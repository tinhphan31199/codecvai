package github

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"codecv/backend/internal/links"
	"codecv/backend/internal/model"
)

func TestEvidenceReadsRepoWithUppercaseName(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/luankat0306/VietJob_FrontEnd":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"full_name":        "luankat0306/VietJob_FrontEnd",
				"language":         "TypeScript",
				"stargazers_count": 3,
				"default_branch":   "master",
				"pushed_at":        "2026-10-01T00:00:00Z",
			})
		case "/repos/luankat0306/VietJob_FrontEnd/languages":
			_ = json.NewEncoder(w).Encode(map[string]float64{"TypeScript": 1000})
		case "/repos/luankat0306/VietJob_FrontEnd/readme":
			_, _ = w.Write([]byte("# VietJob\nJob board cho ứng viên IT."))
		case "/repos/luankat0306/VietJob_FrontEnd/contents":
			_ = json.NewEncoder(w).Encode([]map[string]string{{"name": "src", "type": "dir"}})
		case "/repos/luankat0306/VietJob_FrontEnd/commits":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"sha": "abc123",
					"commit": map[string]any{
						"message": "init",
						"author":  map[string]string{"date": "2026-10-01T00:00:00Z"},
					},
				},
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	extraction := links.Extract("Dự án: https://github.com/luankat0306/VietJob_FrontEnd")
	evidence := New(server.URL, "").Evidence(context.Background(), extraction)

	if evidence.Meta.Targets != 1 {
		t.Fatalf("expected 1 target, got %+v", evidence.Meta)
	}
	if evidence.Meta.Analyzed != 1 {
		t.Fatalf("uppercase repo should be analyzed, got %+v", evidence.Meta)
	}
	if len(evidence.Repositories) != 1 || evidence.Repositories[0].Status != model.RepositoryAnalyzed {
		t.Fatalf("repo should be analyzed, got %+v", evidence.Repositories)
	}
	if evidence.Context == "" {
		t.Fatal("github context should contain the repo section")
	}
}
