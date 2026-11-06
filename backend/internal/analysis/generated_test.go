package analysis

import (
	"strings"
	"testing"

	"codecv/backend/internal/model"
)

func testGenerateInput() GenerateInput {
	return GenerateInput{
		Builder: model.BuilderInput{
			FullName: "Lê Hoàng Minh",
			Position: "Backend Engineer",
			Level:    "Senior",
			Years:    6,
			Skills:   []string{"Go", "PostgreSQL", "AWS"},
			Experiences: []model.BuilderExperience{
				{
					Company:     "Acme",
					Role:        "Senior Backend Engineer",
					Period:      "2021 - 2024",
					Description: "Xây API thanh toán, giảm độ trễ p95 từ 800ms xuống 200ms.",
				},
			},
			Education: []model.BuilderEducation{
				{School: "ĐH Bách Khoa", Degree: "Kỹ sư CNTT", Period: "2014 - 2019"},
			},
			Projects: []model.BuilderProject{
				{Name: "CodeCV", Role: "Tech lead", Period: "2024", Description: "Nền tảng phân tích CV."},
			},
			Certifications: []string{"AWS Solutions Architect"},
			Languages:      []string{"Tiếng Anh - IELTS 7.5"},
			Notes:          "Ưu tiên mô tả kết quả đo được.",
			SourceID:       "cand-1",
		},
		Language: "vi",
		Template: "sidebar",
		Accent:   "emerald",
	}
}

func TestBuildGeneratedPromptIncludesFacts(t *testing.T) {
	input := testGenerateInput()
	input.Feedback = "Nhấn mạnh kinh nghiệm thanh toán."
	prompt := BuildGeneratedPrompt(input)

	checks := []string{
		"Tiếng Việt",
		input.Builder.Position,
		input.Builder.Level,
		input.Builder.Skills[0],
		input.Builder.Experiences[0].Company,
		input.Builder.Experiences[0].Description,
		input.Builder.Education[0].School,
		input.Builder.Projects[0].Name,
		input.Builder.Certifications[0],
		input.Builder.Languages[0],
		input.Builder.Notes,
		`bắt buộc trả về "sidebar"`,
		`bắt buộc trả về "emerald"`,
		"Nhấn mạnh kinh nghiệm thanh toán.",
	}
	for _, expected := range checks {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("prompt missing %q", expected)
		}
	}
	if strings.Contains(prompt, "Tự chọn template") {
		t.Fatal("locked template should not ask the model to choose")
	}
}

func TestBuildGeneratedPromptEnglishLetsAIMChoose(t *testing.T) {
	input := testGenerateInput()
	input.Language = "en"
	input.Template = ""
	input.Accent = ""
	prompt := BuildGeneratedPrompt(input)

	checks := []string{"English", "tự chọn một slug", "classic", "sidebar", "compact", "sky", "slate", "emerald", "amber"}
	for _, expected := range checks {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("prompt missing %q", expected)
		}
	}
	if strings.Contains(prompt, "bắt buộc trả về") {
		t.Fatal("empty choices should leave template and accent to the model")
	}
}

func TestDecodeGeneratedNormalizesAndCaps(t *testing.T) {
	raw := map[string]any{
		"summary": strings.Repeat("a", 1200),
		"experience": []any{
			map[string]any{
				"company":  "Acme",
				"role":     "Backend Engineer",
				"period":   "2021 - 2024",
				"location": "Hà Nội",
				"bullets":  []any{strings.Repeat("b", 300), "led migration", "led migration", ""},
			},
			map[string]any{"company": "", "role": ""},
			map[string]any{"company": "Beta", "role": "Engineer"},
		},
		"education": []any{
			map[string]any{"school": "ĐH Bách Khoa", "degree": "Kỹ sư", "period": "2014 - 2019", "detail": "GPA 3.6"},
			map[string]any{"school": ""},
		},
		"projects": []any{
			map[string]any{"name": "CodeCV", "bullets": []any{"shipped"}},
			map[string]any{"name": ""},
		},
		"skills": []any{
			map[string]any{"group": "Ngôn ngữ", "items": []any{"Go", "go", "", "Rust"}},
			map[string]any{"group": "Trống", "items": []any{}},
		},
		"certifications": []any{
			map[string]any{"name": "AWS SAA", "issuer": "Amazon", "year": "2023"},
			map[string]any{"name": ""},
		},
		"languages": []any{
			map[string]any{"name": "Tiếng Anh", "level": "IELTS 7.5"},
			map[string]any{"name": ""},
		},
		"template": "SIDEBAR",
		"accent":   "violet",
	}

	draft := NormalizeGenerated(raw)

	if got := len([]rune(draft.Content.Summary)); got != 900 {
		t.Fatalf("summary should be clipped to 900 runes, got %d", got)
	}
	if len(draft.Content.Experience) != 2 {
		t.Fatalf("expected 2 experiences, got %d", len(draft.Content.Experience))
	}
	if got := len([]rune(draft.Content.Experience[0].Bullets[0])); got != 240 {
		t.Fatalf("bullet should be clipped to 240 runes, got %d", got)
	}
	if len(draft.Content.Education) != 1 || len(draft.Content.Projects) != 1 {
		t.Fatalf("empty school/name entries should be dropped: %+v", draft.Content)
	}
	if len(draft.Content.Skills) != 1 {
		t.Fatalf("empty skill group should be dropped, got %+v", draft.Content.Skills)
	}
	if got := draft.Content.Skills[0].Items; len(got) != 2 || got[0] != "Go" || got[1] != "Rust" {
		t.Fatalf("skill items should be deduped, got %+v", got)
	}
	if len(draft.Content.Certifications) != 1 || len(draft.Content.Languages) != 1 {
		t.Fatalf("empty certification/language entries should be dropped: %+v", draft.Content)
	}
	if draft.Template != "sidebar" {
		t.Fatalf("template should normalize case, got %q", draft.Template)
	}
	if draft.Accent != "sky" {
		t.Fatalf("unknown accent should fall back to sky, got %q", draft.Accent)
	}
}

func TestDecodeGeneratedCapsCollections(t *testing.T) {
	experiences := make([]any, 0, 10)
	for i := 0; i < 10; i++ {
		experiences = append(experiences, map[string]any{"company": "Acme", "role": "Engineer"})
	}
	groups := make([]any, 0, 8)
	for i := 0; i < 8; i++ {
		groups = append(groups, map[string]any{"group": "Group", "items": []any{"Go", "Rust"}})
	}

	draft := NormalizeGenerated(map[string]any{
		"experience": experiences,
		"skills":     groups,
	})

	if len(draft.Content.Experience) != 8 {
		t.Fatalf("experience should be capped at 8, got %d", len(draft.Content.Experience))
	}
	if len(draft.Content.Skills) != 6 {
		t.Fatalf("skill groups should be capped at 6, got %d", len(draft.Content.Skills))
	}
}

func TestDecodeGeneratedRejectsEmptyContent(t *testing.T) {
	for _, text := range []string{"{}", "[]", `{"summary":"","experience":[]}`, `{"unknown":true}`} {
		if _, err := DecodeGenerated(text); err == nil {
			t.Fatalf("expected an error for %q", text)
		}
	}
}

func TestDecodeGeneratedAcceptsCodeFence(t *testing.T) {
	text := "```json\n{\"summary\":\"Kỹ sư backend 6 năm kinh nghiệm.\",\"template\":\"compact\",\"accent\":\"amber\"}\n```"
	draft, err := DecodeGenerated(text)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if draft.Content.Summary == "" || draft.Template != "compact" || draft.Accent != "amber" {
		t.Fatalf("unexpected draft: %+v", draft)
	}
}

func TestGeneratedSchemasDeclareSlugsAndRequiredFields(t *testing.T) {
	gemini := GeminiGeneratedSchema()
	if gemini["type"] != "OBJECT" {
		t.Fatalf("gemini schema should use uppercase types, got %v", gemini["type"])
	}
	required, _ := gemini["required"].([]string)
	if len(required) != 9 {
		t.Fatalf("expected 9 required fields, got %v", required)
	}

	strict := StrictGeneratedSchema()
	if strict["additionalProperties"] != false {
		t.Fatal("strict schema should disable additional properties")
	}
	properties, _ := strict["properties"].(map[string]any)
	strictRequired, _ := strict["required"].([]string)
	if len(strictRequired) != len(properties) {
		t.Fatalf("strict schema should require every property: %d required, %d properties", len(strictRequired), len(properties))
	}
	template, _ := properties["template"].(map[string]any)
	enum, _ := template["enum"].([]string)
	if strings.Join(enum, ",") != "classic,sidebar,compact" {
		t.Fatalf("unexpected template enum: %v", enum)
	}
	experience, _ := properties["experience"].(map[string]any)
	items, _ := experience["items"].(map[string]any)
	if items["additionalProperties"] != false {
		t.Fatal("nested object should disable additional properties")
	}
}

func TestGeneratedTemplateAndAccentValidation(t *testing.T) {
	if !GeneratedTemplateValid(" Sidebar ") {
		t.Fatal("sidebar should be valid regardless of case and spaces")
	}
	if GeneratedTemplateValid("fancy") {
		t.Fatal("unknown template should be invalid")
	}
	if NormalizeGeneratedTemplate("fancy") != "classic" {
		t.Fatal("unknown template should fall back to classic")
	}
	if !GeneratedAccentValid("AMBER") {
		t.Fatal("amber should be valid regardless of case")
	}
	if NormalizeGeneratedAccent("violet") != "sky" {
		t.Fatal("unknown accent should fall back to sky")
	}
}
