package auth

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestHashPasswordRoundTrip(t *testing.T) {
	hash, err := HashPassword("mat-khau-123")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if hash == "mat-khau-123" {
		t.Fatal("hash must not equal the password")
	}
	if !VerifyPassword(hash, "mat-khau-123") {
		t.Fatal("correct password rejected")
	}
	if VerifyPassword(hash, "mat-khau-124") {
		t.Fatal("wrong password accepted")
	}
}

func TestSignParse(t *testing.T) {
	manager := NewManager("test-secret")
	user := User{ID: "u1", Username: "minhanh", DisplayName: "Minh Anh"}

	token, err := manager.Sign(user, time.Hour)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	claims, err := manager.Parse(token)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if claims.UserID != "u1" || claims.Username != "minhanh" || claims.DisplayName != "Minh Anh" {
		t.Fatalf("claims = %+v", claims)
	}
	if time.Until(claims.ExpiresAt) < 50*time.Minute {
		t.Fatalf("expiry too soon: %v", claims.ExpiresAt)
	}
}

func TestParseRejectsExpired(t *testing.T) {
	manager := NewManager("test-secret")
	token, err := manager.Sign(User{ID: "u1", Username: "minhanh"}, -time.Minute)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if _, err := manager.Parse(token); !errors.Is(err, ErrTokenExpired) {
		t.Fatalf("err = %v, want ErrTokenExpired", err)
	}
}

func TestParseRejectsBadSignature(t *testing.T) {
	signer := NewManager("other-secret")
	token, err := signer.Sign(User{ID: "u1", Username: "minhanh"}, time.Hour)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if _, err := NewManager("test-secret").Parse(token); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("err = %v, want ErrInvalidToken", err)
	}
	if _, err := NewManager("test-secret").Parse("not-a-token"); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("err = %v, want ErrInvalidToken", err)
	}
}

func TestNormalizeUsername(t *testing.T) {
	valid := map[string]string{
		"  MinhAnh ":  "minhanh",
		"Minh.Anh_01": "minh.anh_01",
	}
	for input, want := range valid {
		got, err := NormalizeUsername(input)
		if err != nil {
			t.Fatalf("%q: %v", input, err)
		}
		if got != want {
			t.Fatalf("%q = %q, want %q", input, got, want)
		}
	}
	for _, input := range []string{"", "  ", "ab", "có dấu", "has space", strings.Repeat("a", 33)} {
		if _, err := NormalizeUsername(input); err == nil {
			t.Fatalf("%q accepted", input)
		}
	}
}

func TestValidatePassword(t *testing.T) {
	if err := ValidatePassword("short"); err == nil {
		t.Fatal("short password accepted")
	}
	if err := ValidatePassword(strings.Repeat("a", 73)); err == nil {
		t.Fatal("75-byte password accepted (bcrypt limit)")
	}
	if err := ValidatePassword("mat-khau-123"); err != nil {
		t.Fatalf("valid password rejected: %v", err)
	}
}
