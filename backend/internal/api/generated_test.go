package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"codecv/backend/internal/gateway"
	"codecv/backend/internal/model"
	"codecv/backend/internal/store"
)

type fakeGatewayConfig struct {
	model model.AIModel
	cfg   model.ServiceConfig
}

func (f fakeGatewayConfig) ModelByID(_ context.Context, id string) (model.AIModel, error) {
	if id != f.model.ID {
		return model.AIModel{}, store.ErrNotFound
	}
	return f.model, nil
}

func (f fakeGatewayConfig) ServiceConfig(_ context.Context, id string) (model.ServiceConfig, error) {
	if id != f.cfg.ID {
		return model.ServiceConfig{}, store.ErrNotFound
	}
	return f.cfg, nil
}

func newGenerateServer(t *testing.T, status int, upstreamPayload string) *Server {
	t.Helper()

	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if status != http.StatusOK {
			w.WriteHeader(status)
			_, _ = w.Write([]byte(`{"error":{"message":"boom"}}`))
			return
		}
		_, _ = w.Write([]byte(upstreamPayload))
	}))
	t.Cleanup(provider.Close)

	return &Server{gateway: gateway.New(fakeGatewayConfig{
		model: model.AIModel{ID: "gpt-test", Name: "GPT", Provider: "OpenAI", Active: true},
		cfg: model.ServiceConfig{
			ID: "openai", Kind: "ai", Name: "OpenAI",
			BaseURL: provider.URL + "/v1", APIKey: "test-key",
		},
	})}
}

func testBuilderInput() model.BuilderInput {
	return model.BuilderInput{
		FullName: "  Lê Hoàng Minh  ",
		Position: " Backend Engineer ",
		Level:    "Senior",
		Years:    6,
		Skills:   []string{"Go", "go", "", "PostgreSQL"},
		Experiences: []model.BuilderExperience{
			{Company: "Acme", Role: "Senior Backend Engineer", Period: "2021 - 2024", Description: "Xây API thanh toán."},
		},
	}
}

func generateRequestBody(t *testing.T, input model.BuilderInput) string {
	t.Helper()

	raw, err := json.Marshal(map[string]any{
		"modelId":  "gpt-test",
		"language": "vi",
		"input":    input,
	})
	if err != nil {
		t.Fatalf("cannot encode request: %v", err)
	}
	return string(raw)
}

func callGenerate(t *testing.T, server *Server, body string) *httptest.ResponseRecorder {
	t.Helper()

	request := httptest.NewRequest(http.MethodPost, "/api/cv-builder/generate", strings.NewReader(body))
	recorder := httptest.NewRecorder()
	server.handleGenerateCV(recorder, request)
	return recorder
}

const generatedCVUpstream = `{"choices":[{"message":{"content":"{\"summary\":\"Kỹ sư backend 6 năm kinh nghiệm.\",\"experience\":[{\"company\":\"Acme\",\"role\":\"Senior Backend Engineer\",\"period\":\"2021 - 2024\",\"location\":\"Hà Nội\",\"bullets\":[\"Xây API thanh toán.\"]}],\"education\":[],\"projects\":[],\"skills\":[{\"group\":\"Ngôn ngữ\",\"items\":[\"Go\"]}],\"certifications\":[],\"languages\":[],\"template\":\"sidebar\",\"accent\":\"emerald\"}"},"finish_reason":"stop"}]}`

func TestHandleGenerateCVReturnsDraft(t *testing.T) {
	server := newGenerateServer(t, http.StatusOK, generatedCVUpstream)
	recorder := callGenerate(t, server, generateRequestBody(t, testBuilderInput()))

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status %d: %s", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Input    model.BuilderInput       `json:"input"`
		Content  model.GeneratedCVContent `json:"content"`
		Template string                   `json:"template"`
		Accent   string                   `json:"accent"`
		ModelID  string                   `json:"modelId"`
		Provider string                   `json:"provider"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("cannot decode response: %v", err)
	}

	if response.Input.FullName != "Lê Hoàng Minh" || response.Input.Position != "Backend Engineer" {
		t.Fatalf("input should be trimmed: %+v", response.Input)
	}
	skills := response.Input.Skills
	if len(skills) != 2 || skills[0] != "Go" || skills[1] != "PostgreSQL" {
		t.Fatalf("skills should be deduped and cleaned: %+v", skills)
	}
	if response.Content.Summary == "" || len(response.Content.Experience) != 1 {
		t.Fatalf("missing generated content: %+v", response.Content)
	}
	if response.Template != "sidebar" || response.Accent != "emerald" {
		t.Fatalf("unexpected style: %s/%s", response.Template, response.Accent)
	}
	if response.ModelID != "gpt-test" || response.Provider != "OpenAI" {
		t.Fatalf("unexpected model metadata: %s/%s", response.ModelID, response.Provider)
	}
	if strings.Contains(recorder.Body.String(), `"projects":null`) {
		t.Fatal("empty lists should be serialized as arrays, not null")
	}
}

func TestHandleGenerateCVValidatesInput(t *testing.T) {
	noName := testBuilderInput()
	noName.FullName = "   "

	noPosition := testBuilderInput()
	noPosition.Position = ""

	noFacts := testBuilderInput()
	noFacts.Experiences = nil
	noFacts.Skills = nil

	cases := []struct {
		name   string
		mutate func(body map[string]any)
		want   string
	}{
		{
			name: "missing name",
			mutate: func(body map[string]any) {
				body["input"] = noName
			},
			want: "Nhập họ tên",
		},
		{
			name: "missing position",
			mutate: func(body map[string]any) {
				body["input"] = noPosition
			},
			want: "Nhập vị trí ứng tuyển",
		},
		{
			name: "no facts",
			mutate: func(body map[string]any) {
				body["input"] = noFacts
			},
			want: "ít nhất một kinh nghiệm",
		},
		{
			name: "unknown template",
			mutate: func(body map[string]any) {
				body["template"] = "fancy"
			},
			want: "Template không hợp lệ",
		},
		{
			name: "unknown accent",
			mutate: func(body map[string]any) {
				body["accent"] = "violet"
			},
			want: "Màu nhấn không hợp lệ",
		},
	}

	server := newGenerateServer(t, http.StatusOK, generatedCVUpstream)
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var body map[string]any
			if err := json.Unmarshal([]byte(generateRequestBody(t, testBuilderInput())), &body); err != nil {
				t.Fatalf("cannot build body: %v", err)
			}
			tc.mutate(body)
			raw, _ := json.Marshal(body)

			recorder := callGenerate(t, server, string(raw))
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
			}
			var failure model.ErrorBody
			if err := json.Unmarshal(recorder.Body.Bytes(), &failure); err != nil {
				t.Fatalf("cannot decode error: %v", err)
			}
			if !strings.Contains(failure.Error.Message, tc.want) {
				t.Fatalf("unexpected message: %s", failure.Error.Message)
			}
		})
	}
}

func TestHandleGenerateCVRejectsUnknownFields(t *testing.T) {
	server := newGenerateServer(t, http.StatusOK, generatedCVUpstream)
	body := strings.TrimSuffix(generateRequestBody(t, testBuilderInput()), "}") + `,"extra":true}`

	recorder := callGenerate(t, server, body)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
}

func TestHandleGenerateCVRequiresActiveModel(t *testing.T) {
	server := &Server{}
	body, _ := json.Marshal(map[string]any{
		"language": "vi",
		"input":    testBuilderInput(),
	})
	recorder := callGenerate(t, server, string(body))

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "model AI đang bật") {
		t.Fatalf("unexpected message: %s", recorder.Body.String())
	}
}

func TestHandleGenerateCVMapsProviderFailure(t *testing.T) {
	server := newGenerateServer(t, http.StatusOK, `{"choices":[{"message":{"content":"{}"},"finish_reason":"stop"}]}`)
	recorder := callGenerate(t, server, generateRequestBody(t, testBuilderInput()))

	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var failure model.ErrorBody
	if err := json.Unmarshal(recorder.Body.Bytes(), &failure); err != nil {
		t.Fatalf("cannot decode error: %v", err)
	}
	if failure.Error.Code != "invalid_output" {
		t.Fatalf("unexpected code: %s", failure.Error.Code)
	}
}
