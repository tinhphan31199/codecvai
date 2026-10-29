package storage

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const testBucket = "codecv-cv"

func newTestClient(t *testing.T, endpoint string) *Client {
	t.Helper()
	client, err := New(context.Background(), Config{
		Endpoint:  endpoint,
		Region:    "us-east-2",
		AccessKey: "test-access",
		SecretKey: "test-secret",
		Bucket:    testBucket,
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return client
}

func TestPutUploadsPathStyleObject(t *testing.T) {
	var (
		gotPath string
		gotType string
		gotBody []byte
	)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			t.Errorf("method = %s, want PUT", r.Method)
		}
		gotPath = r.URL.Path
		gotType = r.Header.Get("Content-Type")
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	if err := client.Put(context.Background(), "cv/abc/cv.pdf", "application/pdf", []byte("%PDF-1.4")); err != nil {
		t.Fatalf("Put: %v", err)
	}

	if want := "/" + testBucket + "/cv/abc/cv.pdf"; gotPath != want {
		t.Errorf("path = %q, want %q", gotPath, want)
	}
	if gotType != "application/pdf" {
		t.Errorf("content type = %q, want application/pdf", gotType)
	}
	if string(gotBody) != "%PDF-1.4" {
		t.Errorf("body = %q, want %%PDF-1.4", gotBody)
	}
}

func TestGetReturnsObject(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if want := "/" + testBucket + "/cv/abc/cv.pdf"; r.URL.Path != want {
			t.Errorf("path = %q, want %q", r.URL.Path, want)
		}
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Length", "8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("%PDF-1.4"))
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	object, err := client.Get(context.Background(), "cv/abc/cv.pdf")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	defer object.Body.Close()

	body, err := io.ReadAll(object.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if string(body) != "%PDF-1.4" {
		t.Errorf("body = %q, want %%PDF-1.4", body)
	}
	if object.ContentType != "application/pdf" {
		t.Errorf("content type = %q, want application/pdf", object.ContentType)
	}
	if object.Size != 8 {
		t.Errorf("size = %d, want 8", object.Size)
	}
}

func TestGetMapsMissingObject(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>not found</Message></Error>`))
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	_, err := client.Get(context.Background(), "cv/abc/missing.pdf")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("Get error = %v, want ErrNotFound", err)
	}
}

func TestKeySanitizesFileName(t *testing.T) {
	key, err := Key(`..\docs/cv.pdf`)
	if err != nil {
		t.Fatalf("Key: %v", err)
	}
	if !strings.HasPrefix(key, "cv/") {
		t.Errorf("key = %q, want cv/ prefix", key)
	}
	if !strings.HasSuffix(key, "/cv.pdf") {
		t.Errorf("key = %q, want /cv.pdf suffix", key)
	}
	if strings.Contains(key, "..") {
		t.Errorf("key = %q, should not contain traversal segments", key)
	}
}

func TestKeyRejectsEmptyName(t *testing.T) {
	if _, err := Key("   "); err == nil {
		t.Fatal("Key accepted a blank file name")
	}
}

func TestNewRejectsIncompleteConfig(t *testing.T) {
	if _, err := New(context.Background(), Config{Endpoint: "http://localhost", Region: "us-east-2"}); err == nil {
		t.Fatal("New accepted a config missing credentials and bucket")
	}
}

func TestFromEnvDisabledWhenIncomplete(t *testing.T) {
	for _, key := range []string{
		"AWS_ENDPOINT_URL_S3", "AWS_REGION", "AWS_ACCESS_KEY_ID",
		"AWS_SECRET_ACCESS_KEY", "S3_BUCKET",
	} {
		t.Setenv(key, "")
	}
	if client := FromEnv(context.Background()); client != nil {
		t.Fatal("FromEnv returned a client while configuration is incomplete")
	}
}
