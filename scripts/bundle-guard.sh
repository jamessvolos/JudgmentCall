#!/usr/bin/env bash
# Bundle guard — the invariants the client bundle must never violate, codified
# so they run the same way every time (locally and in CI) instead of as ad-hoc
# greps. Run AFTER `npm run build`, against .next/. Exits non-zero on any breach.
#
#   npm run build && bash scripts/bundle-guard.sh
#
# What it enforces:
#  1. BLINDING — the study's fidelity tags never reach a client chunk. This is
#     the flagship invariant (docs/DESIGN.md): if "overclaimed" or
#     "LOW_ATTENTION" appears in client JS, a voter could fingerprint the hidden
#     experiment. The drill is the sanctioned exception, but it renders the
#     UPPERCASE stamp/vocab and imports the fidelity-family names — the raw
#     lower-case tag values must still appear nowhere.
#  2. NO SERVER SDKS IN CLIENT — Prisma / the Anthropic SDK / external ingest
#     hosts must stay server-only. A leak bloats first-load JS and can ship
#     server code (and secrets-adjacent logic) to the browser.
#  3. TEACHING VOCAB IS DRILL-ONLY — the overclaim-family teaching strings may
#     ship, but only in a chunk reachable from /drill.

set -euo pipefail
CHUNKS=".next/static/chunks"
if [ ! -d "$CHUNKS" ]; then
  echo "::error::$CHUNKS not found — run 'npm run build' first."
  exit 1
fi

fail=0
note() { echo "  $1"; }

echo "[bundle-guard] 1/3 blinding: study fidelity tags absent from client JS"
if grep -rlE "overclaimed|LOW_ATTENTION" "$CHUNKS" >/tmp/bg_blind 2>/dev/null; then
  echo "::error::Fidelity tag leaked into client chunk(s):"; cat /tmp/bg_blind
  fail=1
else
  note "clean — no 'overclaimed' / 'LOW_ATTENTION' in any client chunk"
fi

echo "[bundle-guard] 2/3 no server-only SDKs in client JS"
if grep -rlE "PrismaClient|@anthropic-ai|data\.sec\.gov|api\.stlouisfed\.org|api\.worldbank\.org|api\.frankfurter" "$CHUNKS" >/tmp/bg_srv 2>/dev/null; then
  echo "::error::Server-only dependency leaked into client chunk(s):"; cat /tmp/bg_srv
  fail=1
else
  note "clean — no Prisma / Anthropic SDK / ingest hosts in client chunks"
fi

echo "[bundle-guard] 3/3 teaching (fidelity) vocab is reachable only from /drill"
# Family names are unique to src/lib/teaching.ts; any chunk carrying them must
# be referenced only by the drill route's server entry.
teach_chunks=$(grep -rlE "Cause from correlation|Base-rate neglect|Projecting past the data" "$CHUNKS" 2>/dev/null || true)
if [ -n "$teach_chunks" ]; then
  for c in $teach_chunks; do
    base=$(basename "$c")
    # which built routes reference this chunk?
    refs=$(grep -rl "$base" .next/server/app 2>/dev/null | grep -v "/drill" || true)
    if [ -n "$refs" ]; then
      echo "::error::teaching chunk $base is referenced by a non-drill route:"; echo "$refs"
      fail=1
    else
      note "teaching chunk $base — drill-only ✓"
    fi
  done
else
  note "no teaching-vocab chunk found (ok)"
fi

# Informational: total client JS weight (gzipped), a coarse regression tripwire.
total=$(cat "$CHUNKS"/*.js 2>/dev/null | gzip -9 | wc -c)
echo "[bundle-guard] info: total client chunk JS ≈ $((total/1024)) KB gzipped"

if [ "$fail" -ne 0 ]; then
  echo "::error::bundle-guard FAILED"
  exit 1
fi
echo "[bundle-guard] PASS"
