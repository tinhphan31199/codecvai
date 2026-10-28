CREATE TABLE IF NOT EXISTS positions (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    team        TEXT NOT NULL DEFAULT '',
    level       TEXT NOT NULL DEFAULT '',
    open        TEXT NOT NULL DEFAULT '',
    candidates  INT  NOT NULL DEFAULT 0,
    updated     TEXT NOT NULL DEFAULT '',
    owner       TEXT NOT NULL DEFAULT '',
    location    TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS position_criteria (
    position_id TEXT NOT NULL REFERENCES positions (id) ON DELETE CASCADE,
    idx         INT  NOT NULL,
    label       TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'must',
    weight      INT  NOT NULL DEFAULT 0,
    verify      TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (position_id, idx)
);

CREATE TABLE IF NOT EXISTS candidates (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    initials           TEXT NOT NULL DEFAULT '',
    hue                INT  NOT NULL DEFAULT 0,
    role               TEXT NOT NULL DEFAULT '',
    position           TEXT NOT NULL DEFAULT '',
    level              TEXT NOT NULL DEFAULT 'Middle',
    status             TEXT NOT NULL DEFAULT 'processing',
    updated            TEXT NOT NULL DEFAULT '',
    updated_at         TEXT NOT NULL DEFAULT '',
    email              TEXT NOT NULL DEFAULT '',
    phone              TEXT NOT NULL DEFAULT '',
    location           TEXT NOT NULL DEFAULT '',
    years              INT  NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL DEFAULT '',
    source             TEXT NOT NULL DEFAULT '',
    reviewer           TEXT NOT NULL DEFAULT '',
    summary            TEXT NOT NULL DEFAULT '',
    strengths          JSONB NOT NULL DEFAULT '[]',
    verify             JSONB NOT NULL DEFAULT '[]',
    repo               TEXT NOT NULL DEFAULT '',
    repo_branch        TEXT NOT NULL DEFAULT '',
    commit             TEXT NOT NULL DEFAULT '',
    repo_state         TEXT NOT NULL DEFAULT 'none',
    notes              TEXT NOT NULL DEFAULT '',
    stage_index        INT  NOT NULL DEFAULT 0,
    repo_tree          JSONB,
    architecture_layers JSONB
);

CREATE INDEX IF NOT EXISTS candidates_status_idx ON candidates (status);

CREATE TABLE IF NOT EXISTS criteria (
    candidate_id TEXT NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
    idx          INT  NOT NULL,
    id           TEXT NOT NULL,
    label        TEXT NOT NULL,
    kind         TEXT NOT NULL DEFAULT 'must',
    state        TEXT NOT NULL DEFAULT 'missing',
    evidence     INT  NOT NULL DEFAULT 0,
    note         TEXT NOT NULL DEFAULT '',
    sources      JSONB NOT NULL DEFAULT '[]',
    PRIMARY KEY (candidate_id, idx)
);

CREATE TABLE IF NOT EXISTS skills (
    candidate_id TEXT NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
    idx          INT  NOT NULL,
    name         TEXT NOT NULL,
    level        TEXT NOT NULL DEFAULT '',
    confidence   TEXT NOT NULL DEFAULT '',
    state        TEXT NOT NULL DEFAULT 'missing',
    source       TEXT NOT NULL DEFAULT '',
    evidence     INT  NOT NULL DEFAULT 0,
    PRIMARY KEY (candidate_id, idx)
);

CREATE TABLE IF NOT EXISTS findings (
    candidate_id TEXT NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
    id           TEXT NOT NULL,
    severity     TEXT NOT NULL DEFAULT 'info',
    title        TEXT NOT NULL,
    module       TEXT NOT NULL DEFAULT '',
    file         TEXT NOT NULL DEFAULT '',
    line         INT  NOT NULL DEFAULT 0,
    state        TEXT NOT NULL DEFAULT 'open',
    rationale    TEXT NOT NULL DEFAULT '',
    verification TEXT NOT NULL DEFAULT '',
    code         TEXT NOT NULL DEFAULT '',
    hit_line     INT  NOT NULL DEFAULT 0,
    PRIMARY KEY (candidate_id, id)
);

CREATE TABLE IF NOT EXISTS questions (
    candidate_id TEXT NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
    id           TEXT NOT NULL,
    category     TEXT NOT NULL DEFAULT 'Architecture',
    difficulty   TEXT NOT NULL DEFAULT 'Middle',
    text         TEXT NOT NULL,
    answer       TEXT NOT NULL DEFAULT '',
    follow_ups   JSONB NOT NULL DEFAULT '[]',
    PRIMARY KEY (candidate_id, id)
);

CREATE TABLE IF NOT EXISTS reports (
    id           TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL DEFAULT '',
    candidate    TEXT NOT NULL,
    position     TEXT NOT NULL DEFAULT '',
    version      INT  NOT NULL DEFAULT 1,
    status       TEXT NOT NULL DEFAULT 'review',
    reviewer     TEXT NOT NULL DEFAULT '',
    created      TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS team_members (
    name     TEXT PRIMARY KEY,
    initials TEXT NOT NULL DEFAULT '',
    role     TEXT NOT NULL DEFAULT '',
    email    TEXT NOT NULL DEFAULT '',
    hue      INT  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_models (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT '',
    note     TEXT NOT NULL DEFAULT '',
    active   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS upload_stages (
    id     INT PRIMARY KEY,
    label  TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS workspace_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);
