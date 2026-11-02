package reporeview

import (
	"strings"
	"testing"

	"codecv/backend/internal/model"
)

func TestBuildChatPromptCarriesEvidenceHistoryAndQuestion(t *testing.T) {
	prompt := BuildChatPrompt(ChatInput{
		RepositoryURL: "https://github.com/octo/demo",
		Description:   "Demo app",
		Summary: &model.RepoSummary{
			Files: 12, Folders: 3, Tests: 1,
			Entrypoints: []string{"cmd/main.go"},
		},
		Findings: []model.Finding{{
			Severity: "high", Title: "Thiếu xử lý lỗi", File: "cmd/main.go", Line: 10,
			Rationale: "Bỏ qua lỗi trả về", Code: "line9\nline10\nline11", HitLine: 2,
		}},
		Files: []File{{Path: "cmd/main.go", Content: "package main\n"}},
		History: []model.RepositoryChatMessage{
			{Role: model.ChatRoleUser, Content: "Repo làm gì?"},
			{Role: model.ChatRoleAssistant, Content: "App demo Go."},
		},
		Question: "Kiểm thử nằm ở đâu?",
	})

	checks := []string{
		"https://github.com/octo/demo",
		"Demo app",
		"Điểm vào: cmd/main.go",
		"[high] Thiếu xử lý lỗi — cmd/main.go:10",
		"   9| line9",
		"  10| line10",
		"--- FILE: cmd/main.go ---",
		"Người dùng: Repo làm gì?",
		"Trợ lý: App demo Go.",
		"Câu hỏi của người dùng: Kiểm thử nằm ở đâu?",
	}
	for _, check := range checks {
		if !strings.Contains(prompt, check) {
			t.Fatalf("prompt is missing %q:\n%s", check, prompt)
		}
	}
	if !strings.HasSuffix(strings.TrimSpace(prompt), "Trả lời trực tiếp câu hỏi trên.") {
		t.Fatalf("question must stay last in the prompt:\n%s", prompt)
	}
}

func TestBuildChatPromptNotesMissingFiles(t *testing.T) {
	prompt := BuildChatPrompt(ChatInput{
		RepositoryURL: "https://github.com/octo/demo",
		Question:      "Repo làm gì?",
	})
	if !strings.Contains(prompt, "chưa đọc được tệp nguồn nào") {
		t.Fatalf("prompt should say no source files were read:\n%s", prompt)
	}
}
