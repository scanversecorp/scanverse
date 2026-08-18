#!/usr/bin/env bash
# Add Vercel DNS records for getscanv.com on Cloudflare.
# Usage: CLOUDFLARE_API_TOKEN=your_token ./scripts/cloudflare-dns-getscanv.sh

set -euo pipefail

ZONE_NAME="${ZONE_NAME:-getscanv.com}"
TOKEN="${CLOUDFLARE_API_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "Set CLOUDFLARE_API_TOKEN (Zone.DNS Edit permission for getscanv.com)." >&2
  echo "Create at: https://dash.cloudflare.com/profile/api-tokens" >&2
  exit 1
fi

ZONE_ID="$(curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=$ZONE_NAME" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id'] if d.get('result') else '')")"

if [[ -z "$ZONE_ID" ]]; then
  echo "Could not find Cloudflare zone for $ZONE_NAME" >&2
  exit 1
fi

echo "Zone ID: $ZONE_ID"

upsert() {
  local type="$1" name="$2" content="$3"
  local existing
  existing="$(curl -sS -H "Authorization: Bearer $TOKEN" \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=$type&name=$name")"
  local rid
  rid="$(echo "$existing" | python3 -c "import sys,json; r=json.load(sys.stdin).get('result') or []; print(r[0]['id'] if r else '')")"
  local payload
  payload="$(python3 - <<PY
import json
print(json.dumps({
  "type": "$type",
  "name": "$name",
  "content": "$content",
  "proxied": False,
  "ttl": 1
}))
PY
)"
  if [[ -n "$rid" ]]; then
    curl -sS -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$rid" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      --data "$payload" | python3 -c "import sys,json; d=json.load(sys.stdin); print('updated' if d.get('success') else d)"
  else
    curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      --data "$payload" | python3 -c "import sys,json; d=json.load(sys.stdin); print('created' if d.get('success') else d)"
  fi
}

# Vercel project-specific CNAME (rank 1 from `vercel domains verify`)
upsert CNAME "$ZONE_NAME" "68bca914d03f4ca4.vercel-dns-017.com"
upsert CNAME "www.$ZONE_NAME" "68bca914d03f4ca4.vercel-dns-017.com"

echo "Done. Wait 2–10 min, then: npx vercel domains verify getscanv.com"
