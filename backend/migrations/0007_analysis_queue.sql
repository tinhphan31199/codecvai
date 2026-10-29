ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_file TEXT NOT NULL DEFAULT '';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS candidates_analyzed_at_idx ON candidates (analyzed_at DESC);
