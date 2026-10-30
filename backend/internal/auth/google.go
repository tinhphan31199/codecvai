package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"google.golang.org/api/idtoken"
)

// ErrInvalidGoogleToken marks a Google credential the server refuses to trust.
var ErrInvalidGoogleToken = errors.New("auth: invalid google id token")

// GoogleIdentity is the subset of the Google ID token payload the app uses.
type GoogleIdentity struct {
	Email         string
	EmailVerified bool
	Name          string
	Subject       string
}

// GoogleVerifier lets the API swap in a stub during tests.
type GoogleVerifier interface {
	Verify(ctx context.Context, credential, clientID string) (GoogleIdentity, error)
}

// GoogleIDTokenVerifier checks the Google Identity Services credential:
// signature against Google's keys, audience, issuer and expiry.
type GoogleIDTokenVerifier struct{}

func (GoogleIDTokenVerifier) Verify(ctx context.Context, credential, clientID string) (GoogleIdentity, error) {
	credential = strings.TrimSpace(credential)
	if credential == "" || clientID == "" {
		return GoogleIdentity{}, ErrInvalidGoogleToken
	}
	payload, err := idtoken.Validate(ctx, credential, clientID)
	if err != nil {
		return GoogleIdentity{}, fmt.Errorf("%w: %v", ErrInvalidGoogleToken, err)
	}
	email := strings.ToLower(strings.TrimSpace(stringClaim(payload.Claims, "email")))
	if email == "" {
		return GoogleIdentity{}, fmt.Errorf("%w: token has no email", ErrInvalidGoogleToken)
	}
	verified, _ := payload.Claims["email_verified"].(bool)
	return GoogleIdentity{
		Email:         email,
		EmailVerified: verified,
		Name:          strings.TrimSpace(stringClaim(payload.Claims, "name")),
		Subject:       payload.Subject,
	}, nil
}

func stringClaim(claims map[string]any, key string) string {
	value, _ := claims[key].(string)
	return value
}
