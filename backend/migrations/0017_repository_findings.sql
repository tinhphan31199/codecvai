-- Phát hiện (findings) gắn với repository đã quét và trạng thái phân tích cuối
-- do AI tạo ra, để màn hình Repository lọc đúng theo repo đang xem.
ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS repo_url TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS findings_candidate_repo_idx
    ON findings (candidate_id, repo_url);

ALTER TABLE candidate_repositories
    ADD COLUMN IF NOT EXISTS findings_state TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS findings_detail TEXT NOT NULL DEFAULT '';

-- Hồ sơ có trước tính năng này: xếp repository chính đã đọc vào hàng đợi
-- phân tích phát hiện một lần để màn hình không còn trống.
UPDATE candidate_repositories cr
SET findings_state = 'pending', findings_detail = '', updated_at = now()
FROM candidates c
WHERE cr.candidate_id = c.id
  AND cr.url = c.repo
  AND cr.status = 'analyzed'
  AND cr.tree IS NOT NULL
  AND cr.findings_state = '';
