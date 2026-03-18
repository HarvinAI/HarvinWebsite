#!/bin/bash
# Auto-restart bulk-meta.js on crash (TLS bug in Node v24)
# Progress is saved, so each restart continues from where it left off.

MAX_RESTARTS=50
COUNT=0

while [ $COUNT -lt $MAX_RESTARTS ]; do
  COUNT=$((COUNT + 1))
  echo "=== Run #$COUNT ==="
  node --tls-min-v1.0 scripts/bulk-meta.js "$@"
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo "=== Completed successfully ==="
    exit 0
  fi

  echo "=== Crashed (exit $EXIT_CODE), restarting in 2s... ==="
  sleep 2
done

echo "=== Gave up after $MAX_RESTARTS restarts ==="
exit 1
