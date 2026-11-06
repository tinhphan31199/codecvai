package store

import (
	"strings"
	"testing"
)

func TestGeneratedCVDefaultsAndName(t *testing.T) {
	if language, template, accent := generatedCVDefaults("", "", ""); language != "vi" ||
		template != "classic" || accent != "sky" {
		t.Fatalf("defaults = %q/%q/%q", language, template, accent)
	}
	if language, template, accent := generatedCVDefaults("en", "sidebar", "emerald"); language != "en" ||
		template != "sidebar" || accent != "emerald" {
		t.Fatalf("explicit values = %q/%q/%q", language, template, accent)
	}
	if name := generatedCVName("  ", " Nguyễn Văn Test "); name != "Nguyễn Văn Test" {
		t.Fatalf("fallback name = %q", name)
	}
	if name := generatedCVName("", ""); name != "CV" {
		t.Fatalf("empty name = %q", name)
	}
}

func TestGeneratedCVIdIsUniqueAndReadable(t *testing.T) {
	first := generatedCVId("Nguyễn Văn Test", "")
	second := generatedCVId("Nguyễn Văn Test", "")
	if first == second {
		t.Fatalf("duplicate ids: %s", first)
	}
	if !strings.HasPrefix(first, "gcv-nguyen-van-test-") {
		t.Fatalf("id = %q", first)
	}
}
