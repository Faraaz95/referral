#!/usr/bin/env bash
# Pull the given images and (re)start the CraftFlow Referrals stack. Touches only "referral*"
# containers, network and volumes — other apps are never affected.
#   BACKEND_IMAGE=ghcr.io/faraaz95/referral-backend:<sha> FRONTEND_IMAGE=... ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "deploy/.env is missing — copy .env.example and fill it in"; exit 1; }
export BACKEND_IMAGE="${BACKEND_IMAGE:-ghcr.io/faraaz95/referral-backend:latest}"
export FRONTEND_IMAGE="${FRONTEND_IMAGE:-ghcr.io/faraaz95/referral-frontend:latest}"

docker compose pull backend web
docker compose up -d --remove-orphans

# Wait for the backend health check (migrations run on start)
for i in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' referral-backend 2>/dev/null || echo starting)
  [ "$status" = healthy ] && break
  sleep 4
done
[ "$status" = healthy ] || { echo "backend not healthy"; docker compose logs --tail 80 backend; exit 1; }

# Let Nginx Proxy Manager reach referral-web by name (idempotent)
npm_container=$(docker ps --format '{{.Names}} {{.Image}}' | awk '/nginx-proxy-manager/ {print $1; exit}')
if [ -n "$npm_container" ]; then
  docker network connect referral "$npm_container" 2>/dev/null || true
fi

# Keep only the 3 newest Referral images per repo (never touches other apps' images)
for repo in ghcr.io/faraaz95/referral-backend ghcr.io/faraaz95/referral-frontend; do
  docker images "$repo" --format '{{.ID}}' | awk '!seen[$0]++' | tail -n +4 | xargs -r docker rmi >/dev/null 2>&1 || true
done
echo "Referrals deployed: $BACKEND_IMAGE / $FRONTEND_IMAGE"
