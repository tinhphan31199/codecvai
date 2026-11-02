package store

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"

	"codecv/backend/internal/model"
)

func TestRepositoryTreeDetailsRetry(t *testing.T) {
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
	cleanup := func() {
		if _, err := s.pool.Exec(ctx, `DELETE FROM candidates WHERE id LIKE 'repo-tree%'`); err != nil {
			t.Fatalf("cleanup: %v", err)
		}
	}
	cleanup()
	defer cleanup()

	analyzed := model.RepositoryRecord{
		URL:   "https://github.com/octocat/Tree-Repo",
		Label: "github.com/octocat/Tree-Repo",
		Kind:  model.RepositoryRepo, Status: model.RepositoryAnalyzed,
		Detail: "Đã đọc repo", Source: "cv", Owner: "octocat", Name: "Tree-Repo",
		Tree: []model.RepoTreeNode{{Name: "main.go", Type: "file", SHA: "sha-main"}},
		Details: &model.RepoDetails{
			FullName: "octocat/Tree-Repo", Stars: 7, Language: "Go",
			DefaultBranch: "main", FileCount: 1,
		},
	}
	legacy := model.RepositoryRecord{
		URL:   "https://github.com/octocat/Legacy-Repo",
		Label: "github.com/octocat/Legacy-Repo",
		Kind:  model.RepositoryRepo, Status: model.RepositoryAnalyzed,
		Detail: "Đã đọc repo", Source: "cv", Owner: "octocat", Name: "Legacy-Repo",
	}

	id, err := s.SaveAnalysis(ctx, SaveAnalysisInput{
		Position: "Backend", Level: "Middle", Model: "test", FileName: "cv.pdf",
		Analysis:     model.Analysis{Candidate: model.Candidate{Name: "Repo Tree"}},
		Repositories: []model.RepositoryRecord{analyzed, legacy},
	})
	if err != nil {
		t.Fatalf("save: %v", err)
	}

	rows, err := s.CandidateRepositories(ctx, id)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("saved %d repositories, want 2", len(rows))
	}
	if !rows[0].HasTree || len(rows[0].Tree) != 1 || rows[0].Details == nil {
		t.Fatalf("tree repo = %+v, want persisted tree and details", rows[0])
	}
	if rows[0].Details.Stars != 7 {
		t.Fatalf("details stars = %d, want 7", rows[0].Details.Stars)
	}
	if rows[0].Summary == nil || rows[0].Summary.Files != 1 {
		t.Fatalf("summary = %+v, want a fallback summary for the stored tree", rows[0].Summary)
	}
	if rows[1].HasTree || rows[1].Details != nil || rows[1].Summary != nil {
		t.Fatalf("legacy repo = %+v, want no tree/details/summary", rows[1])
	}

	backfilled, err := s.BackfillRepositorySummaries(ctx)
	if err != nil {
		t.Fatalf("backfill: %v", err)
	}
	if backfilled < 1 {
		t.Fatalf("backfilled = %d, want at least the repo with a tree", backfilled)
	}
	var summaryText string
	if err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(summary::text, '') FROM candidate_repositories
		WHERE candidate_id = $1 AND idx = 0`, id).Scan(&summaryText); err != nil {
		t.Fatalf("summary column: %v", err)
	}
	if strings.TrimSpace(summaryText) == "" {
		t.Fatal("summary was not persisted for the scanned repo")
	}

	owner, name, sha, err := s.RepositoryTarget(ctx, id, "main.go", "")
	if err != nil {
		t.Fatalf("target: %v", err)
	}
	if owner != "octocat" || name != "Tree-Repo" || sha != "sha-main" {
		t.Fatalf("target = %s/%s@%s, want octocat/Tree-Repo@sha-main", owner, name, sha)
	}
	if _, _, _, err := s.RepositoryTarget(ctx, id, "missing.go", ""); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing file err = %v, want ErrNotFound", err)
	}
	if _, _, _, err := s.RepositoryTarget(ctx, id, "main.go", legacy.URL); !errors.Is(err, ErrNotFound) {
		t.Fatalf("legacy target err = %v, want ErrNotFound", err)
	}

	analysis, err := s.Repository(ctx, id, "")
	if err != nil {
		t.Fatalf("repository: %v", err)
	}
	if analysis.Details == nil || analysis.Details.Stars != 7 {
		t.Fatalf("analysis details = %+v, want persisted details", analysis.Details)
	}
	if analysis.Summary == nil || analysis.Summary.Files != 1 {
		t.Fatalf("analysis summary = %+v, want stored summary", analysis.Summary)
	}
	var tree []model.RepoTreeNode
	if err := json.Unmarshal(analysis.Tree, &tree); err != nil || len(tree) != 1 {
		t.Fatalf("analysis tree = %s, want one node", analysis.Tree)
	}
	if analysis.RepoBranch != "main" {
		t.Fatalf("branch = %q, want main", analysis.RepoBranch)
	}

	selected, err := s.Repository(ctx, id, analyzed.URL)
	if err != nil {
		t.Fatalf("selected repository: %v", err)
	}
	if selected.Repo != analyzed.URL || selected.Details == nil || selected.Details.Stars != 7 {
		t.Fatalf("selected = %q %+v, want the tree repo details", selected.Repo, selected.Details)
	}
	legacyAnalysis, err := s.Repository(ctx, id, legacy.Label)
	if err != nil {
		t.Fatalf("legacy repository: %v", err)
	}
	if legacyAnalysis.Repo != legacy.URL {
		t.Fatalf("legacy repo = %q, want %q", legacyAnalysis.Repo, legacy.URL)
	}
	if legacyAnalysis.Details != nil || legacyAnalysis.Summary != nil {
		t.Fatalf("legacy details = %+v summary = %+v, want none", legacyAnalysis.Details, legacyAnalysis.Summary)
	}
	if string(legacyAnalysis.Tree) != "[]" || legacyAnalysis.RepoBranch != "" {
		t.Fatalf("legacy tree = %s branch = %q, want empty", legacyAnalysis.Tree, legacyAnalysis.RepoBranch)
	}

	queued, err := s.RetryRepositories(ctx, id, "")
	if err != nil {
		t.Fatalf("retry: %v", err)
	}
	if queued != 1 {
		t.Fatalf("queued = %d, want only the legacy repo", queued)
	}
	rows, err = s.CandidateRepositories(ctx, id)
	if err != nil {
		t.Fatalf("list after retry: %v", err)
	}
	if rows[1].Status != model.RepositoryPending {
		t.Fatalf("legacy status = %q, want pending", rows[1].Status)
	}
	if rows[0].Status != model.RepositoryAnalyzed {
		t.Fatalf("tree repo status = %q, want analyzed", rows[0].Status)
	}

	if _, err := s.pool.Exec(ctx, `
		UPDATE candidate_repositories SET owner = '', repo_name = ''
		WHERE candidate_id = $1 AND label = $2`, id, legacy.Label); err != nil {
		t.Fatalf("clear owner: %v", err)
	}
	if err := s.Migrate(ctx); err != nil {
		t.Fatalf("migrate backfill: %v", err)
	}
	rows, err = s.CandidateRepositories(ctx, id)
	if err != nil {
		t.Fatalf("list after backfill: %v", err)
	}
	if rows[1].Owner != "octocat" || rows[1].Name != "Legacy-Repo" {
		t.Fatalf("backfill = %s/%s, want octocat/Legacy-Repo", rows[1].Owner, rows[1].Name)
	}

	if err := s.FinishRepositoryJob(ctx,
		model.RepositoryJob{CandidateID: id, Index: 1, Owner: "octocat", Name: "Legacy-Repo"},
		model.RepositoryAnalyzed, "Đã đọc repo", "Đã đọc repo",
		[]model.RepoTreeNode{{Name: "main.go", Type: "file", SHA: "sha-2"}},
		&model.RepoDetails{FullName: "octocat/Legacy-Repo", Stars: 2, FileCount: 1},
		&model.RepoSummary{Files: 1},
	); err != nil {
		t.Fatalf("finish: %v", err)
	}
	rows, err = s.CandidateRepositories(ctx, id)
	if err != nil {
		t.Fatalf("list after finish: %v", err)
	}
	if rows[1].Summary == nil || rows[1].Summary.Files != 1 || !rows[1].HasTree {
		t.Fatalf("finished repo = %+v, want stored tree and summary", rows[1])
	}
}
