package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const testFrontendOrigin = "https://codecvai.onrender.com"

func newCORSTestHandler(allowed []string) http.Handler {
	return cors(allowed, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
}

func TestCORSAllowsConfiguredOrigin(t *testing.T) {
	handler := newCORSTestHandler([]string{testFrontendOrigin + "/"})

	request := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	request.Header.Set("Origin", testFrontendOrigin)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != testFrontendOrigin {
		t.Errorf("allow origin = %q, want %q", got, testFrontendOrigin)
	}
	if vary := response.Header().Get("Vary"); !strings.Contains(vary, "Origin") {
		t.Errorf("Vary = %q, want Origin", vary)
	}
}

func TestCORSPreflightAllowsConfiguredOrigin(t *testing.T) {
	handler := newCORSTestHandler([]string{testFrontendOrigin})

	request := httptest.NewRequest(http.MethodOptions, "/api/analyze-cv", nil)
	request.Header.Set("Origin", testFrontendOrigin)
	request.Header.Set("Access-Control-Request-Method", http.MethodPost)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != testFrontendOrigin {
		t.Errorf("allow origin = %q, want %q", got, testFrontendOrigin)
	}
	methods := response.Header().Get("Access-Control-Allow-Methods")
	for _, method := range []string{"GET", "POST", "PATCH", "DELETE"} {
		if !strings.Contains(methods, method) {
			t.Errorf("allow methods = %q, missing %s", methods, method)
		}
	}
	headers := response.Header().Get("Access-Control-Allow-Headers")
	for _, header := range []string{"Content-Type", "Authorization"} {
		if !strings.Contains(headers, header) {
			t.Errorf("allow headers = %q, missing %s", headers, header)
		}
	}
}

func TestCORSPreflightRejectsUnknownOrigin(t *testing.T) {
	handler := newCORSTestHandler([]string{testFrontendOrigin})

	request := httptest.NewRequest(http.MethodOptions, "/api/analyze-cv", nil)
	request.Header.Set("Origin", "https://evil.example")
	request.Header.Set("Access-Control-Request-Method", http.MethodPost)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("allow origin = %q, want empty", got)
	}
}

func TestCORSPassesThroughWithoutOrigin(t *testing.T) {
	handler := newCORSTestHandler([]string{testFrontendOrigin})

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("allow origin = %q, want empty", got)
	}
}
