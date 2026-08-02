#!/usr/bin/env bash
# Derive the Postgres schema from the canonical SQLite schema. Single source of
# the provider-swap sed — used by scripts/vercel-build.sh, the content/ops
# workflows, and the drift check in scripts/migrations-parity.test.ts. The
# output path defaults to the committed prisma/postgres/schema.prisma; pass an
# argument to write elsewhere (the parity test derives to a temp file and
# compares byte-for-byte).
set -euo pipefail

OUT="${1:-prisma/postgres/schema.prisma}"
# Postgres-only additions: swap the provider, and give the CLI a directUrl so
# `prisma migrate deploy` bypasses Neon's PgBouncer pooler (transaction pooling
# breaks migration advisory locks). The generated client ignores directUrl and
# uses the pooled DATABASE_URL at runtime; the deploy workflow falls back to
# DIRECT_DATABASE_URL=DATABASE_URL when no separate direct secret exists.
sed -e 's/provider = "sqlite"/provider = "postgresql"/' \
    -e 's|^  url      = env("DATABASE_URL")$|  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_DATABASE_URL")|' \
    prisma/schema.prisma > "$OUT"
