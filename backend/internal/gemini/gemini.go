package gemini

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"sort"
	"strings"
	"time"

	"codecv/backend/internal/analysis"
	"codecv/backend/internal/model"
)

const (
	requestTimeout   = 90 * time.Second
	uploadTimeout    = 60 * time.Second
	fileReadyTimeout = 30 * time.Second
	filePollInterval = 800 * time.Millisecond
	maxResponseBytes = 8 << 20
)

type Error struct {
	Code    string
	Message string
}

func (e *Error) Error() string {
	return e.Message
}

type Client struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

func New(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  strings.TrimSpace(apiKey),
		http:    &http.Client{},
	}
}

// UploadFile gửi nguyên tệp lên Gemini Files API để phân tích trực tiếp,
// dùng cho PDF scan không có lớp văn bản.
type ModelInfo struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
}

// ListModels trả các model mà key hiện tại dùng được cho generateContent.
func (c *Client) ListModels(ctx context.Context) ([]ModelInfo, error) {
	if c.apiKey == "" {
		return nil, &Error{Code: "missing_key", Message: "Chưa có Gemini API key. Nhập key rồi thử lại."}
	}

	requestCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	request, err := http.NewRequestWithContext(requestCtx, http.MethodGet, c.baseURL+"/models?pageSize=1000", nil)
	if err != nil {
		return nil, &Error{Code: "server_error", Message: "Không dựng được yêu cầu lấy danh sách model."}
	}
	request.Header.Set("x-goog-api-key", c.apiKey)

	response, err := c.http.Do(request)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return nil, &Error{Code: "upstream_error", Message: "Google phản hồi quá lâu. Thử lại sau."}
		}
		return nil, &Error{Code: "upstream_error", Message: "Không kết nối được tới Google API. Kiểm tra mạng của máy chủ."}
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
		fmt.Printf("[gemini] list models error %d: %.300s\n", response.StatusCode, string(detail))
		switch response.StatusCode {
		case http.StatusBadRequest, http.StatusUnauthorized, http.StatusForbidden:
			return nil, &Error{Code: "upstream_error", Message: "Gemini API key không hợp lệ hoặc chưa được cấp quyền."}
		case http.StatusTooManyRequests:
			return nil, &Error{Code: "upstream_error", Message: "Đã vượt hạn mức gọi Google. Thử lại sau ít phút."}
		default:
			return nil, &Error{Code: "upstream_error", Message: "Google đang lỗi hoặc quá tải. Vui lòng thử lại."}
		}
	}

	raw, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
	if err != nil {
		return nil, &Error{Code: "upstream_error", Message: "Không đọc được danh sách model từ Google."}
	}

	var payload struct {
		Models []struct {
			Name                       string   `json:"name"`
			DisplayName                string   `json:"displayName"`
			SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
		} `json:"models"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, &Error{Code: "upstream_error", Message: "Google trả về dữ liệu không hợp lệ."}
	}

	models := make([]ModelInfo, 0, len(payload.Models))
	for _, item := range payload.Models {
		if !supportsGenerateContent(item.SupportedGenerationMethods) {
			continue
		}
		id := strings.TrimPrefix(item.Name, "models/")
		if id == "" {
			continue
		}
		name := item.DisplayName
		if name == "" {
			name = id
		}
		models = append(models, ModelInfo{ID: id, DisplayName: name})
	}
	sort.Slice(models, func(i, j int) bool { return models[i].ID < models[j].ID })
	return models, nil
}

func supportsGenerateContent(methods []string) bool {
	for _, method := range methods {
		if method == "generateContent" {
			return true
		}
	}
	return false
}

func (c *Client) UploadFile(ctx context.Context, displayName, mimeType string, data []byte) (UploadedFile, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	metadataPart, err := writer.CreatePart(textproto.MIMEHeader{"Content-Type": {"application/json; charset=utf-8"}})
	if err != nil {
		return UploadedFile{}, &Error{Code: "server_error", Message: "Không dựng được yêu cầu tải tệp lên Gemini."}
	}
	metadata, err := json.Marshal(map[string]any{"file": map[string]string{"display_name": displayName}})
	if err != nil {
		return UploadedFile{}, &Error{Code: "server_error", Message: "Không dựng được yêu cầu tải tệp lên Gemini."}
	}
	if _, err := metadataPart.Write(metadata); err != nil {
		return UploadedFile{}, &Error{Code: "server_error", Message: "Không dựng được yêu cầu tải tệp lên Gemini."}
	}

	filePart, err := writer.CreatePart(textproto.MIMEHeader{"Content-Type": {mimeType}})
	if err != nil {
		return UploadedFile{}, &Error{Code: "server_error", Message: "Không dựng được yêu cầu tải tệp lên Gemini."}
	}
	if _, err := filePart.Write(data); err != nil {
		return UploadedFile{}, &Error{Code: "server_error", Message: "Không dựng được yêu cầu tải tệp lên Gemini."}
	}
	if err := writer.Close(); err != nil {
		return UploadedFile{}, &Error{Code: "server_error", Message: "Không dựng được yêu cầu tải tệp lên Gemini."}
	}

	uploadCtx, cancel := context.WithTimeout(ctx, uploadTimeout)
	defer cancel()

	request, err := http.NewRequestWithContext(uploadCtx, http.MethodPost, c.uploadEndpoint(), &body)
	if err != nil {
		return UploadedFile{}, &Error{Code: "server_error", Message: "Không dựng được yêu cầu tải tệp lên Gemini."}
	}
	request.Header.Set("Content-Type", "multipart/related; boundary="+writer.Boundary())
	request.Header.Set("x-goog-api-key", c.apiKey)

	response, err := c.http.Do(request)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return UploadedFile{}, &Error{
				Code:    "upstream_error",
				Message: "Tải tệp CV lên Gemini quá lâu. Thử lại với tệp nhỏ hơn.",
			}
		}
		return UploadedFile{}, &Error{
			Code:    "upstream_error",
			Message: "Không kết nối được tới Gemini Files API. Kiểm tra mạng của máy chủ rồi thử lại.",
		}
	}
	defer response.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
	if err != nil {
		return UploadedFile{}, &Error{Code: "invalid_output", Message: "Không đọc được kết quả tải tệp từ Gemini."}
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		fmt.Printf("[analyze-cv] Gemini files error %d: %.300s\n", response.StatusCode, string(raw))
		return UploadedFile{}, &Error{
			Code:    "upstream_error",
			Message: fmt.Sprintf("Gemini từ chối tải tệp CV lên (mã %d). Thử lại sau ít phút.", response.StatusCode),
		}
	}

	var payload struct {
		File fileResource `json:"file"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return UploadedFile{}, &Error{Code: "invalid_output", Message: "Gemini trả về dữ liệu tải tệp không hợp lệ. Vui lòng thử lại."}
	}

	file := payload.File
	if strings.EqualFold(file.State, "PROCESSING") {
		file, err = c.waitFileReady(ctx, file)
		if err != nil {
			return UploadedFile{}, err
		}
	}
	if strings.EqualFold(file.State, "FAILED") {
		return UploadedFile{}, &Error{
			Code:    "invalid_output",
			Message: "Gemini không xử lý được tệp CV. Kiểm tra lại tệp (có thể bị hỏng hoặc đặt mật khẩu) rồi thử lại.",
		}
	}
	if strings.TrimSpace(file.URI) == "" {
		return UploadedFile{}, &Error{Code: "invalid_output", Message: "Gemini không trả về đường dẫn tệp đã tải lên. Vui lòng thử lại."}
	}

	if file.MimeType == "" {
		file.MimeType = mimeType
	}
	if file.Name == "" {
		file.Name = file.URI
	}

	return UploadedFile{Name: file.Name, URI: file.URI, MimeType: file.MimeType}, nil
}

func (c *Client) waitFileReady(ctx context.Context, file fileResource) (fileResource, error) {
	deadline := time.Now().Add(fileReadyTimeout)
	for strings.EqualFold(file.State, "PROCESSING") {
		if time.Now().After(deadline) {
			return fileResource{}, &Error{
				Code:    "upstream_error",
				Message: "Gemini xử lý tệp CV quá lâu. Thử lại với tệp nhỏ hơn.",
			}
		}
		select {
		case <-ctx.Done():
			return fileResource{}, &Error{Code: "upstream_error", Message: "Yêu cầu phân tích đã bị huỷ."}
		case <-time.After(filePollInterval):
		}

		if strings.TrimSpace(file.Name) == "" {
			return file, nil
		}
		polled, err := c.fileStatus(ctx, file.Name)
		if err != nil {
			return fileResource{}, err
		}
		file = polled
	}
	return file, nil
}

func (c *Client) fileStatus(ctx context.Context, name string) (fileResource, error) {
	requestCtx, cancel := context.WithTimeout(ctx, uploadTimeout)
	defer cancel()

	endpoint := c.baseURL + "/" + strings.TrimLeft(name, "/")
	request, err := http.NewRequestWithContext(requestCtx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fileResource{}, &Error{Code: "server_error", Message: "Không dựng được yêu cầu kiểm tra tệp trên Gemini."}
	}
	request.Header.Set("x-goog-api-key", c.apiKey)

	response, err := c.http.Do(request)
	if err != nil {
		return fileResource{}, &Error{
			Code:    "upstream_error",
			Message: "Không kết nối được tới Gemini Files API. Kiểm tra mạng của máy chủ rồi thử lại.",
		}
	}
	defer response.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
	if err != nil {
		return fileResource{}, &Error{Code: "invalid_output", Message: "Không đọc được trạng thái tệp từ Gemini."}
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		fmt.Printf("[analyze-cv] Gemini files status %d: %.300s\n", response.StatusCode, string(raw))
		return fileResource{}, &Error{
			Code:    "upstream_error",
			Message: fmt.Sprintf("Không kiểm tra được trạng thái tệp trên Gemini (mã %d). Thử lại sau ít phút.", response.StatusCode),
		}
	}

	var wrapped struct {
		File fileResource `json:"file"`
	}
	if err := json.Unmarshal(raw, &wrapped); err == nil && wrapped.File.Name != "" {
		return wrapped.File, nil
	}
	var direct fileResource
	if err := json.Unmarshal(raw, &direct); err != nil || direct.Name == "" {
		return fileResource{}, &Error{Code: "invalid_output", Message: "Gemini trả về trạng thái tệp không hợp lệ. Vui lòng thử lại."}
	}
	return direct, nil
}

// uploadEndpoint chuyển base API (.../v1beta) thành endpoint tải tệp (.../upload/v1beta/files).
func (c *Client) uploadEndpoint() string {
	parsed, err := url.Parse(c.baseURL)
	if err != nil {
		return c.baseURL + "/upload/v1beta/files?uploadType=multipart"
	}
	segments := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	if len(segments) == 0 || segments[len(segments)-1] == "" {
		return c.baseURL + "/upload/v1beta/files?uploadType=multipart"
	}
	segments = append(segments[:len(segments)-1], "upload", segments[len(segments)-1], "files")
	parsed.Path = "/" + strings.Join(segments, "/")
	parsed.RawQuery = "uploadType=multipart"
	return parsed.String()
}

type Input struct {
	analysis.Input
	Model string
}

type UploadedFile struct {
	Name     string
	URI      string
	MimeType string
}

type fileResource struct {
	Name        string `json:"name"`
	URI         string `json:"uri"`
	MimeType    string `json:"mimeType"`
	State       string `json:"state"`
	DisplayName string `json:"displayName"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	PromptFeedback struct {
		BlockReason string `json:"blockReason"`
	} `json:"promptFeedback"`
}

func (c *Client) Analyze(ctx context.Context, input Input) (model.Analysis, error) {
	endpoint := c.baseURL + "/models/" + url.PathEscape(input.Model) + ":generateContent"

	parts := make([]map[string]any, 0, 2)
	if input.CVFileURI != "" {
		parts = append(parts, map[string]any{
			"file_data": map[string]any{
				"mime_type": input.CVFileMime,
				"file_uri":  input.CVFileURI,
			},
		})
	}
	parts = append(parts, map[string]any{"text": analysis.BuildPrompt(input.Input)})

	payload := map[string]any{
		"systemInstruction": map[string]any{
			"parts": []map[string]string{{"text": analysis.SystemInstruction}},
		},
		"contents": []map[string]any{
			{
				"role":  "user",
				"parts": parts,
			},
		},
		"generationConfig": map[string]any{
			"temperature":      0.2,
			"topP":             0.9,
			"maxOutputTokens":  8192,
			"responseMimeType": "application/json",
			"responseSchema":   analysis.GeminiSchema(),
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return model.Analysis{}, &Error{Code: "server_error", Message: "Không dựng được yêu cầu phân tích."}
	}

	requestCtx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()

	request, err := http.NewRequestWithContext(requestCtx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return model.Analysis{}, &Error{Code: "server_error", Message: "Không dựng được yêu cầu phân tích."}
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("x-goog-api-key", c.apiKey)

	response, err := c.http.Do(request)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return model.Analysis{}, &Error{
				Code:    "upstream_error",
				Message: "Gemini phản hồi quá lâu (quá 90 giây). Thử lại hoặc chọn Gemini 3.1 Flash Lite.",
			}
		}
		return model.Analysis{}, &Error{
			Code:    "upstream_error",
			Message: "Không kết nối được tới Gemini API. Kiểm tra mạng của máy chủ rồi thử lại.",
		}
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
		fmt.Printf("[analyze-cv] Gemini error %d: %.300s\n", response.StatusCode, string(detail))
		return model.Analysis{}, upstreamError(response.StatusCode, input.Model)
	}

	raw, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
	if err != nil {
		return model.Analysis{}, &Error{Code: "invalid_output", Message: "Không đọc được kết quả từ Gemini."}
	}

	var payloadResponse geminiResponse
	if err := json.Unmarshal(raw, &payloadResponse); err != nil {
		return model.Analysis{}, &Error{Code: "invalid_output", Message: "Gemini trả về dữ liệu không hợp lệ. Vui lòng thử lại."}
	}

	text, err := extractJsonText(payloadResponse)
	if err != nil {
		return model.Analysis{}, err
	}

	analysisResult, err := analysis.Decode(text, input.Input)
	if err != nil {
		return model.Analysis{}, &Error{
			Code:    "invalid_output",
			Message: "Gemini trả về dữ liệu không phải JSON hợp lệ. Vui lòng thử lại.",
		}
	}

	return analysisResult, nil
}

func upstreamError(status int, modelID string) *Error {
	switch status {
	case http.StatusUnauthorized, http.StatusForbidden:
		return &Error{
			Code:    "upstream_error",
			Message: "Google từ chối API key. Kiểm tra key ở Cài đặt → Nhà cung cấp hoặc key riêng của model.",
		}
	case http.StatusNotFound:
		return &Error{
			Code:    "upstream_error",
			Message: fmt.Sprintf("Model %s không khả dụng với API key hiện tại. Chọn model khác hoặc kiểm tra quyền truy cập.", modelID),
		}
	case http.StatusTooManyRequests:
		return &Error{
			Code:    "upstream_error",
			Message: "Đã vượt hạn mức gọi Gemini. Thử lại sau ít phút hoặc dùng Gemini 3.1 Flash Lite.",
		}
	case http.StatusBadRequest:
		return &Error{
			Code:    "upstream_error",
			Message: "Gemini từ chối yêu cầu. Kiểm tra API key và thử lại với model 3.1 Flash Lite.",
		}
	default:
		return &Error{
			Code:    "upstream_error",
			Message: "Gemini đang lỗi hoặc quá tải. Vui lòng thử lại.",
		}
	}
}

func extractJsonText(payload geminiResponse) (string, error) {
	if len(payload.Candidates) > 0 {
		var text strings.Builder
		for _, part := range payload.Candidates[0].Content.Parts {
			text.WriteString(part.Text)
		}
		if strings.TrimSpace(text.String()) != "" {
			return text.String(), nil
		}
	}

	if payload.PromptFeedback.BlockReason != "" {
		return "", &Error{
			Code:    "invalid_output",
			Message: "Gemini từ chối nội dung CV theo bộ lọc an toàn. Kiểm tra lại tệp và thử lại.",
		}
	}
	if len(payload.Candidates) > 0 && payload.Candidates[0].FinishReason == "MAX_TOKENS" {
		return "", &Error{
			Code:    "invalid_output",
			Message: "Kết quả phân tích bị cắt do vượt giới hạn đầu ra. Thử lại với CV ngắn hơn.",
		}
	}
	return "", &Error{
		Code:    "invalid_output",
		Message: "Gemini không trả về nội dung phân tích. Vui lòng thử lại.",
	}
}
