package store

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"

	"codecv/backend/internal/model"

	"github.com/jackc/pgx/v5/pgconn"
)

//go:embed seeddata/seed.json
var seedRaw []byte

type seedCandidate struct {
	model.CandidateRecord
	RepoTree           json.RawMessage `json:"repoTree"`
	ArchitectureLayers json.RawMessage `json:"architectureLayers"`
}

type seedData struct {
	Positions    []model.Position    `json:"positions"`
	Candidates   []seedCandidate     `json:"candidates"`
	Reports      []model.Report      `json:"reports"`
	Team         []model.TeamMember  `json:"team"`
	Models       []model.AIModel     `json:"models"`
	UploadStages []model.UploadStage `json:"uploadStages"`
}

// Seed nạp dữ liệu mẫu còn thiếu. An toàn khi chạy lại: dữ liệu tham chiếu
// chỉ được thêm nếu chưa có, không ghi đè chỉnh sửa của người dùng.
func (s *Store) Seed(ctx context.Context) error {
	var data seedData
	if err := json.Unmarshal(seedRaw, &data); err != nil {
		return fmt.Errorf("store: decode seed: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, pos := range data.Positions {
		if err := insertPosition(ctx, tx, pos); err != nil {
			return err
		}
	}

	var candidates int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM candidates`).Scan(&candidates); err != nil {
		return fmt.Errorf("store: seed candidate check: %w", err)
	}
	if candidates == 0 {
		for _, candidate := range data.Candidates {
			if err := insertCandidate(ctx, tx, candidate); err != nil {
				return err
			}
		}

		for _, report := range data.Reports {
			if _, err := tx.Exec(ctx, `
				INSERT INTO reports (id, candidate_id, candidate, position, version, status, reviewer, created)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
				report.ID, report.CandidateID, report.Candidate, report.Position,
				report.Version, report.Status, report.Reviewer, report.Created,
			); err != nil {
				return fmt.Errorf("store: seed reports: %w", err)
			}
		}
	}

	for _, member := range data.Team {
		if _, err := tx.Exec(ctx, `
			INSERT INTO team_members (name, initials, role, email, hue) VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (name) DO NOTHING`,
			member.Name, member.Initials, member.Role, member.Email, member.Hue,
		); err != nil {
			return fmt.Errorf("store: seed team: %w", err)
		}
	}

	for _, m := range data.Models {
		if _, err := tx.Exec(ctx, `
			INSERT INTO ai_models (id, name, provider, note, active) VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO NOTHING`,
			m.ID, m.Name, m.Provider, m.Note, m.Active,
		); err != nil {
			return fmt.Errorf("store: seed models: %w", err)
		}
	}

	for _, stage := range data.UploadStages {
		if _, err := tx.Exec(ctx, `
			INSERT INTO upload_stages (id, label, detail) VALUES ($1, $2, $3)
			ON CONFLICT (id) DO NOTHING`,
			stage.ID, stage.Label, stage.Detail,
		); err != nil {
			return fmt.Errorf("store: seed stages: %w", err)
		}
	}

	var levelCount int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM levels`).Scan(&levelCount); err != nil {
		return fmt.Errorf("store: seed level check: %w", err)
	}
	if levelCount == 0 {
		for i, name := range []string{
			"Intern", "Fresher", "Junior", "Middle", "Senior",
			"Lead", "Principal", "Manager", "Director",
		} {
			if _, err := tx.Exec(ctx, `INSERT INTO levels (name, rank) VALUES ($1, $2)`, name, i+1); err != nil {
				return fmt.Errorf("store: seed levels: %w", err)
			}
		}
	}

	var teamCount int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM teams`).Scan(&teamCount); err != nil {
		return fmt.Errorf("store: seed team check: %w", err)
	}
	if teamCount == 0 {
		for i, name := range defaultTeams {
			if _, err := tx.Exec(ctx, `INSERT INTO teams (name, rank) VALUES ($1, $2)`, name, i+1); err != nil {
				return fmt.Errorf("store: seed teams: %w", err)
			}
		}
	}

	return tx.Commit(ctx)
}

// Danh mục chuyên môn CNTT mặc định, chỉ nạp khi bảng teams còn rỗng.
var defaultTeams = []string{
	"Frontend",
	"Backend",
	"Fullstack",
	"Mobile",
	"DevOps",
	"Cloud",
	"Site Reliability (SRE)",
	"Platform Engineering",
	"Data Engineering",
	"Data Science",
	"AI / Machine Learning",
	"Computer Vision",
	"NLP",
	"QA/QC",
	"Security",
	"Solution Architecture",
	"Embedded",
	"IoT",
	"Game Development",
	"Database Administration",
	"Network Engineering",
	"System Administration",
	"IT Support",
	"UI/UX Design",
	"Business Analysis",
}

type execer interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

func insertPosition(ctx context.Context, tx execer, pos model.Position) error {
	if _, err := tx.Exec(ctx, `
		INSERT INTO positions (id, title, team, level, open, candidates, updated, owner, location, description)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (id) DO NOTHING`,
		pos.ID, pos.Title, pos.Team, pos.Level, pos.Open, pos.Candidates,
		pos.Updated, pos.Owner, pos.Location, pos.Description,
	); err != nil {
		return fmt.Errorf("store: seed positions: %w", err)
	}
	for idx, crit := range pos.Criteria {
		if _, err := tx.Exec(ctx, `
			INSERT INTO position_criteria (position_id, idx, label, kind, weight, verify)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (position_id, idx) DO NOTHING`,
			pos.ID, idx, crit.Label, crit.Kind, crit.Weight, crit.Verify,
		); err != nil {
			return fmt.Errorf("store: seed position criteria: %w", err)
		}
	}
	return nil
}

func insertCandidate(ctx context.Context, tx execer, candidate seedCandidate) error {
	strengths, _ := json.Marshal(nonNil(candidate.Strengths))
	verify, _ := json.Marshal(nonNil(candidate.Verify))
	var tree any = nil
	var layers any = nil
	if len(candidate.RepoTree) > 0 {
		tree = candidate.RepoTree
	}
	if len(candidate.ArchitectureLayers) > 0 {
		layers = candidate.ArchitectureLayers
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO candidates (
			id, name, initials, hue, role, position, level, status, updated, updated_at,
			email, phone, location, years, created_at, source, reviewer, summary,
			strengths, verify, repo, repo_branch, commit, repo_state, notes, stage_index,
			repo_tree, architecture_layers
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16, $17, $18,
			$19, $20, $21, $22, $23, $24, $25, $26,
			$27, $28
		)`,
		candidate.ID, candidate.Name, candidate.Initials, candidate.Hue,
		candidate.Role, candidate.Position, candidate.Level, candidate.Status,
		candidate.Updated, candidate.UpdatedAt, candidate.Email, candidate.Phone,
		candidate.Location, candidate.Years, candidate.CreatedAt, candidate.Source,
		candidate.Reviewer, candidate.Summary, strengths, verify, candidate.Repo,
		candidate.RepoBranch, candidate.Commit, candidate.RepoState, candidate.Notes,
		candidate.StageIndex, tree, layers,
	); err != nil {
		return fmt.Errorf("store: seed candidates: %w", err)
	}

	for idx, crit := range candidate.Criteria {
		sources, _ := json.Marshal(nonNil(crit.Sources))
		if _, err := tx.Exec(ctx, `
			INSERT INTO criteria (candidate_id, idx, id, label, kind, state, evidence, note, sources)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			candidate.ID, idx, crit.ID, crit.Label, crit.Kind, crit.State,
			crit.Evidence, crit.Note, sources,
		); err != nil {
			return fmt.Errorf("store: seed criteria: %w", err)
		}
	}

	for idx, skill := range candidate.Skills {
		if _, err := tx.Exec(ctx, `
			INSERT INTO skills (candidate_id, idx, name, level, confidence, state, source, evidence)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			candidate.ID, idx, skill.Name, skill.Level, skill.Confidence,
			skill.State, skill.Source, skill.Evidence,
		); err != nil {
			return fmt.Errorf("store: seed skills: %w", err)
		}
	}

	for _, finding := range candidate.Findings {
		if _, err := tx.Exec(ctx, `
			INSERT INTO findings (candidate_id, id, severity, title, module, file, line, state, rationale, verification, code, hit_line)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			candidate.ID, finding.ID, finding.Severity, finding.Title, finding.Module,
			finding.File, finding.Line, finding.State, finding.Rationale,
			finding.Verification, finding.Code, finding.HitLine,
		); err != nil {
			return fmt.Errorf("store: seed findings: %w", err)
		}
	}

	for _, question := range candidate.Questions {
		followUps, _ := json.Marshal(nonNil(question.FollowUps))
		if _, err := tx.Exec(ctx, `
			INSERT INTO questions (candidate_id, id, category, difficulty, text, answer, follow_ups)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			candidate.ID, question.ID, question.Category, question.Difficulty,
			question.Text, question.Answer, followUps,
		); err != nil {
			return fmt.Errorf("store: seed questions: %w", err)
		}
	}

	return nil
}

func nonNil[T any](slice []T) []T {
	if slice == nil {
		return []T{}
	}
	return slice
}
