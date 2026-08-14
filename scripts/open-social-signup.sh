#!/usr/bin/env bash
# Open ScanV social signup pages (Mac). You complete OTP/verification manually.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Opening ScanV social signup pages..."
echo "Fill credentials in: docs/social/credentials.env (copy from credentials.template.env)"
echo ""

open "https://www.facebook.com/pages/create" 2>/dev/null || true
sleep 1
open "https://business.facebook.com/" 2>/dev/null || true
sleep 1
open "https://www.instagram.com/accounts/emailsignup/" 2>/dev/null || true
sleep 1
open "https://www.threads.net/" 2>/dev/null || true
sleep 1
# TikTok banned in India — skip signup
open "https://studio.youtube.com/" 2>/dev/null || true
sleep 1
open "file://${ROOT}/docs/social/ACCOUNT-SETUP-RUNBOOK.md" 2>/dev/null || true

if [[ ! -f "${ROOT}/docs/social/credentials.env" ]]; then
  cp "${ROOT}/docs/social/credentials.template.env" "${ROOT}/docs/social/credentials.env"
  echo "Created docs/social/credentials.env — fill after each account is live."
fi

echo "Done. Complete phone/email verification on each site."
