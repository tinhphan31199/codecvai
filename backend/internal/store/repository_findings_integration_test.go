package store

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"

	"codecv/backend/internal/model"
)

func TestRepositoryFindingsFlow(t *testing.T) {
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
		if _, err := s.pool.Exec(ctx, `DELETE FROM candidates WHERE id LIKE 'repo-find%'`); err != nil {
			t.Fatalf("cleanup: %v", err)
		}
	}
	cleanup()
	defer cleanup()

	primary := model.RepositoryRecord{
		URL:   "https://github.com/octocat/Findings-Primary",
		Label: "github.com/octocat/Findings-Primary",
		Kind:  model.RepositoryRepo, Status: model.RepositoryAnalyzed,
		Detail: "Đã đọc repo", Source: "cv", Owner: "octocat", Name: "Findings-Primary",
		Tree: []model.RepoTreeNode{{Name: "main.go", Type: "file", SHA: "sha-main"}},
		Details: &model.RepoDetails{
			FullName: "octocat/Findings-Primary", Stars: 3,
			DefaultBranch: "main", FileCount: 1,
		},
	}
	secondary := model.RepositoryRecord{
		URL:   "https://github.com/octocat/Findings-Secondary",
		Label: "github.com/octocat/Findings-Secondary",
		Kind:  model.RepositoryRepo, Status: model.RepositoryAnalyzed,
		Detail: "Đã đọc repo", Source: "cv", Owner: "octocat", Name: "Findings-Secondary",
		Tree: []model.RepoTreeNode{{Name: "app.go", Type: "file", SHA: "sha-app"}},
		Details: &model.RepoDetails{
			FullName: "octocat/Findings-Secondary", Stars: 1,
			DefaultBranch: "main", FileCount: 1,
		},
	}

	id, err := s.SaveAnalysis(ctx, SaveAnalysisInput{
		Position: "Backend", Level: "Middle", Model: "test", FileName: "cv.pdf",
		Analysis:     model.Analysis{Candidate: model.Candidate{Name: "Repo Findings"}},
		Repositories: []model.RepositoryRecord{primary, secondary},
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
	if rows[0].FindingsState != model.RepositoryFindingsPending || rows[1].FindingsState != "" {
		t.Fatalf("states = %q/%q, want only the primary repo queued", rows[0].FindingsState, rows[1].FindingsState)
	}

	primaryURL, err := s.PrimaryRepositoryURL(ctx, id)
	if err != nil {
		t.Fatalf("primary url: %v", err)
	}
	if primaryURL != primary.URL {
		t.Fatalf("primary = %q, want %q", primaryURL, primary.URL)
	}

	if _, _, err := s.QueueRepositoryFindings(ctx, "missing-candidate", ""); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing candidate err = %v, want ErrNotFound", err)
	}
	queuedURL, queued, err := s.QueueRepositoryFindings(ctx, id, secondary.Label)
	if err != nil {
		t.Fatalf("queue secondary: %v", err)
	}
	if queuedURL != secondary.URL || !queued {
		t.Fatalf("queued = %q/%v, want %q/true", queuedURL, queued, secondary.URL)
	}
	if _, queued, err := s.QueueRepositoryFindings(ctx, id, secondary.URL); err != nil || queued {
		t.Fatalf("re-queue = %v/%v, want false and no error", queued, err)
	}

	started, err := s.StartRepositoryFindings(ctx, id, 1)
	if err != nil || !started {
		t.Fatalf("start = %v/%v, want true and no error", started, err)
	}
	if started, err := s.StartRepositoryFindings(ctx, id, 1); err != nil || started {
		t.Fatalf("second start = %v/%v, want false and no error", started, err)
	}
	if err := s.ResetAnalyzingRepositories(ctx); err != nil {
		t.Fatalf("reset: %v", err)
	}
	rows, err = s.CandidateRepositories(ctx, id)
	if err != nil {
		t.Fatalf("list after reset: %v", err)
	}
	if rows[0].FindingsState != model.RepositoryFindingsPending || rows[1].FindingsState != model.RepositoryFindingsPending {
		t.Fatalf("states after reset = %q/%q, want both pending", rows[0].FindingsState, rows[1].FindingsState)
	}

	claimed := make(map[int]model.RepositoryJob)
	for range 2 {
		job, ok, err := s.PendingRepositoryJob(ctx)
		if err != nil {
			t.Fatalf("claim: %v", err)
		}
		if !ok {
			t.Fatal("expected a findings-only job, got none")
		}
		if job.Status != model.RepositoryAnalyzed {
			t.Fatalf("claimed status = %q, want analyzed", job.Status)
		}
		if len(job.Tree) == 0 {
			t.Fatalf("claimed job %d has no tree", job.Index)
		}
		claimed[job.Index] = job
	}
	if _, ok := claimed[0]; !ok {
		t.Fatal("primary repo was never claimed")
	}
	if _, ok := claimed[1]; !ok {
		t.Fatal("secondary repo was never claimed")
	}
	if _, ok, err := s.PendingRepositoryJob(ctx); err != nil || ok {
		t.Fatalf("third claim = %v/%v, want none and no error", ok, err)
	}
	rows, err = s.CandidateRepositories(ctx, id)
	if err != nil {
		t.Fatalf("list after claim: %v", err)
	}
	if rows[0].FindingsState != model.RepositoryFindingsAnalyzing || rows[1].FindingsState != model.RepositoryFindingsAnalyzing {
		t.Fatalf("states after claim = %q/%q, want both analyzing", rows[0].FindingsState, rows[1].FindingsState)
	}
	if err := s.ResetAnalyzingRepositories(ctx); err != nil {
		t.Fatalf("reset after claim: %v", err)
	}

	primaryFindings := []model.Finding{
		{Severity: "high", Title: "SQL injection", Module: "auth", File: "main.go", Line: 12,
			State: "open", Rationale: "Chuỗi nối trực tiếp", Verification: "Kiểm tra query", Code: "db.Query(q)", HitLine: 2},
		{Severity: "low", Title: "Thiếu kiểm tra lỗi", Module: "auth", File: "main.go", Line: 30,
			State: "needs-check", Rationale: "Bỏ qua err", Verification: "Chạy vet", Code: "x, _ := f()", HitLine: 1},
	}
	secondaryFindings := []model.Finding{
		{Severity: "info", Title: "Ghi log lộ dữ liệu", Module: "log", File: "app.go", Line: 7,
			State: "confirmed", Rationale: "Log token", Verification: "Tìm log", Code: "log.Print(token)", HitLine: 1},
	}
	if err := s.SaveRepositoryFindings(ctx, id, primary.URL, primaryFindings); err != nil {
		t.Fatalf("save primary findings: %v", err)
	}
	if err := s.SaveRepositoryFindings(ctx, id, secondary.URL, secondaryFindings); err != nil {
		t.Fatalf("save secondary findings: %v", err)
	}

	var idCount int
	if err := s.pool.QueryRow(ctx, `
		SELECT count(DISTINCT id) FROM findings WHERE candidate_id = $1`, id).Scan(&idCount); err != nil {
		t.Fatalf("count ids: %v", err)
	}
	if idCount != 3 {
		t.Fatalf("distinct finding ids = %d, want 3", idCount)
	}
	var primaryPrefix, secondaryPrefix string
	if err := s.pool.QueryRow(ctx, `SELECT min(id) FROM findings WHERE candidate_id = $1 AND repo_url = $2`,
		id, primary.URL).Scan(&primaryPrefix); err != nil {
		t.Fatalf("primary id: %v", err)
	}
	if err := s.pool.QueryRow(ctx, `SELECT min(id) FROM findings WHERE candidate_id = $1 AND repo_url = $2`,
		id, secondary.URL).Scan(&secondaryPrefix); err != nil {
		t.Fatalf("secondary id: %v", err)
	}
	if !strings.HasPrefix(primaryPrefix, "rf-") || !strings.HasSuffix(primaryPrefix, "-01") {
		t.Fatalf("primary id = %q, want rf-<hash>-01", primaryPrefix)
	}
	if primaryPrefix == secondaryPrefix {
		t.Fatalf("both repositories share finding id %q", primaryPrefix)
	}

	analysis, err := s.Repository(ctx, id, "")
	if err != nil {
		t.Fatalf("repository: %v", err)
	}
	if analysis.Repo != primary.URL {
		t.Fatalf("selected repo = %q, want %q", analysis.Repo, primary.URL)
	}
	if len(analysis.Findings) != 2 {
		t.Fatalf("primary findings = %d, want 2", len(analysis.Findings))
	}
	if analysis.Findings[0].Title != primaryFindings[0].Title || analysis.Findings[0].HitLine != 2 {
		t.Fatalf("first finding = %+v, want the saved SQL injection", analysis.Findings[0])
	}
	selected, err := s.Repository(ctx, id, secondary.Label)
	if err != nil {
		t.Fatalf("secondary repository: %v", err)
	}
	if selected.Repo != secondary.URL || len(selected.Findings) != 1 {
		t.Fatalf("secondary = %q with %d findings, want %q with 1", selected.Repo, len(selected.Findings), secondary.URL)
	}
	if selected.Findings[0].Title != secondaryFindings[0].Title {
		t.Fatalf("secondary finding = %q, want %q", selected.Findings[0].Title, secondaryFindings[0].Title)
	}

	if err := s.SaveRepositoryFindings(ctx, id, primary.URL, primaryFindings[:1]); err != nil {
		t.Fatalf("replace primary findings: %v", err)
	}
	analysis, err = s.Repository(ctx, id, primary.URL)
	if err != nil {
		t.Fatalf("repository after replace: %v", err)
	}
	if len(analysis.Findings) != 1 || analysis.Findings[0].Title != primaryFindings[0].Title {
		t.Fatalf("replaced findings = %+v, want only the first primary finding", analysis.Findings)
	}
	selected, err = s.Repository(ctx, id, secondary.URL)
	if err != nil {
		t.Fatalf("secondary after replace: %v", err)
	}
	if len(selected.Findings) != 1 {
		t.Fatalf("secondary findings = %d, want the other repository untouched", len(selected.Findings))
	}

	if err := s.SetRepositoryFindingsState(ctx, id, 0,
		model.RepositoryFindingsAnalyzed, "Đã đọc 3 tệp · 2 phát hiện"); err != nil {
		t.Fatalf("set state: %v", err)
	}
	rows, err = s.CandidateRepositories(ctx, id)
	if err != nil {
		t.Fatalf("list after state: %v", err)
	}
	if rows[0].FindingsState != model.RepositoryFindingsAnalyzed ||
		rows[0].FindingsDetail != "Đã đọc 3 tệp · 2 phát hiện" {
		t.Fatalf("primary state = %q %q, want analyzed with detail", rows[0].FindingsState, rows[0].FindingsDetail)
	}
	if err := s.SetRepositoryFindingsState(ctx, id, 9, model.RepositoryFindingsFailed, "x"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing index err = %v, want ErrNotFound", err)
	}
}
