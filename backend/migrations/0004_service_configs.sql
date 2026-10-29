CREATE TABLE IF NOT EXISTS service_configs (
	id TEXT PRIMARY KEY,
	kind TEXT NOT NULL DEFAULT 'ai',
	name TEXT NOT NULL,
	base_url TEXT NOT NULL DEFAULT '',
	api_key TEXT NOT NULL DEFAULT '',
	sort INTEGER NOT NULL DEFAULT 0
);

INSERT INTO service_configs (id, kind, name, base_url, sort) VALUES
	('google', 'ai', 'Google', 'https://generativelanguage.googleapis.com/v1beta', 1),
	('openai', 'ai', 'OpenAI', 'https://api.openai.com/v1', 2),
	('anthropic', 'ai', 'Anthropic', 'https://api.anthropic.com', 3),
	('self-hosted', 'ai', 'Self-hosted', '', 4),
	('github', 'integration', 'GitHub', 'https://api.github.com', 5)
ON CONFLICT (id) DO NOTHING;
