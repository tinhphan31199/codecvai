-- Người phân tích CV sở hữu hồ sơ; member chỉ thấy hồ sơ của mình, admin thấy tất cả.
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS candidates_owner_idx ON candidates (owner_id);
