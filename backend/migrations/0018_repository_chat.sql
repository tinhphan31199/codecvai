-- Hỏi đáp về repository: mỗi lượt hỏi/trả lời gắn với hồ sơ và URL repo
-- đang chọn để màn hình Repository tải lại đúng lịch sử khi đổi repo.
CREATE TABLE IF NOT EXISTS repository_chat_messages (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    repo_url TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS repository_chat_messages_repo_idx
    ON repository_chat_messages (candidate_id, repo_url, id);
