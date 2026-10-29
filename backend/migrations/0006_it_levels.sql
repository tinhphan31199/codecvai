-- Ladder 9 bậc IT. Chỉ dời Junior/Middle/Senior khi chúng còn giữ rank mặc định
-- để không ghi đè chỉnh sửa tay của người dùng; không chèn lại bậc đã bị xoá.

INSERT INTO levels (name, rank) VALUES ('Intern', 1), ('Fresher', 2)
ON CONFLICT (name) DO NOTHING;

UPDATE levels SET rank = 3 WHERE name = 'Junior' AND rank = 1;
UPDATE levels SET rank = 4 WHERE name = 'Middle' AND rank = 2;
UPDATE levels SET rank = 5 WHERE name = 'Senior' AND rank = 3;

INSERT INTO levels (name, rank) VALUES
    ('Lead', 6),
    ('Principal', 7),
    ('Manager', 8),
    ('Director', 9)
ON CONFLICT (name) DO NOTHING;
