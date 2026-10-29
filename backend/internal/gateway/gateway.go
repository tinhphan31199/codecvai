package gateway

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"codecv/backend/internal/analysis"
	"codecv/backend/internal/model"
	"codecv/backend/internal/positions"
	"codecv/backend/internal/store"
)

type Error struct {
	Code    string
	Message string
}

func (e *Error) Error() string {
	return e.Message
}

// ConfigStore là phần store mà gateway cần: model đã chọn và cấu hình provider.
type ConfigStore interface {
	ModelByID(ctx context.Context, id string) (model.AIModel, error)
	ServiceConfig(ctx context.Context, id string) (model.ServiceConfig, error)
}

type Request struct {
	ModelID          string
	CVText           string
	CVFile           []byte
	CVFileName       string
	Repositories     []model.Repository
	GithubContext    string
	Position         positions.Position
	Level            string
	Language         string
	IncludeQuestions bool
}

type Result struct {
	Analysis model.Analysis
	Provider string
}

type Gateway struct {
	configs ConfigStore
}

func New(configs ConfigStore) *Gateway {
	return &Gateway{configs: configs}
}

type upstream struct {
	provider string
	baseURL  string
	key      string
	modelID  string
}

var defaultBaseURLs = map[string]string{
	"google":    "https://generativelanguage.googleapis.com/v1beta",
	"openai":    "https://api.openai.com/v1",
	"anthropic": "https://api.anthropic.com",
}

var httpClient = &http.Client{}

func (g *Gateway) Analyze(ctx context.Context, req Request) (Result, error) {
	modelID := strings.TrimSpace(req.ModelID)
	if modelID == "" {
		return Result{}, &Error{Code: "bad_request", Message: "Chưa chọn model phân tích. Chọn model ở màn hình Phân tích CV."}
	}

	record, err := g.configs.ModelByID(ctx, modelID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return Result{}, &Error{
				Code:    "bad_request",
				Message: fmt.Sprintf("Model phân tích %q không tồn tại. Chọn lại trong Cài đặt → AI models.", modelID),
			}
		}
		return Result{}, &Error{Code: "server_error", Message: "Không đọc được cấu hình model phân tích. Vui lòng thử lại."}
	}
	if !record.Active {
		return Result{}, &Error{
			Code:    "bad_request",
			Message: fmt.Sprintf("Model %q đang tắt. Bật lại trong Cài đặt → AI models hoặc chọn model khác.", modelID),
		}
	}

	providerKey, providerLabel, supported := resolveProvider(record.Provider)
	if !supported {
		return Result{}, &Error{
			Code:    "bad_request",
			Message: fmt.Sprintf("Provider %q chưa được hỗ trợ. Chỉ hỗ trợ Google, OpenAI, Anthropic và Self-hosted.", record.Provider),
		}
	}

	cfg, err := g.configs.ServiceConfig(ctx, providerKey)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		return Result{}, &Error{Code: "server_error", Message: "Không đọc được cấu hình provider. Vui lòng thử lại."}
	}

	display := strings.TrimSpace(cfg.Name)
	if display == "" {
		display = providerLabel
	}

	baseURL := strings.TrimSpace(cfg.BaseURL)
	if baseURL == "" {
		baseURL = defaultBaseURLs[providerKey]
	}
	if baseURL == "" {
		return Result{}, &Error{
			Code:    "bad_request",
			Message: fmt.Sprintf("%s chưa có Base URL. Nhập Base URL trong Cài đặt → Nhà cung cấp.", display),
		}
	}

	key := strings.TrimSpace(cfg.APIKey)
	if key == "" {
		key = strings.TrimSpace(record.APIKey)
	}
	if key == "" {
		return Result{}, &Error{
			Code:    "missing_key",
			Message: fmt.Sprintf("Chưa có API key cho %s. Nhập key trong Cài đặt → Nhà cung cấp.", display),
		}
	}

	input := analysis.Input{
		CVText:           req.CVText,
		Repositories:     req.Repositories,
		GithubContext:    req.GithubContext,
		Position:         req.Position,
		Level:            req.Level,
		Language:         req.Language,
		IncludeQuestions: req.IncludeQuestions,
	}
	target := upstream{provider: display, baseURL: baseURL, key: key, modelID: record.ID}

	var result model.Analysis
	switch providerKey {
	case "google":
		result, err = g.analyzeGoogle(ctx, target, input, req)
	case "openai":
		result, err = g.analyzeOpenAI(ctx, target, input, req, true)
	case "self-hosted":
		result, err = g.analyzeOpenAI(ctx, target, input, req, false)
	case "anthropic":
		result, err = g.analyzeAnthropic(ctx, target, input, req)
	}
	if err != nil {
		return Result{}, err
	}

	return Result{Analysis: result, Provider: display}, nil
}

func resolveProvider(name string) (key, label string, ok bool) {
	normalized := strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(name)), " "))
	switch normalized {
	case "google", "gemini", "google gemini", "google ai":
		return "google", "Google", true
	case "openai", "open ai":
		return "openai", "OpenAI", true
	case "anthropic", "claude":
		return "anthropic", "Anthropic", true
	case "self-hosted", "self hosted", "selfhosted", "local":
		return "self-hosted", "Self-hosted", true
	default:
		return "", "", false
	}
}

func providerHTTPError(target upstream, status int) *Error {
	switch status {
	case http.StatusUnauthorized, http.StatusForbidden:
		return &Error{
			Code:    "upstream_error",
			Message: fmt.Sprintf("%s từ chối API key. Kiểm tra key trong Cài đặt → Nhà cung cấp.", target.provider),
		}
	case http.StatusNotFound:
		return &Error{
			Code:    "upstream_error",
			Message: fmt.Sprintf("Model %s không khả dụng với %s. Kiểm tra mã model hoặc chọn model khác.", target.modelID, target.provider),
		}
	case http.StatusTooManyRequests:
		return &Error{
			Code:    "upstream_error",
			Message: fmt.Sprintf("Đã vượt hạn mức gọi %s. Thử lại sau ít phút.", target.provider),
		}
	case http.StatusBadRequest:
		return &Error{
			Code:    "upstream_error",
			Message: fmt.Sprintf("%s từ chối yêu cầu phân tích. Kiểm tra lại cấu hình provider.", target.provider),
		}
	default:
		return &Error{
			Code:    "upstream_error",
			Message: fmt.Sprintf("%s đang lỗi hoặc quá tải. Vui lòng thử lại.", target.provider),
		}
	}
}
