package gateway

import (
	"context"
	"testing"

	"codecv/backend/internal/model"
)

const comparisonJSON = `{"summary":"CV trong chợ nổi bật hơn nhờ thành tích rõ ràng.","bestCvId":"market-1","bestReasons":["Thành tích đo lường được"],"myStrengths":["Kỹ năng Go"],"myGaps":["Thiếu số liệu"],"marketHighlights":["Nêu KPI rõ"]}`

func testCompareRequest(modelID string) CompareRequest {
	return CompareRequest{
		ModelID:  modelID,
		Language: "vi",
		Mine: model.CompareCV{
			ID:         "mine-1",
			Source:     "mine",
			Name:       "Lê Hoàng Minh",
			Title:      "Backend Engineer",
			Level:      "Senior",
			Years:      6,
			Skills:     []string{"Go", "PostgreSQL"},
			Highlights: []string{"Giảm p95 từ 800ms xuống 200ms."},
		},
		Others: []model.CompareCV{
			{
				ID:       "market-1",
				Source:   "market",
				Name:     "Trần Mai",
				Title:    "Senior Backend Engineer",
				Level:    "Senior",
				Years:    7,
				Category: "backend",
				Skills:   []string{"Go", "Kubernetes"},
			},
		},
	}
}

func TestCompareRoutesModelToItsProvider(t *testing.T) {
	cases := []struct {
		provider string
		modelID  string
		wantPath string
		payload  string
	}{
		{
			provider: "Google", modelID: "gemini-3.5-flash-lite",
			wantPath: "/v1beta/models/gemini-3.5-flash-lite:generateContent",
			payload:  geminiRawResponse(comparisonJSON),
		},
		{
			provider: "OpenAI", modelID: "gpt-4o-mini",
			wantPath: "/v1/chat/completions",
			payload:  openAIRawResponse(comparisonJSON, "stop"),
		},
		{
			provider: "Anthropic", modelID: "claude-sonnet-4-5",
			wantPath: "/v1/messages",
			payload:  anthropicRawResponse(comparisonJSON, "end_turn"),
		},
		{
			provider: "Self-hosted", modelID: "qwen3-30b",
			wantPath: "/v1/chat/completions",
			payload:  openAIRawResponse(comparisonJSON, "stop"),
		},
	}

	for _, tc := range cases {
		t.Run(tc.provider, func(t *testing.T) {
			fake := newFakeProvider(t)
			fake.payload = tc.payload
			gateway := newTestGateway(fake, model.AIModel{
				ID: tc.modelID, Name: tc.modelID, Provider: tc.provider, Active: true,
			})

			result, err := gateway.Compare(context.Background(), testCompareRequest(tc.modelID))
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Comparison.BestCvID != "market-1" {
				t.Fatalf("unexpected best id: %q", result.Comparison.BestCvID)
			}
			if len(result.Comparison.MyGaps) != 1 || result.Comparison.Summary == "" {
				t.Fatalf("unexpected comparison: %+v", result.Comparison)
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

func TestCompareUsesProviderSpecificJSONMode(t *testing.T) {
	t.Run("OpenAI uses strict json schema", func(t *testing.T) {
		fake := newFakeProvider(t)
		fake.payload = openAIRawResponse(comparisonJSON, "stop")
		gateway := newTestGateway(fake, model.AIModel{
			ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true,
		})

		if _, err := gateway.Compare(context.Background(), testCompareRequest("gpt-4o-mini")); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		format, _ := fake.requests[0].body["response_format"].(map[string]any)
		if format["type"] != "json_schema" {
			t.Fatalf("expected json_schema, got %v", format["type"])
		}
		jsonSchema, _ := format["json_schema"].(map[string]any)
		if jsonSchema["name"] != "cv_comparison" || jsonSchema["strict"] != true {
			t.Fatalf("unexpected json schema config: %+v", jsonSchema)
		}
		schema, _ := jsonSchema["schema"].(map[string]any)
		if schema["additionalProperties"] != false {
			t.Fatal("strict schema should disable additional properties")
		}
	})

	t.Run("Self-hosted uses json object", func(t *testing.T) {
		fake := newFakeProvider(t)
		fake.payload = openAIRawResponse(comparisonJSON, "stop")
		gateway := newTestGateway(fake, model.AIModel{
			ID: "qwen3-30b", Name: "Qwen", Provider: "Self-hosted", Active: true,
		})

		if _, err := gateway.Compare(context.Background(), testCompareRequest("qwen3-30b")); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		format, _ := fake.requests[0].body["response_format"].(map[string]any)
		if format["type"] != "json_object" {
			t.Fatalf("expected json_object, got %v", format["type"])
		}
	})

	t.Run("Google sends response schema and system instruction", func(t *testing.T) {
		fake := newFakeProvider(t)
		fake.payload = geminiRawResponse(comparisonJSON)
		gateway := newTestGateway(fake, model.AIModel{
			ID: "gemini-3.5-flash-lite", Name: "Gemini", Provider: "Google", Active: true,
		})

		if _, err := gateway.Compare(context.Background(), testCompareRequest("gemini-3.5-flash-lite")); err != nil {
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
	})
}

func TestCompareDropsUnknownBestID(t *testing.T) {
	fake := newFakeProvider(t)
	fake.payload = openAIRawResponse(
		`{"summary":"Nhận xét.","bestCvId":"ghost-9","bestReasons":[],"myStrengths":[],"myGaps":[],"marketHighlights":[]}`,
		"stop",
	)
	gateway := newTestGateway(fake, model.AIModel{
		ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true,
	})

	result, err := gateway.Compare(context.Background(), testCompareRequest("gpt-4o-mini"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Comparison.BestCvID != "" {
		t.Fatalf("unknown best id must be dropped, got %q", result.Comparison.BestCvID)
	}
}

func TestCompareRejectsInvalidOutput(t *testing.T) {
	cases := []struct {
		name    string
		payload string
	}{
		{name: "not json", payload: openAIRawResponse("không phải json", "stop")},
		{name: "empty review", payload: openAIRawResponse(`{"summary":"","bestCvId":"","bestReasons":[],"myStrengths":[],"myGaps":[],"marketHighlights":[]}`, "stop")},
		{name: "truncated", payload: openAIRawResponse(comparisonJSON, "length")},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fake := newFakeProvider(t)
			fake.payload = tc.payload
			gateway := newTestGateway(fake, model.AIModel{
				ID: "gpt-4o-mini", Name: "GPT", Provider: "OpenAI", Active: true,
			})

			_, err := gateway.Compare(context.Background(), testCompareRequest("gpt-4o-mini"))
			expectError(t, err, "invalid_output")
		})
	}
}
