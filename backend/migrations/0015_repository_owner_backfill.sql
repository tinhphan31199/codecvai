-- Repo đọc trực tiếp từ CV trước đây chưa lưu owner/repo_name nên không thể đưa
-- về hàng đợi đọc lại; suy ra từ label chuẩn "github.com/owner/repo".
UPDATE candidate_repositories
SET owner = split_part(label, '/', 2),
    repo_name = split_part(label, '/', 3)
WHERE kind = 'repo'
  AND (owner = '' OR repo_name = '')
  AND label ~* '^github\.com/[^/]+/[^/]+$';
