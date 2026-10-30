package api

import (
	"errors"
	"net/http"
	"strings"

	"codecv/backend/internal/model"
	"codecv/backend/internal/store"
)

func (s *Server) handleUsers(w http.ResponseWriter, r *http.Request) {
	users, err := s.store.ListUsers(r.Context())
	if err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": users})
}

func (s *Server) handleUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Role string `json:"role"`
	}
	if err := decodeJSON(r, &body); err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}
	role := strings.TrimSpace(body.Role)
	if role != model.RoleAdmin && role != model.RoleMember {
		s.fail(w, http.StatusBadRequest, "invalid_role", "Quyền không hợp lệ.")
		return
	}

	current, ok := userFromContext(r.Context())
	if !ok {
		s.unauthorized(w)
		return
	}
	// Mỗi admin chỉ tự nâng quyền, không tự hạ — luôn còn ít nhất một admin.
	if current.ID == r.PathValue("id") && role != model.RoleAdmin {
		s.fail(w, http.StatusBadRequest, "self_role", "Không thể tự bỏ quyền quản trị của chính mình.")
		return
	}

	user, err := s.store.UpdateUserRole(r.Context(), r.PathValue("id"), role)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy người dùng.")
			return
		}
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, user)
}
