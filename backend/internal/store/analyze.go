package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"codecv/backend/internal/model"
)

// SaveAnalysisInput carries the result of an analyze-cv request so it can be
// written into the candidates table.
type SaveAnalysisInput struct {
	OwnerID  string // account that ran the analysis; empty keeps the profile admin-only
	Position string // position title shown on the card
	Level    string
	Model    string
	FileName string // original CV file name shown in the analysis queue
	CVKey    string // object key of the stored original CV; empty when storage is off
	Analysis model.Analysis
}

// SaveAnalysis inserts a candidate (with criteria and questions) produced by
// the CV analysis pipeline and returns the generated candidate id.
func (s *Store) SaveAnalysis(ctx context.Context, in SaveAnalysisInput) (string, error) {
	id := slugify(in.Analysis.Candidate.Name)
	now := time.Now()
	updated := now.Format("02/01 · 15:04")
	updatedAt := now.Format("02/01/2006 · 15:04")

	candidate := model.CandidateRecord{
		ID:         id,
		Name:       in.Analysis.Candidate.Name,
		Initials:   initials(in.Analysis.Candidate.Name),
		Hue:        hueOf(in.Analysis.Candidate.Name),
		Role:       in.Analysis.Candidate.CurrentTitle,
		Position:   in.Position,
		Level:      in.Level,
		Status:     "review",
		Updated:    updated,
		UpdatedAt:  updatedAt,
		Email:      in.Analysis.Candidate.Email,
		Phone:      in.Analysis.Candidate.Phone,
		Location:   in.Analysis.Candidate.Location,
		Years:      in.Analysis.Candidate.YearsExperience,
		CreatedAt:  updatedAt,
		Source:     "CV",
		Reviewer:   "",
		Summary:    in.Analysis.Summary,
		Strengths:  in.Analysis.Strengths,
		Verify:     in.Analysis.Gaps,
		Notes:      "",
		StageIndex: 5,
	}

	repos := in.Analysis.Repositories
	for _, repo := range repos {
		if repo.Kind == model.RepositoryRepo {
			if repo.Status == model.RepositoryAnalyzed {
				candidate.Repo = repo.URL
				candidate.RepoState = "connected"
				candidate.Source = "CV + repository"
			} else if candidate.RepoState == "" {
				candidate.RepoState = "failed"
			}
		}
	}
	if candidate.RepoState == "" {
		candidate.RepoState = "none"
	}

	criteria := make([]model.Criterion, 0, len(in.Analysis.Criteria))
	for i, evaluation := range in.Analysis.Criteria {
		sources := []string{}
		if strings.TrimSpace(evaluation.Quote) != "" {
			sources = append(sources, evaluation.Quote)
		}
		evidence := 0
		if evaluation.Status == model.EvidenceVerified {
			evidence = 1
		}
		criteria = append(criteria, model.Criterion{
			ID:       fmt.Sprintf("c%d", i+1),
			Label:    evaluation.Label,
			Kind:     evaluation.Kind,
			State:    evaluation.Status,
			Evidence: evidence,
			Note:     evaluation.Note,
			Sources:  sources,
		})
	}

	questions := make([]model.Question, 0, len(in.Analysis.Questions))
	for i, q := range in.Analysis.Questions {
		difficulty := "Middle"
		if in.Level == "Senior" {
			difficulty = "Senior"
		}
		questions = append(questions, model.Question{
			ID:         fmt.Sprintf("q%d", i+1),
			Category:   q.Topic,
			Difficulty: difficulty,
			Text:       q.Question,
			Answer:     q.Rationale,
			FollowUps:  []string{},
		})
	}

	if err := s.insertAnalysisCandidate(ctx, in.OwnerID, candidate, criteria, questions, in.FileName, in.CVKey, now); err != nil {
		return "", err
	}
	return id, nil
}

func (s *Store) insertAnalysisCandidate(ctx context.Context, ownerID string, candidate model.CandidateRecord, criteria []model.Criterion, questions []model.Question, fileName, cvKey string, analyzedAt time.Time) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	strengths, _ := json.Marshal(nonNil(candidate.Strengths))
	verify, _ := json.Marshal(nonNil(candidate.Verify))

	var owner any
	if strings.TrimSpace(ownerID) != "" {
		owner = ownerID
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO candidates (
			id, name, initials, hue, role, position, level, status, updated, updated_at,
			email, phone, location, years, created_at, source, reviewer, summary,
			strengths, verify, repo, repo_branch, commit, repo_state, notes, stage_index,
			cv_file, cv_key, analyzed_at, owner_id
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16, $17, $18,
			$19, $20, $21, $22, $23, $24, $25, $26,
			$27, $28, $29, $30
		)`,
		candidate.ID, candidate.Name, candidate.Initials, candidate.Hue,
		candidate.Role, candidate.Position, candidate.Level, candidate.Status,
		candidate.Updated, candidate.UpdatedAt, candidate.Email, candidate.Phone,
		candidate.Location, candidate.Years, candidate.CreatedAt, candidate.Source,
		candidate.Reviewer, candidate.Summary, strengths, verify, candidate.Repo,
		candidate.RepoBranch, candidate.Commit, candidate.RepoState, candidate.Notes,
		candidate.StageIndex, fileName, cvKey, analyzedAt, owner,
	); err != nil {
		return fmt.Errorf("store: save candidate: %w", err)
	}

	for idx, crit := range criteria {
		sources, _ := json.Marshal(nonNil(crit.Sources))
		if _, err := tx.Exec(ctx, `
			INSERT INTO criteria (candidate_id, idx, id, label, kind, state, evidence, note, sources)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			candidate.ID, idx, crit.ID, crit.Label, crit.Kind, crit.State,
			crit.Evidence, crit.Note, sources,
		); err != nil {
			return fmt.Errorf("store: save criteria: %w", err)
		}
	}

	for _, question := range questions {
		followUps, _ := json.Marshal(nonNil(question.FollowUps))
		if _, err := tx.Exec(ctx, `
			INSERT INTO questions (candidate_id, id, category, difficulty, text, answer, follow_ups)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			candidate.ID, question.ID, question.Category, question.Difficulty,
			question.Text, question.Answer, followUps,
		); err != nil {
			return fmt.Errorf("store: save questions: %w", err)
		}
	}

	if _, err := tx.Exec(ctx, `UPDATE positions SET candidates = candidates + 1 WHERE title = $1`, candidate.Position); err != nil {
		return fmt.Errorf("store: bump position counter: %w", err)
	}

	return tx.Commit(ctx)
}

// AnalysisQueue lists completed CV analyses, newest first, with their criteria count.
func (s *Store) AnalysisQueue(ctx context.Context, ownerID string, limit int) ([]model.AnalysisQueueItem, error) {
	where := `WHERE c.analyzed_at IS NOT NULL`
	args := []any{}
	argn := 1
	if ownerID != "" {
		where += fmt.Sprintf(` AND c.owner_id = $%d`, argn)
		args = append(args, ownerID)
		argn++
	}

	rows, err := s.pool.Query(ctx, `
		SELECT c.id, c.cv_file, c.name, c.position, c.level, c.status, c.analyzed_at,
		       count(cr.id)
		FROM candidates c
		LEFT JOIN criteria cr ON cr.candidate_id = c.id
		`+where+`
		GROUP BY c.id
		ORDER BY c.analyzed_at DESC
		LIMIT $`+strconv.Itoa(argn), append(args, limit)...)
	if err != nil {
		return nil, fmt.Errorf("store: analysis queue: %w", err)
	}
	defer rows.Close()

	items := make([]model.AnalysisQueueItem, 0, limit)
	for rows.Next() {
		var item model.AnalysisQueueItem
		if err := rows.Scan(
			&item.ID, &item.File, &item.Candidate, &item.Position, &item.Level,
			&item.Status, &item.AnalyzedAt, &item.Criteria,
		); err != nil {
			return nil, fmt.Errorf("store: analysis queue scan: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func nonNil[T any](slice []T) []T {
	if slice == nil {
		return []T{}
	}
	return slice
}

func slugify(name string) string {
	name = vietnamese.Replace(strings.ToLower(name))
	var b strings.Builder
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else {
			b.WriteRune('-')
		}
	}
	slug := strings.Join(strings.FieldsFunc(b.String(), func(r rune) bool { return r == '-' }), "-")
	if slug == "" {
		slug = "candidate"
	}
	return slug + "-" + time.Now().Format("20060102-150405")
}

var vietnamese = strings.NewReplacer(
	"đ", "d",
	"á", "a", "à", "a", "ả", "a", "ã", "a", "ạ", "a",
	"ă", "a", "ắ", "a", "ằ", "a", "ẳ", "a", "ẵ", "a", "ặ", "a",
	"â", "a", "ấ", "a", "ầ", "a", "ẩ", "a", "ẫ", "a", "ậ", "a",
	"é", "e", "è", "e", "ẻ", "e", "ẽ", "e", "ẹ", "e",
	"ê", "e", "ế", "e", "ề", "e", "ể", "e", "ễ", "e", "ệ", "e",
	"í", "i", "ì", "i", "ỉ", "i", "ĩ", "i", "ị", "i",
	"ó", "o", "ò", "o", "ỏ", "o", "õ", "o", "ọ", "o",
	"ô", "o", "ố", "o", "ồ", "o", "ổ", "o", "ỗ", "o", "ộ", "o",
	"ơ", "o", "ớ", "o", "ờ", "o", "ở", "o", "ỡ", "o", "ợ", "o",
	"ú", "u", "ù", "u", "ủ", "u", "ũ", "u", "ụ", "u",
	"ư", "u", "ứ", "u", "ừ", "u", "ử", "u", "ữ", "u", "ự", "u",
	"ý", "y", "ỳ", "y", "ỷ", "y", "ỹ", "y", "ỵ", "y",
)

func initials(name string) string {
	words := strings.Fields(name)
	if len(words) == 0 {
		return "?"
	}
	first := firstRune(words[0])
	last := firstRune(words[len(words)-1])
	if len(words) == 1 {
		last = first
	}
	return strings.ToUpper(string(first)) + strings.ToUpper(string(last))
}

func firstRune(s string) rune {
	for _, r := range s {
		return r
	}
	return '?'
}

func hueOf(name string) int {
	hash := 0
	for _, r := range strings.ToLower(name) {
		hash = (hash*31 + int(r)) % 360
	}
	return hash
}
