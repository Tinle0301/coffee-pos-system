#!/usr/bin/env bash
# run-sql-checks.sh — POS-42
#
# Builds a fresh database from our migrations and runs every SQL check file
# in backend/tests/. Fails (exit 1) if any migration or check fails, so a
# broken rule fails the PR in CI.
#
# Usage (from the repo root), against an EMPTY Postgres database:
#   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" bash scripts/run-sql-checks.sh
#
# Never point this at the live Supabase project: it loads test stubs and
# seed data.

set -euo pipefail

DB="${DATABASE_URL:?Set DATABASE_URL to an empty Postgres database}"
PSQL=(psql "$DB" -X -q -v ON_ERROR_STOP=1)
cd "$(dirname "$0")/.."

# 1. backend/migrations and supabase/migrations must hold the same SQL ------
echo "== Checking backend/migrations matches supabase/migrations"
missing=0
for f in backend/migrations/*.sql; do
  found=0
  for g in supabase/migrations/*.sql; do
    if cmp -s "$f" "$g"; then found=1; break; fi
  done
  if [ "$found" -eq 0 ]; then
    echo "  no identical copy in supabase/migrations/ for $f"
    missing=1
  fi
done
backend_count=$(ls backend/migrations/*.sql | wc -l)
supabase_count=$(ls supabase/migrations/*.sql | wc -l)
if [ "$backend_count" -ne "$supabase_count" ]; then
  echo "  backend/migrations has $backend_count files, supabase/migrations has $supabase_count"
  missing=1
fi
if [ "$missing" -ne 0 ]; then
  echo "FAIL: add the same migration to both folders (see docs/SETUP.md)"
  exit 1
fi
echo "  $backend_count migrations, both folders match"

# 2. Supabase stubs, migrations, seed -------------------------------------
echo "== Preparing database"
# hide Postgres notices while building; the checks below still print theirs
export PGOPTIONS="-c client_min_messages=error"
"${PSQL[@]}" -f scripts/ci-supabase-stubs.sql >/dev/null

for f in supabase/migrations/*.sql; do
  echo "  applying $(basename "$f")"
  "${PSQL[@]}" -f "$f" >/dev/null
done

"${PSQL[@]}" -f backend/seed/seed.sql >/dev/null
echo "  seed data loaded"
unset PGOPTIONS

# 3. every check file -------------------------------------------------------
echo "== Running SQL checks"
total=0
failed=0
for f in backend/tests/*.sql; do
  name=$(basename "$f")
  if output=$("${PSQL[@]}" -f "$f" 2>&1); then
    passes=$(grep -c 'PASS' <<<"$output" || true)
    total=$((total + passes))
    printf '  ok    %-36s %3d checks\n' "$name" "$passes"
  else
    failed=$((failed + 1))
    printf '  FAIL  %s\n' "$name"
    grep -E 'ERROR|FAIL' <<<"$output" | head -5 | sed 's/^/        /'
  fi
done

echo
if [ "$failed" -ne 0 ]; then
  echo "$failed check file(s) failed"
  exit 1
fi
echo "All $total checks passed"
