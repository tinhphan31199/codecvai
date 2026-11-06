package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"codecv/backend/internal/model"
	"codecv/backend/internal/positions"
)

func testBuilderContent() model.GeneratedCVContent {
	return model.GeneratedCVContent{
		Summary: "Kỹ sư backend 6 năm kinh nghiệm.",
		Experience: []model.GeneratedExperience{
			{
				Company: "Acme",
				Role:    "Senior Backend Engineer",
				Period:  "2021 - 2024",
				Bullets: []string{"Xây API thanh toán, giảm p95 từ 800ms xuống 200ms."},
			},
		},
		Skills: []model.GeneratedSkillGroup{{Group: "Ngôn ngữ", Items: []string{"Go", "PostgreSQL"}}},
	}
}

func builderAnalyzeUpstream(t *testing.T) string {
	t.Helper()

	criteria := make([]map[string]string, 0, 8)
	for index := 0; index < 8; index++ {
		criteria = append(criteria, map[string]string{
			"status": model.EvidenceVerified,
			"quote":  "Xây API thanh toán",
			"note":   "Bằng chứng từ CV.",
		})
	}

	analysisJSON, err := json.Marshal(map[string]any{
		"candidate": map[string]any{
			"name":            "Lê Hoàng Minh",
			"currentTitle":    "Backend Engineer",
			"yearsExperience": 6,
		},
		"summary":   "CV backend mạnh về Go.",
		"criteria":  criteria,
		"strengths": []string{"Kinh nghiệm thanh toán đo lường được"},
		"gaps":      []string{"Chưa nêu chứng chỉ cloud"},
		"questions": []any{},
	})
	if err != nil {
		t.Fatalf("cannot encode analysis: %v", err)
	}

	upstream, err := json.Marshal(map[string]any{
		"choices": []any{map[string]any{
			"message":       map[string]any{"content": string(analysisJSON)},
			"finish_reason": "stop",
		}},
	})
	if err != nil {
		t.Fatalf("cannot encode upstream payload: %v", err)
	}
	return string(upstream)
}

func builderAnalyzeBody(t *testing.T, input model.BuilderInput, content model.GeneratedCVContent) string {
	t.Helper()

	raw, err := json.Marshal(map[string]any{
		"modelId":  "gpt-test",
		"language": "vi",
		"input":    input,
		"content":  content,
	})
	if err != nil {
		t.Fatalf("cannot encode request: %v", err)
	}
	return string(raw)
}

func callBuilderAnalyze(t *testing.T, server *Server, body string) *httptest.ResponseRecorder {
	t.Helper()

	request := httptest.NewRequest(http.MethodPost, "/api/cv-builder/analyze", strings.NewReader(body))
	recorder := httptest.NewRecorder()
	server.handleBuilderAnalyze(recorder, request)
	return recorder
}

func TestHandleBuilderAnalyzeReturnsLiveReview(t *testing.T) {
	server := newGenerateServer(t, http.StatusOK, builderAnalyzeUpstream(t))
	input := testBuilderInput()
	// Không có trong danh mục để chấm bằng bộ tiêu chí chung.
	input.Position = "Kỹ sư Canh tác Dữ liệu Lượng Tử"

	recorder := callBuilderAnalyze(t, server, builderAnalyzeBody(t, input, testBuilderContent()))
	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status %d: %s", recorder.Code, recorder.Body.String())
	}

	var response model.Response
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("cannot decode response: %v", err)
	}

	if response.Analysis.Summary != "CV backend mạnh về Go." {
		t.Fatalf("unexpected summary: %q", response.Analysis.Summary)
	}
	if got := len(response.Analysis.Criteria); got != 5 {
		t.Fatalf("expected 5 synthetic criteria, got %d", got)
	}
	first := response.Analysis.Criteria[0]
	if first.Label != "Kinh nghiệm phù hợp với vị trí ứng tuyển" || first.Status != model.EvidenceVerified {
		t.Fatalf("unexpected first criterion: %+v", first)
	}
	if len(response.Analysis.Strengths) != 1 || len(response.Analysis.Gaps) != 1 {
		t.Fatalf("missing strengths/gaps: %+v", response.Analysis)
	}
	if len(response.Analysis.Questions) != 0 {
		t.Fatal("builder review must not request interview questions")
	}
	if response.Meta.Model != "gpt-test" {
		t.Fatalf("unexpected model meta: %+v", response.Meta)
	}
	if response.Analysis.Candidate.Email != "" {
		t.Fatalf("review should not invent contact fields: %+v", response.Analysis.Candidate)
	}
}

func TestHandleBuilderAnalyzeValidates(t *testing.T) {
	noPosition := testBuilderInput()
	noPosition.Position = "   "

	cases := []struct {
		name    string
		input   model.BuilderInput
		content model.GeneratedCVContent
		want    string
	}{
		{
			name:    "missing position",
			input:   noPosition,
			content: testBuilderContent(),
			want:    "Nhập vị trí ứng tuyển",
		},
		{
			name:    "empty draft",
			input:   testBuilderInput(),
			content: model.GeneratedCVContent{},
			want:    "Chưa có nội dung CV",
		},
	}

	server := newGenerateServer(t, http.StatusOK, builderAnalyzeUpstream(t))
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := callBuilderAnalyze(t, server, builderAnalyzeBody(t, tc.input, tc.content))
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
			}
			if !strings.Contains(recorder.Body.String(), tc.want) {
				t.Fatalf("unexpected message: %s", recorder.Body.String())
			}
		})
	}
}

func TestHandleBuilderAnalyzeRequiresActiveModel(t *testing.T) {
	server := &Server{}
	body, err := json.Marshal(map[string]any{
		"language": "vi",
		"input":    testBuilderInput(),
		"content":  testBuilderContent(),
	})
	if err != nil {
		t.Fatalf("cannot encode request: %v", err)
	}

	recorder := callBuilderAnalyze(t, server, string(body))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "model AI đang bật") {
		t.Fatalf("unexpected message: %s", recorder.Body.String())
	}
}

func TestHandleBuilderAnalyzeRejectsUnknownFields(t *testing.T) {
	server := newGenerateServer(t, http.StatusOK, builderAnalyzeUpstream(t))
	body := strings.TrimSuffix(builderAnalyzeBody(t, testBuilderInput(), testBuilderContent()), "}") + `,"extra":true}`

	recorder := callBuilderAnalyze(t, server, body)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestMatchReviewPositionPrefersRequestedLevel(t *testing.T) {
	candidates := []positions.Position{
		{ID: "junior", Title: "Backend Engineer", Level: "Junior"},
		{ID: "senior", Title: "backend engineer", Level: "Senior"},
		{ID: "frontend", Title: "Frontend Engineer", Level: "Senior"},
	}

	position, ok := matchReviewPosition(candidates, " Backend Engineer ", "Senior")
	if !ok || position.ID != "senior" {
		t.Fatalf("expected senior backend, got %+v (ok=%v)", position, ok)
	}

	position, ok = matchReviewPosition(candidates, "Backend Engineer", "Staff")
	if !ok || position.ID != "junior" {
		t.Fatalf("level miss should fall back to the title match, got %+v (ok=%v)", position, ok)
	}

	if _, ok := matchReviewPosition(candidates, "Data Engineer", ""); ok {
		t.Fatal("unknown title must not match")
	}
}
