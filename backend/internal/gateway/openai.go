package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"codecv/backend/internal/analysis"
	"codecv/backend/internal/model"
)

const (
	requestTimeout   = 90 * time.Second
	maxResponseBytes = 8 << 20
)

func (g *Gateway) analyzeOpenAI(ctx context.Context, target upstream, input analysis.Input, req Request, structured bool) (model.Analysis, error) {
	if len(req.CVFile) > 0 && strings.TrimSpace(req.CVText) == "" {
		return model.Analysis{}, &Error{
			Code:    "no_text",
			Message: fmt.Sprintf("%s chỉ đọc được văn bản trích xuất, nhưng CV này là PDF scan không có lớp chữ. Chọn model Google để đọc trực tiếp tệp.", target.provider),
		}
	}

	format := map[string]any{"type": "json_object"}
	if structured {
		format = map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "cv_analysis",
				"strict": true,
				"schema": analysis.StrictSchema(),
			},
		}
	}

	payload := map[string]any{
		"model":       target.modelID,
		"temperature": 0.2,
		"max_tokens":  8192,
		"messages": []map[string]string{
			{"role": "system", "content": analysis.SystemInstruction},
			{"role": "user", "content": analysis.BuildPrompt(input)},
		},
		"response_format": format,
	}

	raw, err := postJSON(ctx, target, "/chat/completions", map[string]string{
		"Authorization": "Bearer " + target.key,
	}, payload)
	if err != nil {
		return model.Analysis{}, err
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
		return model.Analysis{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s trả về dữ liệu không hợp lệ. Vui lòng thử lại.", target.provider),
		}
	}
	if len(response.Choices) == 0 {
		return model.Analysis{}, &Error{
			Code:    "invalid_output",
			Message: fmt.Sprintf("%s không trả về nội dung phân tích. Vui lòng thử lại.", target.provider),
		}
	}
	choice := response.Choices[0]
	if choice.FinishReason == "length" {
		return model.Analysis{}, &Error{
			Code:    "invalid_output",
			Message: "Kết quả phân tích bị cắt do vượt giới hạn đầu ra. Thử lại với CV ngắn hơn.",
		}
	}
	content := strings.TrimSpace(choice.Message.Content)
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

func postJSON(ctx context.Context, target upstream, path string, headers map[string]string, payload any) ([]byte, error) {
	endpoint := strings.TrimRight(target.baseURL, "/") + path

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, &Error{Code: "server_error", Message: "Không dựng được yêu cầu phân tích."}
	}

	requestCtx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()

	request, err := http.NewRequestWithContext(requestCtx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, &Error{Code: "server_error", Message: "Không dựng được yêu cầu phân tích."}
	}
	request.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		request.Header.Set(key, value)
	}

	response, err := httpClient.Do(request)
	if err != nil {
		if ctx.Err() != nil {
			return nil, &Error{Code: "upstream_error", Message: "Yêu cầu phân tích đã bị huỷ."}
		}
		return nil, &Error{
			Code:    "upstream_error",
			Message: fmt.Sprintf("Không kết nối được tới %s. Kiểm tra mạng của máy chủ và Base URL.", target.provider),
		}
	}
	defer response.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
	if err != nil {
		return nil, &Error{Code: "invalid_output", Message: "Không đọc được kết quả từ provider."}
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		fmt.Printf("[gateway] %s error %d: %.300s\n", endpoint, response.StatusCode, string(raw))
		return nil, providerHTTPError(target, response.StatusCode)
	}
	return raw, nil
}
