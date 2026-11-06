package api

import (
	"errors"
	"net/http"
	"strings"

	"codecv/backend/internal/analysis"
	"codecv/backend/internal/model"
	"codecv/backend/internal/store"
)

type builderDraftRequest struct {
	Input    model.BuilderInput `json:"input"`
	Language string             `json:"language"`
	Template string             `json:"template"`
	Accent   string             `json:"accent"`
}

// handleBuilderDraft reads or replaces the signed-in account's single draft.
func (s *Server) handleBuilderDraft(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		s.unauthorized(w)
		return
	}

	switch r.Method {
	case http.MethodGet:
		draft, err := s.store.BuilderDraft(r.Context(), user.ID)
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusOK, map[string]any{"draft": nil})
			return
		}
		if err != nil {
			s.storeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"draft": draft})

	case http.MethodPut:
		var body builderDraftRequest
		if err := decodeJSON(r, &body); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		template := strings.ToLower(strings.TrimSpace(body.Template))
		if template != "" && !analysis.GeneratedTemplateValid(template) {
			s.fail(w, http.StatusBadRequest, "bad_request", "Template không hợp lệ. Chọn lại mẫu CV.")
			return
		}
		accent := strings.ToLower(strings.TrimSpace(body.Accent))
		if accent != "" && !analysis.GeneratedAccentValid(accent) {
			s.fail(w, http.StatusBadRequest, "bad_request", "Màu nhấn không hợp lệ. Chọn lại màu.")
			return
		}
		language := "vi"
		if value := strings.ToLower(strings.TrimSpace(body.Language)); value == "en" || value == "english" {
			language = "en"
		}
		draft, err := s.store.SaveBuilderDraft(r.Context(), store.SaveBuilderDraftInput{
			OwnerID:  user.ID,
			Input:    normalizeDraftInput(body.Input),
			Language: language,
			Template: template,
			Accent:   accent,
		})
		if err != nil {
			s.storeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"draft": draft})

	default:
		s.fail(w, http.StatusMethodNotAllowed, "method_not_allowed", "Phương thức không được hỗ trợ.")
	}
}
