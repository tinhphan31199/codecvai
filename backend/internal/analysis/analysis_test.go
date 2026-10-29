package analysis

import (
	"strings"
	"testing"

	"codecv/backend/internal/model"
	"codecv/backend/internal/positions"
)

func testInput(t *testing.T) Input {
	t.Helper()

	position, ok := positions.Find("be-dotnet")
	if !ok {
		t.Fatal("be-dotnet position is missing")
	}

	return Input{
		CVText:        "Backend engineer with 8 years of experience.",
		GithubContext: "=== GitHub repo: acme/payment ===\nNgôn ngữ: Go 90%",
		Position:      position,
		Level:         "Senior",
		Language:      "vi",
		Repositories: []model.Repository{
			{
				URL:    "https://github.com/acme/payment",
				Label:  "github.com/acme/payment",
				Kind:   model.RepositoryRepo,
				Status: model.RepositoryAnalyzed,
			},
		},
		IncludeQuestions: true,
	}
}

func TestBuildPromptIncludesEvidenceSources(t *testing.T) {
	input := testInput(t)
	prompt := BuildPrompt(input)

	checks := []string{
		"Tiếng Việt",
		input.Position.Title,
		"<<<GITHUB",
		"github.com/acme/payment",
		"đã đọc dữ liệu",
		"6 câu hỏi phỏng vấn",
		input.CVText,
	}
	for _, expected := range checks {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("prompt missing %q", expected)
		}
	}

	if strings.Count(prompt, "1. [") != 1 {
		t.Fatalf("criteria list should start with one numbered entry")
	}
}

func TestBuildPromptUsesAttachedFile(t *testing.T) {
	input := testInput(t)
	input.CVFileURI = "https://generativelanguage.googleapis.com/v1beta/files/abc123"
	input.CVFileMime = "application/pdf"

	prompt := BuildPrompt(input)

	if !strings.Contains(prompt, "đính kèm") {
		t.Fatal("file mode prompt should say the CV is attached")
	}
	if strings.Contains(prompt, input.CVText) {
		t.Fatal("file mode prompt should not embed the extracted CV text")
	}
}

func TestNormalizeMapsCriteriaByPosition(t *testing.T) {
	input := testInput(t)
	raw := map[string]any{
		"candidate": map[string]any{
			"name":            "Lê Hoàng Minh",
			"yearsExperience": float64(9.4),
		},
		"summary": "Phù hợp backend.",
		"criteria": []any{
			map[string]any{"status": "verified", "quote": "8 years of experience", "note": "CV nêu rõ."},
			map[string]any{"status": "verified", "quote": "[GitHub acme/payment] README", "note": "GitHub xác minh."},
			map[string]any{"status": "unknown", "quote": "bị bỏ", "note": "trạng thái lạ"},
		},
		"strengths": []any{"Kinh nghiệm .NET", "", "Kinh nghiệm webhook"},
		"gaps":      []any{"Thiếu bằng chứng CI/CD"},
		"questions": []any{
			map[string]any{"question": "Thiết kế webhook thế nào?", "topic": "Architecture", "rationale": "Kiểm chứng."},
			map[string]any{"question": ""},
		},
	}

	result := Normalize(raw, input)

	if result.Candidate.Name != "Lê Hoàng Minh" {
		t.Fatalf("unexpected name: %s", result.Candidate.Name)
	}
	if result.Candidate.YearsExperience != 9 {
		t.Fatalf("unexpected years: %d", result.Candidate.YearsExperience)
	}
	if len(result.Criteria) != len(input.Position.Criteria) {
		t.Fatalf("expected %d criteria, got %d", len(input.Position.Criteria), len(result.Criteria))
	}
	if result.Criteria[0].Label != input.Position.Criteria[0].Label {
		t.Fatalf("criteria labels should come from position, got %s", result.Criteria[0].Label)
	}
	if result.Criteria[2].Status != model.EvidenceMissing {
		t.Fatalf("unknown status should become missing, got %s", result.Criteria[2].Status)
	}
	if result.Criteria[2].Quote != "" {
		t.Fatalf("missing criteria should drop the quote, got %q", result.Criteria[2].Quote)
	}
	if len(result.Repositories) != 1 || result.Repositories[0].Status != model.RepositoryAnalyzed {
		t.Fatalf("repositories should be passed through: %+v", result.Repositories)
	}
	if len(result.Strengths) != 2 {
		t.Fatalf("empty strengths should be dropped, got %+v", result.Strengths)
	}
	if len(result.Questions) != 1 || result.Questions[0].Topic != "Architecture" {
		t.Fatalf("unexpected questions: %+v", result.Questions)
	}

	empty := Normalize(map[string]any{}, Input{
		Position:         input.Position,
		IncludeQuestions: false,
	})
	if empty.Repositories == nil || empty.Questions == nil {
		t.Fatal("empty analysis should return empty arrays, not null")
	}
}

func TestDecodeStripsCodeFence(t *testing.T) {
	input := testInput(t)
	text := "```json\n{\"candidate\":{\"name\":\"Trần An\"},\"summary\":\"ok\"}\n```"

	result, err := Decode(text, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Candidate.Name != "Trần An" {
		t.Fatalf("unexpected name: %s", result.Candidate.Name)
	}

	if _, err := Decode("not json", input); err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestSchemasShareShape(t *testing.T) {
	gemini := GeminiSchema()
	if gemini["type"] != "OBJECT" {
		t.Fatalf("gemini schema should use uppercase types, got %v", gemini["type"])
	}

	standard := JSONSchema()
	if standard["type"] != "object" {
		t.Fatalf("json schema should use lowercase types, got %v", standard["type"])
	}
	properties := standard["properties"].(map[string]any)
	if _, ok := properties["questions"]; !ok {
		t.Fatalf("json schema missing questions: %+v", properties)
	}

	strict := StrictSchema()
	candidate := strict["properties"].(map[string]any)["candidate"].(map[string]any)
	if candidate["additionalProperties"] != false {
		t.Fatalf("strict schema should close objects, got %+v", candidate)
	}
	if len(candidate["required"].([]string)) != len(candidate["properties"].(map[string]any)) {
		t.Fatalf("strict schema should require every property, got %+v", candidate["required"])
	}

	if _, ok := gemini["properties"].(map[string]any)["candidate"].(map[string]any)["additionalProperties"]; ok {
		t.Fatal("gemini schema must stay untouched by strict conversion")
	}
}
