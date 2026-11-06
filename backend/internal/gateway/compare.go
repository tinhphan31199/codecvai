package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"codecv/backend/internal/analysis"
	"codecv/backend/internal/gemini"
	"codecv/backend/internal/model"
)

type CompareRequest struct {
	ModelID  string
	Language string
	Mine     model.CompareCV
	Others   []model.CompareCV
}

type CompareResult struct {
	Comparison model.CVComparison
	Provider   string
}

// Compare asks the selected model to rank the user's CV against market CVs.
func (g *Gateway) Compare(ctx context.Context, req CompareRequest) (CompareResult, error) {
	providerKey, target, err := g.resolveUpstream(ctx, req.ModelID)
	if err != nil {
		return CompareResult{}, err
	}

	input := analysis.CompareInput{
		Language: req.Language,
		Mine:     req.Mine,
		Others:   req.Others,
	}
	ids := make([]string, 0, len(req.Others)+1)
	ids = append(ids, req.Mine.ID)
	for _, other := range req.Others {
		ids = append(ids, other.ID)
	}

	var comparison model.CVComparison
	switch providerKey {
	case "google":
		comparison, err = compareGoogle(ctx, target, input, ids)
	case "openai":
		comparison, err = compareOpenAI(ctx, target, input, ids, true)
	case "self-hosted":
		comparison, err = compareOpenAI(ctx, target, input, ids, false)
	case "anthropic":
		comparison, err = compareAnthropic(ctx, target, input, ids)
	}
	if err != nil {
		return CompareResult{}, err
	}

	return CompareResult{Comparison: comparison, Provider: target.provider}, nil
}

func compareGoogle(ctx context.Context, target upstream, input analysis.CompareInput, ids []string) (model.CVComparison, error) {
	client := gemini.New(target.baseURL, target.key)
	text, err := client.GenerateJSON(
		ctx,
		target.modelID,
		analysis.CompareSystemInstruction,
		analysis.BuildComparePrompt(input),
		analysis.GeminiCompareSchema(),
		2048,
	)
	if err != nil {
		return model.CVComparison{}, fromGeminiError(err)
	}
	return decodeComparison(target, text, ids)
}

func compareOpenAI(ctx context.Context, target upstream, input analysis.CompareInput, ids []string, structured bool) (model.CVComparison, error) {
	format := map[string]any{"type": "json_object"}
	if structured {
		format = map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "cv_comparison",
				"strict": true,
				"schema": analysis.StrictCompareSchema(),
			},
		}
	}

	payload := map[string]any{
		"model":       target.modelID,
		"temperature": 0.3,
		"max_tokens":  2048,
		"messages": []map[string]string{
			{"role": "system", "content": analysis.CompareSystemInstruction},
			{"role": "user", "content": analysis.BuildComparePrompt(input)},
		},
		"response_format": format,
	}

	raw, err := postJSON(ctx, target, "/chat/completions", map[string]string{
		"Authorization": "Bearer " + target.key,
	}, payload)
	if err != nil {
		return model.CVComparison{}, err
	}

	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return model.CVComparison{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if len(response.Choices) == 0 {
		return model.CVComparison{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về kết quả so sánh. Vui lòng thử lại.", target.provider),
		}
	}
	choice := response.Choices[0]
	if choice.FinishReason == "length" {
		return model.CVComparison{}, &Error{
			Code:    "invalid_output",
			Message: "Kết quả so sánh bị cắt do vượt giới hạn đầu ra. Bớt CV trong danh sách rồi thử lại.",
		}
	}
	content := strings.TrimSpace(choice.Message.Content)
	if content == "" {
		return model.CVComparison{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về kết quả so sánh. Vui lòng thử lại.", target.provider),
		}
	}
	return decodeComparison(target, content, ids)
}

func compareAnthropic(ctx context.Context, target upstream, input analysis.CompareInput, ids []string) (model.CVComparison, error) {
	payload := map[string]any{
		"model":       target.modelID,
		"max_tokens":  2048,
		"temperature": 0.3,
		"system":      analysis.CompareSystemInstruction,
		"messages": []map[string]any{
			{"role": "user", "content": analysis.BuildComparePrompt(input)},
		},
	}

	raw, err := postJSON(ctx, target, messagesPath(target.baseURL), map[string]string{
		"x-api-key":         target.key,
		"anthropic-version": "2023-06-01",
	}, payload)
	if err != nil {
		return model.CVComparison{}, err
	}

	var response struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		StopReason string `json:"stop_reason"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return model.CVComparison{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if response.StopReason == "max_tokens" {
		return model.CVComparison{}, &Error{
			Code:    "invalid_output",
			Message: "Kết quả so sánh bị cắt do vượt giới hạn đầu ra. Bớt CV trong danh sách rồi thử lại.",
		}
	}

	var text strings.Builder
	for _, block := range response.Content {
		if block.Type == "text" {
			text.WriteString(block.Text)
		}
	}
	content := strings.TrimSpace(text.String())
	if content == "" {
		return model.CVComparison{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về kết quả so sánh. Vui lòng thử lại.", target.provider),
		}
	}
	return decodeComparison(target, content, ids)
}

func decodeComparison(target upstream, text string, ids []string) (model.CVComparison, error) {
	comparison, err := analysis.DecodeComparison(text, ids)
	if err != nil {
		return model.CVComparison{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về nhận xét không phải JSON hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if comparison.Summary == "" &&
		len(comparison.BestReasons) == 0 &&
		len(comparison.MyStrengths) == 0 &&
		len(comparison.MyGaps) == 0 &&
		len(comparison.MarketHighlights) == 0 {
		return model.CVComparison{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về nhận xét rỗng. Vui lòng thử lại.", target.provider),
		}
	}
	return comparison, nil
}
