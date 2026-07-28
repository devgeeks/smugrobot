#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env.deploy ]; then
  set -a
  source .env.deploy
  set +a
fi

: "${MIGRAINE_DEPLOY_PATH:?Set MIGRAINE_DEPLOY_PATH in apps/migraine/.env.deploy (see .env.deploy.example)}"

npm run build
rsync -avz --delete -e ssh dist/ "smugrobot-deploy:${MIGRAINE_DEPLOY_PATH}/"
