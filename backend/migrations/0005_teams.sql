CREATE TABLE IF NOT EXISTS teams (
    name TEXT PRIMARY KEY,
    rank INT NOT NULL DEFAULT 0
);

-- Gán lại các vị trí mẫu sang chuyên môn CNTT đúng một lần: khi bảng teams còn rỗng.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM teams) THEN
        UPDATE positions SET team = 'Backend' WHERE id = 'be-dotnet' AND team = 'Product Engineering';
        UPDATE positions SET team = 'Data Engineering' WHERE id = 'data' AND team = 'Insights';
        UPDATE positions SET team = 'DevOps' WHERE id = 'devops' AND team = 'Platform';
        UPDATE positions SET team = 'Frontend' WHERE id = 'frontend' AND team = 'Product Engineering';
        UPDATE positions SET team = 'Fullstack' WHERE id = 'fullstack' AND team = 'Growth';
        UPDATE positions SET team = 'Mobile' WHERE id = 'mobile' AND team = 'Product Engineering';
        UPDATE positions SET team = 'QA/QC' WHERE id = 'qa' AND team = 'Product Engineering';
        UPDATE positions SET team = 'Solution Architecture' WHERE id = 'solutions' AND team = 'Enterprise';
    END IF;
END $$;
