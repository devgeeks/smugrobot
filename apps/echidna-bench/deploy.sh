#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env.deploy ]; then
  set -a
  source .env.deploy
  set +a
fi

: "${ECHIDNA_BENCH_DEPLOY_PATH:?Set ECHIDNA_BENCH_DEPLOY_PATH in apps/echidna-bench/.env.deploy (see .env.deploy.example)}"

npm run build
rsync -avz --delete -e ssh dist/ "smugrobot-deploy:${ECHIDNA_BENCH_DEPLOY_PATH}/"
