// Package auth xác thực người dùng bằng mật khẩu bcrypt và cấp JWT HS256.
package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidToken  = errors.New("auth: invalid token")
	ErrTokenExpired  = errors.New("auth: token expired")
	ErrInvalidUser   = errors.New("auth: invalid username")
	ErrInvalidPass   = errors.New("auth: invalid password")
	usernamePattern  = regexp.MustCompile(`^[a-z0-9._-]{3,32}$`)
	minPasswordBytes = 8
	maxPasswordBytes = 72 // giới hạn cứng của bcrypt
)

type User struct {
	ID          string
	Username    string
	DisplayName string
}

type Claims struct {
	UserID      string
	Username    string
	DisplayName string
	IssuedAt    time.Time
	ExpiresAt   time.Time
}

type Manager struct {
	secret []byte
}

func NewManager(secret string) *Manager {
	return &Manager{secret: []byte(secret)}
}

// RandomSecret sinh khoá ký ngẫu nhiên 32 byte khi chưa cấu hình AUTH_JWT_SECRET.
func RandomSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("auth: random secret: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

func (m *Manager) Sign(user User, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := jwtClaims{
		Username:    user.Username,
		DisplayName: user.DisplayName,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	if err != nil {
		return "", fmt.Errorf("auth: sign: %w", err)
	}
	return token, nil
}

func (m *Manager) Parse(token string) (Claims, error) {
	var parsed jwtClaims
	_, err := jwt.ParseWithClaims(token, &parsed,
		func(*jwt.Token) (any, error) { return m.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
	)
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return Claims{}, ErrTokenExpired
		}
		return Claims{}, ErrInvalidToken
	}
	if parsed.Subject == "" {
		return Claims{}, ErrInvalidToken
	}
	return Claims{
		UserID:      parsed.Subject,
		Username:    parsed.Username,
		DisplayName: parsed.DisplayName,
		IssuedAt:    parsed.IssuedAt.Time,
		ExpiresAt:   parsed.ExpiresAt.Time,
	}, nil
}

type jwtClaims struct {
	Username    string `json:"usr"`
	DisplayName string `json:"name"`
	jwt.RegisteredClaims
}

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("auth: hash password: %w", err)
	}
	return string(hash), nil
}

func VerifyPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// NormalizeUsername hạ chữ thường và chỉ cho phép chữ, số, dấu chấm, gạch dưới, gạch ngang.
func NormalizeUsername(raw string) (string, error) {
	username := strings.ToLower(strings.TrimSpace(raw))
	if !usernamePattern.MatchString(username) {
		return "", ErrInvalidUser
	}
	return username, nil
}

func ValidatePassword(password string) error {
	if len(password) < minPasswordBytes || len(password) > maxPasswordBytes {
		return ErrInvalidPass
	}
	return nil
}
