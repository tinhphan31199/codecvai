package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"codecv/backend/internal/gemini"
	"codecv/backend/internal/model"
	"codecv/backend/internal/reporeview"
)

// ReviewRepository asks the configured model to read a sample of the scanned
// repository and returns validated findings tied to real file lines.
func (g *Gateway) ReviewRepository(ctx context.Context, modelID string, in reporeview.Input) ([]model.Finding, error) {
	providerKey, target, err := g.resolveUpstream(ctx, modelID)
	if err != nil {
		return nil, err
	}
	system := reporeview.SystemInstruction
	prompt := reporeview.BuildPrompt(in)

	var raw string
	switch providerKey {
	case "google":
		client := gemini.New(target.baseURL, target.key)
		raw, err = client.GenerateJSON(ctx, target.modelID, system, prompt, reporeview.GeminiSchema(), 4096)
		if err != nil {
			return nil, fromGeminiError(err)
		}
	case "openai", "self-hosted":
		raw, err = reviewChat(ctx, target, system, prompt, providerKey == "openai")
	case "anthropic":
		raw, err = reviewAnthropic(ctx, target, system, prompt)
	default:
		return nil, &Error{
			Code:    "bad_request",
			Message: fmt.Sprintf("Provider %q chưa hỗ trợ đọc repository.", target.provider),
		}
	}
	if err != nil {
		return nil, err
	}

	findings, decodeErr := reporeview.Decode(raw, in.Files)
	if decodeErr != nil {
		return nil, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về danh sách phát hiện không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	return findings, nil
}

// ChatRepository answers one question about the selected repository using the
// stored evidence and the conversation so far.
func (g *Gateway) ChatRepository(ctx context.Context, modelID string, in reporeview.ChatInput) (string, error) {
	providerKey, target, err := g.resolveUpstream(ctx, modelID)
	if err != nil {
		return "", err
	}
	system := reporeview.ChatSystemInstruction
	prompt := reporeview.BuildChatPrompt(in)

	var answer string
	switch providerKey {
	case "google":
		client := gemini.New(target.baseURL, target.key)
		answer, err = client.GenerateText(ctx, target.modelID, system, prompt, 2048)
		if err != nil {
			return "", fromGeminiError(err)
		}
	case "openai", "self-hosted":
		answer, err = chatOpenAI(ctx, target, system, prompt)
	case "anthropic":
		answer, err = chatAnthropic(ctx, target, system, prompt)
	default:
		return "", &Error{
			Code:    "bad_request",
			Message: fmt.Sprintf("Provider %q chưa hỗ trợ hỏi đáp repository.", target.provider),
		}
	}
	if err != nil {
		return "", err
	}

	answer = strings.TrimSpace(answer)
	if answer == "" {
		return "", &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả lời nội dung nào. Vui lòng thử lại.", target.provider),
		}
	}
	return answer, nil
}

func chatOpenAI(ctx context.Context, target upstream, system, prompt string) (string, error) {
	payload := map[string]any{
		"model":       target.modelID,
		"temperature": 0.3,
		"max_tokens":  2048,
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": prompt},
		},
	}

	raw, err := postJSON(ctx, target, "/chat/completions", map[string]string{
		"Authorization": "Bearer " + target.key,
	}, payload)
	if err != nil {
		return "", err
	}

	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &response); err != nil || len(response.Choices) == 0 {
		return "", &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if response.Choices[0].FinishReason == "length" {
		return "", &Error{
			Code:    "invalid_output",
			Message: "Câu trả lời bị cắt do vượt giới hạn đầu ra. Hỏi ngắn hơn hoặc thử lại.",
		}
	}
	return strings.TrimSpace(response.Choices[0].Message.Content), nil
}

func chatAnthropic(ctx context.Context, target upstream, system, prompt string) (string, error) {
	payload := map[string]any{
		"model":       target.modelID,
		"max_tokens":  2048,
		"temperature": 0.3,
		"system":      system,
		"messages": []map[string]any{
			{"role": "user", "content": []map[string]any{{"type": "text", "text": prompt}}},
		},
	}

	raw, err := postJSON(ctx, target, messagesPath(target.baseURL), map[string]string{
		"x-api-key":         target.key,
		"anthropic-version": "2023-06-01",
	}, payload)
	if err != nil {
		return "", err
	}

	var response struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		StopReason string `json:"stop_reason"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return "", &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if response.StopReason == "max_tokens" {
		return "", &Error{
			Code:    "invalid_output",
			Message: "Câu trả lời bị cắt do vượt giới hạn đầu ra. Hỏi ngắn hơn hoặc thử lại.",
		}
	}

	var text strings.Builder
	for _, block := range response.Content {
		if block.Type == "text" {
			text.WriteString(block.Text)
		}
	}
	return strings.TrimSpace(text.String()), nil
}

func reviewChat(ctx context.Context, target upstream, system, prompt string, structured bool) (string, error) {
	payload := map[string]any{
		"model":       target.modelID,
		"temperature": 0.2,
		"max_tokens":  4096,
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": prompt},
		},
	}
	if structured {
		payload["response_format"] = map[string]any{"type": "json_object"}
	}

	raw, err := postJSON(ctx, target, "/chat/completions", map[string]string{
		"Authorization": "Bearer " + target.key,
	}, payload)
	if err != nil {
		return "", err
	}

	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &response); err != nil || len(response.Choices) == 0 {
		return "", &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if response.Choices[0].FinishReason == "length" {
		return "", &Error{
			Code:    "invalid_output",
			Message: "Kết quả đọc repository bị cắt do vượt giới hạn đầu ra. Thử lại sau.",
		}
	}
	content := strings.TrimSpace(response.Choices[0].Message.Content)
	if content == "" {
		return "", &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về phát hiện nào. Vui lòng thử lại.", target.provider),
		}
	}
	return content, nil
}

func reviewAnthropic(ctx context.Context, target upstream, system, prompt string) (string, error) {
	payload := map[string]any{
		"model":       target.modelID,
		"max_tokens":  4096,
		"temperature": 0.2,
		"system":      system,
		"messages": []map[string]any{
			{"role": "user", "content": []map[string]any{{"type": "text", "text": prompt}}},
		},
	}

	raw, err := postJSON(ctx, target, messagesPath(target.baseURL), map[string]string{
		"x-api-key":         target.key,
		"anthropic-version": "2023-06-01",
	}, payload)
	if err != nil {
		return "", err
	}

	var response struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		StopReason string `json:"stop_reason"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return "", &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if response.StopReason == "max_tokens" {
		return "", &Error{
			Code:    "invalid_output",
			Message: "Kết quả đọc repository bị cắt do vượt giới hạn đầu ra. Thử lại sau.",
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
		return "", &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về phát hiện nào. Vui lòng thử lại.", target.provider),
		}
	}
	return content, nil
}
