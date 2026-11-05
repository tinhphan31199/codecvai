-- Chợ CV nâng cao: chủ sở hữu có thể ẩn CV khỏi đội ngũ và mỗi tài khoản
-- giữ danh sách CV đã lưu để tuyển nhanh ở lần sau.
ALTER TABLE market_cvs ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

CREATE TABLE IF NOT EXISTS market_cv_saves (
    cv_id TEXT NOT NULL REFERENCES market_cvs (id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (cv_id, user_id)
);

CREATE INDEX IF NOT EXISTS market_cv_saves_user_idx ON market_cv_saves (user_id, created_at DESC);
