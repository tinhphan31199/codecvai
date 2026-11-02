package github

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestRepoStoresTreeDetailsAndFile(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/octo/demo":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"name":              "demo",
				"full_name":         "octo/demo",
				"description":       "Tiny Go service",
				"language":          "Go",
				"stargazers_count":  12,
				"forks_count":       3,
				"subscribers_count": 4,
				"open_issues_count": 1,
				"size":              2048,
				"topics":            []string{"api", "go"},
				"default_branch":    "main",
				"pushed_at":         "2026-10-01T00:00:00Z",
				"created_at":        "2024-01-01T00:00:00Z",
				"license":           map[string]string{"name": "MIT License"},
			})
		case "/repos/octo/demo/languages":
			_ = json.NewEncoder(w).Encode(map[string]float64{"Go": 900, "Shell": 100})
		case "/repos/octo/demo/readme":
			_, _ = w.Write([]byte("# Demo\nTiny Go service."))
		case "/repos/octo/demo/contents":
			_ = json.NewEncoder(w).Encode([]map[string]string{{"name": "cmd", "type": "dir"}})
		case "/repos/octo/demo/commits":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"sha": "abcdef123456", "commit": map[string]any{
					"message": "init",
					"author":  map[string]string{"date": "2026-10-01T00:00:00Z"},
				}},
			})
		case "/repos/octo/demo/git/trees/main":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"truncated": false,
				"tree": []map[string]any{
					{"path": "cmd", "type": "tree", "sha": "t1"},
					{"path": "cmd/app", "type": "tree", "sha": "t2"},
					{"path": "cmd/app/main.go", "type": "blob", "sha": "b1", "size": 120},
					{"path": "main.go", "type": "blob", "sha": "b2", "size": 80},
					{"path": "node_modules", "type": "tree", "sha": "t3"},
					{"path": "node_modules/lib/index.js", "type": "blob", "sha": "b3", "size": 40},
				},
			})
		case "/repos/octo/demo/git/blobs/b2":
			_, _ = w.Write([]byte("package main\n\nfunc main() {}\n"))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := New(server.URL, "")
	repository := client.Repo(context.Background(), "octo", "demo")
	if repository.Status != model.RepositoryAnalyzed {
		t.Fatalf("status = %q, want analyzed", repository.Status)
	}
	if len(repository.Tree) == 0 {
		t.Fatal("repo tree should be populated")
	}
	if repository.Tree[0].Type != "folder" || repository.Tree[0].Name != "cmd" {
		t.Fatalf("tree = %+v, want cmd folder first", repository.Tree)
	}
	if got := len(repository.Tree[0].Children[0].Children); got != 1 {
		t.Fatalf("cmd/app children = %d, want the main.go file", got)
	}

	details := repository.Details
	if details == nil {
		t.Fatal("details should be populated")
	}
	if details.FileCount != 2 {
		t.Fatalf("file count = %d, want 2 (node_modules ignored)", details.FileCount)
	}
	if details.Stars != 12 || details.Forks != 3 || details.License != "MIT License" {
		t.Fatalf("details = %+v, want stars/forks/license", details)
	}
	if len(details.Languages) != 2 || details.Languages[0].Name != "Go" || details.Languages[0].Percent != 90 {
		t.Fatalf("languages = %+v, want Go 90%%", details.Languages)
	}
	if len(details.Commits) != 1 || details.Commits[0].SHA != "abcdef1" {
		t.Fatalf("commits = %+v, want one commit", details.Commits)
	}

	content, truncated, err := client.File(context.Background(), "octo", "demo", "b2")
	if err != nil {
		t.Fatalf("file: %v", err)
	}
	if truncated || !strings.Contains(content, "func main()") {
		t.Fatalf("content = %q truncated=%v", content, truncated)
	}

	if _, _, err := client.File(context.Background(), "octo", "demo", ""); err == nil {
		t.Fatal("empty blob sha should fail")
	}
}
