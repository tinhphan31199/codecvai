-- Cây thư mục và thông tin chi tiết đọc từ GitHub cho từng repository,
-- hiển thị ở màn hình Repository. Dòng cũ chưa có dữ liệu sẽ được đọc lại.
ALTER TABLE candidate_repositories
    ADD COLUMN IF NOT EXISTS tree JSONB,
    ADD COLUMN IF NOT EXISTS details JSONB;
