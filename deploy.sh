#!/bin/bash
# 在服务器上运行：拉取最新代码 → 重建镜像 → 重启容器
# 复制自 linalg-to-attention/deploy.sh（2026-11-19），分支改为 main。
set -e

echo "==> Deploying learn-llm..."

git fetch --all
git reset --hard origin/main

export DOCKER_BUILDKIT=1
docker compose down --remove-orphans 2>/dev/null || true
docker build -t learn-llm:latest .
docker compose up -d

echo "==> Done. Serving on http://127.0.0.1:5193 (Caddy 反代 learn-llm.fim.ai)"
