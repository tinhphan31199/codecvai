package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"codecv/backend/internal/auth"
	"codecv/backend/internal/model"
	"codecv/backend/internal/store"
)

type fakeGoogle struct {
	identity auth.GoogleIdentity
	err      error
	cred     string
}

func (f *fakeGoogle) Verify(_ context.Context, credential, _ string) (auth.GoogleIdentity, error) {
	f.cred = credential
	return f.identity, f.err
}

type fakeEmails struct {
	user        model.User
	lookupErr   error
	updateErr   error
	linked      string
	onLookup    func(call int) (model.User, error)
	lookups     int
	createErrs  []error
	createCalls int
	createUser  model.User
	createHash  string
}

func (f *fakeEmails) UserByEmail(context.Context, string) (model.User, time.Time, error) {
	f.lookups++
	if f.onLookup != nil {
		user, err := f.onLookup(f.lookups)
		return user, time.Time{}, err
	}
	return f.user, time.Time{}, f.lookupErr
}

func (f *fakeEmails) CreateUser(_ context.Context, user model.User, hash string) (model.User, error) {
	f.createCalls++
	f.createUser = user
	f.createHash = hash
	if f.createCalls <= len(f.createErrs) && f.createErrs[f.createCalls-1] != nil {
		return model.User{}, f.createErrs[f.createCalls-1]
	}
	return user, nil
}

func (f *fakeEmails) UpdateEmail(_ context.Context, _ string, email string) error {
	if f.updateErr != nil {
		return f.updateErr
	}
	f.linked = email
	f.user.Email = email
	return nil
}

func newGoogleServer(verifier *fakeGoogle, emails *fakeEmails, clientID string) *Server {
	return &Server{
		auth:           auth.NewManager("test-secret"),
		emailUsers:     emails,
		googleClientID: clientID,
		googleVerifier: verifier,
	}
}

func googlePost(t *testing.T, handler http.HandlerFunc, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/google", strings.NewReader(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func errorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body model.ErrorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error body: %v (%s)", err, rec.Body.String())
	}
	return body.Error.Code
}

func TestAuthConfigReportsClientID(t *testing.T) {
	server := newGoogleServer(nil, &fakeEmails{}, "123.apps.googleusercontent.com")
	rec := httptest.NewRecorder()
	server.handleAuthConfig(rec, httptest.NewRequest(http.MethodGet, "/api/auth/config", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["googleClientId"] != "123.apps.googleusercontent.com" {
		t.Fatalf("client id = %q", body["googleClientId"])
	}

	disabled := newGoogleServer(nil, &fakeEmails{}, "")
	rec = httptest.NewRecorder()
	disabled.handleAuthConfig(rec, httptest.NewRequest(http.MethodGet, "/api/auth/config", nil))
	body = nil
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["googleClientId"] != "" {
		t.Fatalf("disabled client id = %q, want empty", body["googleClientId"])
	}
}

func TestGoogleLoginDisabled(t *testing.T) {
	server := newGoogleServer(&fakeGoogle{}, &fakeEmails{}, "")
	rec := googlePost(t, server.handleGoogleLogin, `{"credential":"x"}`)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
	if code := errorCode(t, rec); code != "google_disabled" {
		t.Fatalf("code = %q", code)
	}
}

func TestGoogleLoginRejectsInvalidCredential(t *testing.T) {
	verifier := &fakeGoogle{err: auth.ErrInvalidGoogleToken}
	server := newGoogleServer(verifier, &fakeEmails{}, "client")
	rec := googlePost(t, server.handleGoogleLogin, `{"credential":"broken"}`)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if code := errorCode(t, rec); code != "google_invalid" {
		t.Fatalf("code = %q", code)
	}
	if verifier.cred != "broken" {
		t.Fatalf("verifier saw %q", verifier.cred)
	}
}

func TestGoogleLoginRejectsUnverifiedEmail(t *testing.T) {
	verifier := &fakeGoogle{identity: auth.GoogleIdentity{Email: "minh@example.com"}}
	emails := &fakeEmails{user: model.User{ID: "u1", Username: "minh"}}
	server := newGoogleServer(verifier, emails, "client")
	rec := googlePost(t, server.handleGoogleLogin, `{"credential":"token"}`)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
	if code := errorCode(t, rec); code != "google_email_unverified" {
		t.Fatalf("code = %q", code)
	}
}

func TestGoogleLoginCreatesAccountForNewEmail(t *testing.T) {
	verifier := &fakeGoogle{identity: auth.GoogleIdentity{
		Email:         "New.User@Example.com",
		EmailVerified: true,
		Name:          "Nguyễn Văn A",
	}}
	emails := &fakeEmails{lookupErr: store.ErrNotFound}
	server := newGoogleServer(verifier, emails, "client")
	rec := googlePost(t, server.handleGoogleLogin, `{"credential":"token"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (%s)", rec.Code, rec.Body.String())
	}
	if emails.createCalls != 1 {
		t.Fatalf("create calls = %d, want 1", emails.createCalls)
	}
	created := emails.createUser
	if created.Username != "new.user" || created.Email != "New.User@Example.com" {
		t.Fatalf("created = %+v", created)
	}
	if created.DisplayName != "Nguyễn Văn A" {
		t.Fatalf("display name = %q", created.DisplayName)
	}
	if emails.createHash != googleOnlyPasswordHash {
		t.Fatalf("password hash = %q, want unusable marker", emails.createHash)
	}
	var body authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	claims, err := server.auth.Parse(body.Token)
	if err != nil {
		t.Fatalf("parse token: %v", err)
	}
	if claims.UserID != created.ID || body.User.Username != "new.user" {
		t.Fatalf("claims = %+v user = %+v", claims, body.User)
	}
}

func TestGoogleLoginRetriesUsernameOnConflict(t *testing.T) {
	verifier := &fakeGoogle{identity: auth.GoogleIdentity{Email: "new@example.com", EmailVerified: true}}
	emails := &fakeEmails{
		lookupErr:  store.ErrNotFound,
		createErrs: []error{store.ErrConflict, nil},
	}
	server := newGoogleServer(verifier, emails, "client")
	rec := googlePost(t, server.handleGoogleLogin, `{"credential":"token"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (%s)", rec.Code, rec.Body.String())
	}
	if emails.createCalls != 2 || emails.createUser.Username != "new-2" {
		t.Fatalf("calls = %d username = %q", emails.createCalls, emails.createUser.Username)
	}
}

func TestGoogleLoginReturnsAccountCreatedByConcurrentSignIn(t *testing.T) {
	verifier := &fakeGoogle{identity: auth.GoogleIdentity{Email: "minh@example.com", EmailVerified: true}}
	emails := &fakeEmails{
		createErrs: []error{store.ErrConflict},
		onLookup: func(call int) (model.User, error) {
			if call == 1 {
				return model.User{}, store.ErrNotFound
			}
			return model.User{ID: "u9", Username: "minh", Email: "minh@example.com"}, nil
		},
	}
	server := newGoogleServer(verifier, emails, "client")
	rec := googlePost(t, server.handleGoogleLogin, `{"credential":"token"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (%s)", rec.Code, rec.Body.String())
	}
	if emails.createCalls != 1 {
		t.Fatalf("create calls = %d, want 1", emails.createCalls)
	}
	if emails.lookups != 2 {
		t.Fatalf("lookups = %d, want 2", emails.lookups)
	}
	var body authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.User.ID != "u9" {
		t.Fatalf("user = %+v", body.User)
	}
}

func TestGoogleLoginFailsWhenCreateErrors(t *testing.T) {
	verifier := &fakeGoogle{identity: auth.GoogleIdentity{Email: "new@example.com", EmailVerified: true}}
	emails := &fakeEmails{
		lookupErr:  store.ErrNotFound,
		createErrs: []error{errors.New("insert failed")},
	}
	server := newGoogleServer(verifier, emails, "client")
	rec := googlePost(t, server.handleGoogleLogin, `{"credential":"token"}`)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if code := errorCode(t, rec); code != "store_error" {
		t.Fatalf("code = %q", code)
	}
}

func TestGoogleUsernameBase(t *testing.T) {
	cases := map[string]string{
		"New.User@Example.com":                      "new.user",
		"minh+dev@example.com":                      "minh.dev",
		"ab@example.com":                            "user",
		"a_b-c.d@example.com":                       "a_b-c.d",
		"Nguyễn.Văn@example.com":                    "nguy.n.v.n",
		"this.username.is.far.too.long@example.com": "this.username.is.far.too.long",
	}
	for email, want := range cases {
		if got := googleUsernameBase(email); got != want {
			t.Errorf("googleUsernameBase(%q) = %q, want %q", email, got, want)
		}
	}
	if got := googleUsernameCandidate("a.very.long.username.for.testing", 3); len(got) != googleUsernameMaxLength {
		t.Fatalf("suffixed username length = %d (%q)", len(got), got)
	}
}

func TestGoogleLoginIssuesTokenForLinkedAccount(t *testing.T) {
	verifier := &fakeGoogle{identity: auth.GoogleIdentity{
		Email:         "minh@example.com",
		EmailVerified: true,
		Name:          "Minh",
	}}
	emails := &fakeEmails{user: model.User{
		ID: "u1", Username: "minh", DisplayName: "Minh", Email: "minh@example.com",
	}}
	server := newGoogleServer(verifier, emails, "client")
	rec := googlePost(t, server.handleGoogleLogin, `{"credential":"token"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (%s)", rec.Code, rec.Body.String())
	}
	var body authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.User.Username != "minh" || body.User.Email != "minh@example.com" {
		t.Fatalf("user = %+v", body.User)
	}
	claims, err := server.auth.Parse(body.Token)
	if err != nil {
		t.Fatalf("parse token: %v", err)
	}
	if claims.UserID != "u1" {
		t.Fatalf("claims = %+v", claims)
	}
}

func TestGoogleLinkStoresEmail(t *testing.T) {
	verifier := &fakeGoogle{identity: auth.GoogleIdentity{Email: "minh@example.com", EmailVerified: true}}
	emails := &fakeEmails{}
	server := newGoogleServer(verifier, emails, "client")

	req := httptest.NewRequest(http.MethodPost, "/api/auth/google/link", strings.NewReader(`{"credential":"token"}`))
	req = req.WithContext(context.WithValue(req.Context(), userContextKey{}, model.User{ID: "u1", Username: "minh"}))
	rec := httptest.NewRecorder()
	server.handleGoogleLink(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (%s)", rec.Code, rec.Body.String())
	}
	if emails.linked != "minh@example.com" {
		t.Fatalf("linked = %q", emails.linked)
	}
	var body struct {
		User model.User `json:"user"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.User.Email != "minh@example.com" {
		t.Fatalf("user = %+v", body.User)
	}
}

func TestGoogleLinkRejectsEmailOwnedByAnotherAccount(t *testing.T) {
	verifier := &fakeGoogle{identity: auth.GoogleIdentity{Email: "minh@example.com", EmailVerified: true}}
	emails := &fakeEmails{updateErr: store.ErrConflict}
	server := newGoogleServer(verifier, emails, "client")

	req := httptest.NewRequest(http.MethodPost, "/api/auth/google/link", strings.NewReader(`{"credential":"token"}`))
	req = req.WithContext(context.WithValue(req.Context(), userContextKey{}, model.User{ID: "u1"}))
	rec := httptest.NewRecorder()
	server.handleGoogleLink(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", rec.Code)
	}
	if code := errorCode(t, rec); code != "google_email_in_use" {
		t.Fatalf("code = %q", code)
	}
}
