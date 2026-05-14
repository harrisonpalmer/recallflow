#!/usr/bin/env bash
set -euo pipefail

APP_URL="${RECALLFLOW_APP_URL:-https://recallflow-six.vercel.app}"
VERCEL_BIN="${VERCEL_BIN:-}"

if [[ -z "$VERCEL_BIN" ]]; then
  if command -v vercel >/dev/null 2>&1; then
    VERCEL_BIN="$(command -v vercel)"
  elif [[ -x "$HOME/.local/bin/vercel" ]]; then
    VERCEL_BIN="$HOME/.local/bin/vercel"
  else
    echo "Vercel CLI was not found. Install it with: npm i -g vercel" >&2
    exit 1
  fi
fi

read -r -s -p "Paste your OpenAI API key: " OPENAI_API_KEY
echo

if [[ -z "$OPENAI_API_KEY" ]]; then
  echo "No API key entered." >&2
  exit 1
fi

printf '%s' "$OPENAI_API_KEY" | "$VERCEL_BIN" env add OPENAI_API_KEY production --yes --force --sensitive
"$VERCEL_BIN" --prod --yes

response="$(curl -sS -X POST "$APP_URL/api/generate-cards" \
  -H 'Content-Type: application/json' \
  -H "Origin: $APP_URL" \
  -d '{"notes":"Retrieval practice strengthens memory by making learners recall information before seeing the answer.","mode":"basic"}')"

if echo "$response" | grep -q '"cards"'; then
  echo "RecallFlow AI is live at $APP_URL"
else
  echo "The deploy finished, but the AI smoke test did not return cards:"
  echo "$response"
  exit 1
fi
