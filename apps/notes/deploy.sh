#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env.deploy ]; then
  set -a
  source .env.deploy
  set +a
fi

: "${NOTES_DEPLOY_PATH:?Set NOTES_DEPLOY_PATH in apps/notes/.env.deploy (see .env.deploy.example)}"

npm run build
rsync -avz --delete -e ssh dist/ "smugrobot-deploy:${NOTES_DEPLOY_PATH}/"
