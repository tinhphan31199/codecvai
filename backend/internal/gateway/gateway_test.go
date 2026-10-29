package gateway

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"codecv/backend/internal/analysis"
	"codecv/backend/internal/model"
	"codecv/backend/internal/positions"
	"codecv/backend/internal/store"
)

type fakeStore struct {
	models  map[string]model.AIModel
	configs map[string]model.ServiceConfig
}

func (f *fakeStore) ModelByID(_ context.Context, id string) (model.AIModel, error) {
	record, ok := f.models[id]
	if !ok {
		return model.AIModel{}, store.ErrNotFound
	}
	return record, nil
}

func (f *fakeStore) ServiceConfig(_ context.Context, id string) (model.ServiceConfig, error) {
	cfg, ok := f.configs[id]
	if !ok {
		return model.ServiceConfig{}, store.ErrNotFound
	}
	return cfg, nil
}

const analysisJSON = `{"candidate":{"name":"CV Bot"},"summary":"ok","criteria":[],"strengths":[],"gaps":[],"questions":[]}`

type capturedRequest struct {
	path    string
	headers http.Header
	body    map[string]any
}

type fakeProvider struct {
	requests []capturedRequest
	server   *httptest.Server
	status   int
	payload  string
}

func newFakeProvider(t *testing.T) *fakeProvider {
	t.Helper()

	fake := &fakeProvider{status: http.StatusOK}
	fake.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		fake.requests = append(fake.requests, capturedRequest{path: r.URL.Path, headers: r.Header.Clone(), body: body})

		if fake.status != http.StatusOK {
			w.WriteHeader(fake.status)
			_, _ = w.Write([]byte(`{"error":{"message":"boom"}}`))
			return
		}

		switch {
		case strings.HasSuffix(r.URL.Path, ":generateContent"):
			if fake.payload != "" {
				_, _ = w.Write([]byte(fake.payload))
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"candidates": []any{map[string]any{
					"content":      map[string]any{"parts": []any{map[string]any{"text": analysisJSON}}},
					"finishReason": "STOP",
				}},
			})
		case strings.HasSuffix(r.URL.Path, "/upload/v1beta/files"):
			_ = json.NewEncoder(w).Encode(map[string]any{
				"file": map[string]any{
					"name":     "files/abc123",
					"uri":      "https://example.test/v1beta/files/abc123",
					"mimeType": "application/pdf",
					"state":    "ACTIVE",
				},
			})
		case r.URL.Path == "/v1/chat/completions":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"choices": []any{map[string]any{
					"message":       map[string]any{"content": analysisJSON},
					"finish_reason": "stop",
				}},
			})
		case r.URL.Path == "/v1/messages":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"content":     []any{map[string]any{"type": "text", "text": analysisJSON}},
				"stop_reason": "end_turn",
			})
		default:
			t.Errorf("unexpected provider path: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(fake.server.Close)

	return fake
}

func testPosition(t *testing.T) positions.Position {
	t.Helper()

	position, ok := positions.Find("be-dotnet")
	if !ok {
		t.Fatal("be-dotnet position is missing")
	}
	return position
}

func testRequest(t *testing.T, modelID string) Request {
	t.Helper()

	return Request{
		ModelID:          modelID,
		CVText:           "Backend engineer with 8 years of experience in Go.",
		Repositories:     []model.Repository{},
		Position:         testPosition(t),
		Level:            "Senior",
		Language:         "vi",
		IncludeQuestions: true,
	}
}

func newProviderConfigs(fake *fakeProvider) map[string]model.ServiceConfig {
	return map[string]model.ServiceConfig{
		"google": {
			ID: "google", Kind: "ai", Name: "Google",
			BaseURL: fake.server.URL + "/v1beta", APIKey: "provider-google-key",
		},
		"openai": {
			ID: "openai", Kind: "ai", Name: "OpenAI",
			BaseURL: fake.server.URL + "/v1", APIKey: "provider-openai-key",
		},
		"anthropic": {
			ID: "anthropic", Kind: "ai", Name: "Anthropic",
			BaseURL: fake.server.URL, APIKey: "provider-anthropic-key",
		},
		"self-hosted": {
			ID: "self-hosted", Kind: "ai", Name: "Self-hosted",
			BaseURL: fake.server.URL + "/v1", APIKey: "provider-local-key",
		},
	}
}

func newTestGateway(fake *fakeProvider, records ...model.AIModel) *Gateway {
	models := map[string]model.AIModel{}
	for _, record := range records {
		models[record.ID] = record
	}
	return New(&fakeStore{models: models, configs: newProviderConfigs(fake)})
}

func expectError(t *testing.T, err error, code string) *Error {
	t.Helper()

	if err == nil {
		t.Fatalf("expected error with code %s", code)
	}
	var gatewayErr *Error
	if !errors.As(err, &gatewayErr) {
		t.Fatalf("expected *Error, got %T: %v", err, err)
	}
	if gatewayErr.Code != code {
		t.Fatalf("expected code %s, got %s (%s)", code, gatewayErr.Code, gatewayErr.Message)
	}
	return gatewayErr
}

func TestAnalyzeRoutesModelToItsProvider(t *testing.T) {
	cases := []struct {
		provider  string
		modelID   string
		wantPath  string
		wantKey   string
		checkAuth func(t *testing.T, headers http.Header, key string)
	}{
		{
			provider: "Google", modelID: "gemini-3.5-flash-lite",
			wantPath: "/v1beta/models/gemini-3.5-flash-lite:generateContent",
			wantKey:  "provider-google-key",
			checkAuth: func(t *testing.T, headers http.Header, key string) {
				if got := headers.Get("x-goog-api-key"); got != key {
					t.Fatalf("unexpected google key: %q", got)
				}
			},
		},
		{
			provider: "OpenAI", modelID: "gpt-4o-mini",
			wantPath: "/v1/chat/completions",
			wantKey:  "provider-openai-key",
			checkAuth: func(t *testing.T, headers http.Header, key string) {
				if got := headers.Get("Authorization"); got != "Bearer "+key {
					t.Fatalf("unexpected bearer token: %q", got)
				}
			},
		},
		{
			provider: "Anthropic", modelID: "claude-sonnet-4-5",
			wantPath: "/v1/messages",
			wantKey:  "provider-anthropic-key",
			checkAuth: func(t *testing.T, headers http.Header, key string) {
				if got := headers.Get("x-api-key"); got != key {
					t.Fatalf("unexpected anthropic key: %q", got)
				}
				if got := headers.Get("anthropic-version"); got != "2023-06-01" {
					t.Fatalf("unexpected anthropic version: %q", got)
				}
			},
		},
		{
			provider: "Self-hosted", modelID: "qwen3-30b",
			wantPath: "/v1/chat/completions",
			wantKey:  "provider-local-key",
			checkAuth: func(t *testing.T, headers http.Header, key string) {
				if got := headers.Get("Authorization"); got != "Bearer "+key {
					t.Fatalf("unexpected local token: %q", got)
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.provider, func(t *testing.T) {
			fake := newFakeProvider(t)
			gateway := newTestGateway(fake, model.AIModel{
				ID: tc.modelID, Name: tc.modelID, Provider: tc.provider, Active: true,
			})

			result, err := gateway.Analyze(context.Background(), testRequest(t, tc.modelID))
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Analysis.Candidate.Name != "CV Bot" {
				t.Fatalf("unexpected candidate: %+v", result.Analysis.Candidate)
			}
			if result.Provider != tc.provider {
				t.Fatalf("unexpected provider label: %s", result.Provider)
			}
			if len(fake.requests) != 1 {
				t.Fatalf("expected one upstream call, got %d", len(fake.requests))
			}
			if got := fake.requests[0].path; got != tc.wantPath {
				t.Fatalf("unexpected path: %s (want %s)", got, tc.wantPath)
			}
			tc.checkAuth(t, fake.requests[0].headers, tc.wantKey)
		})
	}
}

func TestAnalyzePrefersProviderKeyOverModelKey(t *testing.T) {
	fake := newFakeProvider(t)
	gateway := newTestGateway(fake, model.AIModel{
		ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true, APIKey: "legacy-model-key",
	})

	if _, err := gateway.Analyze(context.Background(), testRequest(t, "gpt-4o-mini")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := fake.requests[0].headers.Get("Authorization"); got != "Bearer provider-openai-key" {
		t.Fatalf("provider key should win, got %q", got)
	}
}

func TestAnalyzeFallsBackToModelKey(t *testing.T) {
	fake := newFakeProvider(t)
	gateway := New(&fakeStore{
		models: map[string]model.AIModel{
			"gpt-4o-mini": {
				ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true, APIKey: "legacy-model-key",
			},
		},
		configs: map[string]model.ServiceConfig{
			"openai": {ID: "openai", Kind: "ai", Name: "OpenAI", BaseURL: fake.server.URL + "/v1"},
		},
	})

	if _, err := gateway.Analyze(context.Background(), testRequest(t, "gpt-4o-mini")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := fake.requests[0].headers.Get("Authorization"); got != "Bearer legacy-model-key" {
		t.Fatalf("model key should be the fallback, got %q", got)
	}
}

func TestAnalyzeReportsMissingKeyWithProviderName(t *testing.T) {
	fake := newFakeProvider(t)
	gateway := New(&fakeStore{
		models: map[string]model.AIModel{
			"gpt-4o-mini": {ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true},
		},
		configs: map[string]model.ServiceConfig{
			"openai": {ID: "openai", Kind: "ai", Name: "OpenAI", BaseURL: fake.server.URL + "/v1"},
		},
	})

	gatewayErr := expectError(t, mustAnalyze(t, gateway, "gpt-4o-mini"), "missing_key")
	if !strings.Contains(gatewayErr.Message, "OpenAI") {
		t.Fatalf("message should name the provider: %s", gatewayErr.Message)
	}
	if len(fake.requests) != 0 {
		t.Fatal("no upstream call should happen without a key")
	}
}

func TestAnalyzeRejectsInactiveModel(t *testing.T) {
	fake := newFakeProvider(t)
	gateway := newTestGateway(fake, model.AIModel{
		ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: false,
	})

	expectError(t, mustAnalyze(t, gateway, "gpt-4o-mini"), "bad_request")
	if len(fake.requests) != 0 {
		t.Fatal("inactive model must not reach the provider")
	}
}

func TestAnalyzeRejectsUnknownModel(t *testing.T) {
	fake := newFakeProvider(t)
	gateway := newTestGateway(fake)

	expectError(t, mustAnalyze(t, gateway, "missing-model"), "bad_request")
}

func TestAnalyzeRejectsUnsupportedProvider(t *testing.T) {
	fake := newFakeProvider(t)
	gateway := newTestGateway(fake, model.AIModel{
		ID: "mistral-large", Name: "Mistral", Provider: "Mistral", Active: true,
	})

	gatewayErr := expectError(t, mustAnalyze(t, gateway, "mistral-large"), "bad_request")
	if !strings.Contains(gatewayErr.Message, "Mistral") {
		t.Fatalf("message should name the provider: %s", gatewayErr.Message)
	}
}

func mustAnalyze(t *testing.T, gateway *Gateway, modelID string) error {
	t.Helper()
	_, err := gateway.Analyze(context.Background(), testRequest(t, modelID))
	return err
}

func TestAnalyzeOpenAISendsStructuredRequest(t *testing.T) {
	fake := newFakeProvider(t)
	gateway := newTestGateway(fake, model.AIModel{
		ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true,
	})

	if _, err := gateway.Analyze(context.Background(), testRequest(t, "gpt-4o-mini")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	body := fake.requests[0].body
	if body["model"] != "gpt-4o-mini" {
		t.Fatalf("unexpected model: %v", body["model"])
	}
	messages, ok := body["messages"].([]any)
	if !ok || len(messages) != 2 {
		t.Fatalf("unexpected messages: %+v", body["messages"])
	}
	system := messages[0].(map[string]any)
	if system["role"] != "system" || system["content"] != analysis.SystemInstruction {
		t.Fatalf("unexpected system message: %+v", system)
	}
	user := messages[1].(map[string]any)
	if !strings.Contains(user["content"].(string), "8 years of experience") {
		t.Fatalf("user message should embed the CV text: %+v", user)
	}

	format, ok := body["response_format"].(map[string]any)
	if !ok || format["type"] != "json_schema" {
		t.Fatalf("unexpected response format: %+v", body["response_format"])
	}
	jsonSchema := format["json_schema"].(map[string]any)
	if jsonSchema["strict"] != true {
		t.Fatalf("openai schema should be strict: %+v", jsonSchema)
	}
	if _, ok := jsonSchema["schema"].(map[string]any)["properties"]; !ok {
		t.Fatalf("schema missing properties: %+v", jsonSchema["schema"])
	}
}

func TestAnalyzeSelfHostedFallsBackToJSONObjectMode(t *testing.T) {
	fake := newFakeProvider(t)
	gateway := newTestGateway(fake, model.AIModel{
		ID: "qwen3-30b", Name: "Qwen", Provider: "Self-hosted", Active: true,
	})

	if _, err := gateway.Analyze(context.Background(), testRequest(t, "qwen3-30b")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	format, ok := fake.requests[0].body["response_format"].(map[string]any)
	if !ok || format["type"] != "json_object" {
		t.Fatalf("self-hosted should use json_object mode, got %+v", fake.requests[0].body["response_format"])
	}
}

func TestAnalyzeRequiresBaseURLForSelfHosted(t *testing.T) {
	gateway := New(&fakeStore{
		models: map[string]model.AIModel{
			"qwen3-30b": {ID: "qwen3-30b", Name: "Qwen", Provider: "Self-hosted", Active: true, APIKey: "local"},
		},
		configs: map[string]model.ServiceConfig{
			"self-hosted": {ID: "self-hosted", Kind: "ai", Name: "Self-hosted"},
		},
	})

	expectError(t, mustAnalyze(t, gateway, "qwen3-30b"), "bad_request")
}

func TestAnalyzeTextOnlyProviderRejectsScannedPDF(t *testing.T) {
	fake := newFakeProvider(t)
	gateway := newTestGateway(fake, model.AIModel{
		ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true,
	})

	request := testRequest(t, "gpt-4o-mini")
	request.CVText = ""
	request.CVFile = []byte("%PDF-1.4 scanned")

	gatewayErr := expectError(t, func() error {
		_, err := gateway.Analyze(context.Background(), request)
		return err
	}(), "no_text")
	if !strings.Contains(gatewayErr.Message, "Google") {
		t.Fatalf("message should suggest a Google model: %s", gatewayErr.Message)
	}
	if len(fake.requests) != 0 {
		t.Fatal("scanned PDF should not reach a text-only provider")
	}
}

func TestAnalyzeAnthropicSendsPDFDocumentBlock(t *testing.T) {
	fake := newFakeProvider(t)
	gateway := newTestGateway(fake, model.AIModel{
		ID: "claude-sonnet-4-5", Name: "Claude", Provider: "Anthropic", Active: true,
	})

	request := testRequest(t, "claude-sonnet-4-5")
	request.CVText = ""
	request.CVFile = []byte("%PDF-1.4 scanned cv")

	if _, err := gateway.Analyze(context.Background(), request); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	body := fake.requests[0].body
	if body["system"] != analysis.SystemInstruction {
		t.Fatalf("unexpected system prompt: %v", body["system"])
	}
	messages := body["messages"].([]any)
	blocks := messages[0].(map[string]any)["content"].([]any)
	if len(blocks) != 2 {
		t.Fatalf("expected document and text blocks, got %+v", blocks)
	}
	document := blocks[0].(map[string]any)
	if document["type"] != "document" {
		t.Fatalf("first block should be a document, got %+v", document)
	}
	source := document["source"].(map[string]any)
	if source["type"] != "base64" || source["media_type"] != "application/pdf" {
		t.Fatalf("unexpected document source: %+v", source)
	}
	if source["data"] != base64.StdEncoding.EncodeToString([]byte("%PDF-1.4 scanned cv")) {
		t.Fatal("document data should be the base64 PDF payload")
	}
	text := blocks[1].(map[string]any)
	if text["type"] != "text" || !strings.Contains(text["text"].(string), "đính kèm") {
		t.Fatalf("unexpected text block: %+v", text)
	}
}

func TestAnalyzeGoogleUploadsPDFToFilesAPI(t *testing.T) {
	fake := newFakeProvider(t)
	gateway := newTestGateway(fake, model.AIModel{
		ID: "gemini-3.5-flash-lite", Name: "Gemini", Provider: "Google", Active: true,
	})

	request := testRequest(t, "gemini-3.5-flash-lite")
	request.CVText = ""
	request.CVFile = []byte("%PDF-1.4 scanned cv")

	if _, err := gateway.Analyze(context.Background(), request); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fake.requests) != 2 {
		t.Fatalf("expected upload then analyze, got %d calls", len(fake.requests))
	}

	contents := fake.requests[1].body["contents"].([]any)
	parts := contents[0].(map[string]any)["parts"].([]any)
	if len(parts) != 2 {
		t.Fatalf("expected file_data and text parts, got %+v", parts)
	}
	filePart := parts[0].(map[string]any)["file_data"].(map[string]any)
	if filePart["file_uri"] != "https://example.test/v1beta/files/abc123" {
		t.Fatalf("unexpected file part: %+v", filePart)
	}
}

func TestAnalyzeMapsUpstreamFailures(t *testing.T) {
	fake := newFakeProvider(t)
	fake.status = http.StatusUnauthorized
	gateway := newTestGateway(fake, model.AIModel{
		ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true,
	})

	gatewayErr := expectError(t, mustAnalyze(t, gateway, "gpt-4o-mini"), "upstream_error")
	if !strings.Contains(gatewayErr.Message, "OpenAI") {
		t.Fatalf("message should name the provider: %s", gatewayErr.Message)
	}
}

func TestAnalyzeRejectsNonJSONProviderOutput(t *testing.T) {
	fake := newFakeProvider(t)
	fake.payload = `{"candidates":[{"content":{"parts":[{"text":"not json"}]},"finishReason":"STOP"}]}`
	gateway := newTestGateway(fake, model.AIModel{
		ID: "gemini-3.5-flash-lite", Name: "Gemini", Provider: "Google", Active: true,
	})

	expectError(t, mustAnalyze(t, gateway, "gemini-3.5-flash-lite"), "invalid_output")
}
