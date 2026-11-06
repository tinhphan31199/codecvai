package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"codecv/backend/internal/model"

	"github.com/jackc/pgx/v5"
)

type CreateGeneratedCVInput struct {
	OwnerID        string
	Name           string
	TargetPosition string
	Level          string
	Language       string
	Template       string
	Accent         string
	Content        model.GeneratedCVContent
	Input          model.BuilderInput
	ModelID        string
	Provider       string
}

type UpdateGeneratedCVInput struct {
	OwnerID        string
	ID             string
	Name           string
	TargetPosition string
	Level          string
	Language       string
	Template       string
	Accent         string
	Content        model.GeneratedCVContent
	Input          model.BuilderInput
	ModelID        string
	Provider       string
}

type SaveBuilderDraftInput struct {
	OwnerID  string
	Input    model.BuilderInput
	Language string
	Template string
	Accent   string
}

const generatedCVSelect = `
	SELECT id, name, target_position, level, language, template, accent,
	       content, input, model_id, provider, created_at, updated_at
	FROM generated_cvs`

// CreateGeneratedCV stores one private CV for the owner and returns the saved row.
func (s *Store) CreateGeneratedCV(ctx context.Context, in CreateGeneratedCVInput) (model.GeneratedCV, error) {
	content, err := json.Marshal(in.Content)
	if err != nil {
		return model.GeneratedCV{}, fmt.Errorf("store: encode generated cv content: %w", err)
	}
	input, err := json.Marshal(in.Input)
	if err != nil {
		return model.GeneratedCV{}, fmt.Errorf("store: encode generated cv input: %w", err)
	}

	language, template, accent := generatedCVDefaults(in.Language, in.Template, in.Accent)
	id := generatedCVId(in.Name, in.Input.FullName)
	if _, err := s.pool.Exec(ctx, `
		INSERT INTO generated_cvs (
			id, owner_id, name, target_position, level, language, template, accent,
			content, input, model_id, provider
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		id, in.OwnerID, generatedCVName(in.Name, in.Input.FullName), in.TargetPosition,
		in.Level, language, template, accent, content, input, in.ModelID, in.Provider,
	); err != nil {
		return model.GeneratedCV{}, fmt.Errorf("store: create generated cv: %w", err)
	}
	return s.GeneratedCV(ctx, in.OwnerID, id)
}

// GeneratedCVs lists the account's saved CVs, newest edit first.
func (s *Store) GeneratedCVs(ctx context.Context, ownerID string) ([]model.GeneratedCVSummary, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, target_position, level, language, template, accent,
		       created_at, updated_at
		FROM generated_cvs
		WHERE owner_id = $1
		ORDER BY updated_at DESC, created_at DESC`, ownerID)
	if err != nil {
		return nil, fmt.Errorf("store: list generated cvs: %w", err)
	}
	defer rows.Close()

	cvs := make([]model.GeneratedCVSummary, 0, 8)
	for rows.Next() {
		var (
			cv        model.GeneratedCVSummary
			createdAt time.Time
			updatedAt time.Time
		)
		if err := rows.Scan(&cv.ID, &cv.Name, &cv.TargetPosition, &cv.Level,
			&cv.Language, &cv.Template, &cv.Accent, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("store: scan generated cv: %w", err)
		}
		cv.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		cv.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		cvs = append(cvs, cv)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("store: list generated cvs: %w", err)
	}
	return cvs, nil
}

// GeneratedCV returns one saved CV only when the caller owns it.
func (s *Store) GeneratedCV(ctx context.Context, ownerID, id string) (model.GeneratedCV, error) {
	var (
		cv                   model.GeneratedCV
		contentRaw           []byte
		inputRaw             []byte
		createdAt, updatedAt time.Time
	)
	err := s.pool.QueryRow(ctx, generatedCVSelect+`
		WHERE id = $1 AND owner_id = $2`, id, ownerID).Scan(
		&cv.ID, &cv.Name, &cv.TargetPosition, &cv.Level, &cv.Language,
		&cv.Template, &cv.Accent, &contentRaw, &inputRaw, &cv.ModelID, &cv.Provider,
		&createdAt, &updatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.GeneratedCV{}, ErrNotFound
	}
	if err != nil {
		return model.GeneratedCV{}, fmt.Errorf("store: generated cv %s: %w", id, err)
	}
	if err := json.Unmarshal(contentRaw, &cv.Content); err != nil {
		return model.GeneratedCV{}, fmt.Errorf("store: decode generated cv content %s: %w", id, err)
	}
	if err := json.Unmarshal(inputRaw, &cv.Input); err != nil {
		return model.GeneratedCV{}, fmt.Errorf("store: decode generated cv input %s: %w", id, err)
	}
	normalizeGeneratedCV(&cv)
	cv.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	cv.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return cv, nil
}

// UpdateGeneratedCV replaces the editable fields after an edit or regeneration.
func (s *Store) UpdateGeneratedCV(ctx context.Context, in UpdateGeneratedCVInput) (model.GeneratedCV, error) {
	content, err := json.Marshal(in.Content)
	if err != nil {
		return model.GeneratedCV{}, fmt.Errorf("store: encode generated cv content: %w", err)
	}
	input, err := json.Marshal(in.Input)
	if err != nil {
		return model.GeneratedCV{}, fmt.Errorf("store: encode generated cv input: %w", err)
	}

	language, template, accent := generatedCVDefaults(in.Language, in.Template, in.Accent)
	tag, err := s.pool.Exec(ctx, `
		UPDATE generated_cvs SET
			name = $3, target_position = $4, level = $5, language = $6,
			template = $7, accent = $8, content = $9, input = $10,
			model_id = $11, provider = $12, updated_at = now()
		WHERE id = $1 AND owner_id = $2`,
		in.ID, in.OwnerID, generatedCVName(in.Name, in.Input.FullName), in.TargetPosition,
		in.Level, language, template, accent, content, input, in.ModelID, in.Provider,
	)
	if err != nil {
		return model.GeneratedCV{}, fmt.Errorf("store: update generated cv: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.GeneratedCV{}, ErrNotFound
	}
	return s.GeneratedCV(ctx, in.OwnerID, in.ID)
}

// DeleteGeneratedCV removes one CV only when the caller owns it.
func (s *Store) DeleteGeneratedCV(ctx context.Context, ownerID, id string) error {
	tag, err := s.pool.Exec(ctx, `
		DELETE FROM generated_cvs WHERE id = $1 AND owner_id = $2`, id, ownerID)
	if err != nil {
		return fmt.Errorf("store: delete generated cv: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// BuilderDraft returns the account's single saved builder draft.
func (s *Store) BuilderDraft(ctx context.Context, ownerID string) (model.BuilderDraft, error) {
	var (
		draft     model.BuilderDraft
		inputRaw  []byte
		updatedAt time.Time
	)
	err := s.pool.QueryRow(ctx, `
		SELECT input, language, template, accent, updated_at
		FROM builder_drafts
		WHERE owner_id = $1`, ownerID).Scan(
		&inputRaw, &draft.Language, &draft.Template, &draft.Accent, &updatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.BuilderDraft{}, ErrNotFound
	}
	if err != nil {
		return model.BuilderDraft{}, fmt.Errorf("store: builder draft: %w", err)
	}
	if err := json.Unmarshal(inputRaw, &draft.Input); err != nil {
		return model.BuilderDraft{}, fmt.Errorf("store: decode builder draft: %w", err)
	}
	normalizeBuilderInputLists(&draft.Input)
	draft.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return draft, nil
}

// SaveBuilderDraft upserts the account's single draft row. Empty template and
// accent are kept as-is because they mean "let AI choose".
func (s *Store) SaveBuilderDraft(ctx context.Context, in SaveBuilderDraftInput) (model.BuilderDraft, error) {
	input, err := json.Marshal(in.Input)
	if err != nil {
		return model.BuilderDraft{}, fmt.Errorf("store: encode builder draft: %w", err)
	}
	language := strings.TrimSpace(in.Language)
	if language == "" {
		language = "vi"
	}
	if _, err := s.pool.Exec(ctx, `
		INSERT INTO builder_drafts (owner_id, input, language, template, accent, updated_at)
		VALUES ($1, $2, $3, $4, $5, now())
		ON CONFLICT (owner_id) DO UPDATE SET
			input = EXCLUDED.input, language = EXCLUDED.language,
			template = EXCLUDED.template, accent = EXCLUDED.accent,
			updated_at = now()`,
		in.OwnerID, input, language, strings.TrimSpace(in.Template), strings.TrimSpace(in.Accent),
	); err != nil {
		return model.BuilderDraft{}, fmt.Errorf("store: save builder draft: %w", err)
	}
	return s.BuilderDraft(ctx, in.OwnerID)
}

func generatedCVId(name, fallback string) string {
	var suffix [4]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		return "gcv-" + slugify(generatedCVName(name, fallback)) + "-" + time.Now().Format("150405.000000")
	}
	return "gcv-" + slugify(generatedCVName(name, fallback)) + "-" + hex.EncodeToString(suffix[:])
}

func generatedCVName(name, fallback string) string {
	if trimmed := strings.TrimSpace(name); trimmed != "" {
		return trimmed
	}
	if trimmed := strings.TrimSpace(fallback); trimmed != "" {
		return trimmed
	}
	return "CV"
}

func generatedCVDefaults(language, template, accent string) (string, string, string) {
	if strings.TrimSpace(language) == "" {
		language = "vi"
	}
	if strings.TrimSpace(template) == "" {
		template = "classic"
	}
	if strings.TrimSpace(accent) == "" {
		accent = "sky"
	}
	return language, template, accent
}

func normalizeGeneratedCV(cv *model.GeneratedCV) {
	cv.Content.Experience = nonNil(cv.Content.Experience)
	for i := range cv.Content.Experience {
		cv.Content.Experience[i].Bullets = nonNil(cv.Content.Experience[i].Bullets)
	}
	cv.Content.Education = nonNil(cv.Content.Education)
	cv.Content.Projects = nonNil(cv.Content.Projects)
	for i := range cv.Content.Projects {
		cv.Content.Projects[i].Bullets = nonNil(cv.Content.Projects[i].Bullets)
	}
	cv.Content.Skills = nonNil(cv.Content.Skills)
	for i := range cv.Content.Skills {
		cv.Content.Skills[i].Items = nonNil(cv.Content.Skills[i].Items)
	}
	cv.Content.Certifications = nonNil(cv.Content.Certifications)
	cv.Content.Languages = nonNil(cv.Content.Languages)
	normalizeBuilderInputLists(&cv.Input)
}

func normalizeBuilderInputLists(input *model.BuilderInput) {
	input.Skills = nonNil(input.Skills)
	input.Experiences = nonNil(input.Experiences)
	input.Education = nonNil(input.Education)
	input.Projects = nonNil(input.Projects)
	input.Certifications = nonNil(input.Certifications)
	input.Languages = nonNil(input.Languages)
}
