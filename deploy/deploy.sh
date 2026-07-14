#!/usr/bin/env bash
# One-shot redeploy on the Hostinger VPS: pull, install, build, restart.
# Run from anywhere:  bash deploy/deploy.sh
set -euo pipefail

# Move to the repo root (this script lives in deploy/).
cd "$(dirname "$0")/.."

echo "→ Pulling latest code..."
git pull --ff-only

echo "→ Installing server (production) deps..."
npm install --omit=dev

echo "→ Building the React client (installs client devDeps + vite build)..."
npm run build

echo "→ Reloading under PM2 (zero-downtime)..."
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "✓ Deployed. Tail logs with: pm2 logs grn-desk"
