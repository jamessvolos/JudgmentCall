#!/usr/bin/env bash
# Vercel build: the production (Postgres) pipeline.
#
# The canonical prisma/schema.prisma stays on SQLite so local dev is
# zero-config; this script derives the Postgres schema from it at build time
# (sed on the provider line only — no drift possible), applies the committed
# migrations, seeds ONCE if the database is empty, and builds.
set -euo pipefail

# The postgres schema's directUrl (used only by prisma migrate) falls back to
# the runtime URL when no dedicated direct-connection URL is configured.
export DIRECT_DATABASE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}"

bash scripts/gen-postgres-schema.sh
npx prisma generate --schema prisma/postgres/schema.prisma
npx prisma migrate deploy --schema prisma/postgres/schema.prisma
npx tsx scripts/prod-init.ts
npx next build
