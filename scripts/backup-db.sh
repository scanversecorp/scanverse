#!/usr/bin/env bash
# Dump ScanV Supabase Postgres to a timestamped SQL file.
# Requires: supabase CLI linked to project (supabase/.temp/linked-project.json)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/scanv-db-$STAMP.sql"

echo "ScanV database backup"
echo "  Project dir: $ROOT"
echo "  Output:      $FILE"
echo ""

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx not found. Install Node.js first." >&2
  exit 1
fi

npx supabase db dump -f "$FILE"

BYTES="$(wc -c < "$FILE" | tr -d ' ')"
echo ""
echo "Done. Size: $BYTES bytes"
echo "Store off-site (encrypted drive / cloud). Do not commit backups/ to git."
