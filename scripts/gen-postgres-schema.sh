#!/usr/bin/env bash
# Derive the Postgres schema from the canonical SQLite schema. Single source of
# the provider-swap sed — used by scripts/vercel-build.sh, the content/ops
# workflows, and the drift check in scripts/migrations-parity.test.ts. The
# output path defaults to the committed prisma/postgres/schema.prisma; pass an
# argument to write elsewhere (the parity test derives to a temp file and
# compares byte-for-byte).
set -euo pipefail

OUT="${1:-prisma/postgres/schema.prisma}"
sed 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma > "$OUT"
