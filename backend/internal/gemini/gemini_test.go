package gemini

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
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
		Model:         "gemini-3.5-flash-lite",
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
	prompt := buildPrompt(input)

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

func TestNormalizeAnalysisMapsCriteriaByPosition(t *testing.T) {
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

	analysis := normalizeAnalysis(raw, input)

	if analysis.Candidate.Name != "Lê Hoàng Minh" {
		t.Fatalf("unexpected name: %s", analysis.Candidate.Name)
	}
	if analysis.Candidate.YearsExperience != 9 {
		t.Fatalf("unexpected years: %d", analysis.Candidate.YearsExperience)
	}
	if len(analysis.Criteria) != len(input.Position.Criteria) {
		t.Fatalf("expected %d criteria, got %d", len(input.Position.Criteria), len(analysis.Criteria))
	}
	if analysis.Criteria[0].Label != input.Position.Criteria[0].Label {
		t.Fatalf("criteria labels should come from position, got %s", analysis.Criteria[0].Label)
	}
	if analysis.Criteria[2].Status != model.EvidenceMissing {
		t.Fatalf("unknown status should become missing, got %s", analysis.Criteria[2].Status)
	}
	if analysis.Criteria[2].Quote != "" {
		t.Fatalf("missing criteria should drop the quote, got %q", analysis.Criteria[2].Quote)
	}
	if len(analysis.Repositories) != 1 || analysis.Repositories[0].Status != model.RepositoryAnalyzed {
		t.Fatalf("repositories should be passed through: %+v", analysis.Repositories)
	}
	if len(analysis.Strengths) != 2 {
		t.Fatalf("empty strengths should be dropped, got %+v", analysis.Strengths)
	}
	if len(analysis.Questions) != 1 || analysis.Questions[0].Topic != "Architecture" {
		t.Fatalf("unexpected questions: %+v", analysis.Questions)
	}

	empty := normalizeAnalysis(map[string]any{}, Input{
		Position:         input.Position,
		IncludeQuestions: false,
	})
	if empty.Repositories == nil || empty.Questions == nil {
		t.Fatal("empty analysis should return empty arrays, not null")
	}
}

func TestBuildPromptUsesAttachedFile(t *testing.T) {
	input := testInput(t)
	input.CVFileURI = "https://generativelanguage.googleapis.com/v1beta/files/abc123"
	input.CVFileMime = "application/pdf"

	prompt := buildPrompt(input)

	if !strings.Contains(prompt, "file_data") {
		t.Fatal("file mode prompt should reference file_data")
	}
	if strings.Contains(prompt, input.CVText) {
		t.Fatal("file mode prompt should not embed the extracted CV text")
	}
}

func newAnalyzeServer(t *testing.T, captured *map[string]any, expectedKey string) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-goog-api-key") != expectedKey {
			t.Errorf("unexpected api key: %q", r.Header.Get("x-goog-api-key"))
		}
		if err := json.NewDecoder(r.Body).Decode(captured); err != nil {
			t.Errorf("decode request: %v", err)
		}

		analysis := `{"candidate":{"name":"A"},"summary":"ok","criteria":[],"strengths":[],"gaps":[],"questions":[]}`
		_ = json.NewEncoder(w).Encode(map[string]any{
			"candidates": []any{map[string]any{
				"content":      map[string]any{"parts": []any{map[string]any{"text": analysis}}},
				"finishReason": "STOP",
			}},
		})
	}))
}

func TestAnalyzeSendsFileDataPart(t *testing.T) {
	var captured map[string]any
	server := newAnalyzeServer(t, &captured, "test-key")
	defer server.Close()

	client := New(server.URL+"/v1beta", "test-key")
	input := testInput(t)
	input.CVText = ""
	input.CVFileURI = "https://generativelanguage.googleapis.com/v1beta/files/abc123"
	input.CVFileMime = "application/pdf"

	if _, err := client.Analyze(context.Background(), input); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	contents, ok := captured["contents"].([]any)
	if !ok || len(contents) != 1 {
		t.Fatalf("unexpected contents: %+v", captured["contents"])
	}
	parts, ok := contents[0].(map[string]any)["parts"].([]any)
	if !ok || len(parts) != 2 {
		t.Fatalf("expected file_data and text parts, got %+v", parts)
	}
	filePart, ok := parts[0].(map[string]any)["file_data"].(map[string]any)
	if !ok {
		t.Fatalf("first part should be file_data, got %+v", parts[0])
	}
	if filePart["file_uri"] != input.CVFileURI {
		t.Fatalf("unexpected file_uri: %v", filePart["file_uri"])
	}
	if filePart["mime_type"] != "application/pdf" {
		t.Fatalf("unexpected mime_type: %v", filePart["mime_type"])
	}
	if _, ok := parts[1].(map[string]any)["text"].(string); !ok {
		t.Fatalf("second part should be text, got %+v", parts[1])
	}
}

func TestAnalyzeKeepsSingleTextPartWithoutFile(t *testing.T) {
	var captured map[string]any
	server := newAnalyzeServer(t, &captured, "test-key")
	defer server.Close()

	client := New(server.URL+"/v1beta", "test-key")

	if _, err := client.Analyze(context.Background(), testInput(t)); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	contents := captured["contents"].([]any)
	parts := contents[0].(map[string]any)["parts"].([]any)
	if len(parts) != 1 {
		t.Fatalf("expected one text part, got %+v", parts)
	}
	if _, ok := parts[0].(map[string]any)["text"].(string); !ok {
		t.Fatalf("expected a text part, got %+v", parts[0])
	}
}

func TestUploadFilePollsUntilActive(t *testing.T) {
	var uploads, polls int
	fileData := "%PDF-1.4 fake cv"

	mux := http.NewServeMux()
	mux.HandleFunc("POST /upload/v1beta/files", func(w http.ResponseWriter, r *http.Request) {
		uploads++
		if key := r.Header.Get("x-goog-api-key"); key != "test-key" {
			t.Errorf("unexpected api key: %q", key)
		}
		if contentType := r.Header.Get("Content-Type"); !strings.HasPrefix(contentType, "multipart/related; boundary=") {
			t.Errorf("unexpected content type: %q", contentType)
		}

		mediaType, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || mediaType != "multipart/related" {
			t.Errorf("unexpected media type: %q (%v)", mediaType, err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		reader := multipart.NewReader(r.Body, params["boundary"])
		metadata, err := reader.NextPart()
		if err != nil {
			t.Errorf("metadata part: %v", err)
			return
		}
		metadataBody, _ := io.ReadAll(metadata)
		if !strings.Contains(string(metadataBody), "display_name") {
			t.Errorf("metadata missing display_name: %s", metadataBody)
		}
		binary, err := reader.NextPart()
		if err != nil {
			t.Errorf("file part: %v", err)
			return
		}
		if got := binary.Header.Get("Content-Type"); got != "application/pdf" {
			t.Errorf("unexpected file part content type: %q", got)
		}
		binaryBody, _ := io.ReadAll(binary)
		if string(binaryBody) != fileData {
			t.Errorf("unexpected file payload: %q", binaryBody)
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"file": map[string]any{
				"name":     "files/abc123",
				"mimeType": "application/pdf",
				"state":    "PROCESSING",
			},
		})
	})
	mux.HandleFunc("GET /v1beta/files/abc123", func(w http.ResponseWriter, _ *http.Request) {
		polls++
		_ = json.NewEncoder(w).Encode(map[string]any{
			"name":     "files/abc123",
			"uri":      "https://example.test/v1beta/files/abc123",
			"mimeType": "application/pdf",
			"state":    "ACTIVE",
		})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	client := New(server.URL+"/v1beta", "test-key")
	uploaded, err := client.UploadFile(context.Background(), "cv.pdf", "application/pdf", []byte(fileData))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if uploads != 1 || polls != 1 {
		t.Fatalf("expected 1 upload and 1 poll, got %d and %d", uploads, polls)
	}
	if uploaded.URI != "https://example.test/v1beta/files/abc123" {
		t.Fatalf("unexpected uri: %s", uploaded.URI)
	}
	if uploaded.MimeType != "application/pdf" {
		t.Fatalf("unexpected mime: %s", uploaded.MimeType)
	}
}

func TestUploadFileMapsHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = io.WriteString(w, `{"error":{"message":"quota"}}`)
	}))
	defer server.Close()

	client := New(server.URL+"/v1beta", "test-key")
	_, err := client.UploadFile(context.Background(), "cv.pdf", "application/pdf", []byte("%PDF-1.4"))
	if err == nil {
		t.Fatal("expected error")
	}

	var geminiErr *Error
	if !errors.As(err, &geminiErr) {
		t.Fatalf("expected *Error, got %T", err)
	}
	if geminiErr.Code != "upstream_error" {
		t.Fatalf("unexpected code: %s", geminiErr.Code)
	}
}
