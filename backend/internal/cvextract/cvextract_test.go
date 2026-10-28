package cvextract

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"
)

func buildDOCX(t *testing.T, body string) []byte {
	t.Helper()

	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	file, err := writer.Create("word/document.xml")
	if err != nil {
		t.Fatalf("create document.xml: %v", err)
	}

	document := `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>` + body + `</w:body></w:document>`
	if _, err := file.Write([]byte(document)); err != nil {
		t.Fatalf("write document.xml: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close docx: %v", err)
	}
	return buffer.Bytes()
}

func TestDetect(t *testing.T) {
	cases := []struct {
		name     string
		mime     string
		expected Type
		ok       bool
	}{
		{"cv.pdf", "application/pdf", TypePDF, true},
		{"cv.docx", "", TypeDOCX, true},
		{"cv", docxMIME, TypeDOCX, true},
		{"cv.txt", "text/plain", "", false},
	}

	for _, testCase := range cases {
		fileType, ok := Detect(testCase.name, testCase.mime)
		if ok != testCase.ok || fileType != testCase.expected {
			t.Fatalf("Detect(%q, %q) = (%q, %v), want (%q, %v)", testCase.name, testCase.mime, fileType, ok, testCase.expected, testCase.ok)
		}
	}
}

func TestExtractDOCX(t *testing.T) {
	body := `<w:p><w:r><w:t>Le Hoang Minh - Senior .NET Backend Engineer</w:t></w:r></w:p>` +
		`<w:p><w:r><w:t>Backend engineer with 8 years of experience building payment and order services.</w:t></w:r></w:p>` +
		`<w:p><w:r><w:t>Skills: C#, .NET, EF Core, PostgreSQL, RabbitMQ, Docker, CI/CD, xUnit.</w:t></w:r></w:p>`

	result, err := Extract(buildDOCX(t, body), TypeDOCX)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "Senior .NET Backend Engineer") {
		t.Fatalf("text missing content: %q", result.Text)
	}
	if !strings.Contains(result.Text, "PostgreSQL") {
		t.Fatalf("text missing second paragraph: %q", result.Text)
	}
	if result.Pages != nil {
		t.Fatalf("docx should not report pages, got %v", *result.Pages)
	}
	if result.Characters != len([]rune(result.Text)) {
		t.Fatalf("character count mismatch: %d vs %d", result.Characters, len([]rune(result.Text)))
	}
	if result.Truncated {
		t.Fatal("short document should not be truncated")
	}
}

func TestExtractRejectsShortText(t *testing.T) {
	_, err := Extract(buildDOCX(t, `<w:p><w:r><w:t>Quá ngắn</w:t></w:r></w:p>`), TypeDOCX)
	if err == nil {
		t.Fatal("expected error for short text")
	}

	extractionError, ok := err.(*Error)
	if !ok {
		t.Fatalf("expected *Error, got %T", err)
	}
	if extractionError.Code != "no_text" {
		t.Fatalf("unexpected code: %s", extractionError.Code)
	}
}

func TestExtractRejectsBrokenArchive(t *testing.T) {
	if _, err := Extract([]byte("not a zip"), TypeDOCX); err == nil {
		t.Fatal("expected error for broken docx")
	}
}

func TestBestEffortKeepsShortText(t *testing.T) {
	result := BestEffort(buildDOCX(t, `<w:p><w:r><w:t>Quá ngắn</w:t></w:r></w:p>`), TypeDOCX)
	if result.Text != "Quá ngắn" {
		t.Fatalf("unexpected text: %q", result.Text)
	}
	if result.Characters != len([]rune("Quá ngắn")) {
		t.Fatalf("unexpected characters: %d", result.Characters)
	}
}

func TestBestEffortIgnoresBrokenFile(t *testing.T) {
	result := BestEffort([]byte("not a zip"), TypeDOCX)
	if result.Text != "" || result.Characters != 0 || result.Pages != nil || result.Truncated {
		t.Fatalf("broken file should yield empty result, got %+v", result)
	}
}
