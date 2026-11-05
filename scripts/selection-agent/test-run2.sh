#!/bin/bash
cd /home/admin/Fiestaflare
node --experimental-strip-types scripts/selection-agent/run.ts \
  --input scripts/selection-agent/candidates.test.json \
  --out /tmp/selection-report.json \
  --top 3 "$@"
