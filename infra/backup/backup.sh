#!/usr/bin/env bash
# Dumps the production database, compresses and encrypts it with age (public key only).
# Env: PGDATABASE_URL (the Supabase Session pooler, port 5432: the direct connection db.<ref>.supabase.co only has IPv6 on the free plan, and GitHub Actions cannot reach it; do not use the Transaction pooler on 6543, pg_dump needs a session), AGE_RECIPIENT (age public key).
set -euo pipefail

: "${PGDATABASE_URL:?missing PGDATABASE_URL}"
: "${AGE_RECIPIENT:?missing AGE_RECIPIENT}"

stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
out="querorevisar-${stamp}.dump.gz.age"

# Custom format (-Fc) restores selectively with pg_restore. Only the app schema and auth.users are needed:
# Supabase internal schemas are recreated by the platform.
pg_dump "$PGDATABASE_URL" -Fc --no-owner --no-privileges --schema=public --schema=auth \
  | gzip -9 \
  | age -r "$AGE_RECIPIENT" -o "$out"

echo "BACKUP_FILE=$out" >> "${GITHUB_ENV:-/dev/null}"
ls -lh "$out"
