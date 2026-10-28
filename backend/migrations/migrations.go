package migrations

import "embed"

// FS holds SQL migration files applied in filename order.
//
//go:embed *.sql
var FS embed.FS
