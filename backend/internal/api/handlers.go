package api

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"codecv/backend/internal/gemini"
	"codecv/backend/internal/model"
	"codecv/backend/internal/store"
)

func (s *Server) handleWorkspace(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPut {
		var values map[string]string
		if err := decodeJSON(r, &values); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		if err := s.store.UpdateWorkspaceSettings(r.Context(), values); err != nil {
			s.storeError(w, err)
			return
		}
		workspace, err := s.store.Workspace(r.Context())
		if err != nil {
			s.storeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, workspace)
		return
	}

	workspace, err := s.store.Workspace(r.Context())
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, workspace)
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	stats, err := s.store.Stats(r.Context())
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	dashboard, err := s.store.Dashboard(r.Context())
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dashboard)
}

func (s *Server) handleCandidates(w http.ResponseWriter, r *http.Request) {
	filter := store.CandidateFilter{
		Query:    r.URL.Query().Get("q"),
		Status:   r.URL.Query().Get("status"),
		Position: r.URL.Query().Get("position"),
		Sort:     r.URL.Query().Get("sort"),
	}
	filter.Limit = queryInt(r, "limit", 100)
	filter.Offset = queryInt(r, "offset", 0)

	candidates, err := s.store.ListCandidates(r.Context(), filter)
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"candidates": candidates, "total": len(candidates)})
}

func (s *Server) handleCandidate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if r.Method == http.MethodPatch {
		var patch struct {
			Status   string `json:"status"`
			Notes    string `json:"notes"`
			Reviewer string `json:"reviewer"`
			Repo     string `json:"repo"`
		}
		if err := decodeJSON(r, &patch); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		if patch.Status != "" {
			if err := s.store.UpdateCandidateStatus(r.Context(), id, patch.Status); err != nil {
				s.storeError(w, err)
				return
			}
		}
		if patch.Notes != "" || patch.Reviewer != "" || patch.Repo != "" {
			if err := s.store.UpdateCandidateFields(r.Context(), id, patch.Notes, patch.Reviewer, patch.Repo); err != nil {
				s.storeError(w, err)
				return
			}
		}
	}

	candidate, err := s.store.Candidate(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy ứng viên.")
			return
		}
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, candidate)
}

func (s *Server) handleRepository(w http.ResponseWriter, r *http.Request) {
	repo, err := s.store.Repository(r.Context(), r.PathValue("id"))
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy ứng viên.")
			return
		}
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, repo)
}

func (s *Server) handleQuestions(w http.ResponseWriter, r *http.Request) {
	questions, err := s.store.Questions(r.Context(), r.PathValue("id"))
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"questions": questions})
}

func (s *Server) handleFinding(w http.ResponseWriter, r *http.Request) {
	var patch struct {
		State string `json:"state"`
	}
	if err := decodeJSON(r, &patch); err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}
	if patch.State == "" {
		s.fail(w, http.StatusBadRequest, "bad_request", "Thiếu trạng thái phát hiện.")
		return
	}
	if err := s.store.UpdateFindingState(r.Context(), r.PathValue("id"), r.PathValue("findingId"), patch.State); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy phát hiện.")
			return
		}
		s.storeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handlePositions(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var pos model.Position
		if err := decodeJSON(r, &pos); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		if err := s.store.CreatePosition(r.Context(), pos); err != nil {
			s.storeError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, pos)
		return
	}

	positions, err := s.store.Positions(r.Context())
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"positions": positions})
}

func (s *Server) handlePosition(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	switch r.Method {
	case http.MethodPut:
		var pos model.Position
		if err := decodeJSON(r, &pos); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		pos.ID = id
		if err := s.store.UpdatePosition(r.Context(), pos); err != nil {
			if errors.Is(err, store.ErrNotFound) {
				s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy vị trí.")
				return
			}
			s.storeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, pos)
		return
	case http.MethodDelete:
		if err := s.store.DeletePosition(r.Context(), id); err != nil {
			s.storeError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}

	pos, err := s.store.Position(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy vị trí.")
			return
		}
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, pos)
}

func (s *Server) handleReports(w http.ResponseWriter, r *http.Request) {
	reports, err := s.store.Reports(r.Context())
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"reports": reports})
}

func (s *Server) handleReport(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if r.Method == http.MethodPatch {
		var patch struct {
			Status string `json:"status"`
		}
		if err := decodeJSON(r, &patch); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		if patch.Status != "" {
			if err := s.store.UpdateReportStatus(r.Context(), id, patch.Status); err != nil {
				s.storeError(w, err)
				return
			}
		}
	}

	report, err := s.store.Report(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy báo cáo.")
			return
		}
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (s *Server) handleTeam(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var member model.TeamMember
		if err := decodeJSON(r, &member); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		if strings.TrimSpace(member.Name) == "" {
			s.fail(w, http.StatusBadRequest, "bad_request", "Thiếu tên thành viên.")
			return
		}
		if err := s.store.CreateTeamMember(r.Context(), member); err != nil {
			s.configError(w, err, "Không tìm thấy thành viên.", "Tên thành viên đã tồn tại.")
			return
		}
		writeJSON(w, http.StatusCreated, member)
		return
	}

	members, err := s.store.Team(r.Context())
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"members": members})
}

func (s *Server) handleTeamMember(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	switch r.Method {
	case http.MethodPut:
		var member model.TeamMember
		if err := decodeJSON(r, &member); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		if strings.TrimSpace(member.Name) == "" {
			s.fail(w, http.StatusBadRequest, "bad_request", "Thiếu tên thành viên.")
			return
		}
		if err := s.store.UpdateTeamMember(r.Context(), name, member); err != nil {
			s.configError(w, err, "Không tìm thấy thành viên.", "Tên thành viên đã tồn tại.")
			return
		}
		writeJSON(w, http.StatusOK, member)
	case http.MethodDelete:
		if err := s.store.DeleteTeamMember(r.Context(), name); err != nil {
			s.configError(w, err, "Không tìm thấy thành viên.", "")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleModels(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var m model.AIModel
		if err := decodeJSON(r, &m); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		if strings.TrimSpace(m.ID) == "" || strings.TrimSpace(m.Name) == "" {
			s.fail(w, http.StatusBadRequest, "bad_request", "Thiếu mã hoặc tên model.")
			return
		}
		if err := s.store.CreateModel(r.Context(), m); err != nil {
			s.configError(w, err, "Không tìm thấy model.", "Mã model đã tồn tại.")
			return
		}
		store.HideModelKey(&m)
		writeJSON(w, http.StatusCreated, m)
		return
	}

	models, err := s.store.Models(r.Context())
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"models": models})
}

func (s *Server) handleModel(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	switch r.Method {
	case http.MethodPut:
		var m model.AIModel
		if err := decodeJSON(r, &m); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		if strings.TrimSpace(m.ID) == "" || strings.TrimSpace(m.Name) == "" {
			s.fail(w, http.StatusBadRequest, "bad_request", "Thiếu mã hoặc tên model.")
			return
		}
		if err := s.store.UpdateModel(r.Context(), id, m); err != nil {
			s.configError(w, err, "Không tìm thấy model.", "Mã model đã tồn tại.")
			return
		}
		if key, err := s.store.ModelAPIKey(r.Context(), m.ID); err == nil {
			m.APIKey = key
		}
		store.HideModelKey(&m)
		writeJSON(w, http.StatusOK, m)
	case http.MethodDelete:
		if err := s.store.DeleteModel(r.Context(), id); err != nil {
			s.configError(w, err, "Không tìm thấy model.", "")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleGeminiModels(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		APIKey  string `json:"apiKey"`
		ModelID string `json:"modelId"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}

	baseURL, providerKey := s.serviceConfig(r.Context(), "google", "https://generativelanguage.googleapis.com/v1beta")
	key := strings.TrimSpace(payload.APIKey)
	if key == "" {
		key = providerKey
	}
	if key == "" && strings.TrimSpace(payload.ModelID) != "" && s.store != nil {
		if stored, err := s.store.ModelAPIKey(r.Context(), payload.ModelID); err == nil {
			key = strings.TrimSpace(stored)
		}
	}

	models, err := gemini.New(baseURL, key).ListModels(r.Context())
	if err != nil {
		var geminiErr *gemini.Error
		if errors.As(err, &geminiErr) {
			s.fail(w, errorStatus(geminiErr.Code), geminiErr.Code, geminiErr.Message)
			return
		}
		s.fail(w, http.StatusBadGateway, "upstream_error", "Không lấy được danh sách model từ Google.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"models": models})
}

func (s *Server) handleServiceConfigs(w http.ResponseWriter, r *http.Request) {
	configs, err := s.store.ServiceConfigs(r.Context())
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"configs": configs})
}

func (s *Server) handleServiceConfig(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var payload model.ServiceConfig
	if err := decodeJSON(r, &payload); err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}
	if err := s.store.UpdateServiceConfig(r.Context(), id, payload); err != nil {
		s.configError(w, err, "Không tìm thấy nhà cung cấp.", "")
		return
	}
	record, err := s.store.ServiceConfig(r.Context(), id)
	if err != nil {
		s.storeError(w, err)
		return
	}
	store.HideServiceKey(&record)
	writeJSON(w, http.StatusOK, record)
}

func (s *Server) handleStages(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var stage model.UploadStage
		if err := decodeJSON(r, &stage); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		if stage.ID <= 0 {
			s.fail(w, http.StatusBadRequest, "bad_request", "Mã công đoạn phải là số dương.")
			return
		}
		if strings.TrimSpace(stage.Label) == "" {
			s.fail(w, http.StatusBadRequest, "bad_request", "Thiếu tên công đoạn.")
			return
		}
		if err := s.store.CreateUploadStage(r.Context(), stage); err != nil {
			s.configError(w, err, "Không tìm thấy công đoạn.", "Mã công đoạn đã tồn tại.")
			return
		}
		writeJSON(w, http.StatusCreated, stage)
		return
	}

	stages, err := s.store.UploadStages(r.Context())
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"stages": stages})
}

func (s *Server) handleStage(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id <= 0 {
		s.fail(w, http.StatusBadRequest, "bad_request", "Mã công đoạn không hợp lệ.")
		return
	}

	switch r.Method {
	case http.MethodPut:
		var stage model.UploadStage
		if err := decodeJSON(r, &stage); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		if stage.ID <= 0 {
			s.fail(w, http.StatusBadRequest, "bad_request", "Mã công đoạn phải là số dương.")
			return
		}
		if strings.TrimSpace(stage.Label) == "" {
			s.fail(w, http.StatusBadRequest, "bad_request", "Thiếu tên công đoạn.")
			return
		}
		if err := s.store.UpdateUploadStage(r.Context(), id, stage); err != nil {
			s.configError(w, err, "Không tìm thấy công đoạn.", "Mã công đoạn đã tồn tại.")
			return
		}
		writeJSON(w, http.StatusOK, stage)
	case http.MethodDelete:
		if err := s.store.DeleteUploadStage(r.Context(), id); err != nil {
			s.configError(w, err, "Không tìm thấy công đoạn.", "")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleLevels(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var level model.Level
		if err := decodeJSON(r, &level); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		if strings.TrimSpace(level.Name) == "" {
			s.fail(w, http.StatusBadRequest, "bad_request", "Thiếu tên cấp bậc.")
			return
		}
		if err := s.store.CreateLevel(r.Context(), level); err != nil {
			s.configError(w, err, "Không tìm thấy cấp bậc.", "Cấp bậc đã tồn tại.")
			return
		}
		writeJSON(w, http.StatusCreated, level)
		return
	}

	levels, err := s.store.Levels(r.Context())
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"levels": levels})
}

func (s *Server) handleLevel(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	switch r.Method {
	case http.MethodPut:
		var level model.Level
		if err := decodeJSON(r, &level); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
			return
		}
		if strings.TrimSpace(level.Name) == "" {
			s.fail(w, http.StatusBadRequest, "bad_request", "Thiếu tên cấp bậc.")
			return
		}
		if err := s.store.UpdateLevel(r.Context(), name, level); err != nil {
			s.configError(w, err, "Không tìm thấy cấp bậc.", "Cấp bậc đã tồn tại.")
			return
		}
		writeJSON(w, http.StatusOK, level)
	case http.MethodDelete:
		if err := s.store.DeleteLevel(r.Context(), name); err != nil {
			s.configError(w, err, "Không tìm thấy cấp bậc.", "")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}

func queryInt(r *http.Request, key string, fallback int) int {
	value := strings.TrimSpace(r.URL.Query().Get(key))
	if value == "" {
		return fallback
	}
	n, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return n
}

func (s *Server) storeError(w http.ResponseWriter, err error) {
	log.Printf("[api] store error: %v", err)
	s.fail(w, http.StatusInternalServerError, "server_error", "Máy chủ gặp lỗi khi truy cập dữ liệu. Vui lòng thử lại.")
}

func (s *Server) configError(w http.ResponseWriter, err error, notFound, conflict string) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		s.fail(w, http.StatusNotFound, "not_found", notFound)
	case errors.Is(err, store.ErrConflict):
		s.fail(w, http.StatusConflict, "conflict", conflict)
	default:
		s.storeError(w, err)
	}
}
