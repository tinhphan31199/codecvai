package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"codecv/backend/internal/auth"
	"codecv/backend/internal/model"
	"codecv/backend/internal/store"
)

const defaultSessionHours = 12

type userContextKey struct{}

// authenticate chặn mọi tuyến API trừ healthz và các tuyến auth công khai.
func (s *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isPublicRoute(r) {
			next.ServeHTTP(w, r)
			return
		}
		if s.authUsers == nil || s.auth == nil {
			s.fail(w, http.StatusServiceUnavailable, "missing_db", "Máy chủ chưa kết nối cơ sở dữ liệu. Kiểm tra DATABASE_URL và khởi động lại server.")
			return
		}
		token := bearerToken(r)
		if token == "" {
			s.unauthorized(w)
			return
		}
		claims, err := s.auth.Parse(token)
		if err != nil {
			s.unauthorized(w)
			return
		}
		user, passwordChangedAt, err := s.authUsers.UserByID(r.Context(), claims.UserID)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				s.unauthorized(w)
				return
			}
			log.Printf("[auth] user lookup failed: %v", err)
			s.fail(w, http.StatusInternalServerError, "store_error", "Không kiểm tra được phiên đăng nhập. Vui lòng thử lại.")
			return
		}
		if claims.IssuedAt.Truncate(time.Second).Before(passwordChangedAt.Truncate(time.Second)) {
			s.unauthorized(w)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userContextKey{}, user)))
	})
}

func isPublicRoute(r *http.Request) bool {
	switch r.Method + " " + r.URL.Path {
	case "GET /healthz", "POST /api/auth/login", "POST /api/auth/register",
		"GET /api/auth/config", "POST /api/auth/google":
		return true
	default:
		return false
	}
}

func bearerToken(r *http.Request) string {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	scheme, token, found := strings.Cut(header, " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}

func (s *Server) unauthorized(w http.ResponseWriter) {
	s.fail(w, http.StatusUnauthorized, "unauthorized", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.")
}

func userFromContext(ctx context.Context) (model.User, bool) {
	user, ok := ctx.Value(userContextKey{}).(model.User)
	return user, ok
}

type credentials struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

type authResponse struct {
	Token     string     `json:"token"`
	ExpiresAt string     `json:"expiresAt"`
	User      model.User `json:"user"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	if !s.requireStore(w) {
		return
	}
	var body credentials
	if err := decodeJSON(r, &body); err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}
	username, err := auth.NormalizeUsername(body.Username)
	if err != nil {
		s.fail(w, http.StatusBadRequest, "invalid_username", "Tên đăng nhập 3–32 ký tự, chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.")
		return
	}
	if err := auth.ValidatePassword(body.Password); err != nil {
		s.fail(w, http.StatusBadRequest, "weak_password", "Mật khẩu cần từ 8 đến 72 ký tự.")
		return
	}
	displayName := strings.TrimSpace(body.DisplayName)
	if displayName == "" {
		displayName = username
	}
	if runes := []rune(displayName); len(runes) > 80 {
		displayName = string(runes[:80])
	}

	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		log.Printf("[auth] hash failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "server_error", "Không tạo được tài khoản. Vui lòng thử lại.")
		return
	}
	user, err := s.store.CreateUser(r.Context(), model.User{
		ID:          newUserID(),
		Username:    username,
		DisplayName: displayName,
	}, hash)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			s.fail(w, http.StatusConflict, "username_taken", "Tên đăng nhập đã được sử dụng.")
			return
		}
		log.Printf("[auth] create user failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "store_error", "Không tạo được tài khoản. Vui lòng thử lại.")
		return
	}
	s.issueToken(w, r.Context(), user)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !s.requireStore(w) {
		return
	}
	var body credentials
	if err := decodeJSON(r, &body); err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}
	username, err := auth.NormalizeUsername(body.Username)
	if err != nil {
		s.invalidCredentials(w)
		return
	}
	record, err := s.store.UserByUsername(r.Context(), username)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.invalidCredentials(w)
			return
		}
		log.Printf("[auth] lookup failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "store_error", "Không đăng nhập được. Vui lòng thử lại.")
		return
	}
	if !auth.VerifyPassword(record.PasswordHash, body.Password) {
		s.invalidCredentials(w)
		return
	}
	s.issueToken(w, r.Context(), record.User)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		s.unauthorized(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]model.User{"user": user})
}

func (s *Server) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		s.unauthorized(w)
		return
	}
	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := decodeJSON(r, &body); err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}
	record, err := s.store.UserByUsername(r.Context(), user.Username)
	if err != nil {
		s.storeError(w, err)
		return
	}
	if !auth.VerifyPassword(record.PasswordHash, body.CurrentPassword) {
		s.fail(w, http.StatusBadRequest, "wrong_password", "Mật khẩu hiện tại không đúng.")
		return
	}
	if err := auth.ValidatePassword(body.NewPassword); err != nil {
		s.fail(w, http.StatusBadRequest, "weak_password", "Mật khẩu cần từ 8 đến 72 ký tự.")
		return
	}
	hash, err := auth.HashPassword(body.NewPassword)
	if err != nil {
		log.Printf("[auth] hash failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "server_error", "Không đổi được mật khẩu. Vui lòng thử lại.")
		return
	}
	if err := s.store.UpdatePassword(r.Context(), user.ID, hash); err != nil {
		s.storeError(w, err)
		return
	}
	s.issueToken(w, r.Context(), user)
}

func (s *Server) issueToken(w http.ResponseWriter, ctx context.Context, user model.User) {
	ttl := s.sessionTTL(ctx)
	token, err := s.auth.Sign(auth.User{
		ID:          user.ID,
		Username:    user.Username,
		DisplayName: user.DisplayName,
	}, ttl)
	if err != nil {
		log.Printf("[auth] sign failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "server_error", "Không tạo được phiên đăng nhập. Vui lòng thử lại.")
		return
	}
	writeJSON(w, http.StatusOK, authResponse{
		Token:     token,
		ExpiresAt: time.Now().Add(ttl).UTC().Format(time.RFC3339),
		User:      user,
	})
}

// sessionTTL lấy theo Cài đặt → Bảo mật; mặc định 12 giờ khi chưa đặt.
func (s *Server) sessionTTL(ctx context.Context) time.Duration {
	if s.store != nil {
		if workspace, err := s.store.Workspace(ctx); err == nil && workspace.SessionHours > 0 {
			hours := workspace.SessionHours
			if hours > 24*30 {
				hours = 24 * 30
			}
			return time.Duration(hours) * time.Hour
		}
	}
	return defaultSessionHours * time.Hour
}

func (s *Server) requireStore(w http.ResponseWriter) bool {
	if s.store == nil {
		s.fail(w, http.StatusServiceUnavailable, "missing_db", "Máy chủ chưa kết nối cơ sở dữ liệu. Kiểm tra DATABASE_URL và khởi động lại server.")
		return false
	}
	if s.auth == nil {
		s.fail(w, http.StatusServiceUnavailable, "auth_unavailable", "Máy chủ chưa cấu hình khoá ký phiên đăng nhập.")
		return false
	}
	return true
}

func (s *Server) invalidCredentials(w http.ResponseWriter) {
	s.fail(w, http.StatusUnauthorized, "invalid_credentials", "Tên đăng nhập hoặc mật khẩu không đúng.")
}

func newUserID() string {
	buf := make([]byte, 8)
	_, _ = rand.Read(buf) // crypto/rand.Read không lỗi từ Go 1.24 (panic nếu hỏng entropy)
	return "u_" + hex.EncodeToString(buf)
}
