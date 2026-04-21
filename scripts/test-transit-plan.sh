#!/usr/bin/env bash
set -euo pipefail

API_BASE="${1:-http://localhost:10000}"

curl -sS -X POST "$API_BASE/transit/plan" \
  -H 'Content-Type: application/json' \
  -d '{
    "origin": {"latitude": 55.7033, "longitude": 21.1443},
    "destination": {"latitude": 55.7090, "longitude": 21.1312},
    "serviceDate": "2026-04-20"
  }' | python -m json.tool
