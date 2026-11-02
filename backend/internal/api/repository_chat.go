package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"codecv/backend/internal/gateway"
	"codecv/backend/internal/model"
	"codecv/backend/internal/reporeview"
	"codecv/backend/internal/store"
)

// chatFileLimit keeps a question from consuming the GitHub quota the
// background reader also needs.
const chatFileLimit = 4

func (s *Server) handleRepositoryChat(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !s.requireCandidate(w, r, id) {
		return
	}
	if r.Method == http.MethodGet {
		s.getRepositoryChat(w, r, id)
		return
	}
	s.postRepositoryChat(w, r, id)
}

func (s *Server) getRepositoryChat(w http.ResponseWriter, r *http.Request, id string) {
	repoRef := strings.TrimSpace(r.URL.Query().Get("repo"))
	repo, err := s.store.Repository(r.Context(), id, repoRef)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy ứng viên.")
			return
		}
		s.storeError(w, err)
		return
	}
	repoURL := repo.Repo
	if repoURL == "" {
		repoURL = repoRef
	}
	messages, err := s.store.RepositoryChatMessages(r.Context(), id, repoURL)
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"repo": repoURL, "messages": messages})
}

func (s *Server) postRepositoryChat(w http.ResponseWriter, r *http.Request, id string) {
	var body struct {
		Repo    string `json:"repo"`
		Message string `json:"message"`
	}
	if err := decodeJSON(r, &body); err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}
	question := strings.TrimSpace(body.Message)
	if question == "" {
		s.fail(w, http.StatusBadRequest, "bad_request", "Nhập câu hỏi về repository.")
		return
	}
	if len([]rune(question)) > reporeview.ChatQuestionLimit {
		s.fail(w, http.StatusBadRequest, "bad_request", "Câu hỏi quá dài. Rút gọn còn tối đa 2000 ký tự.")
		return
	}

	repo, err := s.store.Repository(r.Context(), id, strings.TrimSpace(body.Repo))
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy ứng viên.")
			return
		}
		s.storeError(w, err)
		return
	}
	var tree []model.RepoTreeNode
	if len(repo.Tree) > 0 {
		_ = json.Unmarshal(repo.Tree, &tree)
	}
	if repo.Repo == "" || len(tree) == 0 {
		s.fail(w, http.StatusBadRequest, "repository_not_ready", "Repository chưa có dữ liệu đã đọc. Chạy phân tích repository trước khi hỏi.")
		return
	}

	startedAt := time.Now()
	files := s.chatFiles(r.Context(), repo, tree)
	history, err := s.store.RepositoryChatMessages(r.Context(), id, repo.Repo)
	if err != nil {
		s.storeError(w, err)
		return
	}
	if len(history) > reporeview.ChatHistoryLimit {
		history = history[len(history)-reporeview.ChatHistoryLimit:]
	}

	aiModels, err := s.store.ActiveModels(r.Context())
	if err != nil {
		log.Printf("[repository-chat] active models lookup failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "server_error", "Không đọc được model AI. Vui lòng thử lại.")
		return
	}
	if len(aiModels) == 0 {
		s.fail(w, http.StatusServiceUnavailable, "missing_model", "Chưa có model AI nào được bật. Bật model ở Cài đặt → AI models.")
		return
	}

	description, languages, readme := chatRepoFacts(repo.Details)
	input := reporeview.ChatInput{
		RepositoryURL: repo.Repo,
		Description:   description,
		Languages:     languages,
		Readme:        readme,
		Summary:       repo.Summary,
		Findings:      repo.Findings,
		Files:         files,
		History:       history,
		Question:      question,
	}

	replyCtx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()

	// The first enabled model is the configured default; a provider that no
	// longer serves it may still serve another enabled model.
	var (
		answer  string
		aiModel model.AIModel
		aiErr   error
	)
	provider := strings.TrimSpace(aiModels[0].Provider)
	for index, candidate := range aiModels {
		if index > 0 && !strings.EqualFold(strings.TrimSpace(candidate.Provider), provider) {
			continue
		}
		answer, aiErr = s.gateway.ChatRepository(replyCtx, candidate.ID, input)
		if aiErr == nil {
			aiModel = candidate
			break
		}
		if replyCtx.Err() != nil {
			break
		}
		if !gateway.IsModelUnavailable(aiErr) {
			break
		}
		log.Printf("[repository-chat] model %s unavailable, trying another %s model", candidate.ID, provider)
	}
	if aiModel.ID == "" {
		log.Printf("[repository-chat] ai failed candidate=%s repo=%s: %v", id, repo.Repo, aiErr)
		var gatewayErr *gateway.Error
		if errors.As(aiErr, &gatewayErr) {
			s.fail(w, errorStatus(gatewayErr.Code), gatewayErr.Code, gatewayErr.Message)
			return
		}
		s.fail(w, http.StatusBadGateway, "upstream_error", "AI chưa trả lời được. Vui lòng thử lại.")
		return
	}

	messages, err := s.store.AppendRepositoryChatExchange(r.Context(), id, repo.Repo, question, answer)
	if err != nil {
		log.Printf("[repository-chat] save failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "server_error", "Không lưu được câu trả lời. Vui lòng thử lại.")
		return
	}
	log.Printf(
		"[repository-chat] candidate=%s repo=%s model=%s files=%d findings=%d history=%d duration=%s",
		id, repo.Repo, aiModel.ID, len(files), len(repo.Findings), len(history),
		time.Since(startedAt).Round(time.Millisecond),
	)
	writeJSON(w, http.StatusOK, map[string]any{"repo": repo.Repo, "messages": messages})
}

// chatFiles reads a small sample of the scanned tree so answers can cite real
// code; read failures only drop that file from the context.
func (s *Server) chatFiles(ctx context.Context, repo model.RepoAnalysis, tree []model.RepoTreeNode) []reporeview.File {
	record := findRepoRecord(repo.Repositories, repo.Repo)
	if record == nil || record.Owner == "" || record.Name == "" {
		return nil
	}
	paths := reporeview.Plan(tree, repo.Summary, chatFileLimit)
	if len(paths) == 0 {
		return nil
	}
	client := s.githubClient(ctx)
	readCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	files := make([]reporeview.File, 0, len(paths))
	for _, filePath := range paths {
		sha := reporeview.BlobSHA(tree, filePath)
		if sha == "" {
			continue
		}
		content, _, err := client.File(readCtx, record.Owner, record.Name, sha)
		if err != nil {
			log.Printf("[repository-chat] read %s/%s/%s failed: %v", record.Owner, record.Name, filePath, err)
			continue
		}
		if strings.TrimSpace(content) == "" {
			continue
		}
		files = append(files, reporeview.File{Path: filePath, Content: content})
	}
	return files
}

func findRepoRecord(records []model.RepositoryRecord, repoURL string) *model.RepositoryRecord {
	for index := range records {
		if records[index].Kind == model.RepositoryRepo && strings.EqualFold(records[index].URL, repoURL) {
			return &records[index]
		}
	}
	return nil
}

func chatRepoFacts(details *model.RepoDetails) (string, string, string) {
	if details == nil {
		return "", "", ""
	}
	languages := details.Language
	if len(details.Languages) > 0 {
		parts := make([]string, 0, len(details.Languages))
		for _, language := range details.Languages {
			parts = append(parts, fmt.Sprintf("%s %.0f%%", language.Name, language.Percent))
		}
		languages = strings.Join(parts, ", ")
	}
	return details.Description, languages, details.Readme
}
