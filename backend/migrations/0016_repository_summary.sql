-- Tổng hợp mã nguồn (cấu trúc, tệp chính, cờ test/CI/Docker...) dựng từ cây
-- thư mục ngay khi quét, để màn hình Repository hiển thị mà không cần đọc từng tệp.
ALTER TABLE candidate_repositories
    ADD COLUMN IF NOT EXISTS summary JSONB;
