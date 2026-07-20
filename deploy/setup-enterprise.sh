#!/bin/bash
# Control Drift - Enterprise Infrastructure Setup Script

set -euo pipefail

# Error handler
trap 'echo "Error: Script failed on line $LINENO. Deployment halted." >&2' ERR

if [ "$EUID" -ne 0 ]; then
  echo "Please run this script as root (sudo)."
  exit 1
fi

echo "========================================================="
echo " Control Drift - Enterprise Setup"
echo "========================================================="

echo "[*] Checking system dependencies..."
for cmd in git docker curl; do
  if ! command -v $cmd &> /dev/null; then
    echo "Error: $cmd is not installed or not in PATH."
    exit 1
  fi
done

if ! docker info &> /dev/null; then
  echo "Error: Docker daemon is not running. Please start Docker and try again."
  exit 1
fi

read -p "Enter the IP address or domain for this server (default: localhost): " SERVER_IP
SERVER_IP=${SERVER_IP:-localhost}

echo "[*] Fetching official Supabase docker repository (using sparse-checkout for speed)..."
if [ -d "supabase" ]; then
    echo "[*] Tearing down existing deployment to prevent dangling containers..."
    if [ -f "supabase/docker/docker-compose.yml" ]; then
        cd supabase/docker
        docker compose down -v || true
        cd ../../
    fi
    echo "[*] Force-removing any remaining Supabase containers..."
    CONTAINERS=$(docker ps -a --filter "name=supabase-" -q)
    if [ -n "$CONTAINERS" ]; then docker rm -f -v $CONTAINERS >/dev/null 2>&1 || true; fi
    CONTAINERS=$(docker ps -a --filter "name=realtime-dev.supabase-realtime" -q)
    if [ -n "$CONTAINERS" ]; then docker rm -f -v $CONTAINERS >/dev/null 2>&1 || true; fi
    rm -rf supabase
fi
mkdir -p supabase
cd supabase
git init
git remote add -f origin https://github.com/supabase/supabase.git
git config core.sparseCheckout true
echo "docker/*" >> .git/info/sparse-checkout
git pull --depth=1 origin master
cd docker

echo "[*] Copying default Supabase configuration..."
cp .env.example .env
sed -i "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=http://${SERVER_IP}:8000/auth/v1|g" .env
sed -i "s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=http://${SERVER_IP}:8000|g" .env
sed -i "s|^SITE_URL=.*|SITE_URL=http://${SERVER_IP}:3000|g" .env
sed -i "s|^ADDITIONAL_REDIRECT_URLS=.*|ADDITIONAL_REDIRECT_URLS=http://${SERVER_IP},http://${SERVER_IP}:80,http://${SERVER_IP}:3000,http://localhost:3000,http://localhost:80|g" .env
sed -i 's/^COMPOSE_FILE=/#COMPOSE_FILE=/' .env
echo "GOTRUE_MAILER_AUTOCONFIRM=true" >> .env

echo "[*] Exposing Supabase Studio and Injecting Schema..."
cat << EOF > docker-compose.override.yml
services:
  studio:
    ports:
      - "3000:3000/tcp"
  db:
    healthcheck:
      start_period: 120s
    volumes:
      - ./volumes/db/init/01-schema.sql:/docker-entrypoint-initdb.d/init-scripts/99-control-drift.sql:Z
EOF

echo "[*] Injecting Database Schema for Auto-Initialization..."
mkdir -p volumes/db/init
cp ../../deploy/schema.sql volumes/db/init/01-schema.sql

echo "[*] Starting Supabase backend stack..."
docker compose pull
docker compose up -d

echo "[*] Waiting up to 3 minutes for database initialization and health checks..."
WAIT_TIME=0
IS_HEALTHY=false
while [ $WAIT_TIME -lt 180 ]; do
    sleep 5
    WAIT_TIME=$((WAIT_TIME + 5))
    STATUS=$(docker inspect --format="{{.State.Health.Status}}" supabase-db 2>/dev/null || true)
    if [ "$STATUS" = "healthy" ]; then
        IS_HEALTHY=true
        break
    fi
done

if [ "$IS_HEALTHY" = false ]; then
    echo "Error: supabase-db failed to become healthy within 3 minutes." >&2
    exit 1
fi
echo "[+] Database is healthy!"

cd ../../

echo "[*] Generating LiteLLM AI Proxy Configuration..."
cat <<EOF > deploy/litellm-config.yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
  - model_name: claude-3-5-sonnet-20240620
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20240620
  - model_name: gemini-1.5-pro
    litellm_params:
      model: gemini/gemini-1.5-pro
EOF

echo "[*] Generating Control Drift Config..."
cat <<EOF > deploy/config.json
{
  "database": {
    "provider": "supabase",
    "endpoint": "http://${SERVER_IP}:8000",
    "apiKey": "<YOUR_SUPABASE_ANON_KEY>"
  },
  "ai": {
    "enabled": true,
    "endpointUrl": "http://${SERVER_IP}:4000/v1/chat/completions",
    "model": "gpt-4o",
    "proxy": true
  }
}
EOF

echo "[*] Starting Control Drift and AI Proxy..."
cd deploy
docker compose pull litellm
docker compose up -d --build

echo "[*] Waiting for Supabase API to initialize (this may take a minute)..."
max_retries=30
retry_count=0
until curl -s http://${SERVER_IP}:8000/rest/v1/ > /dev/null || curl -s -o /dev/null -w "%{http_code}" http://${SERVER_IP}:8000/rest/v1/ | grep -q "401\|404\|200"; do
  if [ $retry_count -ge $max_retries ]; then
    echo "Error: Supabase API failed to become ready in time. Check docker logs."
    exit 1
  fi
  printf "."
  sleep 5
  retry_count=$((retry_count+1))
done
echo -e "\n[*] Supabase is ready!"

echo "[*] Waiting for Control Drift frontend..."
retry_count=0
until curl -s -o /dev/null -w "%{http_code}" http://localhost:80 | grep -q "200"; do
  if [ $retry_count -ge $max_retries ]; then
    echo "Error: Control Drift frontend failed to start. Check docker logs."
    exit 1
  fi
  printf "."
  sleep 5
  retry_count=$((retry_count+1))
done
echo -e "\n[*] Control Drift is ready!"

echo "========================================================="
echo " Deployment Complete!"
echo "---------------------------------------------------------"
echo " Supabase Studio: http://localhost:3000"
echo " LiteLLM Proxy:   http://localhost:4000"
echo " Control Drift:   http://localhost:80"
echo "========================================================="
