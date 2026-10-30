package store

import (
	"context"
	"errors"
	"fmt"

	"codecv/backend/internal/model"

	"github.com/jackc/pgx/v5"
)

// CandidateRepositories lists every repository saved with the candidate.
func (s *Store) CandidateRepositories(ctx context.Context, candidateID string) ([]model.RepositoryRecord, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT url, label, kind, status, "context", detail, source, owner, repo_name, updated_at
		FROM candidate_repositories
		WHERE candidate_id = $1
		ORDER BY idx`, candidateID)
	if err != nil {
		return nil, fmt.Errorf("store: candidate repositories: %w", err)
	}
	defer rows.Close()

	repositories := make([]model.RepositoryRecord, 0)
	for rows.Next() {
		var repository model.RepositoryRecord
		if err := rows.Scan(
			&repository.URL, &repository.Label, &repository.Kind, &repository.Status,
			&repository.Context, &repository.Detail, &repository.Source,
			&repository.Owner, &repository.Name, &repository.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("store: candidate repositories scan: %w", err)
		}
		repositories = append(repositories, repository)
	}
	return repositories, rows.Err()
}

// PendingRepositoryJob claims the oldest pending repository. One worker reads
// one repo at a time; SKIP LOCKED keeps a second process from taking the same row.
func (s *Store) PendingRepositoryJob(ctx context.Context) (model.RepositoryJob, bool, error) {
	var job model.RepositoryJob
	err := s.pool.QueryRow(ctx, `
		UPDATE candidate_repositories
		SET status = $1, updated_at = now()
		WHERE (candidate_id, idx) IN (
			SELECT candidate_id, idx
			FROM candidate_repositories
			WHERE status = $2 AND kind = $3 AND owner <> '' AND repo_name <> ''
			ORDER BY updated_at, candidate_id, idx
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING candidate_id, idx, url, owner, repo_name`,
		model.RepositoryAnalyzing, model.RepositoryPending, model.RepositoryRepo,
	).Scan(&job.CandidateID, &job.Index, &job.URL, &job.Owner, &job.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.RepositoryJob{}, false, nil
	}
	if err != nil {
		return model.RepositoryJob{}, false, fmt.Errorf("store: claim repository: %w", err)
	}
	return job, true, nil
}

// FinishRepositoryJob stores the background result and marks the candidate as
// connected once at least one repository has been read.
func (s *Store) FinishRepositoryJob(ctx context.Context, job model.RepositoryJob, status, summary, detail string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		UPDATE candidate_repositories
		SET status = $1, "context" = $2, detail = $3, updated_at = now()
		WHERE candidate_id = $4 AND idx = $5`,
		status, summary, detail, job.CandidateID, job.Index,
	); err != nil {
		return fmt.Errorf("store: finish repository: %w", err)
	}

	if status == model.RepositoryAnalyzed {
		if _, err := tx.Exec(ctx, `
			UPDATE candidates
			SET repo = CASE WHEN COALESCE(repo, '') = '' THEN $2 ELSE repo END,
				repo_state = 'connected',
				source = 'CV + repository'
			WHERE id = $1`, job.CandidateID, job.URL,
		); err != nil {
			return fmt.Errorf("store: finish repository candidate: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// ResetAnalyzingRepositories returns rows left mid-flight by a restart to pending.
func (s *Store) ResetAnalyzingRepositories(ctx context.Context) error {
	if _, err := s.pool.Exec(ctx, `
		UPDATE candidate_repositories
		SET status = $1, updated_at = now()
		WHERE status = $2`,
		model.RepositoryPending, model.RepositoryAnalyzing,
	); err != nil {
		return fmt.Errorf("store: reset repositories: %w", err)
	}
	return nil
}
