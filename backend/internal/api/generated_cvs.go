package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"codecv/backend/internal/analysis"
	"codecv/backend/internal/model"
	"codecv/backend/internal/store"
)

// generatedCVRequest is the payload saved after an AI generation or an edit.
type generatedCVRequest struct {
	Name     string                   `json:"name"`
	Language string                   `json:"language"`
	Template string                   `json:"template"`
	Accent   string                   `json:"accent"`
	Content  model.GeneratedCVContent `json:"content"`
	Input    model.BuilderInput       `json:"input"`
	ModelID  string                   `json:"modelId"`
	Provider string                   `json:"provider"`
}

type generatedCVFields struct {
	Name           string
	TargetPosition string
	Level          string
	Language       string
	Template       string
	Accent         string
	Content        model.GeneratedCVContent
	Input          model.BuilderInput
	ModelID        string
	Provider       string
}

// handleGeneratedCVs lists or creates the signed-in account's private CVs.
func (s *Server) handleGeneratedCVs(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		s.unauthorized(w)
		return
	}

	switch r.Method {
	case http.MethodGet:
		cvs, err := s.store.GeneratedCVs(r.Context(), user.ID)
		if err != nil {
			s.storeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"cvs": cvs})

	case http.MethodPost:
		var body generatedCVRequest
		if err := decodeJSON(r, &body); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		fields, ok := s.validateGeneratedCV(w, body)
		if !ok {
			return
		}
		saved, err := s.store.CreateGeneratedCV(r.Context(), store.CreateGeneratedCVInput{
			OwnerID:        user.ID,
			Name:           fields.Name,
			TargetPosition: fields.TargetPosition,
			Level:          fields.Level,
			Language:       fields.Language,
			Template:       fields.Template,
			Accent:         fields.Accent,
			Content:        fields.Content,
			Input:          fields.Input,
			ModelID:        fields.ModelID,
			Provider:       fields.Provider,
		})
		if err != nil {
			s.storeError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"cv": saved})

	default:
		s.fail(w, http.StatusMethodNotAllowed, "method_not_allowed", "Phương thức không được hỗ trợ.")
	}
}

// handleGeneratedCV reads, updates or deletes one CV; only its owner can see it.
func (s *Server) handleGeneratedCV(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		s.unauthorized(w)
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		s.generatedCVError(w, store.ErrNotFound)
		return
	}

	switch r.Method {
	case http.MethodGet:
		cv, err := s.store.GeneratedCV(r.Context(), user.ID, id)
		if err != nil {
			s.generatedCVError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"cv": cv})

	case http.MethodPut:
		var body generatedCVRequest
		if err := decodeJSON(r, &body); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		fields, ok := s.validateGeneratedCV(w, body)
		if !ok {
			return
		}
		saved, err := s.store.UpdateGeneratedCV(r.Context(), store.UpdateGeneratedCVInput{
			OwnerID:        user.ID,
			ID:             id,
			Name:           fields.Name,
			TargetPosition: fields.TargetPosition,
			Level:          fields.Level,
			Language:       fields.Language,
			Template:       fields.Template,
			Accent:         fields.Accent,
			Content:        fields.Content,
			Input:          fields.Input,
			ModelID:        fields.ModelID,
			Provider:       fields.Provider,
		})
		if err != nil {
			s.generatedCVError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"cv": saved})

	case http.MethodDelete:
		if err := s.store.DeleteGeneratedCV(r.Context(), user.ID, id); err != nil {
			s.generatedCVError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		s.fail(w, http.StatusMethodNotAllowed, "method_not_allowed", "Phương thức không được hỗ trợ.")
	}
}

func (s *Server) validateGeneratedCV(w http.ResponseWriter, body generatedCVRequest) (generatedCVFields, bool) {
	input, message := normalizeBuilderInput(body.Input)
	if message != "" {
		s.fail(w, http.StatusBadRequest, "bad_request", message)
		return generatedCVFields{}, false
	}
	content, ok := normalizeGeneratedContent(body.Content)
	if !ok {
		s.fail(w, http.StatusBadRequest, "bad_request", "Nội dung CV trống. Tạo CV bằng AI trước khi lưu.")
		return generatedCVFields{}, false
	}

	template := strings.ToLower(strings.TrimSpace(body.Template))
	if template != "" && !analysis.GeneratedTemplateValid(template) {
		s.fail(w, http.StatusBadRequest, "bad_request", "Template không hợp lệ. Chọn lại mẫu CV.")
		return generatedCVFields{}, false
	}
	accent := strings.ToLower(strings.TrimSpace(body.Accent))
	if accent != "" && !analysis.GeneratedAccentValid(accent) {
		s.fail(w, http.StatusBadRequest, "bad_request", "Màu nhấn không hợp lệ. Chọn lại màu.")
		return generatedCVFields{}, false
	}

	language := "vi"
	if value := strings.ToLower(strings.TrimSpace(body.Language)); value == "en" || value == "english" {
		language = "en"
	}

	return generatedCVFields{
		Name:           clipText(body.Name, 160),
		TargetPosition: input.Position,
		Level:          input.Level,
		Language:       language,
		Template:       template,
		Accent:         accent,
		Content:        content,
		Input:          input,
		ModelID:        clipText(body.ModelID, 120),
		Provider:       clipText(body.Provider, 60),
	}, true
}

// normalizeGeneratedContent reuses the AI output normalizer so a client cannot
// store oversized or malformed fields that the templates cannot render.
func normalizeGeneratedContent(content model.GeneratedCVContent) (model.GeneratedCVContent, bool) {
	raw, err := json.Marshal(content)
	if err != nil {
		return model.GeneratedCVContent{}, false
	}
	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return model.GeneratedCVContent{}, false
	}
	draft := analysis.NormalizeGenerated(decoded)
	if analysis.GeneratedDraftEmpty(draft) {
		return model.GeneratedCVContent{}, false
	}
	return draft.Content, true
}

func (s *Server) generatedCVError(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrNotFound) {
		s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy CV hoặc bạn không có quyền truy cập.")
		return
	}
	s.storeError(w, err)
}
