#!/bin/bash
# Open IAP tunnel: localhost:27017 → mongo-a:27017
# Keep running in a separate terminal while developing locally.
# Ctrl+C to close.
set -e
echo "[tunnel] opening IAP tunnel mongo-a:27017 → localhost:27017"
echo "[tunnel] keep this terminal open while running 'npm run dev'"
echo "[tunnel] Ctrl+C to close"
exec gcloud compute start-iap-tunnel mongo-a 27017 \
  --zone=asia-south1-a \
  --local-host-port=localhost:27017
