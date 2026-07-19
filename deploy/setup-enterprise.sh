#!/bin/bash
# Control Drift - Enterprise Infrastructure Setup Script

if [ "$EUID" -ne 0 ]; then
  echo "Please run this script as root (sudo)."
  exit 1
fi

echo "========================================================="
echo " Control Drift - Enterprise Setup"
echo "========================================================="

read -p "Enter the IP address or domain for this server (default: localhost): " SERVER_IP
SERVER_IP=${SERVER_IP:-localhost}

echo "[*] Fetching official Supabase docker repository (using sparse-checkout for speed)..."
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
sed -i "s|SUPABASE_PUBLIC_URL=http://localhost:8000|SUPABASE_PUBLIC_URL=http://${SERVER_IP}:8000|g" .env
echo "GOTRUE_MAILER_AUTOCONFIRM=true" >> .env
echo "COMPOSE_FILE=docker-compose.yml:docker-compose.override.yml" >> .env

echo "[*] Exposing Supabase Studio and Injecting Schema..."
cat << EOF > docker-compose.override.yml
services:
  studio:
    ports:
      - "3000:3000/tcp"
  db:
    volumes:
      - ./volumes/db/init/01-schema.sql:/docker-entrypoint-initdb.d/init-scripts/99-control-drift.sql:Z
EOF

echo "[*] Injecting Database Schema for Auto-Initialization..."
mkdir -p volumes/db/init
cp ../../deploy/schema.sql volumes/db/init/01-schema.sql

echo "[*] Starting Supabase backend stack..."
docker compose pull
docker compose up -d

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

echo "========================================================="
echo " Deployment Complete!"
echo "---------------------------------------------------------"
echo " Supabase Studio: http://localhost:3000"
echo " LiteLLM Proxy:   http://localhost:4000"
echo " Control Drift:   http://localhost:80"
echo "========================================================="
