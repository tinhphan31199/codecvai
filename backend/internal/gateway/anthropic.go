package gateway

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"codecv/backend/internal/analysis"
	"codecv/backend/internal/model"
)

func (g *Gateway) analyzeAnthropic(ctx context.Context, target upstream, input analysis.Input, req Request) (model.Analysis, error) {
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
	blocks = append(blocks, map[string]any{"type": "text", "text": analysis.BuildPrompt(input)})

	payload := map[string]any{
		"model":       target.modelID,
		"max_tokens":  8192,
		"temperature": 0.2,
		"system":      analysis.SystemInstruction,
		"messages": []map[string]any{
			{"role": "user", "content": blocks},
		},
	}

	raw, err := postJSON(ctx, target, messagesPath(target.baseURL), map[string]string{
		"x-api-key":         target.key,
		"anthropic-version": "2023-06-01",
	}, payload)
	if err != nil {
		return model.Analysis{}, err
	}

	var response struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		StopReason string `json:"stop_reason"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return model.Analysis{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if response.StopReason == "max_tokens" {
		return model.Analysis{}, &Error{
			Code:    "invalid_output",
			Message: "Kết quả phân tích bị cắt do vượt giới hạn đầu ra. Thử lại với CV ngắn hơn.",
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
		return model.Analysis{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về nội dung phân tích. Vui lòng thử lại.", target.provider),
		}
	}

	result, err := analysis.Decode(content, input)
	if err != nil {
		return model.Analysis{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không phải JSON hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	return result, nil
}

func messagesPath(baseURL string) string {
	trimmed := strings.TrimRight(baseURL, "/")
	if strings.HasSuffix(trimmed, "/v1") {
		return "/messages"
	}
	return "/v1/messages"
}

// extractLinksAnthropic đọc link GitHub trực tiếp từ PDF qua document block base64.
func extractLinksAnthropic(ctx context.Context, target upstream, cvFile []byte) ([]string, error) {
	payload := map[string]any{
		"model":       target.modelID,
		"max_tokens":  1024,
		"temperature": 0,
		"messages": []map[string]any{
			{
				"role": "user",
				"content": []map[string]any{
					{
						"type": "document",
						"source": map[string]any{
							"type":       "base64",
							"media_type": "application/pdf",
							"data":       base64.StdEncoding.EncodeToString(cvFile),
						},
					},
					{"type": "text", "text": analysis.LinkPrompt},
				},
			},
		},
	}

	raw, err := postJSON(ctx, target, messagesPath(target.baseURL), map[string]string{
		"x-api-key":         target.key,
		"anthropic-version": "2023-06-01",
	}, payload)
	if err != nil {
		return nil, err
	}

	var response struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		StopReason string `json:"stop_reason"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return nil, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if response.StopReason == "max_tokens" {
		return nil, &Error{
			Code:    "invalid_output",
			Message: "Kết quả đọc link bị cắt do vượt giới hạn đầu ra. Vui lòng thử lại.",
		}
	}

	var text strings.Builder
	for _, block := range response.Content {
		if block.Type == "text" {
			text.WriteString(block.Text)
		}
	}

	var parsed struct {
		Links []string `json:"links"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(text.String())), &parsed); err != nil {
		return nil, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về danh sách link không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}

	urls := make([]string, 0, len(parsed.Links))
	for _, link := range parsed.Links {
		if trimmed := strings.TrimSpace(link); trimmed != "" {
			urls = append(urls, trimmed)
		}
	}
	return urls, nil
}
