package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"codecv/backend/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type CandidateFilter struct {
	Query    string
	Status   string
	Position string
	Sort     string
	Limit    int
	Offset   int
}

const candidateCols = `
	id, name, initials, hue, role, position, level, status, updated, updated_at,
	email, phone, location, years, created_at, source, reviewer, summary,
	strengths, verify, repo, repo_branch, commit, repo_state, notes, stage_index`

func (s *Store) Workspace(ctx context.Context) (model.Workspace, error) {
	rows, err := s.pool.Query(ctx, `SELECT key, value FROM workspace_settings`)
	if err != nil {
		return model.Workspace{}, fmt.Errorf("store: workspace: %w", err)
	}
	defer rows.Close()

	values := map[string]string{}
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return model.Workspace{}, err
		}
		values[key] = value
	}
	if err := rows.Err(); err != nil {
		return model.Workspace{}, err
	}

	return model.Workspace{
		TwoFactor:    boolValue(values["twoFactor"]),
		SessionHours: intValue(values["sessionHours"]),
		NotifyReview: boolValue(values["notifyReview"]),
		NotifyDone:   boolValue(values["notifyDone"]),
		NotifyDigest: boolValue(values["notifyDigest"]),
	}, nil
}

func (s *Store) Stats(ctx context.Context) (model.Stats, error) {
	var stats model.Stats
	if err := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'completed'),
			COUNT(*) FILTER (WHERE status = 'review'),
			COUNT(*) FILTER (WHERE status = 'processing'),
			COUNT(*) FILTER (WHERE status = 'failed'),
			COUNT(*) FILTER (WHERE status = 'archived'),
			(SELECT COUNT(*) FROM positions)
		FROM candidates`).Scan(
		&stats.Total, &stats.Completed, &stats.Review, &stats.Processing,
		&stats.Failed, &stats.Archived, &stats.Positions,
	); err != nil {
		return model.Stats{}, fmt.Errorf("store: stats counts: %w", err)
	}

	if err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(to_char(MAX(ts), 'DD/MM · HH24:MI'), ''),
			COALESCE(to_char(MAX(ts), 'DD/MM/YYYY · HH24:MI'), '')
		FROM (
			SELECT to_timestamp(updated_at, 'DD/MM/YYYY · HH24:MI') AS ts
			FROM candidates
			WHERE updated_at ~ '^\d{2}/\d{2}/\d{4} · \d{2}:\d{2}$'
		) t`).Scan(&stats.Updated, &stats.UpdatedAt); err != nil {
		return model.Stats{}, fmt.Errorf("store: stats updated: %w", err)
	}

	return stats, nil
}

func (s *Store) UpdateWorkspaceSettings(ctx context.Context, values map[string]string) error {
	allowed := map[string]bool{
		"twoFactor": true, "sessionHours": true, "notifyReview": true,
		"notifyDone": true, "notifyDigest": true,
	}
	for key, value := range values {
		if !allowed[key] {
			continue
		}
		if _, err := s.pool.Exec(ctx, `
			INSERT INTO workspace_settings (key, value) VALUES ($1, $2)
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, key, value); err != nil {
			return fmt.Errorf("store: update settings: %w", err)
		}
	}
	return nil
}

func (s *Store) Positions(ctx context.Context) ([]model.Position, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT p.id, p.title, p.team, p.level, p.open, p.candidates, p.updated,
			p.owner, p.location, p.description,
			(SELECT COUNT(*) FROM candidates c WHERE c.position = p.title) AS candidate_count
		FROM positions p ORDER BY p.candidates DESC, p.id ASC`)
	if err != nil {
		return nil, fmt.Errorf("store: positions: %w", err)
	}
	defer rows.Close()

	positions := make([]model.Position, 0)
	for rows.Next() {
		var pos model.Position
		if err := rows.Scan(&pos.ID, &pos.Title, &pos.Team, &pos.Level, &pos.Open,
			&pos.Candidates, &pos.Updated, &pos.Owner, &pos.Location, &pos.Description,
			&pos.CandidateCount); err != nil {
			return nil, err
		}
		positions = append(positions, pos)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range positions {
		criteria, err := s.positionCriteria(ctx, positions[i].ID)
		if err != nil {
			return nil, err
		}
		positions[i].Criteria = criteria
	}
	return positions, nil
}

func (s *Store) positionCriteria(ctx context.Context, positionID string) ([]model.PositionCriterion, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT label, kind, weight, verify FROM position_criteria
		WHERE position_id = $1 ORDER BY idx`, positionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	criteria := make([]model.PositionCriterion, 0)
	for rows.Next() {
		var crit model.PositionCriterion
		if err := rows.Scan(&crit.Label, &crit.Kind, &crit.Weight, &crit.Verify); err != nil {
			return nil, err
		}
		criteria = append(criteria, crit)
	}
	return criteria, rows.Err()
}

func (s *Store) Position(ctx context.Context, id string) (model.Position, error) {
	var pos model.Position
	err := s.pool.QueryRow(ctx, `
		SELECT id, title, team, level, open, candidates, updated, owner, location, description
		FROM positions WHERE id = $1`, id).
		Scan(&pos.ID, &pos.Title, &pos.Team, &pos.Level, &pos.Open, &pos.Candidates,
			&pos.Updated, &pos.Owner, &pos.Location, &pos.Description)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.Position{}, ErrNotFound
		}
		return model.Position{}, fmt.Errorf("store: position: %w", err)
	}
	pos.Criteria, err = s.positionCriteria(ctx, id)
	return pos, err
}

func (s *Store) CreatePosition(ctx context.Context, pos model.Position) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := insertPosition(ctx, tx, pos); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) UpdatePosition(ctx context.Context, pos model.Position) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		UPDATE positions SET title=$1, team=$2, level=$3, open=$4, candidates=$5,
			updated=$6, owner=$7, location=$8, description=$9 WHERE id=$10`,
		pos.Title, pos.Team, pos.Level, pos.Open, pos.Candidates, pos.Updated,
		pos.Owner, pos.Location, pos.Description, pos.ID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM position_criteria WHERE position_id = $1`, pos.ID); err != nil {
		return err
	}
	for idx, crit := range pos.Criteria {
		if _, err := tx.Exec(ctx, `
			INSERT INTO position_criteria (position_id, idx, label, kind, weight, verify)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			pos.ID, idx, crit.Label, crit.Kind, crit.Weight, crit.Verify); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) DeletePosition(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM positions WHERE id = $1`, id)
	return err
}

func (s *Store) ListCandidates(ctx context.Context, filter CandidateFilter) ([]model.CandidateRecord, error) {
	where := []string{}
	args := []any{}
	argn := 1

	if strings.TrimSpace(filter.Query) != "" {
		where = append(where, fmt.Sprintf(`(name ILIKE '%%' || $%d || '%%' OR email ILIKE '%%' || $%d || '%%' OR position ILIKE '%%' || $%d || '%%')`, argn, argn, argn))
		args = append(args, strings.TrimSpace(filter.Query))
		argn++
	}
	if filter.Status != "" {
		where = append(where, fmt.Sprintf(`status = $%d`, argn))
		args = append(args, filter.Status)
		argn++
	}
	if filter.Position != "" {
		where = append(where, fmt.Sprintf(`position = $%d`, argn))
		args = append(args, filter.Position)
		argn++
	}

	orderBy := "updated_at DESC"
	switch filter.Sort {
	case "name":
		orderBy = "name ASC"
	case "position":
		orderBy = "position ASC, name ASC"
	case "evidence":
		orderBy = "(SELECT COALESCE(SUM(evidence), 0) FROM criteria WHERE candidate_id = candidates.id) DESC"
	case "created":
		orderBy = "created_at DESC"
	}

	limit, offset := filter.Limit, filter.Offset
	if limit <= 0 {
		limit = 100
	}

	query := `SELECT ` + candidateCols + ` FROM candidates`
	if len(where) > 0 {
		query += " WHERE " + strings.Join(where, " AND ")
	}
	query += " ORDER BY " + orderBy + fmt.Sprintf(" LIMIT $%d OFFSET $%d", argn, argn+1)
	args = append(args, limit, offset)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("store: list candidates: %w", err)
	}
	defer rows.Close()

	candidates := make([]model.CandidateRecord, 0, limit)
	for rows.Next() {
		candidate, err := scanCandidate(rows)
		if err != nil {
			return nil, err
		}
		candidates = append(candidates, candidate)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range candidates {
		if err := s.attachCriteriaSkills(ctx, &candidates[i]); err != nil {
			return nil, err
		}
	}
	return candidates, nil
}

func (s *Store) RecentCandidates(ctx context.Context, limit int) ([]model.CandidateRecord, error) {
	if limit <= 0 {
		limit = 5
	}
	rows, err := s.pool.Query(ctx, `
		SELECT `+candidateCols+` FROM candidates
		WHERE status IN ('completed', 'review') ORDER BY updated_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("store: recent candidates: %w", err)
	}
	defer rows.Close()

	candidates := make([]model.CandidateRecord, 0, limit)
	for rows.Next() {
		candidate, err := scanCandidate(rows)
		if err != nil {
			return nil, err
		}
		candidates = append(candidates, candidate)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range candidates {
		if err := s.attachCriteriaSkills(ctx, &candidates[i]); err != nil {
			return nil, err
		}
	}
	return candidates, nil
}

func (s *Store) Candidate(ctx context.Context, id string) (model.CandidateRecord, error) {
	row := s.pool.QueryRow(ctx, `SELECT `+candidateCols+` FROM candidates WHERE id = $1`, id)
	candidate, err := scanCandidate(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.CandidateRecord{}, ErrNotFound
		}
		return model.CandidateRecord{}, fmt.Errorf("store: candidate %s: %w", id, err)
	}
	if err := s.attachCriteriaSkills(ctx, &candidate); err != nil {
		return model.CandidateRecord{}, err
	}
	candidate.Findings, err = s.findings(ctx, id)
	if err != nil {
		return model.CandidateRecord{}, err
	}
	candidate.Questions, err = s.Questions(ctx, id)
	if err != nil {
		return model.CandidateRecord{}, err
	}
	return candidate, nil
}

func (s *Store) Repository(ctx context.Context, id string) (model.RepoAnalysis, error) {
	var repo model.RepoAnalysis
	var treeText, layersText string
	err := s.pool.QueryRow(ctx, `
		SELECT id, repo, repo_branch, commit, repo_state,
		       COALESCE(repo_tree::text, ''), COALESCE(architecture_layers::text, '')
		FROM candidates WHERE id = $1`, id).
		Scan(&repo.CandidateID, &repo.Repo, &repo.RepoBranch, &repo.Commit, &repo.RepoState,
			&treeText, &layersText)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.RepoAnalysis{}, ErrNotFound
		}
		return model.RepoAnalysis{}, fmt.Errorf("store: repository: %w", err)
	}
	if treeText != "" {
		repo.Tree = json.RawMessage(treeText)
	} else {
		repo.Tree = json.RawMessage("[]")
	}
	if layersText != "" {
		repo.Layers = json.RawMessage(layersText)
	} else {
		repo.Layers = json.RawMessage("[]")
	}
	repo.Findings, err = s.findings(ctx, id)
	if err != nil {
		return model.RepoAnalysis{}, err
	}
	return repo, nil
}

func (s *Store) findings(ctx context.Context, id string) ([]model.Finding, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, severity, title, module, file, line, state, rationale, verification, code, hit_line
		FROM findings WHERE candidate_id = $1 ORDER BY id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	findings := make([]model.Finding, 0)
	for rows.Next() {
		var finding model.Finding
		if err := rows.Scan(&finding.ID, &finding.Severity, &finding.Title, &finding.Module,
			&finding.File, &finding.Line, &finding.State, &finding.Rationale,
			&finding.Verification, &finding.Code, &finding.HitLine); err != nil {
			return nil, err
		}
		findings = append(findings, finding)
	}
	return findings, rows.Err()
}

func (s *Store) UpdateFindingState(ctx context.Context, candidateID, findingID, state string) error {
	result, err := s.pool.Exec(ctx, `
		UPDATE findings SET state = $1 WHERE candidate_id = $2 AND id = $3`,
		state, candidateID, findingID)
	if err != nil {
		return fmt.Errorf("store: update finding: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) Questions(ctx context.Context, id string) ([]model.Question, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, category, difficulty, text, answer, follow_ups
		FROM questions WHERE candidate_id = $1 ORDER BY id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	questions := make([]model.Question, 0)
	for rows.Next() {
		var question model.Question
		var followUps []byte
		if err := rows.Scan(&question.ID, &question.Category, &question.Difficulty,
			&question.Text, &question.Answer, &followUps); err != nil {
			return nil, err
		}
		question.FollowUps = scanStringSlice(followUps)
		questions = append(questions, question)
	}
	return questions, rows.Err()
}

func (s *Store) Reports(ctx context.Context) ([]model.Report, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, candidate_id, candidate, position, version, status, reviewer, created
		FROM reports ORDER BY created DESC`)
	if err != nil {
		return nil, fmt.Errorf("store: reports: %w", err)
	}
	defer rows.Close()

	reports := make([]model.Report, 0)
	for rows.Next() {
		var report model.Report
		if err := rows.Scan(&report.ID, &report.CandidateID, &report.Candidate,
			&report.Position, &report.Version, &report.Status, &report.Reviewer,
			&report.Created); err != nil {
			return nil, err
		}
		reports = append(reports, report)
	}
	return reports, rows.Err()
}

func (s *Store) Report(ctx context.Context, id string) (model.Report, error) {
	var report model.Report
	err := s.pool.QueryRow(ctx, `
		SELECT id, candidate_id, candidate, position, version, status, reviewer, created
		FROM reports WHERE id = $1`, id).
		Scan(&report.ID, &report.CandidateID, &report.Candidate, &report.Position,
			&report.Version, &report.Status, &report.Reviewer, &report.Created)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.Report{}, ErrNotFound
		}
		return model.Report{}, err
	}
	return report, nil
}

func (s *Store) UpdateReportStatus(ctx context.Context, id, status string) error {
	_, err := s.pool.Exec(ctx, `UPDATE reports SET status = $1 WHERE id = $2`, status, id)
	return err
}

func (s *Store) UpdateCandidateStatus(ctx context.Context, id, status string) error {
	_, err := s.pool.Exec(ctx, `UPDATE candidates SET status = $1 WHERE id = $2`, status, id)
	return err
}

func (s *Store) UpdateCandidateFields(ctx context.Context, id, notes, reviewer, repo string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE candidates SET notes = $1, reviewer = $2, repo = $3 WHERE id = $4`,
		notes, reviewer, repo, id)
	return err
}

func (s *Store) Team(ctx context.Context) ([]model.TeamMember, error) {
	rows, err := s.pool.Query(ctx, `SELECT name, initials, role, email, hue FROM team_members ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := make([]model.TeamMember, 0)
	for rows.Next() {
		var member model.TeamMember
		if err := rows.Scan(&member.Name, &member.Initials, &member.Role, &member.Email, &member.Hue); err != nil {
			return nil, err
		}
		members = append(members, member)
	}
	return members, rows.Err()
}

func (s *Store) CreateTeamMember(ctx context.Context, member model.TeamMember) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO team_members (name, initials, role, email, hue)
		VALUES ($1, $2, $3, $4, $5)`,
		member.Name, member.Initials, member.Role, member.Email, member.Hue)
	return wrapConfigError("store: create team member", err)
}

func (s *Store) UpdateTeamMember(ctx context.Context, original string, member model.TeamMember) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE team_members
		SET name = $1, initials = $2, role = $3, email = $4, hue = $5
		WHERE name = $6`,
		member.Name, member.Initials, member.Role, member.Email, member.Hue, original)
	if err != nil {
		return wrapConfigError("store: update team member", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) DeleteTeamMember(ctx context.Context, name string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM team_members WHERE name = $1`, name)
	if err != nil {
		return fmt.Errorf("store: delete team member: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) Models(ctx context.Context) ([]model.AIModel, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, name, provider, note, active, api_key FROM ai_models ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	models := make([]model.AIModel, 0)
	for rows.Next() {
		var m model.AIModel
		if err := rows.Scan(&m.ID, &m.Name, &m.Provider, &m.Note, &m.Active, &m.APIKey); err != nil {
			return nil, err
		}
		HideModelKey(&m)
		models = append(models, m)
	}
	return models, rows.Err()
}

func (s *Store) ModelAPIKey(ctx context.Context, id string) (string, error) {
	var key string
	err := s.pool.QueryRow(ctx, `SELECT api_key FROM ai_models WHERE id = $1`, id).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("store: model api key: %w", err)
	}
	return key, nil
}

func (s *Store) CreateModel(ctx context.Context, m model.AIModel) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO ai_models (id, name, provider, note, active, api_key)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		m.ID, m.Name, m.Provider, m.Note, m.Active, strings.TrimSpace(m.APIKey))
	return wrapConfigError("store: create model", err)
}

func (s *Store) UpdateModel(ctx context.Context, originalID string, m model.AIModel) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE ai_models SET id = $1, name = $2, provider = $3, note = $4, active = $5,
			api_key = CASE WHEN $6 = '' THEN api_key ELSE $6 END
		WHERE id = $7`,
		m.ID, m.Name, m.Provider, m.Note, m.Active, strings.TrimSpace(m.APIKey), originalID)
	if err != nil {
		return wrapConfigError("store: update model", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// HideModelKey keeps the raw key out of API responses, exposing only a masked hint.
func HideModelKey(m *model.AIModel) {
	key := strings.TrimSpace(m.APIKey)
	m.APIKey = ""
	if key == "" {
		return
	}
	hint := "••••"
	if len(key) > 4 {
		hint += key[len(key)-4:]
	}
	m.APIKeySet = true
	m.APIKeyHint = hint
}

func (s *Store) DeleteModel(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM ai_models WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("store: delete model: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ModelByID trả về nguyên hàng, kể cả api_key, để gateway gọi thẳng provider.
func (s *Store) ModelByID(ctx context.Context, id string) (model.AIModel, error) {
	var m model.AIModel
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, provider, note, active, api_key FROM ai_models WHERE id = $1`, id).
		Scan(&m.ID, &m.Name, &m.Provider, &m.Note, &m.Active, &m.APIKey)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.AIModel{}, ErrNotFound
		}
		return model.AIModel{}, fmt.Errorf("store: model %s: %w", id, err)
	}
	return m, nil
}

func (s *Store) ServiceConfigs(ctx context.Context) ([]model.ServiceConfig, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, kind, name, base_url, api_key, sort FROM service_configs ORDER BY sort, id`)
	if err != nil {
		return nil, fmt.Errorf("store: service configs: %w", err)
	}
	defer rows.Close()

	configs := make([]model.ServiceConfig, 0)
	for rows.Next() {
		var cfg model.ServiceConfig
		if err := rows.Scan(&cfg.ID, &cfg.Kind, &cfg.Name, &cfg.BaseURL, &cfg.APIKey, &cfg.Sort); err != nil {
			return nil, err
		}
		HideServiceKey(&cfg)
		configs = append(configs, cfg)
	}
	return configs, rows.Err()
}

// ServiceConfig trả về nguyên hàng, kể cả api_key, để gateway dựng client.
func (s *Store) ServiceConfig(ctx context.Context, id string) (model.ServiceConfig, error) {
	var cfg model.ServiceConfig
	err := s.pool.QueryRow(ctx, `
		SELECT id, kind, name, base_url, api_key, sort FROM service_configs WHERE id = $1`, id).
		Scan(&cfg.ID, &cfg.Kind, &cfg.Name, &cfg.BaseURL, &cfg.APIKey, &cfg.Sort)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ServiceConfig{}, ErrNotFound
		}
		return model.ServiceConfig{}, fmt.Errorf("store: service config %s: %w", id, err)
	}
	return cfg, nil
}

func (s *Store) UpdateServiceConfig(ctx context.Context, id string, cfg model.ServiceConfig) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE service_configs SET base_url = $1,
			api_key = CASE WHEN $2 = '' THEN api_key ELSE $2 END
		WHERE id = $3`,
		strings.TrimSpace(cfg.BaseURL), strings.TrimSpace(cfg.APIKey), id)
	if err != nil {
		return fmt.Errorf("store: update service config: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// HideServiceKey keeps the raw key out of API responses, exposing only a masked hint.
func HideServiceKey(cfg *model.ServiceConfig) {
	key := strings.TrimSpace(cfg.APIKey)
	cfg.APIKey = ""
	if key == "" {
		return
	}
	hint := "••••"
	if len(key) > 4 {
		hint += key[len(key)-4:]
	}
	cfg.APIKeySet = true
	cfg.APIKeyHint = hint
}

func (s *Store) UploadStages(ctx context.Context) ([]model.UploadStage, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, label, detail FROM upload_stages ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stages := make([]model.UploadStage, 0)
	for rows.Next() {
		var stage model.UploadStage
		if err := rows.Scan(&stage.ID, &stage.Label, &stage.Detail); err != nil {
			return nil, err
		}
		stages = append(stages, stage)
	}
	return stages, rows.Err()
}

func (s *Store) CreateUploadStage(ctx context.Context, stage model.UploadStage) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO upload_stages (id, label, detail) VALUES ($1, $2, $3)`,
		stage.ID, stage.Label, stage.Detail)
	return wrapConfigError("store: create upload stage", err)
}

func (s *Store) UpdateUploadStage(ctx context.Context, originalID int, stage model.UploadStage) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE upload_stages SET id = $1, label = $2, detail = $3 WHERE id = $4`,
		stage.ID, stage.Label, stage.Detail, originalID)
	if err != nil {
		return wrapConfigError("store: update upload stage", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) DeleteUploadStage(ctx context.Context, id int) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM upload_stages WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("store: delete upload stage: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) Levels(ctx context.Context) ([]model.Level, error) {
	rows, err := s.pool.Query(ctx, `SELECT name, rank FROM levels ORDER BY rank, name`)
	if err != nil {
		return nil, fmt.Errorf("store: levels: %w", err)
	}
	defer rows.Close()

	levels := make([]model.Level, 0)
	for rows.Next() {
		var level model.Level
		if err := rows.Scan(&level.Name, &level.Rank); err != nil {
			return nil, err
		}
		levels = append(levels, level)
	}
	return levels, rows.Err()
}

func (s *Store) CreateLevel(ctx context.Context, level model.Level) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO levels (name, rank) VALUES ($1, $2)`, level.Name, level.Rank)
	return wrapConfigError("store: create level", err)
}

// Đổi tên cấp bậc lan sang vị trí và hồ sơ đang mang tên cũ.
func (s *Store) UpdateLevel(ctx context.Context, original string, level model.Level) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: update level: %w", err)
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `UPDATE levels SET name = $1, rank = $2 WHERE name = $3`, level.Name, level.Rank, original)
	if err != nil {
		return wrapConfigError("store: update level", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	if level.Name != original {
		if _, err := tx.Exec(ctx, `UPDATE positions SET level = $1 WHERE level = $2`, level.Name, original); err != nil {
			return fmt.Errorf("store: rename level in positions: %w", err)
		}
		if _, err := tx.Exec(ctx, `UPDATE candidates SET level = $1 WHERE level = $2`, level.Name, original); err != nil {
			return fmt.Errorf("store: rename level in candidates: %w", err)
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteLevel(ctx context.Context, name string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM levels WHERE name = $1`, name)
	if err != nil {
		return fmt.Errorf("store: delete level: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) Teams(ctx context.Context) ([]model.Team, error) {
	rows, err := s.pool.Query(ctx, `SELECT name, rank FROM teams ORDER BY rank, name`)
	if err != nil {
		return nil, fmt.Errorf("store: teams: %w", err)
	}
	defer rows.Close()

	teams := make([]model.Team, 0)
	for rows.Next() {
		var team model.Team
		if err := rows.Scan(&team.Name, &team.Rank); err != nil {
			return nil, err
		}
		teams = append(teams, team)
	}
	return teams, rows.Err()
}

func (s *Store) CreateTeam(ctx context.Context, team model.Team) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO teams (name, rank) VALUES ($1, $2)`, team.Name, team.Rank)
	return wrapConfigError("store: create team", err)
}

// Đổi tên chuyên môn lan sang các vị trí đang mang tên cũ.
func (s *Store) UpdateTeam(ctx context.Context, original string, team model.Team) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: update team: %w", err)
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `UPDATE teams SET name = $1, rank = $2 WHERE name = $3`, team.Name, team.Rank, original)
	if err != nil {
		return wrapConfigError("store: update team", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	if team.Name != original {
		if _, err := tx.Exec(ctx, `UPDATE positions SET team = $1 WHERE team = $2`, team.Name, original); err != nil {
			return fmt.Errorf("store: rename team in positions: %w", err)
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteTeam(ctx context.Context, name string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM teams WHERE name = $1`, name)
	if err != nil {
		return fmt.Errorf("store: delete team: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func wrapConfigError(op string, err error) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return fmt.Errorf("%s: %w", op, ErrConflict)
	}
	return fmt.Errorf("%s: %w", op, err)
}

func (s *Store) Dashboard(ctx context.Context) (model.Dashboard, error) {
	review, err := s.ListCandidates(ctx, CandidateFilter{Status: "review", Sort: "updated", Limit: 50})
	if err != nil {
		return model.Dashboard{}, err
	}
	processing, err := s.ListCandidates(ctx, CandidateFilter{Status: "processing", Sort: "updated", Limit: 50})
	if err != nil {
		return model.Dashboard{}, err
	}
	recent, err := s.RecentCandidates(ctx, 5)
	if err != nil {
		return model.Dashboard{}, err
	}
	positions, err := s.Positions(ctx)
	if err != nil {
		return model.Dashboard{}, err
	}
	return model.Dashboard{
		Review:     review,
		Processing: processing,
		Recent:     recent,
		Positions:  positions,
	}, nil
}

func scanCandidate(row pgx.Row) (model.CandidateRecord, error) {
	var candidate model.CandidateRecord
	var strengthsRaw, verifyRaw []byte
	if err := row.Scan(&candidate.ID, &candidate.Name, &candidate.Initials, &candidate.Hue,
		&candidate.Role, &candidate.Position, &candidate.Level, &candidate.Status,
		&candidate.Updated, &candidate.UpdatedAt, &candidate.Email, &candidate.Phone,
		&candidate.Location, &candidate.Years, &candidate.CreatedAt, &candidate.Source,
		&candidate.Reviewer, &candidate.Summary, &strengthsRaw, &verifyRaw,
		&candidate.Repo, &candidate.RepoBranch, &candidate.Commit, &candidate.RepoState,
		&candidate.Notes, &candidate.StageIndex); err != nil {
		return model.CandidateRecord{}, err
	}
	candidate.Strengths = scanStringSlice(strengthsRaw)
	candidate.Verify = scanStringSlice(verifyRaw)
	return candidate, nil
}

func (s *Store) attachCriteriaSkills(ctx context.Context, candidate *model.CandidateRecord) error {
	criteria, err := s.criteria(ctx, candidate.ID)
	if err != nil {
		return err
	}
	skills, err := s.skills(ctx, candidate.ID)
	if err != nil {
		return err
	}
	candidate.Criteria = criteria
	candidate.Skills = skills
	return nil
}

func (s *Store) criteria(ctx context.Context, id string) ([]model.Criterion, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, label, kind, state, evidence, note, sources
		FROM criteria WHERE candidate_id = $1 ORDER BY idx`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	criteria := make([]model.Criterion, 0)
	for rows.Next() {
		var crit model.Criterion
		var sourcesRaw []byte
		if err := rows.Scan(&crit.ID, &crit.Label, &crit.Kind, &crit.State,
			&crit.Evidence, &crit.Note, &sourcesRaw); err != nil {
			return nil, err
		}
		crit.Sources = scanStringSlice(sourcesRaw)
		criteria = append(criteria, crit)
	}
	return criteria, rows.Err()
}

func (s *Store) skills(ctx context.Context, id string) ([]model.Skill, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT name, level, confidence, state, source, evidence
		FROM skills WHERE candidate_id = $1 ORDER BY idx`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	skills := make([]model.Skill, 0)
	for rows.Next() {
		var skill model.Skill
		if err := rows.Scan(&skill.Name, &skill.Level, &skill.Confidence,
			&skill.State, &skill.Source, &skill.Evidence); err != nil {
			return nil, err
		}
		skills = append(skills, skill)
	}
	return skills, rows.Err()
}

func scanStringSlice(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}
	var out []string
	if err := json.Unmarshal(raw, &out); err != nil {
		return []string{}
	}
	if out == nil {
		return []string{}
	}
	return out
}

func atoi(value string) int {
	n := 0
	for _, c := range value {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + int(c-'0')
	}
	return n
}

func boolValue(value string) bool {
	return value == "1" || value == "true"
}

func intValue(value string) int {
	if n := atoi(value); n > 0 {
		return n
	}
	return 0
}
