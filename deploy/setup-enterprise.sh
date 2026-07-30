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

echo "[*] Setting up SSL certificates..."
mkdir -p certs
if [ ! -f certs/cert.pem ]; then
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout certs/key.pem \
    -out certs/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Security/CN=${SERVER_IP}" >/dev/null 2>&1
  echo "  --> Generated self-signed certificates in /certs"
else
  echo "  --> Existing certificates found, skipping generation."
fi

echo "[*] Force-removing any remaining Supabase containers from previous failed runs..."
docker ps -a --filter "name=supabase-" -q | xargs -r docker rm -f -v >/dev/null 2>&1 || true
docker ps -a --filter "name=realtime-dev.supabase-realtime" -q | xargs -r docker rm -f -v >/dev/null 2>&1 || true

echo "[*] Fetching official Supabase docker repository (via Git sparse-checkout)..."
if [ -d "supabase" ]; then
    echo "[*] Tearing down existing deployment networks..."
    if [ -f "supabase/docker/docker-compose.yml" ]; then
        cd supabase/docker
        docker compose down -v || true
        cd ../../
    fi
    rm -rf supabase
fi
git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase.git supabase_temp >/dev/null 2>&1
cd supabase_temp
git sparse-checkout set docker >/dev/null 2>&1
cd ..
mkdir -p supabase
mv supabase_temp/docker supabase/docker
rm -rf supabase_temp
cd supabase/docker

echo "[*] Copying default Supabase configuration..."
cp .env.example .env
sed -i "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://${SERVER_IP}/auth/v1|g" .env
sed -i "s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=https://${SERVER_IP}|g" .env
sed -i "s|^SITE_URL=.*|SITE_URL=http://127.0.0.1:3000|g" .env
sed -i "s|^ADDITIONAL_REDIRECT_URLS=.*|ADDITIONAL_REDIRECT_URLS=https://${SERVER_IP},https://localhost,http://127.0.0.1:3000,http://localhost:3000|g" .env
sed -i 's/^COMPOSE_FILE=/#COMPOSE_FILE=/' .env
echo "GOTRUE_MAILER_AUTOCONFIRM=true" >> .env

# Safely remap the external supavisor port to 54320 to avoid host collisions, 
# without breaking internal networking or the pg_isready healthcheck
sed -i 's/- ${POSTGRES_PORT}:5432/- 54320:5432/g' docker-compose.yml

echo "[*] Exposing Supabase Studio (Localhost Only) and Injecting Schema..."
cat << EOF > docker-compose.override.yml
services:
  studio:
    ports:
      - "127.0.0.1:3000:3000/tcp"
  db:
    healthcheck:
      start_period: 1800s
EOF

echo "[*] Preparing to start Supabase stack..."

echo "[*] Starting Supabase backend stack..."
docker compose pull
docker compose up -d

echo "[*] Waiting up to 30 minutes for database initialization and health checks (this takes a very long time on low-spec servers)..."
WAIT_TIME=0
IS_HEALTHY=false
while [ $WAIT_TIME -lt 1800 ]; do
    sleep 5
    WAIT_TIME=$((WAIT_TIME + 5))
    STATUS=$(docker inspect --format="{{.State.Health.Status}}" supabase-db 2>/dev/null || true)
    echo "Current supabase-db status: '$STATUS'"
    if echo "$STATUS" | grep -q "healthy"; then
        IS_HEALTHY=true
        break
    fi
done

if [ "$IS_HEALTHY" = false ]; then
    echo "Error: supabase-db failed to become healthy within 30 minutes." >&2
    exit 1
fi
echo "[+] Database is healthy!"

echo "[*] Injecting Control Drift Database Schema..."
docker exec -i supabase-db psql -U postgres -d postgres < ../../schema.sql
echo "[+] Schema injected successfully!"

cd ../../

echo "[*] Generating Control Drift Config..."
rm -rf config.json 2>/dev/null || true
ANON_KEY=$(grep '^ANON_KEY=' supabase/docker/.env | cut -d '=' -f2)

echo ""
echo "--- AI Configuration ---"
echo "Select the AI Provider:"
echo "1) OpenAI (or OpenAI-compatible models)"
echo "2) Anthropic (Claude)"
echo "3) Gemini"
read -p "Choice [1]: " provider_choice

case "$provider_choice" in
  2) user_provider="anthropic" ;;
  3) user_provider="gemini" ;;
  *) user_provider="openai" ;;
esac

read -p "Enter AI Model Name: " user_ai_model

read -p "Enter Target AI Endpoint URL (e.g. http://192.168.1.100:1234/v1, leave blank for default): " user_ai_endpoint
# Automatically strip /chat/completions if the user accidentally includes it
user_ai_endpoint=${user_ai_endpoint%/chat/completions}
user_ai_endpoint=${user_ai_endpoint%/chat/completions/}

read -p "Enter API Key (Leave blank if none): " user_api_key

echo "[*] Generating AI Proxy Config..."
rm -rf litellm-config.yaml 2>/dev/null || true

cat <<EOF > litellm-config.yaml
litellm_settings:
  master_key: dummy
model_list:
  - model_name: $user_ai_model
    litellm_params:
      model: ${user_provider}/${user_ai_model}
EOF

if [ -n "$user_ai_endpoint" ]; then
  echo "      api_base: $user_ai_endpoint" >> litellm-config.yaml
fi

if [ -n "$user_api_key" ]; then
  echo "      api_key: $user_api_key" >> litellm-config.yaml
fi

# Add default fallbacks
cat <<EOF >> litellm-config.yaml
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
  - model_name: claude-3-5-sonnet-20240620
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20240620
EOF

cat <<EOF > config.json
{
  "database": {
    "provider": "supabase",
    "endpoint": "https://${SERVER_IP}",
    "apiKey": "${ANON_KEY}"
  },
  "ai": {
    "enabled": true,
    "endpointUrl": "https://${SERVER_IP}/litellm/v1/chat/completions",
    "model": "${user_ai_model}",
    "proxy": true
  }
}
EOF

echo "[*] Starting Control Drift and AI Proxy..."
docker compose pull litellm
docker compose up -d --build
docker compose restart litellm

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
until [ "$(docker inspect --format="{{.State.Status}}" control-drift 2>/dev/null)" = "running" ]; do
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
echo " Control Drift:   https://${SERVER_IP}"
echo " Supabase API:    https://${SERVER_IP}/rest/v1"
echo " AI Proxy API:    https://${SERVER_IP}/litellm"
echo " (Supabase Studio is locked down to 127.0.0.1:3000)"
echo "========================================================="
