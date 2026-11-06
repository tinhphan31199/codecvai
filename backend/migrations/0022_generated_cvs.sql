-- CV tạo bằng AI: mỗi tài khoản giữ các bản CV riêng tư của mình.
-- content là nội dung đã sinh (JSON), input là snapshot form để mở lại và tạo lại.
CREATE TABLE IF NOT EXISTS generated_cvs (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_position TEXT NOT NULL DEFAULT '',
    level TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'vi',
    template TEXT NOT NULL DEFAULT 'classic',
    accent TEXT NOT NULL DEFAULT 'sky',
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    input JSONB NOT NULL DEFAULT '{}'::jsonb,
    model_id TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_cvs_owner_idx ON generated_cvs (owner_id, updated_at DESC);
