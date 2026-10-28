# CodeCV AI

Recruitment intelligence app. Next.js renders the UI; every piece of server-side
processing (multipart upload, PDF/DOCX text extraction, repository link
extraction, GitHub enrichment, Gemini analysis, data persistence) runs in the Go
API in `backend/` backed by PostgreSQL.

## Requirements

- Node.js 20+
- Go 1.26+
- Docker (for the Postgres container)
- `GEMINI_API_KEY` in `.env.local` at the project root (optional `GITHUB_TOKEN`
  raises GitHub rate limits)

## Database

Postgres 16 runs in a dedicated container (`codecv-postgres`) on host port
`5433`. Start it from `backend/`:

```bash
cd backend && docker compose up -d
```

The API migrates and seeds automatically on startup. Connection string defaults
to `postgres://codecv:codecv@localhost:5433/codecv?sslmode=disable`; override
with `DATABASE_URL` if needed. Seed data is generated from `src/data/codecv.ts`
via `backend/scripts/export-seed.mjs`.

## Run

Terminal 1 — Go API on `http://localhost:8080`:

```bash
npm run api            # cd backend && go run ./cmd/api
```

The API loads `.env.local` from the project root automatically.

Terminal 2 — Next.js on `http://localhost:3000`:

```bash
npm run dev
```

Open http://localhost:3000/#upload.

The frontend calls the API at `NEXT_PUBLIC_API_BASE_URL` (default
`http://localhost:8080`). Set it in `.env.local` when the API lives elsewhere.

## API

`POST /api/analyze-cv` — `multipart/form-data` with:

| Field              | Notes                                                    |
| ------------------ | -------------------------------------------------------- |
| `file`             | `.pdf` or `.docx`, max 10 MB                             |
| `positionId`       | id from `backend/internal/positions/positions.json`      |
| `level`            | defaults to the position level                           |
| `language`         | `Vietnamese` or `English`                                |
| `model`            | `gemini-3.1-flash-lite` or `gemini-3.5-flash-lite`       |
| `includeQuestions` | `true` / `false`                                         |

Successful analyses are persisted as candidates (status `review`).

Screen APIs (all JSON):

| Method | Path                          | Purpose                              |
| ------ | ----------------------------- | ------------------------------------ |
| GET    | `/api/workspace`              | workspace summary + settings         |
| PUT    | `/api/workspace`              | update workspace settings            |
| GET    | `/api/dashboard`              | overview aggregate                   |
| GET    | `/api/candidates`             | list (`q`, `status`, `position`, `sort`, `limit`, `offset`) |
| GET    | `/api/candidates/{id}`        | candidate detail                      |
| PATCH  | `/api/candidates/{id}`        | update status/notes/reviewer/repo    |
| GET    | `/api/candidates/{id}/repository` | repo tree, layers, findings       |
| GET    | `/api/candidates/{id}/questions`  | interview questions               |
| GET    | `/api/positions`              | list positions                        |
| POST   | `/api/positions`              | create position                       |
| GET    | `/api/positions/{id}`         | position detail                       |
| PUT    | `/api/positions/{id}`         | update position                       |
| DELETE | `/api/positions/{id}`         | delete position                       |
| GET    | `/api/reports`                | list reports                          |
| GET    | `/api/reports/{id}`           | report detail                         |
| PATCH  | `/api/reports/{id}`           | update report status                  |
| GET    | `/api/team`                   | list team members                     |
| PUT    | `/api/team`                   | replace team members                  |
| GET    | `/api/models`                 | list AI models                        |
| PUT    | `/api/models`                 | replace AI models                     |
| GET    | `/api/stages`                 | upload pipeline stages                |

`GET /healthz` returns `{"status":"ok"}`.

Environment variables: `PORT`, `DATABASE_URL`, `GEMINI_API_BASE_URL`,
`GEMINI_API_KEY`, `GITHUB_API_BASE_URL`, `GITHUB_TOKEN`, `ALLOWED_ORIGINS`.

## Checks

```bash
npm run lint
npm run build
cd backend && go vet ./... && go test ./...
```

Position definitions live in `backend/internal/positions/positions.json` and are
a snapshot of `src/data/codecv.ts`; update both when the job list changes.
