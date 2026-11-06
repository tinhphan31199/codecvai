-- Bản nháp form CV builder: một dòng cho mỗi tài khoản, tách khỏi CV đã lưu.
-- input là snapshot form hiện tại để mở lại Builder và điền tiếp.
CREATE TABLE IF NOT EXISTS builder_drafts (
    owner_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    input JSONB NOT NULL DEFAULT '{}'::jsonb,
    language TEXT NOT NULL DEFAULT 'vi',
    template TEXT NOT NULL DEFAULT '',
    accent TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
