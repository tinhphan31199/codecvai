package api

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"codecv/backend/internal/auth"
	"codecv/backend/internal/model"
	"codecv/backend/internal/store"
)

type googleCredential struct {
	Credential string `json:"credential"`
}

const googleDisabledMessage = "Đăng nhập Google chưa được bật trên máy chủ này."

func (s *Server) handleAuthConfig(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"googleClientId": s.googleClientID})
}

// handleGoogleLogin signs in the account matching the Google email, creating
// the account on the first sign-in.
func (s *Server) handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	identity, ok := s.googleIdentity(w, r)
	if !ok {
		return
	}
	user, _, err := s.emailUsers.UserByEmail(r.Context(), identity.Email)
	if errors.Is(err, store.ErrNotFound) {
		user, err = s.createGoogleAccount(r.Context(), identity)
		if err != nil {
			log.Printf("[auth] google account create failed: %v", err)
			s.fail(w, http.StatusInternalServerError, "store_error", "Không tạo được tài khoản từ Google. Vui lòng thử lại.")
			return
		}
	} else if err != nil {
		log.Printf("[auth] google lookup failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "store_error", "Không đăng nhập được. Vui lòng thử lại.")
		return
	}
	s.issueToken(w, r.Context(), user)
}

const (
	// googleOnlyPasswordHash never matches bcrypt, so accounts created from
	// Google cannot be signed into with a password.
	googleOnlyPasswordHash   = "!"
	googleUsernameMinLength  = 3
	googleUsernameMaxLength  = 32
	googleUsernameMaxAttempt = 20
)

func (s *Server) createGoogleAccount(ctx context.Context, identity auth.GoogleIdentity) (model.User, error) {
	base := googleUsernameBase(identity.Email)
	displayName := googleDisplayName(identity.Name, base)
	for attempt := 0; attempt < googleUsernameMaxAttempt; attempt++ {
		user, err := s.emailUsers.CreateUser(ctx, model.User{
			ID:          newUserID(),
			Username:    googleUsernameCandidate(base, attempt),
			DisplayName: displayName,
			Email:       identity.Email,
		}, googleOnlyPasswordHash)
		if err == nil {
			return user, nil
		}
		if !errors.Is(err, store.ErrConflict) {
			return model.User{}, err
		}
		// A concurrent first sign-in may already own this email.
		if existing, _, lookupErr := s.emailUsers.UserByEmail(ctx, identity.Email); lookupErr == nil {
			return existing, nil
		}
	}
	return model.User{}, store.ErrConflict
}

func googleUsernameBase(email string) string {
	local := email
	if at := strings.IndexByte(local, '@'); at >= 0 {
		local = local[:at]
	}
	var b strings.Builder
	for _, r := range strings.ToLower(local) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '.', r == '_', r == '-':
			b.WriteRune(r)
		default:
			b.WriteByte('.')
		}
	}
	name := strings.Trim(b.String(), "._-")
	if len(name) > googleUsernameMaxLength {
		name = name[:googleUsernameMaxLength]
	}
	if len(name) < googleUsernameMinLength {
		name = "user"
	}
	return name
}

func googleUsernameCandidate(base string, attempt int) string {
	if attempt == 0 {
		return base
	}
	suffix := "-" + strconv.Itoa(attempt+1)
	if room := googleUsernameMaxLength - len(suffix); len(base) > room {
		base = base[:room]
	}
	return base + suffix
}

func googleDisplayName(name, fallback string) string {
	displayName := strings.TrimSpace(name)
	if displayName == "" {
		displayName = fallback
	}
	if runes := []rune(displayName); len(runes) > 80 {
		displayName = string(runes[:80])
	}
	return displayName
}

func (s *Server) handleGoogleLink(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		s.unauthorized(w)
		return
	}
	identity, ok := s.googleIdentity(w, r)
	if !ok {
		return
	}
	if err := s.emailUsers.UpdateEmail(r.Context(), user.ID, identity.Email); err != nil {
		if errors.Is(err, store.ErrConflict) {
			s.fail(w, http.StatusConflict, "google_email_in_use", "Email Google này đã liên kết với một tài khoản khác.")
			return
		}
		s.storeError(w, err)
		return
	}
	user.Email = identity.Email
	writeJSON(w, http.StatusOK, map[string]model.User{"user": user})
}

// googleIdentity verifies the posted credential and rejects unverified emails.
func (s *Server) googleIdentity(w http.ResponseWriter, r *http.Request) (auth.GoogleIdentity, bool) {
	if !s.requireEmailStore(w) {
		return auth.GoogleIdentity{}, false
	}
	if s.googleClientID == "" || s.googleVerifier == nil {
		s.fail(w, http.StatusServiceUnavailable, "google_disabled", googleDisabledMessage)
		return auth.GoogleIdentity{}, false
	}
	var body googleCredential
	if err := decodeJSON(r, &body); err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return auth.GoogleIdentity{}, false
	}
	identity, err := s.googleVerifier.Verify(r.Context(), body.Credential, s.googleClientID)
	if err != nil {
		log.Printf("[auth] google verify failed: %v", err)
		s.fail(w, http.StatusUnauthorized, "google_invalid", "Không xác minh được tài khoản Google. Vui lòng thử lại.")
		return auth.GoogleIdentity{}, false
	}
	if !identity.EmailVerified {
		s.fail(w, http.StatusForbidden, "google_email_unverified", "Email của tài khoản Google này chưa được xác minh.")
		return auth.GoogleIdentity{}, false
	}
	return identity, true
}

func (s *Server) requireEmailStore(w http.ResponseWriter) bool {
	if s.emailUsers == nil {
		s.fail(w, http.StatusServiceUnavailable, "missing_db", "Máy chủ chưa kết nối cơ sở dữ liệu. Kiểm tra DATABASE_URL và khởi động lại server.")
		return false
	}
	if s.auth == nil {
		s.fail(w, http.StatusServiceUnavailable, "auth_unavailable", "Máy chủ chưa cấu hình khoá ký phiên đăng nhập.")
		return false
	}
	return true
}
