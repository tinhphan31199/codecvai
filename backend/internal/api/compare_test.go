package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"codecv/backend/internal/model"
)

func compareRequestBody(t *testing.T, extra map[string]any) string {
	t.Helper()

	payload := map[string]any{
		"modelId":     "gpt-test",
		"language":    "vi",
		"myCvId":      "cv-1",
		"marketCvIds": []string{"market-1"},
	}
	for key, value := range extra {
		payload[key] = value
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("cannot encode request: %v", err)
	}
	return string(raw)
}

func callCompare(t *testing.T, server *Server, body string, withUser bool) *httptest.ResponseRecorder {
	t.Helper()

	request := httptest.NewRequest(http.MethodPost, "/api/cv-compare", strings.NewReader(body))
	if withUser {
		request = request.WithContext(context.WithValue(request.Context(), userContextKey{}, model.User{
			ID: "u-1", Username: "tester", Role: model.RoleMember,
		}))
	}
	recorder := httptest.NewRecorder()
	server.handleCompareCVs(recorder, request)
	return recorder
}

func TestHandleCompareCVsRequiresSession(t *testing.T) {
	server := &Server{}
	recorder := callCompare(t, server, compareRequestBody(t, nil), false)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestHandleCompareCVsValidates(t *testing.T) {
	cases := []struct {
		name string
		body string
		want string
	}{
		{
			name: "missing my cv",
			body: compareRequestBody(t, map[string]any{"myCvId": "   "}),
			want: "Chọn CV của bạn",
		},
		{
			name: "missing market cvs",
			body: compareRequestBody(t, map[string]any{"marketCvIds": []string{}}),
			want: "Chọn ít nhất một CV trong chợ",
		},
		{
			name: "blank market ids",
			body: compareRequestBody(t, map[string]any{"marketCvIds": []string{"  ", ""}}),
			want: "Chọn ít nhất một CV trong chợ",
		},
	}

	server := &Server{}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := callCompare(t, server, tc.body, true)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
			}
			if !strings.Contains(recorder.Body.String(), tc.want) {
				t.Fatalf("unexpected message: %s", recorder.Body.String())
			}
		})
	}
}

func TestHandleCompareCVsRejectsUnknownFields(t *testing.T) {
	server := &Server{}
	body := strings.TrimSuffix(compareRequestBody(t, nil), "}") + `,"extra":true}`

	recorder := callCompare(t, server, body, true)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestHandleCompareCVsRequiresActiveModel(t *testing.T) {
	server := &Server{}
	recorder := callCompare(t, server, compareRequestBody(t, map[string]any{"modelId": ""}), true)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "model AI đang bật") {
		t.Fatalf("unexpected message: %s", recorder.Body.String())
	}
}

func TestGeneratedCompareProfile(t *testing.T) {
	cv := model.GeneratedCV{
		ID:             "cv-1",
		Name:           "  Lê Hoàng Minh  ",
		TargetPosition: "  Backend Engineer  ",
		Content: model.GeneratedCVContent{
			Summary: "  Kỹ sư backend 6 năm kinh nghiệm.  ",
			Experience: []model.GeneratedExperience{
				{Bullets: []string{"Xây API thanh toán.", "Giảm p95 xuống 200ms.", "Tối ưu chi phí cloud."}},
			},
			Projects: []model.GeneratedProject{
				{Bullets: []string{"Dựng hệ thống giám sát."}},
			},
			Skills: []model.GeneratedSkillGroup{
				{Items: []string{"Go", "go", "PostgreSQL"}},
			},
			Certifications: []model.GeneratedCertification{
				{Name: "AWS Solutions Architect"},
				{Name: "CKA"},
			},
		},
		Input: model.BuilderInput{
			Level:  "Senior",
			Years:  6,
			Skills: []string{"Go"},
		},
	}

	profile := generatedCompareProfile(cv)
	if profile.Source != "mine" || profile.ID != "cv-1" {
		t.Fatalf("unexpected identity: %+v", profile)
	}
	if profile.Name != "Lê Hoàng Minh" || profile.Title != "Backend Engineer" {
		t.Fatalf("fields should be trimmed: %+v", profile)
	}
	if profile.Level != "Senior" || profile.Years != 6 {
		t.Fatalf("unexpected level/years: %+v", profile)
	}
	if profile.Summary != "Kỹ sư backend 6 năm kinh nghiệm." {
		t.Fatalf("unexpected summary: %q", profile.Summary)
	}
	if len(profile.Skills) != 2 || profile.Skills[0] != "Go" || profile.Skills[1] != "PostgreSQL" {
		t.Fatalf("skills should be deduped, got %v", profile.Skills)
	}
	wantHighlights := []string{
		"Xây API thanh toán.",
		"Giảm p95 xuống 200ms.",
		"Dựng hệ thống giám sát.",
		"Chứng chỉ: AWS Solutions Architect, CKA",
	}
	if len(profile.Highlights) != len(wantHighlights) {
		t.Fatalf("unexpected highlights: %v", profile.Highlights)
	}
	for index, want := range wantHighlights {
		if profile.Highlights[index] != want {
			t.Fatalf("highlight %d: got %q, want %q", index, profile.Highlights[index], want)
		}
	}
}

func TestMarketCompareProfile(t *testing.T) {
	profile := marketCompareProfile(model.MarketCV{
		ID:         "market-1",
		Name:       "  Trần Mai ",
		Title:      " Senior Backend Engineer ",
		Level:      "Senior",
		Years:      7,
		Category:   "backend",
		Summary:    "Chuyên thanh toán.",
		Skills:     []string{"Go", "Kubernetes"},
		Highlights: []string{"Nêu KPI rõ"},
	})

	if profile.Source != "market" || profile.ID != "market-1" || profile.Name != "Trần Mai" {
		t.Fatalf("unexpected identity: %+v", profile)
	}
	if profile.Title != "Senior Backend Engineer" || profile.Category != "backend" {
		t.Fatalf("unexpected fields: %+v", profile)
	}
	if len(profile.Skills) != 2 || len(profile.Highlights) != 1 {
		t.Fatalf("unexpected lists: %+v", profile)
	}
}
