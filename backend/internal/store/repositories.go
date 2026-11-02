package store

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"codecv/backend/internal/model"
	"codecv/backend/internal/reposummary"

	"github.com/jackc/pgx/v5"
)

// CandidateRepositories lists every repository saved with the candidate.
func (s *Store) CandidateRepositories(ctx context.Context, candidateID string) ([]model.RepositoryRecord, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT idx, url, label, kind, status, "context", detail, source, owner, repo_name, updated_at,
		       COALESCE(tree::text, ''), COALESCE(details::text, ''), COALESCE(summary::text, ''),
		       findings_state, findings_detail
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
		var treeText, detailsText, summaryText string
		if err := rows.Scan(
			&repository.Index, &repository.URL, &repository.Label, &repository.Kind, &repository.Status,
			&repository.Context, &repository.Detail, &repository.Source,
			&repository.Owner, &repository.Name, &repository.UpdatedAt,
			&treeText, &detailsText, &summaryText,
			&repository.FindingsState, &repository.FindingsDetail,
		); err != nil {
			return nil, fmt.Errorf("store: candidate repositories scan: %w", err)
		}
		repository.HasTree = strings.TrimSpace(treeText) != ""
		if repository.HasTree {
			if err := json.Unmarshal([]byte(treeText), &repository.Tree); err != nil {
				repository.Tree = nil
				repository.HasTree = false
			}
		}
		if strings.TrimSpace(detailsText) != "" {
			var details model.RepoDetails
			if err := json.Unmarshal([]byte(detailsText), &details); err == nil {
				repository.Details = &details
			}
		}
		if strings.TrimSpace(summaryText) != "" {
			var summary model.RepoSummary
			if err := json.Unmarshal([]byte(summaryText), &summary); err == nil {
				repository.Summary = &summary
			}
		}
		// Hàng quét trước khi có cột summary vẫn được tổng hợp từ cây đã lưu.
		if repository.Summary == nil && repository.HasTree {
			repository.Summary = reposummary.Build(repository.Tree)
		}
		repositories = append(repositories, repository)
	}
	return repositories, rows.Err()
}

// PendingRepositoryJob claims the oldest repository that still needs work:
// a pending GitHub read, or an already-read repo whose final findings analysis
// is queued. One worker processes one row at a time; SKIP LOCKED keeps a second
// process from taking the same row.
func (s *Store) PendingRepositoryJob(ctx context.Context) (model.RepositoryJob, bool, error) {
	var job model.RepositoryJob
	var treeText, detailsText, summaryText string
	err := s.pool.QueryRow(ctx, `
		UPDATE candidate_repositories
		SET status = CASE WHEN status = $2 THEN $1 ELSE status END,
		    findings_state = CASE WHEN status = $2 THEN findings_state ELSE $3 END,
		    updated_at = now()
		WHERE (candidate_id, idx) IN (
			SELECT candidate_id, idx
			FROM candidate_repositories
			WHERE kind = $4 AND owner <> '' AND repo_name <> ''
			  AND (
			    status = $2
			    OR (status = $5 AND findings_state = $6 AND tree IS NOT NULL)
			  )
			ORDER BY updated_at, candidate_id, idx
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING candidate_id, idx, url, owner, repo_name, status,
		          COALESCE(tree::text, ''), COALESCE(details::text, ''), COALESCE(summary::text, '')`,
		model.RepositoryAnalyzing, model.RepositoryPending, model.RepositoryFindingsAnalyzing,
		model.RepositoryRepo, model.RepositoryAnalyzed, model.RepositoryFindingsPending,
	).Scan(&job.CandidateID, &job.Index, &job.URL, &job.Owner, &job.Name, &job.Status,
		&treeText, &detailsText, &summaryText)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.RepositoryJob{}, false, nil
	}
	if err != nil {
		return model.RepositoryJob{}, false, fmt.Errorf("store: claim repository: %w", err)
	}
	if strings.TrimSpace(treeText) != "" {
		_ = json.Unmarshal([]byte(treeText), &job.Tree)
	}
	if strings.TrimSpace(detailsText) != "" {
		var details model.RepoDetails
		if json.Unmarshal([]byte(detailsText), &details) == nil {
			job.Details = &details
		}
	}
	if strings.TrimSpace(summaryText) != "" {
		var summary model.RepoSummary
		if json.Unmarshal([]byte(summaryText), &summary) == nil {
			job.Summary = &summary
		}
	}
	return job, true, nil
}

// FinishRepositoryJob stores the background result and marks the candidate as
// connected once at least one repository has been read.
func (s *Store) FinishRepositoryJob(
	ctx context.Context,
	job model.RepositoryJob,
	status, contextText, detail string,
	tree []model.RepoTreeNode,
	details *model.RepoDetails,
	summary *model.RepoSummary,
) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var treeJSON, detailsJSON, summaryJSON any
	if len(tree) > 0 {
		if encoded, err := json.Marshal(tree); err == nil {
			treeJSON = string(encoded)
		}
	}
	if details != nil {
		if encoded, err := json.Marshal(details); err == nil {
			detailsJSON = string(encoded)
		}
	}
	if summary != nil {
		if encoded, err := json.Marshal(summary); err == nil {
			summaryJSON = string(encoded)
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE candidate_repositories
		SET status = $1, "context" = $2, detail = $3, updated_at = now(),
		    tree = COALESCE($6::jsonb, tree), details = COALESCE($7::jsonb, details),
		    summary = COALESCE($8::jsonb, summary),
		    findings_state = CASE WHEN $1 = $9 THEN findings_state ELSE '' END,
		    findings_detail = CASE WHEN $1 = $9 THEN findings_detail ELSE '' END
		WHERE candidate_id = $4 AND idx = $5`,
		status, contextText, detail, job.CandidateID, job.Index, treeJSON, detailsJSON, summaryJSON,
		model.RepositoryAnalyzed,
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
		// The fresh scan is the primary repository: queue its findings in the
		// same transaction so a crash before the worker starts cannot lose it.
		if _, err := tx.Exec(ctx, `
			UPDATE candidate_repositories cr
			SET findings_state = $1, updated_at = now()
			WHERE cr.candidate_id = $2 AND cr.idx = $3 AND cr.findings_state = ''
			  AND cr.url = (
				SELECT cr2.url
				FROM candidate_repositories cr2
				JOIN candidates c ON c.id = cr2.candidate_id
				WHERE cr2.candidate_id = $2 AND cr2.kind = $4 AND cr2.status = $5
				ORDER BY
					(cr2.url = COALESCE(c.repo, '') AND cr2.tree IS NOT NULL) DESC,
					(cr2.tree IS NOT NULL) DESC,
					(cr2.url = COALESCE(c.repo, '')) DESC,
					cr2.idx
				LIMIT 1
			)`,
			model.RepositoryFindingsPending, job.CandidateID, job.Index,
			model.RepositoryRepo, model.RepositoryAnalyzed,
		); err != nil {
			return fmt.Errorf("store: queue repository findings: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// BackfillRepositorySummaries derives summaries from trees already stored for
// scans that finished before summaries existed. It never calls GitHub.
func (s *Store) BackfillRepositorySummaries(ctx context.Context) (int, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT candidate_id, idx, tree::text
		FROM candidate_repositories
		WHERE summary IS NULL AND tree IS NOT NULL`)
	if err != nil {
		return 0, fmt.Errorf("store: repository summaries: %w", err)
	}
	type pending struct {
		candidateID string
		index       int
		tree        string
	}
	items := make([]pending, 0)
	for rows.Next() {
		var item pending
		if err := rows.Scan(&item.candidateID, &item.index, &item.tree); err != nil {
			rows.Close()
			return 0, fmt.Errorf("store: repository summaries scan: %w", err)
		}
		items = append(items, item)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return 0, fmt.Errorf("store: repository summaries scan: %w", err)
	}

	updated := 0
	for _, item := range items {
		var tree []model.RepoTreeNode
		if err := json.Unmarshal([]byte(item.tree), &tree); err != nil {
			continue
		}
		summary := reposummary.Build(tree)
		if summary == nil {
			continue
		}
		encoded, err := json.Marshal(summary)
		if err != nil {
			continue
		}
		if _, err := s.pool.Exec(ctx, `
			UPDATE candidate_repositories SET summary = $1::jsonb
			WHERE candidate_id = $2 AND idx = $3`, string(encoded), item.candidateID, item.index); err != nil {
			return updated, fmt.Errorf("store: backfill repository summary: %w", err)
		}
		updated++
	}
	return updated, nil
}

// RetryRepositories queues failed reads again, and re-reads analyzed rows that
// were stored before repository trees existed. An empty label retries all rows.
func (s *Store) RetryRepositories(ctx context.Context, candidateID, label string) (int, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE candidate_repositories
		SET status = $1, detail = 'Đang chờ phân tích ở luồng nền', updated_at = now()
		WHERE candidate_id = $2
		  AND kind = $3
		  AND owner <> '' AND repo_name <> ''
		  AND (status IN ($4, $5) OR (status = $6 AND tree IS NULL))
		  AND ($7 = '' OR label = $7)`,
		model.RepositoryPending, candidateID, model.RepositoryRepo,
		model.RepositoryUnavailable, model.RepositorySkipped, model.RepositoryAnalyzed, label,
	)
	if err != nil {
		return 0, fmt.Errorf("store: retry repositories: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

// RepositoryTarget resolves the analyzed repository whose tree the screen
// shows, then finds the blob SHA of one file inside it.
func (s *Store) RepositoryTarget(ctx context.Context, candidateID, filePath, repoRef string) (string, string, string, error) {
	repositories, err := s.CandidateRepositories(ctx, candidateID)
	if err != nil {
		return "", "", "", err
	}
	candidateRepo := ""
	err = s.pool.QueryRow(ctx, `SELECT COALESCE(repo, '') FROM candidates WHERE id = $1`, candidateID).
		Scan(&candidateRepo)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", ErrNotFound
	}
	if err != nil {
		return "", "", "", fmt.Errorf("store: repository target: %w", err)
	}

	primary := PickRepository(repositories, candidateRepo, repoRef)
	if primary == nil {
		return "", "", "", ErrNotFound
	}
	sha := findTreeFile(primary.Tree, filePath)
	if sha == "" {
		return "", "", "", ErrNotFound
	}
	return primary.Owner, primary.Name, sha, nil
}

// PickRepository resolves the repository the analysis view shows. A non-empty
// reference matches a saved URL or label; anything else falls back to the
// candidate's primary repository.
func PickRepository(repositories []model.RepositoryRecord, candidateRepo, ref string) *model.RepositoryRecord {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return PickPrimaryRepository(repositories, candidateRepo)
	}
	for index := range repositories {
		repository := &repositories[index]
		if repository.Kind != model.RepositoryRepo || repository.Status != model.RepositoryAnalyzed {
			continue
		}
		if strings.EqualFold(repository.URL, ref) || strings.EqualFold(repository.Label, ref) {
			return repository
		}
	}
	return PickPrimaryRepository(repositories, candidateRepo)
}

// PickPrimaryRepository chooses the repository shown in the analysis view:
// the analyzed one referenced by the candidate first, then the first analyzed row.
func PickPrimaryRepository(repositories []model.RepositoryRecord, candidateRepo string) *model.RepositoryRecord {
	var (
		matchWithTree *model.RepositoryRecord
		firstWithTree *model.RepositoryRecord
		matchPlain    *model.RepositoryRecord
		firstAnalyzed *model.RepositoryRecord
	)
	remember := func(target **model.RepositoryRecord, repository *model.RepositoryRecord) {
		if *target == nil {
			*target = repository
		}
	}
	for index := range repositories {
		repository := &repositories[index]
		if repository.Kind != model.RepositoryRepo || repository.Status != model.RepositoryAnalyzed {
			continue
		}
		if repository.URL == candidateRepo {
			if repository.HasTree {
				remember(&matchWithTree, repository)
			} else {
				remember(&matchPlain, repository)
			}
			continue
		}
		if repository.HasTree {
			remember(&firstWithTree, repository)
		} else {
			remember(&firstAnalyzed, repository)
		}
	}
	switch {
	case matchWithTree != nil:
		return matchWithTree
	case firstWithTree != nil:
		return firstWithTree
	case matchPlain != nil:
		return matchPlain
	default:
		return firstAnalyzed
	}
}

func findTreeFile(nodes []model.RepoTreeNode, path string) string {
	parts := strings.Split(path, "/")
	var walk func([]model.RepoTreeNode, int) string
	walk = func(level []model.RepoTreeNode, depth int) string {
		for _, node := range level {
			if node.Name != parts[depth] {
				continue
			}
			if depth == len(parts)-1 {
				if node.Type == "file" {
					return node.SHA
				}
				return ""
			}
			if node.Type == "folder" {
				return walk(node.Children, depth+1)
			}
			return ""
		}
		return ""
	}
	if path == "" {
		return ""
	}
	return walk(nodes, 0)
}

// ResetAnalyzingRepositories returns rows left mid-flight by a restart to
// pending: a half-read scan goes back to the GitHub queue, a half-run findings
// analysis goes back to the findings queue.
func (s *Store) ResetAnalyzingRepositories(ctx context.Context) error {
	if _, err := s.pool.Exec(ctx, `
		UPDATE candidate_repositories
		SET status = CASE WHEN status = $2 THEN $1 ELSE status END,
		    findings_state = CASE WHEN findings_state = $3 THEN $4 ELSE findings_state END,
		    updated_at = now()
		WHERE status = $2 OR findings_state = $3`,
		model.RepositoryPending, model.RepositoryAnalyzing,
		model.RepositoryFindingsAnalyzing, model.RepositoryFindingsPending,
	); err != nil {
		return fmt.Errorf("store: reset repositories: %w", err)
	}
	return nil
}

// PrimaryRepositoryURL resolves the repository the Repository screen shows by
// default, using the same precedence as PickPrimaryRepository.
func (s *Store) PrimaryRepositoryURL(ctx context.Context, candidateID string) (string, error) {
	var url string
	err := s.pool.QueryRow(ctx, `
		SELECT cr.url
		FROM candidate_repositories cr
		JOIN candidates c ON c.id = cr.candidate_id
		WHERE cr.candidate_id = $1 AND cr.kind = $2 AND cr.status = $3
		ORDER BY
			(cr.url = COALESCE(c.repo, '') AND cr.tree IS NOT NULL) DESC,
			(cr.tree IS NOT NULL) DESC,
			(cr.url = COALESCE(c.repo, '')) DESC,
			cr.idx
		LIMIT 1`,
		candidateID, model.RepositoryRepo, model.RepositoryAnalyzed,
	).Scan(&url)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("store: primary repository %s: %w", candidateID, err)
	}
	return url, nil
}

// QueueRepositoryFindings puts the selected repository back in the findings
// queue; pending and already-running rows are left untouched.
func (s *Store) QueueRepositoryFindings(ctx context.Context, candidateID, repoRef string) (string, bool, error) {
	repositories, err := s.CandidateRepositories(ctx, candidateID)
	if err != nil {
		return "", false, err
	}
	var candidateRepo string
	err = s.pool.QueryRow(ctx, `SELECT COALESCE(repo, '') FROM candidates WHERE id = $1`, candidateID).
		Scan(&candidateRepo)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, ErrNotFound
	}
	if err != nil {
		return "", false, fmt.Errorf("store: queue findings: %w", err)
	}
	selected := PickRepository(repositories, candidateRepo, repoRef)
	if selected == nil || !selected.HasTree {
		return "", false, ErrNotFound
	}
	tag, err := s.pool.Exec(ctx, `
		UPDATE candidate_repositories
		SET findings_state = $1, findings_detail = '', updated_at = now()
		WHERE candidate_id = $2 AND idx = $3
		  AND status = $4 AND tree IS NOT NULL
		  AND findings_state NOT IN ($1, $5)`,
		model.RepositoryFindingsPending, candidateID, selected.Index,
		model.RepositoryAnalyzed, model.RepositoryFindingsAnalyzing,
	)
	if err != nil {
		return "", false, fmt.Errorf("store: queue findings: %w", err)
	}
	return selected.URL, tag.RowsAffected() > 0, nil
}

// StartRepositoryFindings moves one repository into the analyzing state when
// it is still waiting; a finished or failed analysis is never overwritten.
func (s *Store) StartRepositoryFindings(ctx context.Context, candidateID string, index int) (bool, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE candidate_repositories
		SET findings_state = $1, findings_detail = '', updated_at = now()
		WHERE candidate_id = $2 AND idx = $3 AND findings_state IN ('', $4)`,
		model.RepositoryFindingsAnalyzing, candidateID, index, model.RepositoryFindingsPending,
	)
	if err != nil {
		return false, fmt.Errorf("store: start repository findings: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

// SetRepositoryFindingsState records where the final AI findings analysis of
// one repository stands.
func (s *Store) SetRepositoryFindingsState(ctx context.Context, candidateID string, index int, state, detail string) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE candidate_repositories
		SET findings_state = $1, findings_detail = $2, updated_at = now()
		WHERE candidate_id = $3 AND idx = $4`,
		state, detail, candidateID, index,
	)
	if err != nil {
		return fmt.Errorf("store: repository findings state: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SaveRepositoryFindings replaces every finding of one repository. IDs carry a
// short hash of the repository URL so two repositories can share the table.
func (s *Store) SaveRepositoryFindings(ctx context.Context, candidateID, repoURL string, findings []model.Finding) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`DELETE FROM findings WHERE candidate_id = $1 AND repo_url = $2`,
		candidateID, repoURL,
	); err != nil {
		return fmt.Errorf("store: clear repository findings: %w", err)
	}
	prefix := "rf-" + repositoryFindingPrefix(repoURL) + "-"
	for position, finding := range findings {
		if _, err := tx.Exec(ctx, `
			INSERT INTO findings (
				candidate_id, id, severity, title, module, file, line, state,
				rationale, verification, code, hit_line, repo_url
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
			candidateID, fmt.Sprintf("%s%02d", prefix, position+1),
			finding.Severity, finding.Title, finding.Module, finding.File, finding.Line,
			finding.State, finding.Rationale, finding.Verification, finding.Code, finding.HitLine,
			repoURL,
		); err != nil {
			return fmt.Errorf("store: save repository finding: %w", err)
		}
	}
	return tx.Commit(ctx)
}

func repositoryFindingPrefix(repoURL string) string {
	sum := sha1.Sum([]byte(strings.ToLower(strings.TrimSpace(repoURL))))
	return hex.EncodeToString(sum[:4])
}
