-- Báo cáo gắn với mỗi lần phân tích CV. created_at thật để sắp xếp và lọc
-- theo khoảng thời gian thay cho chuỗi hiển thị "DD/MM/YYYY · HH:MM".
ALTER TABLE reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE reports
SET created_at = CASE
        WHEN created ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4} · [0-9]{2}:[0-9]{2}$'
            THEN to_timestamp(created, 'DD/MM/YYYY · HH24:MI')
        ELSE now()
    END
WHERE created_at IS NULL;

-- Hồ sơ đã phân tích trước đây chưa có báo cáo: tạo bù đúng một báo cáo mỗi hồ sơ.
INSERT INTO reports (id, candidate_id, candidate, position, version, status, reviewer, created, created_at)
SELECT
    'rp-' || c.id,
    c.id,
    c.name,
    c.position,
    1,
    CASE
        WHEN c.status = 'failed' THEN 'failed'
        WHEN c.status IN ('completed', 'archived') THEN 'exported'
        ELSE 'review'
    END,
    c.reviewer,
    to_char(c.analyzed_at, 'DD/MM/YYYY · HH24:MI'),
    c.analyzed_at
FROM candidates c
WHERE c.analyzed_at IS NOT NULL
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports (created_at DESC);
CREATE INDEX IF NOT EXISTS reports_candidate_id_idx ON reports (candidate_id);
