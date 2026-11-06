package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"codecv/backend/internal/model"
)

func testGeneratedContent() model.GeneratedCVContent {
	return model.GeneratedCVContent{
		Summary: "Kỹ sư backend 6 năm kinh nghiệm.",
		Experience: []model.GeneratedExperience{
			{Company: "Acme", Role: "Senior Backend Engineer", Period: "2021 - 2024", Bullets: []string{"Xây API thanh toán."}},
		},
		Skills: []model.GeneratedSkillGroup{
			{Group: "Ngôn ngữ", Items: []string{"Go"}},
		},
	}
}

func testGeneratedCVRequest() generatedCVRequest {
	return generatedCVRequest{
		Name:     "CV Backend",
		Language: "vi",
		Template: "sidebar",
		Accent:   "emerald",
		Content:  testGeneratedContent(),
		Input:    testBuilderInput(),
		ModelID:  "gpt-test",
		Provider: "OpenAI",
	}
}

func TestValidateGeneratedCVNormalizes(t *testing.T) {
	body := testGeneratedCVRequest()
	body.Name = strings.Repeat("A", 200)
	body.Language = "EN"
	body.Template = " Sidebar "
	body.Accent = "EMERALD "

	fields, ok := (&Server{}).validateGeneratedCV(httptest.NewRecorder(), body)
	if !ok {
		t.Fatal("valid payload should be accepted")
	}

	if len([]rune(fields.Name)) != 160 {
		t.Fatalf("name should be clipped to 160 runes: %d", len([]rune(fields.Name)))
	}
	if fields.Language != "en" || fields.Template != "sidebar" || fields.Accent != "emerald" {
		t.Fatalf("unexpected style fields: %+v", fields)
	}
	if fields.TargetPosition != "Backend Engineer" || fields.Level != "Senior" {
		t.Fatalf("target position and level should come from the input: %+v", fields)
	}
	if fields.Input.FullName != "Lê Hoàng Minh" {
		t.Fatalf("input should be normalized: %+v", fields.Input)
	}
	if fields.Content.Summary == "" || len(fields.Content.Experience) != 1 {
		t.Fatalf("content should be kept: %+v", fields.Content)
	}
}

func TestValidateGeneratedCVClipsContent(t *testing.T) {
	body := testGeneratedCVRequest()
	body.Content.Summary = strings.Repeat("x", 1200)

	fields, ok := (&Server{}).validateGeneratedCV(httptest.NewRecorder(), body)
	if !ok {
		t.Fatal("payload should be accepted")
	}
	if len([]rune(fields.Content.Summary)) != 900 {
		t.Fatalf("summary should be clipped to 900 runes: %d", len([]rune(fields.Content.Summary)))
	}
}

func TestValidateGeneratedCVRejectsInvalidPayloads(t *testing.T) {
	emptyContent := testGeneratedCVRequest()
	emptyContent.Content = model.GeneratedCVContent{}

	badTemplate := testGeneratedCVRequest()
	badTemplate.Template = "fancy"

	badAccent := testGeneratedCVRequest()
	badAccent.Accent = "violet"

	noFacts := testGeneratedCVRequest()
	noFacts.Input.Experiences = nil
	noFacts.Input.Skills = nil

	cases := []struct {
		name string
		body generatedCVRequest
		want string
	}{
		{name: "empty content", body: emptyContent, want: "Nội dung CV trống"},
		{name: "unknown template", body: badTemplate, want: "Template không hợp lệ"},
		{name: "unknown accent", body: badAccent, want: "Màu nhấn không hợp lệ"},
		{name: "no builder facts", body: noFacts, want: "ít nhất một kinh nghiệm"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			if _, ok := (&Server{}).validateGeneratedCV(recorder, tc.body); ok {
				t.Fatal("payload should be rejected")
			}
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d", recorder.Code)
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
