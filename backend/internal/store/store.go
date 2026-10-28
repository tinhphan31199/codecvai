package store

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"sort"

	"codecv/backend/migrations"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound = errors.New("store: not found")
	ErrConflict = errors.New("store: conflict")
)

type Store struct {
	pool *pgxpool.Pool
}

func Open(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("store: connect: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("store: ping: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

// Migrate applies embedded SQL migrations in filename order.
func (s *Store) Migrate(ctx context.Context) error {
	entries, err := fs.ReadDir(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("store: read migrations: %w", err)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		body, err := fs.ReadFile(migrations.FS, entry.Name())
		if err != nil {
			return fmt.Errorf("store: read %s: %w", entry.Name(), err)
		}
		if _, err := s.pool.Exec(ctx, string(body)); err != nil {
			return fmt.Errorf("store: migrate %s: %w", entry.Name(), err)
		}
		log.Printf("[store] applied migration %s", entry.Name())
	}
	return nil
}
