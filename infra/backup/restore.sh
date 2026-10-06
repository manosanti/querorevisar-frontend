#!/usr/bin/env bash
# Downloads the most recent backup from R2, decrypts it and restores it into TARGET_URL.
# Env: AGE_IDENTITY (age private key), TARGET_URL, R2_ENDPOINT, R2_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
# Locally: AGE_IDENTITY="$(cat ~/.config/qr/backup.key)" TARGET_URL=postgresql://... bash infra/backup/restore.sh
set -euo pipefail

: "${AGE_IDENTITY:?missing AGE_IDENTITY}"
: "${TARGET_URL:?missing TARGET_URL}"
: "${R2_ENDPOINT:?missing R2_ENDPOINT}"
: "${R2_BUCKET:?missing R2_BUCKET}"

latest=$(aws s3 ls "s3://${R2_BUCKET}/daily/" --endpoint-url "$R2_ENDPOINT" | sort | tail -n 1 | awk '{print $4}')
if [[ -z "$latest" ]]; then
  echo "no backup found" >&2
  exit 1
fi
echo "restoring ${latest}"
aws s3 cp "s3://${R2_BUCKET}/daily/${latest}" ./latest.dump.gz.age --endpoint-url "$R2_ENDPOINT" --only-show-errors

key=$(mktemp)
trap 'rm -f "$key"' EXIT
printf '%s\n' "$AGE_IDENTITY" > "$key"

age -d -i "$key" ./latest.dump.gz.age | gunzip > ./latest.dump
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -c 'create schema if not exists auth;'
pg_restore --no-owner --no-privileges --dbname "$TARGET_URL" ./latest.dump
psql "$TARGET_URL" -At -c "select 'vehicles', count(*) from public.vehicles union all select 'records', count(*) from public.maintenance_records;"
echo "restore ok"
