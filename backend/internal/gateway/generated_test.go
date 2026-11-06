package gateway

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"codecv/backend/internal/model"
)

func testGenerateRequest(modelID string) GenerateRequest {
	return GenerateRequest{
		ModelID: modelID,
		Builder: model.BuilderInput{
			FullName: "Lê Hoàng Minh",
			Position: "Backend Engineer",
			Level:    "Senior",
			Years:    6,
			Skills:   []string{"Go", "PostgreSQL"},
			Experiences: []model.BuilderExperience{
				{Company: "Acme", Role: "Senior Backend Engineer", Period: "2021 - 2024", Description: "Xây API thanh toán."},
			},
		},
		Language: "vi",
	}
}

const generatedDraftJSON = `{"summary":"Kỹ sư backend 6 năm kinh nghiệm.","experience":[{"company":"Acme","role":"Senior Backend Engineer","period":"2021 - 2024","location":"Hà Nội","bullets":["Xây API thanh toán."]}],"education":[],"projects":[],"skills":[{"group":"Ngôn ngữ","items":["Go"]}],"certifications":[],"languages":[],"template":"sidebar","accent":"emerald"}`

func geminiRawResponse(text string) string {
	body, _ := json.Marshal(map[string]any{
		"candidates": []any{map[string]any{
			"content":      map[string]any{"parts": []any{map[string]any{"text": text}}},
			"finishReason": "STOP",
		}},
	})
	return string(body)
}

func openAIRawResponse(text, finishReason string) string {
	body, _ := json.Marshal(map[string]any{
		"choices": []any{map[string]any{
			"message":       map[string]any{"content": text},
			"finish_reason": finishReason,
		}},
	})
	return string(body)
}

func anthropicRawResponse(text, stopReason string) string {
	body, _ := json.Marshal(map[string]any{
		"content":     []any{map[string]any{"type": "text", "text": text}},
		"stop_reason": stopReason,
	})
	return string(body)
}

func TestGenerateRoutesModelToItsProvider(t *testing.T) {
	cases := []struct {
		provider string
		modelID  string
		wantPath string
		payload  string
	}{
		{
			provider: "Google", modelID: "gemini-3.5-flash-lite",
			wantPath: "/v1beta/models/gemini-3.5-flash-lite:generateContent",
			payload:  geminiRawResponse(generatedDraftJSON),
		},
		{
			provider: "OpenAI", modelID: "gpt-4o-mini",
			wantPath: "/v1/chat/completions",
			payload:  openAIRawResponse(generatedDraftJSON, "stop"),
		},
		{
			provider: "Anthropic", modelID: "claude-sonnet-4-5",
			wantPath: "/v1/messages",
			payload:  anthropicRawResponse(generatedDraftJSON, "end_turn"),
		},
		{
			provider: "Self-hosted", modelID: "qwen3-30b",
			wantPath: "/v1/chat/completions",
			payload:  openAIRawResponse(generatedDraftJSON, "stop"),
		},
	}

	for _, tc := range cases {
		t.Run(tc.provider, func(t *testing.T) {
			fake := newFakeProvider(t)
			fake.payload = tc.payload
			gateway := newTestGateway(fake, model.AIModel{
				ID: tc.modelID, Name: tc.modelID, Provider: tc.provider, Active: true,
			})

			result, err := gateway.Generate(context.Background(), testGenerateRequest(tc.modelID))
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Draft.Content.Summary != "Kỹ sư backend 6 năm kinh nghiệm." {
				t.Fatalf("unexpected summary: %q", result.Draft.Content.Summary)
			}
			if result.Draft.Template != "sidebar" || result.Draft.Accent != "emerald" {
				t.Fatalf("unexpected style: %+v", result.Draft)
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
		})
	}
}

func TestGenerateAppliesLockedTemplateAndAccent(t *testing.T) {
	fake := newFakeProvider(t)
	fake.payload = openAIRawResponse(generatedDraftJSON, "stop")
	gateway := newTestGateway(fake, model.AIModel{
		ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true,
	})

	request := testGenerateRequest("gpt-4o-mini")
	request.Template = "classic"
	request.Accent = "amber"
	result, err := gateway.Generate(context.Background(), request)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Draft.Template != "classic" || result.Draft.Accent != "amber" {
		t.Fatalf("user choices should win, got %+v", result.Draft)
	}
}

func TestGenerateRequestsProviderSpecificJSONMode(t *testing.T) {
	t.Run("OpenAI uses strict json schema", func(t *testing.T) {
		fake := newFakeProvider(t)
		fake.payload = openAIRawResponse(generatedDraftJSON, "stop")
		gateway := newTestGateway(fake, model.AIModel{
			ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true,
		})

		if _, err := gateway.Generate(context.Background(), testGenerateRequest("gpt-4o-mini")); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		format, _ := fake.requests[0].body["response_format"].(map[string]any)
		if format["type"] != "json_schema" {
			t.Fatalf("expected json_schema, got %v", format["type"])
		}
		jsonSchema, _ := format["json_schema"].(map[string]any)
		if jsonSchema["strict"] != true {
			t.Fatal("strict mode should be enabled")
		}
		schema, _ := jsonSchema["schema"].(map[string]any)
		if schema["additionalProperties"] != false {
			t.Fatal("strict schema should disable additional properties")
		}
	})

	t.Run("Self-hosted uses json object", func(t *testing.T) {
		fake := newFakeProvider(t)
		fake.payload = openAIRawResponse(generatedDraftJSON, "stop")
		gateway := newTestGateway(fake, model.AIModel{
			ID: "qwen3-30b", Name: "Qwen", Provider: "Self-hosted", Active: true,
		})

		if _, err := gateway.Generate(context.Background(), testGenerateRequest("qwen3-30b")); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		format, _ := fake.requests[0].body["response_format"].(map[string]any)
		if format["type"] != "json_object" {
			t.Fatalf("expected json_object, got %v", format["type"])
		}
	})

	t.Run("Google sends response schema and system instruction", func(t *testing.T) {
		fake := newFakeProvider(t)
		fake.payload = geminiRawResponse(generatedDraftJSON)
		gateway := newTestGateway(fake, model.AIModel{
			ID: "gemini-3.5-flash-lite", Name: "Gemini", Provider: "Google", Active: true,
		})

		if _, err := gateway.Generate(context.Background(), testGenerateRequest("gemini-3.5-flash-lite")); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		body := fake.requests[0].body
		config, _ := body["generationConfig"].(map[string]any)
		if config["responseSchema"] == nil || config["responseMimeType"] != "application/json" {
			t.Fatalf("missing JSON response config: %+v", config)
		}
		system, _ := body["systemInstruction"].(map[string]any)
		if system == nil {
			t.Fatal("missing system instruction")
		}
		prompt := promptText(t, body)
		if !strings.Contains(prompt, "Backend Engineer") {
			t.Fatalf("prompt should include the target position: %s", prompt)
		}
	})

	t.Run("Anthropic gets a plain message", func(t *testing.T) {
		fake := newFakeProvider(t)
		fake.payload = anthropicRawResponse(generatedDraftJSON, "end_turn")
		gateway := newTestGateway(fake, model.AIModel{
			ID: "claude-sonnet-4-5", Name: "Claude", Provider: "Anthropic", Active: true,
		})

		if _, err := gateway.Generate(context.Background(), testGenerateRequest("claude-sonnet-4-5")); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if fake.requests[0].body["max_tokens"] != float64(8192) {
			t.Fatalf("unexpected max_tokens: %v", fake.requests[0].body["max_tokens"])
		}
		if fake.requests[0].body["system"] == nil {
			t.Fatal("missing system instruction")
		}
		if fake.requests[0].headers.Get("anthropic-version") != "2023-06-01" {
			t.Fatal("missing anthropic version header")
		}
	})
}

func promptText(t *testing.T, body map[string]any) string {
	t.Helper()

	contents, _ := body["contents"].([]any)
	if len(contents) == 0 {
		t.Fatal("missing contents")
	}
	content, _ := contents[0].(map[string]any)
	parts, _ := content["parts"].([]any)
	for _, item := range parts {
		part, _ := item.(map[string]any)
		if text, ok := part["text"].(string); ok {
			return text
		}
	}
	t.Fatal("missing prompt text")
	return ""
}

func TestGenerateRejectsInvalidOutput(t *testing.T) {
	cases := []struct {
		name    string
		payload string
	}{
		{name: "empty content", payload: openAIRawResponse("{}", "stop")},
		{name: "not json", payload: openAIRawResponse("xin chào", "stop")},
		{name: "truncated", payload: openAIRawResponse(generatedDraftJSON, "length")},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fake := newFakeProvider(t)
			fake.payload = tc.payload
			gateway := newTestGateway(fake, model.AIModel{
				ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true,
			})

			_, err := gateway.Generate(context.Background(), testGenerateRequest("gpt-4o-mini"))
			expectError(t, err, "invalid_output")
		})
	}
}

func TestGenerateReportsUpstreamErrors(t *testing.T) {
	fake := newFakeProvider(t)
	fake.status = http.StatusUnauthorized
	gateway := newTestGateway(fake, model.AIModel{
		ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true,
	})

	_, err := gateway.Generate(context.Background(), testGenerateRequest("gpt-4o-mini"))
	gatewayErr := expectError(t, err, "upstream_error")
	if !strings.Contains(gatewayErr.Message, "OpenAI") {
		t.Fatalf("error should name the provider: %s", gatewayErr.Message)
	}
}
