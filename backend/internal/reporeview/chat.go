package reporeview

import (
	"fmt"
	"strings"

	"codecv/backend/internal/model"
)

const (
	// ChatHistoryLimit caps how many stored turns are sent back to the model.
	ChatHistoryLimit = 10
	// chatMessageLimit caps one stored message inside the prompt.
	chatMessageLimit = 1200
	// ChatQuestionLimit caps one new question; the API rejects longer input.
	ChatQuestionLimit = 2000
)

// ChatInput carries the stored repository context and the conversation so far.
type ChatInput struct {
	RepositoryURL string
	Description   string
	Languages     string
	Readme        string
	Summary       *model.RepoSummary
	Findings      []model.Finding
	Files         []File
	History       []model.RepositoryChatMessage
	Question      string
}

// ChatSystemInstruction steers every provider to the same answer style.
const ChatSystemInstruction = "Bạn là kỹ sư phần mềm cấp cao đang trả lời câu hỏi về repository của một ứng viên. " +
	"Chỉ kết luận dựa trên metadata, phát hiện và các tệp được cung cấp; khi ngữ cảnh chưa đủ, nói rõ là chưa đủ dữ liệu thay vì suy đoán. " +
	"Nêu tệp và dòng khi có thể. Trả lời bằng đúng ngôn ngữ của câu hỏi, ngắn gọn, văn bản thuần (không markdown, không JSON)."

// BuildChatPrompt puts the repository evidence, earlier turns and the new
// question in one prompt so every provider gets the same context.
func BuildChatPrompt(in ChatInput) string {
	var b strings.Builder
	b.WriteString("Ngữ cảnh repository:\n")
	b.WriteString("Repository: " + strings.TrimSpace(in.RepositoryURL) + "\n")
	if description := strings.TrimSpace(in.Description); description != "" {
		b.WriteString("Mô tả: " + truncate(description, 300) + "\n")
	}
	if languages := strings.TrimSpace(in.Languages); languages != "" {
		b.WriteString("Ngôn ngữ: " + languages + "\n")
	}
	if in.Summary != nil {
		b.WriteString(fmt.Sprintf("Quy mô: %d tệp, %d thư mục, %d tệp kiểm thử.\n",
			in.Summary.Files, in.Summary.Folders, in.Summary.Tests))
		if len(in.Summary.Modules) > 0 {
			parts := make([]string, 0, len(in.Summary.Modules))
			for _, module := range in.Summary.Modules {
				parts = append(parts, fmt.Sprintf("%s (%d tệp)", module.Name, module.Files))
			}
			b.WriteString("Thư mục lớn: " + strings.Join(parts, ", ") + "\n")
		}
		if len(in.Summary.Entrypoints) > 0 {
			b.WriteString("Điểm vào: " + strings.Join(in.Summary.Entrypoints, ", ") + "\n")
		}
	}
	if readme := strings.TrimSpace(in.Readme); readme != "" {
		b.WriteString("\nTrích README:\n" + truncate(readme, 1200) + "\n")
	}

	if len(in.Findings) > 0 {
		b.WriteString("\nCác phát hiện AI đã ghi nhận trước đó:\n")
		for _, finding := range in.Findings {
			b.WriteString(fmt.Sprintf("- [%s] %s — %s:%d — %s\n",
				finding.Severity, finding.Title, finding.File, finding.Line,
				truncate(strings.TrimSpace(finding.Rationale), 400)))
			if strings.TrimSpace(finding.Code) != "" {
				b.WriteString(numberedWindow(finding.Code, finding.Line, finding.HitLine))
			}
		}
	}

	if len(in.Files) > 0 {
		b.WriteString("\nCác tệp đã đọc (số ở đầu dòng là số dòng thật trong tệp):\n")
		for _, file := range in.Files {
			b.WriteString("\n--- FILE: " + file.Path + " ---\n")
			b.WriteString(numberedLines(file.Content))
		}
	} else {
		b.WriteString("\nLượt này chưa đọc được tệp nguồn nào; chỉ có metadata và phát hiện đã lưu.\n")
	}

	if len(in.History) > 0 {
		b.WriteString("\nHội thoại trước đó:\n")
		for _, message := range in.History {
			label := "Người dùng"
			if message.Role == model.ChatRoleAssistant {
				label = "Trợ lý"
			}
			b.WriteString(label + ": " + truncate(strings.TrimSpace(message.Content), chatMessageLimit) + "\n")
		}
	}

	b.WriteString("\nCâu hỏi của người dùng: " + strings.TrimSpace(in.Question) + "\n")
	b.WriteString("Trả lời trực tiếp câu hỏi trên.\n")
	return b.String()
}

// numberedWindow numbers a finding's stored code window with its real file
// line numbers, so answers can cite the same lines as the findings rail.
func numberedWindow(code string, line, hitLine int) string {
	start := line - (hitLine - 1)
	if start < 1 {
		start = 1
	}
	lines := strings.Split(strings.ReplaceAll(code, "\r\n", "\n"), "\n")
	var b strings.Builder
	for index, content := range lines {
		b.WriteString(fmt.Sprintf("%4d| %s\n", start+index, content))
	}
	return b.String()
}
