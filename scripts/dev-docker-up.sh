#!/bin/bash
# Local dev: bring up app + IAP tunnel sidecar via docker compose.
# Fetches MONGO_APP_PASSWORD fresh from Secret Manager every run so no secret
# is ever written to disk.
set -e

echo "[dev-docker] fetching MONGO_APP_PASSWORD from Secret Manager…"
export MONGO_APP_PASSWORD=$(gcloud secrets versions access latest --secret=MONGO_APP_PASSWORD)

if [[ -z "$MONGO_APP_PASSWORD" ]]; then
  echo "[dev-docker] ✗ could not fetch MONGO_APP_PASSWORD" >&2
  echo "[dev-docker]   check: gcloud auth list  + gcloud config get-value project" >&2
  exit 1
fi

echo "[dev-docker] starting compose stack (app + iap-tunnel sidecar)…"
echo "[dev-docker] app will be live at http://localhost:8080 once both containers report healthy"
echo "[dev-docker] Ctrl+C to stop"
echo ""

exec docker compose up --build "$@"
