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

// MarketViewer identifies who is browsing so private CVs and saved flags stay
// per-account while admins can still audit the whole pool.
type MarketViewer struct {
	UserID string
	Admin  bool
}

type SaveMarketCVInput struct {
	OwnerID    string
	FileName   string
	CVKey      string
	Model      string
	Visibility string
	Profile    model.MarketProfile
}

const marketCVSelect = `
	SELECT m.id, m.name, m.title, m.email, m.phone, m.location, m.years,
	       m.category, m.level, m.summary, m.skills, m.highlights, m.file_name,
	       m.cv_key, m.model, COALESCE(u.display_name, ''), m.created_at,
	       COALESCE(m.owner_id, ''), m.visibility,
	       EXISTS (
	           SELECT 1 FROM market_cv_saves s
	           WHERE s.cv_id = m.id AND s.user_id = $1
	       )
	FROM market_cvs m
	LEFT JOIN users u ON u.id = m.owner_id`

func (s *Store) SaveMarketCV(ctx context.Context, in SaveMarketCVInput) (model.MarketCV, error) {
	id := marketCVId(in.Profile.Name)
	skills, _ := json.Marshal(nonNil(in.Profile.Skills))
	highlights, _ := json.Marshal(nonNil(in.Profile.Highlights))

	var owner any
	if strings.TrimSpace(in.OwnerID) != "" {
		owner = in.OwnerID
	}

	visibility := "public"
	if strings.EqualFold(strings.TrimSpace(in.Visibility), "private") {
		visibility = "private"
	}

	if _, err := s.pool.Exec(ctx, `
		INSERT INTO market_cvs (
			id, owner_id, file_name, cv_key, name, title, email, phone, location,
			years, category, level, summary, skills, highlights, model, visibility
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
		id, owner, in.FileName, in.CVKey, in.Profile.Name, in.Profile.Title,
		in.Profile.Email, in.Profile.Phone, in.Profile.Location, in.Profile.Years,
		in.Profile.Category, in.Profile.Level, in.Profile.Summary, skills, highlights,
		in.Model, visibility,
	); err != nil {
		return model.MarketCV{}, fmt.Errorf("store: save market cv: %w", err)
	}

	return s.marketCV(ctx, id, MarketViewer{UserID: in.OwnerID})
}

// marketCVId keeps the readable name slug but adds random bytes so two CVs of
// the same candidate uploaded together never collide on the primary key.
func marketCVId(name string) string {
	var suffix [4]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		return "m-" + slugify(name) + "-" + time.Now().Format("150405.000000")
	}
	return "m-" + slugify(name) + "-" + hex.EncodeToString(suffix[:])
}

func (s *Store) marketCV(ctx context.Context, id string, viewer MarketViewer) (model.MarketCV, error) {
	row := s.pool.QueryRow(ctx, marketCVSelect+`
		WHERE m.id = $2 AND (m.visibility = 'public' OR m.owner_id = $1 OR $3)`,
		viewer.UserID, id, viewer.Admin)
	cv, err := scanMarketCV(row, viewer)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.MarketCV{}, ErrNotFound
	}
	if err != nil {
		return model.MarketCV{}, fmt.Errorf("store: market cv %s: %w", id, err)
	}
	return cv, nil
}

// MarketCV returns one CV when the viewer may see it: public, their own, or admin.
func (s *Store) MarketCV(ctx context.Context, id string, viewer MarketViewer) (model.MarketCV, error) {
	return s.marketCV(ctx, id, viewer)
}

// MarketCVs lists the shared CV pool, newest first, hiding other people's private CVs.
func (s *Store) MarketCVs(ctx context.Context, viewer MarketViewer, limit int) ([]model.MarketCV, error) {
	if limit <= 0 {
		limit = 200
	}
	rows, err := s.pool.Query(ctx, marketCVSelect+`
		WHERE m.visibility = 'public' OR m.owner_id = $1 OR $2
		ORDER BY m.created_at DESC
		LIMIT $3`, viewer.UserID, viewer.Admin, limit)
	if err != nil {
		return nil, fmt.Errorf("store: market cvs: %w", err)
	}
	defer rows.Close()

	cvs := make([]model.MarketCV, 0, limit)
	for rows.Next() {
		cv, err := scanMarketCV(rows, viewer)
		if err != nil {
			return nil, err
		}
		cvs = append(cvs, cv)
	}
	return cvs, rows.Err()
}

// MarketCVFile returns the stored object key and the original file name after
// checking the viewer may see the CV.
func (s *Store) MarketCVFile(ctx context.Context, id string, viewer MarketViewer) (key, fileName string, err error) {
	var ownerID, visibility string
	err = s.pool.QueryRow(ctx, `
		SELECT cv_key, file_name, COALESCE(owner_id, ''), visibility
		FROM market_cvs WHERE id = $1`, id).Scan(&key, &fileName, &ownerID, &visibility)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrNotFound
	}
	if err != nil {
		return "", "", fmt.Errorf("store: market cv file %s: %w", id, err)
	}
	if visibility != "public" && !viewer.Admin && ownerID != viewer.UserID {
		return "", "", ErrNotFound
	}
	return key, fileName, nil
}

func (s *Store) SetMarketCVSaved(ctx context.Context, id, userID string, saved bool) error {
	if saved {
		if _, err := s.pool.Exec(ctx, `
			INSERT INTO market_cv_saves (cv_id, user_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING`, id, userID); err != nil {
			return fmt.Errorf("store: save market cv: %w", err)
		}
		return nil
	}
	if _, err := s.pool.Exec(ctx, `
		DELETE FROM market_cv_saves WHERE cv_id = $1 AND user_id = $2`, id, userID); err != nil {
		return fmt.Errorf("store: unsave market cv: %w", err)
	}
	return nil
}

func (s *Store) SetMarketCVVisibility(ctx context.Context, id, userID string, admin bool, visibility string) (model.MarketCV, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE market_cvs SET visibility = $3
		WHERE id = $1 AND ($4 OR owner_id = $2)`, id, userID, visibility, admin)
	if err != nil {
		return model.MarketCV{}, fmt.Errorf("store: set market cv visibility: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.MarketCV{}, ErrNotFound
	}
	return s.marketCV(ctx, id, MarketViewer{UserID: userID, Admin: admin})
}

// DeleteMarketCV removes a CV owned by the viewer (admins may remove any) and
// returns the stored object key so the handler can clean up the bucket.
func (s *Store) DeleteMarketCV(ctx context.Context, id, userID string, admin bool) (string, error) {
	var cvKey string
	err := s.pool.QueryRow(ctx, `
		DELETE FROM market_cvs
		WHERE id = $1 AND ($3 OR owner_id = $2)
		RETURNING cv_key`, id, userID, admin).Scan(&cvKey)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("store: delete market cv: %w", err)
	}
	return cvKey, nil
}

func scanMarketCV(row pgx.Row, viewer MarketViewer) (model.MarketCV, error) {
	var cv model.MarketCV
	var skillsRaw, highlightsRaw []byte
	var cvKey string
	var createdAt time.Time
	var ownerID, visibility string
	var saved bool

	if err := row.Scan(
		&cv.ID, &cv.Name, &cv.Title, &cv.Email, &cv.Phone, &cv.Location, &cv.Years,
		&cv.Category, &cv.Level, &cv.Summary, &skillsRaw, &highlightsRaw,
		&cv.FileName, &cvKey, &cv.Model, &cv.UploadedBy, &createdAt,
		&ownerID, &visibility, &saved,
	); err != nil {
		return model.MarketCV{}, err
	}

	cv.Initials = initials(cv.Name)
	cv.Hue = hueOf(cv.Name)
	cv.HasCV = cvKey != ""
	cv.Skills = scanStringSlice(skillsRaw)
	cv.Highlights = scanStringSlice(highlightsRaw)
	cv.CreatedAt = createdAt.Format("02/01/2006 · 15:04")
	cv.OwnerID = ownerID
	cv.Visibility = visibility
	if cv.Visibility == "" {
		cv.Visibility = "public"
	}
	cv.Saved = saved
	cv.CanEdit = viewer.Admin || (ownerID != "" && ownerID == viewer.UserID)
	return cv, nil
}
