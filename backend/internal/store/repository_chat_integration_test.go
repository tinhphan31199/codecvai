package store

import (
	"context"
	"os"
	"testing"

	"codecv/backend/internal/model"
)

func TestRepositoryChatHistory(t *testing.T) {
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
		if _, err := s.pool.Exec(ctx, `DELETE FROM candidates WHERE id LIKE 'repo-chat%'`); err != nil {
			t.Fatalf("cleanup: %v", err)
		}
	}
	cleanup()
	defer cleanup()

	repository := model.RepositoryRecord{
		URL:   "https://github.com/octocat/Chat-Repo",
		Label: "github.com/octocat/Chat-Repo",
		Kind:  model.RepositoryRepo, Status: model.RepositoryAnalyzed,
		Detail: "Đã đọc repo", Source: "cv", Owner: "octocat", Name: "Chat-Repo",
		Tree: []model.RepoTreeNode{{Name: "main.go", Type: "file", SHA: "sha-main"}},
	}
	id, err := s.SaveAnalysis(ctx, SaveAnalysisInput{
		Position: "Backend", Level: "Middle", Model: "test", FileName: "cv.pdf",
		Analysis:     model.Analysis{Candidate: model.Candidate{Name: "Repo Chat"}},
		Repositories: []model.RepositoryRecord{repository},
	})
	if err != nil {
		t.Fatalf("save: %v", err)
	}

	history, err := s.RepositoryChatMessages(ctx, id, repository.URL)
	if err != nil {
		t.Fatalf("read empty history: %v", err)
	}
	if len(history) != 0 {
		t.Fatalf("history = %d messages, want none", len(history))
	}

	first, err := s.AppendRepositoryChatExchange(ctx, id, repository.URL, "Repo này làm gì?", "Đây là ứng dụng demo.")
	if err != nil {
		t.Fatalf("append first exchange: %v", err)
	}
	if len(first) != 2 {
		t.Fatalf("exchange = %d messages, want question and answer", len(first))
	}
	if first[0].Role != model.ChatRoleUser || first[0].Content != "Repo này làm gì?" {
		t.Fatalf("unexpected question: %+v", first[0])
	}
	if first[1].Role != model.ChatRoleAssistant || first[1].Content != "Đây là ứng dụng demo." {
		t.Fatalf("unexpected answer: %+v", first[1])
	}
	if first[0].ID == "" || first[0].ID == first[1].ID || first[0].CreatedAt == "" {
		t.Fatalf("stored messages need distinct ids and timestamps: %+v", first)
	}

	if _, err := s.AppendRepositoryChatExchange(ctx, id, repository.URL, "Có kiểm thử không?", "Chưa thấy tệp kiểm thử."); err != nil {
		t.Fatalf("append second exchange: %v", err)
	}
	history, err = s.RepositoryChatMessages(ctx, id, repository.URL)
	if err != nil {
		t.Fatalf("read history: %v", err)
	}
	if len(history) != 4 {
		t.Fatalf("history = %d messages, want 4", len(history))
	}
	if history[0].Content != "Repo này làm gì?" || history[3].Content != "Chưa thấy tệp kiểm thử." {
		t.Fatalf("history lost order: %+v", history)
	}

	other, err := s.RepositoryChatMessages(ctx, id, "https://github.com/octocat/Other-Repo")
	if err != nil {
		t.Fatalf("read other repo: %v", err)
	}
	if len(other) != 0 {
		t.Fatalf("other repo history = %d messages, want none", len(other))
	}
}
