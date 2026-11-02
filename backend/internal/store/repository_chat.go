package store

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"codecv/backend/internal/model"
)

const repositoryChatHistoryLimit = 100

// RepositoryChatMessages returns the stored Q&A of one repository, oldest
// first. Only the most recent turns are kept so a long conversation stays
// cheap to load.
func (s *Store) RepositoryChatMessages(ctx context.Context, candidateID, repoURL string) ([]model.RepositoryChatMessage, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, role, content, created_at
		FROM (
			SELECT id, role, content, created_at
			FROM repository_chat_messages
			WHERE candidate_id = $1 AND repo_url = $2
			ORDER BY id DESC
			LIMIT $3
		) recent
		ORDER BY id`, candidateID, repoURL, repositoryChatHistoryLimit)
	if err != nil {
		return nil, fmt.Errorf("store: repository chat: %w", err)
	}
	defer rows.Close()

	messages := make([]model.RepositoryChatMessage, 0)
	for rows.Next() {
		var (
			id        int64
			role      string
			content   string
			createdAt time.Time
		)
		if err := rows.Scan(&id, &role, &content, &createdAt); err != nil {
			return nil, fmt.Errorf("store: repository chat scan: %w", err)
		}
		messages = append(messages, model.RepositoryChatMessage{
			ID:        strconv.FormatInt(id, 10),
			Role:      role,
			Content:   content,
			CreatedAt: createdAt.UTC().Format(time.RFC3339),
		})
	}
	return messages, rows.Err()
}

// AppendRepositoryChatExchange stores the question and the answer together so
// a failed AI call never leaves a question without its reply.
func (s *Store) AppendRepositoryChatExchange(ctx context.Context, candidateID, repoURL, question, answer string) ([]model.RepositoryChatMessage, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	turns := []struct{ role, content string }{
		{model.ChatRoleUser, question},
		{model.ChatRoleAssistant, answer},
	}
	messages := make([]model.RepositoryChatMessage, 0, len(turns))
	for _, turn := range turns {
		var (
			id        int64
			createdAt time.Time
		)
		if err := tx.QueryRow(ctx, `
			INSERT INTO repository_chat_messages (candidate_id, repo_url, role, content)
			VALUES ($1, $2, $3, $4)
			RETURNING id, created_at`,
			candidateID, repoURL, turn.role, turn.content,
		).Scan(&id, &createdAt); err != nil {
			return nil, fmt.Errorf("store: save repository chat: %w", err)
		}
		messages = append(messages, model.RepositoryChatMessage{
			ID:        strconv.FormatInt(id, 10),
			Role:      turn.role,
			Content:   turn.content,
			CreatedAt: createdAt.UTC().Format(time.RFC3339),
		})
	}
	return messages, tx.Commit(ctx)
}
