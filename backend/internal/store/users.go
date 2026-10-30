package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"codecv/backend/internal/model"

	"github.com/jackc/pgx/v5"
)

type UserRecord struct {
	User              model.User
	PasswordHash      string
	PasswordChangedAt time.Time
}

func (s *Store) CreateUser(ctx context.Context, user model.User, passwordHash string) (model.User, error) {
	// Tài khoản đầu tiên trên một DB trống trở thành admin để không bị khoá quyền cấu hình.
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users (id, username, display_name, password_hash, email, role)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''),
			CASE WHEN EXISTS (SELECT 1 FROM users) THEN 'member' ELSE 'admin' END)
		RETURNING id, username, display_name, COALESCE(email, ''), role`,
		user.ID, user.Username, user.DisplayName, passwordHash, user.Email,
	).Scan(&user.ID, &user.Username, &user.DisplayName, &user.Email, &user.Role)
	if err != nil {
		return model.User{}, wrapConfigError("store: create user", err)
	}
	return user, nil
}

// ListUsers trả danh sách tài khoản cho tab Người dùng; password_hash "!" đánh dấu tài khoản tạo từ Google.
func (s *Store) ListUsers(ctx context.Context) ([]model.UserAccount, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, username, display_name, COALESCE(email, ''), role,
			CASE WHEN password_hash = '!' THEN 'google' ELSE 'password' END,
			created_at
		FROM users
		ORDER BY created_at, username`)
	if err != nil {
		return nil, fmt.Errorf("store: list users: %w", err)
	}
	defer rows.Close()

	users := make([]model.UserAccount, 0, 8)
	for rows.Next() {
		var (
			user      model.UserAccount
			createdAt time.Time
		)
		if err := rows.Scan(&user.ID, &user.Username, &user.DisplayName, &user.Email,
			&user.Role, &user.AuthSource, &createdAt); err != nil {
			return nil, fmt.Errorf("store: scan user: %w", err)
		}
		user.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("store: list users: %w", err)
	}
	return users, nil
}

func (s *Store) UpdateUserRole(ctx context.Context, id, role string) (model.User, error) {
	var user model.User
	err := s.pool.QueryRow(ctx, `
		UPDATE users SET role = $2 WHERE id = $1
		RETURNING id, username, display_name, COALESCE(email, ''), role`, id, role).
		Scan(&user.ID, &user.Username, &user.DisplayName, &user.Email, &user.Role)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.User{}, ErrNotFound
	}
	if err != nil {
		return model.User{}, fmt.Errorf("store: update user role: %w", err)
	}
	return user, nil
}

func (s *Store) UserByUsername(ctx context.Context, username string) (UserRecord, error) {
	var record UserRecord
	err := s.pool.QueryRow(ctx, `
		SELECT id, username, display_name, COALESCE(email, ''), role, password_hash, password_changed_at
		FROM users WHERE lower(username) = lower($1)`, username).
		Scan(&record.User.ID, &record.User.Username, &record.User.DisplayName,
			&record.User.Email, &record.User.Role, &record.PasswordHash, &record.PasswordChangedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return UserRecord{}, ErrNotFound
	}
	if err != nil {
		return UserRecord{}, fmt.Errorf("store: user by username: %w", err)
	}
	return record, nil
}

func (s *Store) UserByID(ctx context.Context, id string) (model.User, time.Time, error) {
	var user model.User
	var passwordChangedAt time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT id, username, display_name, COALESCE(email, ''), role, password_changed_at
		FROM users WHERE id = $1`, id).
		Scan(&user.ID, &user.Username, &user.DisplayName, &user.Email, &user.Role, &passwordChangedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.User{}, time.Time{}, ErrNotFound
	}
	if err != nil {
		return model.User{}, time.Time{}, fmt.Errorf("store: user by id: %w", err)
	}
	return user, passwordChangedAt, nil
}

func (s *Store) UserByEmail(ctx context.Context, email string) (model.User, time.Time, error) {
	var user model.User
	var passwordChangedAt time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT id, username, display_name, COALESCE(email, ''), role, password_changed_at
		FROM users WHERE email IS NOT NULL AND lower(email) = lower($1)`, email).
		Scan(&user.ID, &user.Username, &user.DisplayName, &user.Email, &user.Role, &passwordChangedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.User{}, time.Time{}, ErrNotFound
	}
	if err != nil {
		return model.User{}, time.Time{}, fmt.Errorf("store: user by email: %w", err)
	}
	return user, passwordChangedAt, nil
}

func (s *Store) UpdateEmail(ctx context.Context, id, email string) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE users SET email = NULLIF($2, '') WHERE id = $1`, id, email)
	if err != nil {
		return wrapConfigError("store: update email", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) UpdatePassword(ctx context.Context, id, passwordHash string) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1`,
		id, passwordHash)
	if err != nil {
		return fmt.Errorf("store: update password: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
