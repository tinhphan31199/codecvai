package analysis

import (
	"strings"
	"testing"

	"codecv/backend/internal/model"
)

func testCompareInput(language string) CompareInput {
	return CompareInput{
		Language: language,
		Mine: model.CompareCV{
			ID:         "mine-1",
			Source:     "mine",
			Name:       "Lê Hoàng Minh",
			Title:      "Backend Engineer",
			Level:      "Senior",
			Years:      6,
			Summary:    "Kỹ sư backend tập trung vào thanh toán.",
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

func TestBuildComparePromptIncludesCVsAndLanguage(t *testing.T) {
	prompt := BuildComparePrompt(testCompareInput("vi"))
	for _, want := range []string{
		"Ngôn ngữ cho toàn bộ nội dung nhận xét: Tiếng Việt",
		"CV CỦA NGƯỜI DÙNG (id: mine-1)",
		"CV TRONG CHỢ 1 (id: market-1)",
		"id: market-1",
		"Kỹ sư backend tập trung vào thanh toán.",
		"Go, PostgreSQL",
		"Giảm p95 từ 800ms xuống 200ms.",
		"bestCvId",
	} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt is missing %q:\n%s", want, prompt)
		}
	}
	if strings.Contains(prompt, "CV TRONG CHỢ 2") {
		t.Fatal("prompt should only contain the picked market CVs")
	}

	english := BuildComparePrompt(testCompareInput("en"))
	if !strings.Contains(english, "Ngôn ngữ cho toàn bộ nội dung nhận xét: English") {
		t.Fatalf("english prompt should request English output:\n%s", english)
	}
}

func TestDecodeComparisonKeepsOnlyKnownBestID(t *testing.T) {
	raw := `{"summary":"CV trong chợ nổi bật hơn.","bestCvId":"market-1","bestReasons":["Thành tích đo lường được"],"myStrengths":["Kỹ năng Go"],"myGaps":["Thiếu số liệu"],"marketHighlights":["Nêu KPI rõ"]}`
	ids := []string{"mine-1", "market-1"}

	comparison, err := DecodeComparison(raw, ids)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if comparison.BestCvID != "market-1" {
		t.Fatalf("unexpected best id: %q", comparison.BestCvID)
	}
	if comparison.Summary != "CV trong chợ nổi bật hơn." || len(comparison.MyGaps) != 1 {
		t.Fatalf("unexpected comparison: %+v", comparison)
	}

	unknown, err := DecodeComparison(strings.Replace(raw, `"bestCvId":"market-1"`, `"bestCvId":"ghost-9"`, 1), ids)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if unknown.BestCvID != "" {
		t.Fatalf("unknown ids must be dropped, got %q", unknown.BestCvID)
	}

	fenced, err := DecodeComparison("```json\n"+raw+"\n```", ids)
	if err != nil {
		t.Fatalf("code fences should be stripped: %v", err)
	}
	if fenced.BestCvID != "market-1" {
		t.Fatalf("unexpected fenced best id: %q", fenced.BestCvID)
	}
}

func TestDecodeComparisonRejectsMalformedJSON(t *testing.T) {
	if _, err := DecodeComparison("{not json", []string{"mine-1"}); err == nil {
		t.Fatal("expected an error for malformed JSON")
	}
}
