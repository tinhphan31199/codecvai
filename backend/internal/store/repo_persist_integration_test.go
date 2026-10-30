package store

import (
	"context"
	"os"
	"testing"

	"codecv/backend/internal/model"
)

func TestSaveAnalysisRepositoriesQueue(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	s, err := Open(ctx, dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer s.Close()
	if err := s.Migrate(ctx); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if _, err := s.pool.Exec(ctx, `DELETE FROM candidates WHERE id LIKE 'repo-persist%'`); err != nil {
		t.Fatalf("cleanup: %v", err)
	}

	repositories := []model.RepositoryRecord{
		{
			URL:    "https://github.com/octocat/Hello-World",
			Label:  "github.com/octocat/hello-world",
			Kind:   model.RepositoryRepo,
			Status: model.RepositoryAnalyzed,
			Detail: "Đã đọc repo",
			Source: "cv",
		},
		{
			URL:    "https://github.com/octocat/Third-Repo",
			Label:  "github.com/octocat/third-repo",
			Kind:   model.RepositoryRepo,
			Status: model.RepositoryPending,
			Detail: "Đang chờ phân tích ở luồng nền",
			Source: "profile",
			Owner:  "octocat",
			Name:   "Third-Repo",
		},
		{
			URL:    "https://github.com/octocat/Empty-Repo",
			Label:  "github.com/octocat/empty-repo",
			Kind:   model.RepositoryRepo,
			Status: model.RepositoryPending,
			Detail: "Đang chờ phân tích ở luồng nền",
			Source: "profile",
			Owner:  "octocat",
			Name:   "Empty-Repo",
		},
	}

	id, err := s.SaveAnalysis(ctx, SaveAnalysisInput{
		Position:     "Backend",
		Level:        "Middle",
		Model:        "test",
		FileName:     "cv.pdf",
		Analysis:     model.Analysis{Candidate: model.Candidate{Name: "Repo Persist"}},
		Repositories: repositories,
	})
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	defer func() {
		if _, err := s.pool.Exec(ctx, `DELETE FROM candidates WHERE id=$1`, id); err != nil {
			t.Errorf("cleanup after: %v", err)
		}
	}()

	rows, err := s.CandidateRepositories(ctx, id)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(rows) != len(repositories) {
		t.Fatalf("saved %d repositories, want %d", len(rows), len(repositories))
	}
	for i, row := range rows {
		if row.Status != repositories[i].Status || row.URL != repositories[i].URL {
			t.Errorf("row %d = %s/%s, want %s/%s", i, row.URL, row.Status, repositories[i].URL, repositories[i].Status)
		}
	}

	var repo, repoState, source string
	if err := s.pool.QueryRow(ctx,
		`SELECT repo, repo_state, source FROM candidates WHERE id=$1`, id,
	).Scan(&repo, &repoState, &source); err != nil {
		t.Fatalf("candidate row: %v", err)
	}
	if repoState != "connected" || source != "CV + repository" {
		t.Errorf("repo_state=%q source=%q, want connected / CV + repository", repoState, source)
	}
	if repo != "https://github.com/octocat/Hello-World" {
		t.Errorf("repo=%q, want analyzed repo URL", repo)
	}
}
