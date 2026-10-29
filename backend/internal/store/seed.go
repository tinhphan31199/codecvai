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

type seedData struct {
	Positions    []model.Position    `json:"positions"`
	Team         []model.TeamMember  `json:"team"`
	Models       []model.AIModel     `json:"models"`
	UploadStages []model.UploadStage `json:"uploadStages"`
}

// Seed nạp dữ liệu tham chiếu còn thiếu. An toàn khi chạy lại: dữ liệu tham chiếu
// chỉ được thêm nếu chưa có, không ghi đè chỉnh sửa của người dùng. Ứng viên và
// báo cáo mẫu không còn được nạp — dữ liệu đó chỉ đến từ phân tích CV thật.
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
