-- Tài khoản đã có trước bản này trở thành admin; tài khoản mới mặc định là member.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'member';
