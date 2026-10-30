package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"codecv/backend/internal/auth"
	"codecv/backend/internal/model"
	"codecv/backend/internal/store"
)

type fakeUsers struct {
	user      model.User
	changedAt time.Time
	err       error
}

func (f *fakeUsers) UserByID(context.Context, string) (model.User, time.Time, error) {
	return f.user, f.changedAt, f.err
}

func newAuthServer(users *fakeUsers) (*Server, *auth.Manager) {
	manager := auth.NewManager("test-secret")
	return &Server{auth: manager, authUsers: users}, manager
}

func TestAuthenticateRejectsMissingToken(t *testing.T) {
	server, _ := newAuthServer(&fakeUsers{})
	handler := server.authenticate(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/stats", nil))

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestAuthenticateAcceptsValidToken(t *testing.T) {
	users := &fakeUsers{user: model.User{ID: "u1", Username: "minhanh", DisplayName: "Minh Anh"}}
	server, manager := newAuthServer(users)
	token, err := manager.Sign(auth.User{ID: "u1", Username: "minhanh"}, time.Hour)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	var got model.User
	handler := server.authenticate(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got, _ = userFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got.ID != "u1" {
		t.Fatalf("user = %+v", got)
	}
}

func TestAuthenticateRejectsBadToken(t *testing.T) {
	server, _ := newAuthServer(&fakeUsers{})
	handler := server.authenticate(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for _, header := range []string{"", "Bearer nope", "Basic abc"} {
		req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
		if header != "" {
			req.Header.Set("Authorization", header)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("header %q: status = %d, want 401", header, rec.Code)
		}
	}
}

func TestAuthenticateRejectsExpiredOrChangedPassword(t *testing.T) {
	users := &fakeUsers{user: model.User{ID: "u1"}}
	server, manager := newAuthServer(users)
	handler := server.authenticate(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	expired, err := manager.Sign(auth.User{ID: "u1"}, -time.Minute)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	req.Header.Set("Authorization", "Bearer "+expired)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expired token: status = %d, want 401", rec.Code)
	}

	users.changedAt = time.Now().Add(time.Hour)
	old, err := manager.Sign(auth.User{ID: "u1"}, time.Hour)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	req = httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	req.Header.Set("Authorization", "Bearer "+old)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("token issued before password change: status = %d, want 401", rec.Code)
	}
}

func TestAuthenticateRejectsUnknownUser(t *testing.T) {
	users := &fakeUsers{err: store.ErrNotFound}
	server, manager := newAuthServer(users)
	token, err := manager.Sign(auth.User{ID: "gone"}, time.Hour)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	handler := server.authenticate(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestAuthenticateLeavesPublicRoutesOpen(t *testing.T) {
	server, _ := newAuthServer(&fakeUsers{err: errors.New("must not be called")})
	handler := server.authenticate(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for _, route := range []struct{ method, path string }{
		{http.MethodGet, "/healthz"},
		{http.MethodPost, "/api/auth/login"},
		{http.MethodPost, "/api/auth/register"},
		{http.MethodGet, "/api/auth/config"},
		{http.MethodPost, "/api/auth/google"},
	} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(route.method, route.path, nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("%s %s: status = %d, want 200", route.method, route.path, rec.Code)
		}
	}
}
