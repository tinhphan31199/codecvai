-- Chợ CV: mỗi CV tải lên được AI đọc và gắn chuyên môn, cấp bậc, kỹ năng
-- để đội tuyển dụng lọc khi tìm hồ sơ. Bảng độc lập với pipeline ứng viên.
CREATE TABLE IF NOT EXISTS market_cvs (
    id TEXT PRIMARY KEY,
    owner_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    file_name TEXT NOT NULL DEFAULT '',
    cv_key TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    years INT NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'other',
    level TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
    model TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_cvs_category_idx ON market_cvs (category, created_at DESC);
CREATE INDEX IF NOT EXISTS market_cvs_created_idx ON market_cvs (created_at DESC);
