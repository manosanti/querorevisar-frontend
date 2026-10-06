#!/usr/bin/env bash
# Uploads the encrypted dump to Cloudflare R2 (S3 API) and deletes backups older than 30 days.
# Env: BACKUP_FILE, R2_ENDPOINT, R2_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
set -euo pipefail

: "${BACKUP_FILE:?missing BACKUP_FILE}"
: "${R2_ENDPOINT:?missing R2_ENDPOINT}"
: "${R2_BUCKET:?missing R2_BUCKET}"

aws s3 cp "$BACKUP_FILE" "s3://${R2_BUCKET}/daily/${BACKUP_FILE}" --endpoint-url "$R2_ENDPOINT" --only-show-errors

cutoff=$(date -u -d '30 days ago' +%Y-%m-%d)
aws s3 ls "s3://${R2_BUCKET}/daily/" --endpoint-url "$R2_ENDPOINT" | while read -r day _time _size name; do
  if [[ -n "${name:-}" && "$day" < "$cutoff" ]]; then
    aws s3 rm "s3://${R2_BUCKET}/daily/${name}" --endpoint-url "$R2_ENDPOINT" --only-show-errors
    echo "pruned ${name}"
  fi
done
