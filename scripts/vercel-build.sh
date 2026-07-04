#!/usr/bin/env bash
# Vercel build: the production (Postgres) pipeline.
#
# The canonical prisma/schema.prisma stays on SQLite so local dev is
# zero-config; this script derives the Postgres schema from it at build time
# (sed on the provider line only — no drift possible), applies the committed
# migrations, seeds ONCE if the database is empty, and builds.
set -euo pipefail

sed 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma > prisma/postgres/schema.prisma
npx prisma generate --schema prisma/postgres/schema.prisma
npx prisma migrate deploy --schema prisma/postgres/schema.prisma
npx tsx scripts/prod-init.ts
npx next build
