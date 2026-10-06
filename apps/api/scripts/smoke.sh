#!/usr/bin/env bash
# End-to-end smoke against a running API (default http://localhost:8080, local profile, every secret <SEM_TOKEN>).
# Usage: ./gradlew :apps:api:localDb & ./gradlew :apps:api:bootRun &, then bash apps/api/scripts/smoke.sh
set -u
B=${B:-http://localhost:8080}
pass=0; fail=0
OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT
uuid() { node -e 'console.log(crypto.randomUUID())'; }
json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const v=('"$1"');console.log(typeof v==="object"?JSON.stringify(v):v)})'; }
check() { # name expected actual
  if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1 ($3)"; else fail=$((fail+1)); echo "  FAIL $1: expected [$2] got [$3]"; fi
}
req() { # method path [body] -> sets CODE and BODY
  local m=$1 p=$2 d=${3:-}
  local args=(-s -o "$OUT" -w "%{http_code}" -X "$m" "$B$p" -H "Authorization: Bearer $TOKEN")
  if [ "$m" != "GET" ]; then args+=(-H "Idempotency-Key: $(uuid)"); fi
  if [ -n "$d" ]; then args+=(-H "Content-Type: application/json" -d "$d"); fi
  CODE=$(curl "${args[@]}"); BODY=$(cat "$OUT")
}

echo "== health"
check "health" 200 "$(curl -s -o /dev/null -w "%{http_code}" $B/actuator/health)"
check "catalog version" '/catalog.v1.json' "$(curl -s $B/v1/catalog/version | json j.url)"

echo "== dev anonymous login"
SESSION=$(curl -s -X POST $B/dev/auth/anonymous)
TOKEN=$(echo "$SESSION" | json j.accessToken)
USER_ID=$(echo "$SESSION" | json j.user.id)
check "anonymous" true "$(echo "$SESSION" | json j.user.isAnonymous)"
check "no token → 401" 401 "$(curl -s -o /dev/null -w "%{http_code}" $B/v1/me)"
req GET /v1/me; check "me" free "$(echo "$BODY" | json j.plan)"

echo "== vehicle"
VID=$(uuid)
req POST /v1/vehicles "{\"id\":\"$VID\",\"type\":\"car\",\"brand\":\"Chevrolet\",\"model\":\"Onix\",\"year\":2019,\"km\":48000,\"plate\":\"qrv-2e19\"}"
check "create vehicle" 200 "$CODE"; check "kmPerMonth" 1100 "$(echo "$BODY" | json j.kmPerMonth)"; check "plate normalized" QRV2E19 "$(echo "$BODY" | json j.plate)"
req POST /v1/vehicles "{\"id\":\"$(uuid)\",\"type\":\"moto\",\"brand\":\"Honda\",\"model\":\"CG 160\",\"year\":2022,\"km\":1000}"
check "second vehicle → 402" 402 "$CODE"; check "vehicle-limit title" "O plano grátis acompanha 1 veículo." "$(echo "$BODY" | json j.title)"

echo "== record"
RID=$(uuid)
req POST /v1/records "{\"id\":\"$RID\",\"vehicleId\":\"$VID\",\"km\":47000,\"where\":\"home\"}"
check "record without item → 400" 400 "$CODE"; check "item message" "Escolha o item que você trocou" "$(echo "$BODY" | json j.title)"
req POST /v1/records "{\"id\":\"$RID\",\"vehicleId\":\"$VID\",\"itemId\":\"m1\",\"km\":47000,\"date\":\"2099-01-01\",\"where\":\"home\"}"
check "future date → 400" "A data não pode ser no futuro" "$(echo "$BODY" | json j.title)"
req POST /v1/records "{\"id\":\"$RID\",\"vehicleId\":\"$VID\",\"itemId\":\"m1\",\"km\":47000,\"date\":\"2026-09-01\",\"costCents\":18990,\"where\":\"shop\"}"
check "create record" 200 "$CODE"
req GET "/v1/vehicles/$VID/records"; check "records listed" 1 "$(echo "$BODY" | json j.records.length)"

echo "== sync"
req GET /v1/sync; check "sync full" true "$(echo "$BODY" | json j.full)"; check "sync vehicles" 1 "$(echo "$BODY" | json j.vehicles.length)"
CURSOR=$(echo "$BODY" | json j.cursor)
ETAG=$(curl -s -D - -o /dev/null "$B/v1/sync?since=$CURSOR" -H "Authorization: Bearer $TOKEN" | tr -d '\r' | grep -i '^etag:' | cut -d' ' -f2)
check "sync 304 with If-None-Match" 304 "$(curl -s -o /dev/null -w "%{http_code}" "$B/v1/sync?since=$CURSOR" -H "Authorization: Bearer $TOKEN" -H "If-None-Match: $ETAG")"
MID=$(uuid)
req POST /v1/sync "{\"mutations\":[{\"id\":\"$MID\",\"type\":\"record.upsert\",\"clientTime\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"payload\":{\"id\":\"$(uuid)\",\"vehicleId\":\"$VID\",\"itemId\":\"m2\",\"km\":47100,\"where\":\"home\"}}]}"
check "sync push applied" 1 "$(echo "$BODY" | json j.applied.length)"

echo "== km"
req POST "/v1/vehicles/$VID/km" '{"km":46000}'
check "km below record → 400" "Km menor que a última troca registrada (47.100 km)" "$(echo "$BODY" | json j.title)"
req POST "/v1/vehicles/$VID/km" '{"km":49000}'
check "km update" 49000 "$(echo "$BODY" | json j.km)"

echo "== credits (Pix mock)"
req GET /v1/credits/packs; check "packs" 4 "$(echo "$BODY" | json j.length)"
req POST /v1/credits/purchases '{"packId":"pack-12","method":"pix"}'
check "pix purchase" pending "$(echo "$BODY" | json j.status)"
PID=$(echo "$BODY" | json j.purchaseId)
check "pix qr" true "$(echo "$BODY" | json 'j.qrCodeBase64.length>100')"
sleep 4
req GET "/v1/credits/purchases/$PID"; check "pix approved after 3 s" approved "$(echo "$BODY" | json j.status)"
req GET /v1/me; check "credits balance" 12 "$(echo "$BODY" | json j.credits)"

echo "== lookup"
req POST /v1/lookups '{"plate":"abc-1d23","product":"laudo","mine":false}'
check "lookup" 200 "$CODE"; check "lookup summary" "Nada consta nas bases consultadas" "$(echo "$BODY" | json j.summary.text)"
LID=$(echo "$BODY" | json j.id)
req GET /v1/me; check "credits after lookup" 6 "$(echo "$BODY" | json j.credits)"
req GET "/v1/lookups/$LID"; check "reopen lookup" 200 "$CODE"
req GET /v1/me; check "reopen does not charge" 6 "$(echo "$BODY" | json j.credits)"
req POST /v1/lookups '{"plate":"AB1","product":"basica","mine":false}'
check "invalid plate → 422" 422 "$CODE"

echo "== premium (mock)"
req POST /v1/billing/premium/checkout
check "checkout" true "$(echo "$BODY" | json 'j.initPoint.includes("/mock/checkout?kind=premium&id=")')"
SUB=$(echo "$BODY" | json 'new URL(j.initPoint).searchParams.get("id")')
req POST "/v1/mock/payments/$SUB/approve"; check "approve premium" 204 "$CODE"
req GET /v1/me; check "me premium" premium "$(echo "$BODY" | json j.plan)"; check "premium bonus" 8 "$(echo "$BODY" | json j.credits)"
req GET /v1/billing/premium; check "premium status" authorized "$(echo "$BODY" | json j.status)"

echo "== jobs"
check "job daily (ran or already ran today)" true "$(curl -s -X POST $B/internal/jobs/daily | json '["ran","skipped"].includes(j.status)')"
check "job daily again" skipped "$(curl -s -X POST $B/internal/jobs/daily | json j.status)"

echo "== FIPE (live Parallelum API)"
req GET /v1/catalog/vehicles/car/brands; check "fipe brands" 200 "$CODE"; check "fipe brands listed" true "$(echo "$BODY" | json 'j.length>10')"

echo "== dev signup keeps the user id"
EMAIL="smoke-$(uuid | cut -c1-8)@local.test"
SIGNUP=$(curl -s -X POST $B/dev/auth/signup -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"segredo1\",\"name\":\"Smoke\"}")
check "same id after signup" "$USER_ID" "$(echo "$SIGNUP" | json j.user.id)"
TOKEN=$(echo "$SIGNUP" | json j.accessToken)
req GET /v1/vehicles; check "data kept after signup" 1 "$(echo "$BODY" | json j.length)"

echo
echo "smoke: $pass passed, $fail failed (user $USER_ID)"
[ "$fail" = 0 ]
