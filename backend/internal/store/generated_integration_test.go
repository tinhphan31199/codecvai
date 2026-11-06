package store

import (
	"context"
	"errors"
	"os"
	"testing"

	"codecv/backend/internal/model"
)

func TestGeneratedCVCRUDScopesByOwner(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	s, err := Open(ctx, dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer s.Close()
	if err := s.Migrate(ctx); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	const ownerID = "gcv-test-owner"
	const otherID = "gcv-test-other"
	cleanup := func() {
		if _, err := s.pool.Exec(ctx, `DELETE FROM users WHERE id = ANY($1)`,
			[]string{ownerID, otherID}); err != nil {
			t.Fatalf("cleanup users: %v", err)
		}
	}
	cleanup()
	defer cleanup()

	if _, err := s.pool.Exec(ctx, `
		INSERT INTO users (id, username, display_name, password_hash, role)
		VALUES ($1, $1, 'Owner Test', '!', 'member'),
		       ($2, $2, 'Other Test', '!', 'member')`, ownerID, otherID); err != nil {
		t.Fatalf("insert users: %v", err)
	}

	created, err := s.CreateGeneratedCV(ctx, CreateGeneratedCVInput{
		OwnerID:        ownerID,
		TargetPosition: "Backend Developer",
		Level:          "Middle",
		Content: model.GeneratedCVContent{
			Summary: "Tóm tắt do AI viết.",
			Experience: []model.GeneratedExperience{{
				Company: "CodeCV",
				Role:    "Backend Engineer",
				Period:  "2023 - nay",
				Bullets: []string{"Xây API Go", "Tối ưu Postgres"},
			}},
			Skills: []model.GeneratedSkillGroup{{Group: "Backend", Items: []string{"Go", "PostgreSQL"}}},
		},
		Input: model.BuilderInput{
			FullName: "Nguyễn Văn Test",
			Position: "Backend Developer",
			Skills:   []string{"Go"},
		},
		ModelID:  "model-test",
		Provider: "stub",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if created.Name != "Nguyễn Văn Test" {
		t.Fatalf("name fallback = %q", created.Name)
	}
	if created.Language != "vi" || created.Template != "classic" || created.Accent != "sky" {
		t.Fatalf("defaults = %q/%q/%q", created.Language, created.Template, created.Accent)
	}
	if created.Content.Summary != "Tóm tắt do AI viết." ||
		len(created.Content.Experience) != 1 ||
		len(created.Content.Experience[0].Bullets) != 2 ||
		len(created.Content.Skills) != 1 {
		t.Fatalf("content round trip = %+v", created.Content)
	}
	if created.Input.FullName != "Nguyễn Văn Test" || created.Input.Position != "Backend Developer" {
		t.Fatalf("input round trip = %+v", created.Input)
	}
	if created.CreatedAt == "" || created.UpdatedAt == "" {
		t.Fatalf("missing timestamps: %+v", created)
	}

	ownerList, err := s.GeneratedCVs(ctx, ownerID)
	if err != nil || len(ownerList) != 1 || ownerList[0].ID != created.ID {
		t.Fatalf("owner list = %+v, err %v", ownerList, err)
	}
	otherList, err := s.GeneratedCVs(ctx, otherID)
	if err != nil || len(otherList) != 0 {
		t.Fatalf("other list = %+v, err %v", otherList, err)
	}

	if _, err := s.GeneratedCV(ctx, otherID, created.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("other get err = %v, want ErrNotFound", err)
	}
	if _, err := s.UpdateGeneratedCV(ctx, UpdateGeneratedCVInput{
		OwnerID: otherID,
		ID:      created.ID,
		Name:    "Chiếm đoạt",
	}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("other update err = %v, want ErrNotFound", err)
	}
	if err := s.DeleteGeneratedCV(ctx, otherID, created.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("other delete err = %v, want ErrNotFound", err)
	}

	updated, err := s.UpdateGeneratedCV(ctx, UpdateGeneratedCVInput{
		OwnerID:        ownerID,
		ID:             created.ID,
		Name:           "CV Backend đã sửa",
		TargetPosition: "Senior Backend",
		Level:          "Senior",
		Language:       "en",
		Template:       "sidebar",
		Accent:         "emerald",
		Content: model.GeneratedCVContent{
			Summary: "Updated summary.",
			Skills:  []model.GeneratedSkillGroup{{Group: "Backend", Items: []string{"Go"}}},
		},
		Input:    model.BuilderInput{FullName: "Nguyễn Văn Test"},
		ModelID:  "model-test",
		Provider: "stub",
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Name != "CV Backend đã sửa" || updated.Template != "sidebar" ||
		updated.Accent != "emerald" || updated.Language != "en" ||
		updated.Content.Summary != "Updated summary." {
		t.Fatalf("updated = %+v", updated)
	}
	if updated.Content.Experience == nil || updated.Input.Skills == nil {
		t.Fatalf("empty slices should be normalized: %+v", updated)
	}

	if err := s.DeleteGeneratedCV(ctx, ownerID, created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := s.GeneratedCV(ctx, ownerID, created.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("get after delete err = %v, want ErrNotFound", err)
	}
}
