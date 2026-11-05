package gateway

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"codecv/backend/internal/analysis"
	"codecv/backend/internal/gemini"
	"codecv/backend/internal/model"
)

type MarketRequest struct {
	ModelID    string
	CVText     string
	CVFile     []byte
	CVFileName string
	Language   string
	Levels     []string
}

type MarketResult struct {
	Profile  model.MarketProfile
	Provider string
}

// Categorize reads a CV and returns the profile the marketplace stores.
func (g *Gateway) Categorize(ctx context.Context, req MarketRequest) (MarketResult, error) {
	if strings.TrimSpace(req.CVText) == "" && len(req.CVFile) == 0 {
		return MarketResult{}, &Error{Code: "no_text", Message: "Không đọc được nội dung CV. Kiểm tra lại định dạng tệp."}
	}

	providerKey, target, err := g.resolveUpstream(ctx, req.ModelID)
	if err != nil {
		return MarketResult{}, err
	}

	input := analysis.MarketInput{
		CVText:   req.CVText,
		Language: req.Language,
		Levels:   req.Levels,
	}

	var profile model.MarketProfile
	switch providerKey {
	case "google":
		profile, err = g.categorizeGoogle(ctx, target, input, req)
	case "openai":
		profile, err = g.categorizeOpenAI(ctx, target, input, req, true)
	case "self-hosted":
		profile, err = g.categorizeOpenAI(ctx, target, input, req, false)
	case "anthropic":
		profile, err = g.categorizeAnthropic(ctx, target, input, req)
	}
	if err != nil {
		return MarketResult{}, err
	}

	return MarketResult{Profile: profile, Provider: target.provider}, nil
}

func (g *Gateway) categorizeGoogle(ctx context.Context, target upstream, input analysis.MarketInput, req MarketRequest) (model.MarketProfile, error) {
	client := gemini.New(target.baseURL, target.key)

	if len(req.CVFile) > 0 {
		name := strings.TrimSpace(req.CVFileName)
		if name == "" {
			name = "cv.pdf"
		}
		uploaded, err := client.UploadFile(ctx, name, "application/pdf", req.CVFile)
		if err != nil {
			if len([]rune(strings.TrimSpace(req.CVText))) == 0 {
				return model.MarketProfile{}, fromGeminiError(err)
			}
			log.Printf("[gateway] %s upload failed, using extracted text: %v", target.provider, err)
		} else {
			input.CVFileURI = uploaded.URI
			input.CVFileMime = uploaded.MimeType
			input.CVAttached = true
		}
	}

	profile, err := client.Categorize(ctx, input, target.modelID)
	if err != nil {
		return model.MarketProfile{}, fromGeminiError(err)
	}
	return profile, nil
}

func (g *Gateway) categorizeOpenAI(ctx context.Context, target upstream, input analysis.MarketInput, req MarketRequest, structured bool) (model.MarketProfile, error) {
	if len(req.CVFile) > 0 && strings.TrimSpace(req.CVText) == "" {
		return model.MarketProfile{}, &Error{
			Code:    "no_text",
			Message: fmt.Sprintf("%s chỉ đọc được văn bản trích xuất, nhưng CV này là PDF scan không có lớp chữ. Chọn model Google để đọc trực tiếp tệp.", target.provider),
		}
	}

	format := map[string]any{"type": "json_object"}
	if structured {
		format = map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "cv_market_profile",
				"strict": true,
				"schema": analysis.StrictMarketSchema(),
			},
		}
	}

	payload := map[string]any{
		"model":       target.modelID,
		"temperature": 0.2,
		"max_tokens":  2048,
		"messages": []map[string]string{
			{"role": "system", "content": analysis.MarketSystemInstruction},
			{"role": "user", "content": analysis.BuildMarketPrompt(input)},
		},
		"response_format": format,
	}

	raw, err := postJSON(ctx, target, "/chat/completions", map[string]string{
		"Authorization": "Bearer " + target.key,
	}, payload)
	if err != nil {
		return model.MarketProfile{}, err
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
		return model.MarketProfile{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if len(response.Choices) == 0 {
		return model.MarketProfile{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về kết quả phân loại. Vui lòng thử lại.", target.provider),
		}
	}
	choice := response.Choices[0]
	if choice.FinishReason == "length" {
		return model.MarketProfile{}, &Error{
			Code:    "invalid_output",
			Message: "Kết quả phân loại bị cắt do vượt giới hạn đầu ra. Thử lại với CV ngắn hơn.",
		}
	}
	content := strings.TrimSpace(choice.Message.Content)
	if content == "" {
		return model.MarketProfile{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về kết quả phân loại. Vui lòng thử lại.", target.provider),
		}
	}

	profile, err := analysis.DecodeMarket(content, input.Levels)
	if err != nil {
		return model.MarketProfile{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không phải JSON hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	return profile, nil
}

func (g *Gateway) categorizeAnthropic(ctx context.Context, target upstream, input analysis.MarketInput, req MarketRequest) (model.MarketProfile, error) {
	blocks := make([]map[string]any, 0, 2)
	if len(req.CVFile) > 0 {
		blocks = append(blocks, map[string]any{
			"type": "document",
			"source": map[string]any{
				"type":       "base64",
				"media_type": "application/pdf",
				"data":       base64.StdEncoding.EncodeToString(req.CVFile),
			},
		})
		input.CVAttached = true
	}
	blocks = append(blocks, map[string]any{"type": "text", "text": analysis.BuildMarketPrompt(input)})

	payload := map[string]any{
		"model":       target.modelID,
		"max_tokens":  2048,
		"temperature": 0.2,
		"system":      analysis.MarketSystemInstruction,
		"messages": []map[string]any{
			{"role": "user", "content": blocks},
		},
	}

	raw, err := postJSON(ctx, target, messagesPath(target.baseURL), map[string]string{
		"x-api-key":         target.key,
		"anthropic-version": "2023-06-01",
	}, payload)
	if err != nil {
		return model.MarketProfile{}, err
	}

	var response struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		StopReason string `json:"stop_reason"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return model.MarketProfile{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if response.StopReason == "max_tokens" {
		return model.MarketProfile{}, &Error{
			Code:    "invalid_output",
			Message: "Kết quả phân loại bị cắt do vượt giới hạn đầu ra. Thử lại với CV ngắn hơn.",
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
		return model.MarketProfile{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về kết quả phân loại. Vui lòng thử lại.", target.provider),
		}
	}

	profile, err := analysis.DecodeMarket(content, input.Levels)
	if err != nil {
		return model.MarketProfile{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không phải JSON hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	return profile, nil
}
