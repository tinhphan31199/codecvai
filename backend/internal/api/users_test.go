package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"codecv/backend/internal/model"
)

func userPatchRequest(t *testing.T, current model.User, pathID, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPatch, "/api/users/"+pathID, strings.NewReader(body))
	req.SetPathValue("id", pathID)
	req = req.WithContext(context.WithValue(req.Context(), userContextKey{}, current))
	rec := httptest.NewRecorder()
	(&Server{}).handleUser(rec, req)
	return rec
}

func TestHandleUserRejectsInvalidRole(t *testing.T) {
	rec := userPatchRequest(t, model.User{ID: "u2", Role: model.RoleAdmin}, "u1", `{"role":"owner"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if code := errorCode(t, rec); code != "invalid_role" {
		t.Fatalf("code = %q, want invalid_role", code)
	}
}

func TestHandleUserBlocksSelfDemotion(t *testing.T) {
	rec := userPatchRequest(t, model.User{ID: "u1", Role: model.RoleAdmin}, "u1", `{"role":"member"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if code := errorCode(t, rec); code != "self_role" {
		t.Fatalf("code = %q, want self_role", code)
	}
}
