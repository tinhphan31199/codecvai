-- Danh sách repository lưu từ mỗi lần phân tích CV. Phân tích hiện tại chỉ đọc vài repo;
-- các repo còn lại nằm ở trạng thái pending và được worker nền đọc lần lượt để tránh giới hạn API.
CREATE TABLE IF NOT EXISTS candidate_repositories (
    candidate_id TEXT NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    url TEXT NOT NULL,
    label TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    owner TEXT NOT NULL DEFAULT '',
    repo_name TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (candidate_id, idx)
);

CREATE INDEX IF NOT EXISTS candidate_repositories_pending_idx
    ON candidate_repositories (status, updated_at);
