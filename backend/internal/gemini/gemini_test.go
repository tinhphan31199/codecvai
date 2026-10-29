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

	"codecv/backend/internal/analysis"
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
		Input: analysis.Input{
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
		},
		Model: "gemini-3.5-flash-lite",
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

func TestExtractLinksSendsFileAndParsesLinks(t *testing.T) {
	var captured map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Path; got != "/v1beta/models/gemini-3.5-flash-lite:generateContent" {
			t.Errorf("unexpected path: %s", got)
		}
		if key := r.Header.Get("x-goog-api-key"); key != "test-key" {
			t.Errorf("unexpected api key: %q", key)
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Errorf("decode request: %v", err)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"candidates": []any{map[string]any{
				"content": map[string]any{"parts": []any{map[string]any{
					"text": `{"links":["https://github.com/luankat0306","","https://github.com/luankat0306/VietJob_FrontEnd"]}`,
				}}},
				"finishReason": "STOP",
			}},
		})
	}))
	defer server.Close()

	client := New(server.URL+"/v1beta", "test-key")
	urls, err := client.ExtractLinks(
		context.Background(),
		"gemini-3.5-flash-lite",
		"https://example.test/v1beta/files/abc123",
		"application/pdf",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(urls) != 2 || urls[0] != "https://github.com/luankat0306" {
		t.Fatalf("unexpected links: %+v", urls)
	}

	contents, ok := captured["contents"].([]any)
	if !ok || len(contents) != 1 {
		t.Fatalf("unexpected contents: %+v", captured["contents"])
	}
	parts := contents[0].(map[string]any)["parts"].([]any)
	if len(parts) != 2 {
		t.Fatalf("expected file_data and text parts, got %+v", parts)
	}
	filePart := parts[0].(map[string]any)["file_data"].(map[string]any)
	if filePart["file_uri"] != "https://example.test/v1beta/files/abc123" {
		t.Fatalf("unexpected file_uri: %v", filePart["file_uri"])
	}
	if filePart["mime_type"] != "application/pdf" {
		t.Fatalf("unexpected mime_type: %v", filePart["mime_type"])
	}
	text, ok := parts[1].(map[string]any)["text"].(string)
	if !ok || !strings.Contains(text, "GitHub") {
		t.Fatalf("text part should ask for GitHub links, got %+v", parts[1])
	}
}

func TestExtractLinksRejectsMalformedOutput(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"candidates": []any{map[string]any{
				"content":      map[string]any{"parts": []any{map[string]any{"text": "not json"}}},
				"finishReason": "STOP",
			}},
		})
	}))
	defer server.Close()

	client := New(server.URL+"/v1beta", "test-key")
	_, err := client.ExtractLinks(context.Background(), "gemini-3.5-flash-lite", "https://example.test/files/abc", "application/pdf")
	if err == nil {
		t.Fatal("expected error")
	}

	var geminiErr *Error
	if !errors.As(err, &geminiErr) || geminiErr.Code != "invalid_output" {
		t.Fatalf("expected invalid_output, got %v", err)
	}
}
