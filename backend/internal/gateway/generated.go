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

type GenerateRequest struct {
	ModelID  string
	Builder  model.BuilderInput
	Language string
	Template string
	Accent   string
	Feedback string
}

type GenerateResult struct {
	Draft    model.GeneratedCVDraft
	Provider string
}

// Generate viết CV từ thông tin người dùng nhập. Model trả JSON nội dung và
// slug template/accent; lựa chọn người dùng khoá cứng sẽ được áp lại sau.
func (g *Gateway) Generate(ctx context.Context, req GenerateRequest) (GenerateResult, error) {
	providerKey, target, err := g.resolveUpstream(ctx, req.ModelID)
	if err != nil {
		return GenerateResult{}, err
	}

	input := analysis.GenerateInput{
		Builder:  req.Builder,
		Language: req.Language,
		Template: req.Template,
		Accent:   req.Accent,
		Feedback: req.Feedback,
	}

	var draft model.GeneratedCVDraft
	switch providerKey {
	case "google":
		draft, err = g.generateGoogle(ctx, target, input)
	case "openai":
		draft, err = g.generateOpenAI(ctx, target, input, true)
	case "self-hosted":
		draft, err = g.generateOpenAI(ctx, target, input, false)
	case "anthropic":
		draft, err = g.generateAnthropic(ctx, target, input)
	}
	if err != nil {
		return GenerateResult{}, err
	}

	return GenerateResult{
		Draft:    applyGeneratedPreferences(draft, req.Template, req.Accent),
		Provider: target.provider,
	}, nil
}

func (g *Gateway) generateGoogle(ctx context.Context, target upstream, input analysis.GenerateInput) (model.GeneratedCVDraft, error) {
	client := gemini.New(target.baseURL, target.key)
	draft, err := client.Generate(ctx, input, target.modelID)
	if err != nil {
		return model.GeneratedCVDraft{}, fromGeminiError(err)
	}
	return draft, nil
}

func (g *Gateway) generateOpenAI(ctx context.Context, target upstream, input analysis.GenerateInput, structured bool) (model.GeneratedCVDraft, error) {
	format := map[string]any{"type": "json_object"}
	if structured {
		format = map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "generated_cv",
				"strict": true,
				"schema": analysis.StrictGeneratedSchema(),
			},
		}
	}

	payload := map[string]any{
		"model":       target.modelID,
		"temperature": 0.4,
		"max_tokens":  8192,
		"messages": []map[string]string{
			{"role": "system", "content": analysis.GeneratedSystemInstruction},
			{"role": "user", "content": analysis.BuildGeneratedPrompt(input)},
		},
		"response_format": format,
	}

	raw, err := postJSON(ctx, target, "/chat/completions", map[string]string{
		"Authorization": "Bearer " + target.key,
	}, payload)
	if err != nil {
		return model.GeneratedCVDraft{}, err
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
		return model.GeneratedCVDraft{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if len(response.Choices) == 0 {
		return model.GeneratedCVDraft{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về nội dung CV. Vui lòng thử lại.", target.provider),
		}
	}
	choice := response.Choices[0]
	if choice.FinishReason == "length" {
		return model.GeneratedCVDraft{}, &Error{
			Code:    "invalid_output",
			Message: "Kết quả tạo CV bị cắt do vượt giới hạn đầu ra. Rút gọn bớt kinh nghiệm hoặc mô tả rồi thử lại.",
		}
	}
	content := strings.TrimSpace(choice.Message.Content)
	if content == "" {
		return model.GeneratedCVDraft{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về nội dung CV. Vui lòng thử lại.", target.provider),
		}
	}

	draft, err := analysis.DecodeGenerated(content)
	if err != nil {
		return model.GeneratedCVDraft{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về nội dung CV không phải JSON hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	return draft, nil
}

func (g *Gateway) generateAnthropic(ctx context.Context, target upstream, input analysis.GenerateInput) (model.GeneratedCVDraft, error) {
	payload := map[string]any{
		"model":       target.modelID,
		"max_tokens":  8192,
		"temperature": 0.4,
		"system":      analysis.GeneratedSystemInstruction,
		"messages": []map[string]any{
			{"role": "user", "content": analysis.BuildGeneratedPrompt(input)},
		},
	}

	raw, err := postJSON(ctx, target, messagesPath(target.baseURL), map[string]string{
		"x-api-key":         target.key,
		"anthropic-version": "2023-06-01",
	}, payload)
	if err != nil {
		return model.GeneratedCVDraft{}, err
	}

	var response struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		StopReason string `json:"stop_reason"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return model.GeneratedCVDraft{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if response.StopReason == "max_tokens" {
		return model.GeneratedCVDraft{}, &Error{
			Code:    "invalid_output",
			Message: "Kết quả tạo CV bị cắt do vượt giới hạn đầu ra. Rút gọn bớt kinh nghiệm hoặc mô tả rồi thử lại.",
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
		return model.GeneratedCVDraft{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về nội dung CV. Vui lòng thử lại.", target.provider),
		}
	}

	draft, err := analysis.DecodeGenerated(content)
	if err != nil {
		return model.GeneratedCVDraft{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về nội dung CV không phải JSON hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	return draft, nil
}

func applyGeneratedPreferences(draft model.GeneratedCVDraft, template, accent string) model.GeneratedCVDraft {
	if analysis.GeneratedTemplateValid(template) {
		draft.Template = analysis.NormalizeGeneratedTemplate(template)
	}
	if analysis.GeneratedAccentValid(accent) {
		draft.Accent = analysis.NormalizeGeneratedAccent(accent)
	}
	return draft
}
