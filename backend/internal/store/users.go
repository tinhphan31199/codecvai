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
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users (id, username, display_name, password_hash, email)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''))
		RETURNING id, username, display_name, COALESCE(email, '')`,
		user.ID, user.Username, user.DisplayName, passwordHash, user.Email,
	).Scan(&user.ID, &user.Username, &user.DisplayName, &user.Email)
	if err != nil {
		return model.User{}, wrapConfigError("store: create user", err)
	}
	return user, nil
}

func (s *Store) UserByUsername(ctx context.Context, username string) (UserRecord, error) {
	var record UserRecord
	err := s.pool.QueryRow(ctx, `
		SELECT id, username, display_name, COALESCE(email, ''), password_hash, password_changed_at
		FROM users WHERE lower(username) = lower($1)`, username).
		Scan(&record.User.ID, &record.User.Username, &record.User.DisplayName,
			&record.User.Email, &record.PasswordHash, &record.PasswordChangedAt)
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
		SELECT id, username, display_name, COALESCE(email, ''), password_changed_at
		FROM users WHERE id = $1`, id).
		Scan(&user.ID, &user.Username, &user.DisplayName, &user.Email, &passwordChangedAt)
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
		SELECT id, username, display_name, COALESCE(email, ''), password_changed_at
		FROM users WHERE email IS NOT NULL AND lower(email) = lower($1)`, email).
		Scan(&user.ID, &user.Username, &user.DisplayName, &user.Email, &passwordChangedAt)
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
