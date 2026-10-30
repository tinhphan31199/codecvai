-- Ladder 9 bậc IT mặc định. ON CONFLICT DO NOTHING nên rank người dùng đã sửa
-- được giữ nguyên; các UPDATE chỉ dời bậc còn mang rank mặc định cũ.

INSERT INTO levels (name, rank) VALUES
    ('Intern', 1),
    ('Fresher', 2),
    ('Junior', 3),
    ('Middle', 4),
    ('Senior', 5)
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
