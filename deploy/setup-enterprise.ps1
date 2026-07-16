Write-Host "========================================================="
Write-Host " Control Drift - Enterprise Setup"
Write-Host "========================================================="

Write-Host "[*] Fetching official Supabase docker repository (using sparse-checkout for speed)..."
New-Item -ItemType Directory -Force -Path supabase | Out-Null
Set-Location supabase
git init
git remote add -f origin https://github.com/supabase/supabase.git
git config core.sparseCheckout true
Add-Content -Path .git/info/sparse-checkout -Value "docker/*"
git pull --depth=1 origin master
Set-Location docker

Write-Host "[*] Copying default Supabase configuration..."
Copy-Item .env.example .env
Add-Content -Path .env -Value "GOTRUE_MAILER_AUTOCONFIRM=true"

Write-Host "[*] Injecting Database Schema for Auto-Initialization..."
New-Item -ItemType Directory -Force -Path "volumes/db/init" | Out-Null
Copy-Item ../../deploy/schema.sql volumes/db/init/01-schema.sql

Write-Host "[*] Starting Supabase backend stack..."
docker compose pull
docker compose up -d

Set-Location ../../

Write-Host "[*] Generating LiteLLM AI Proxy Configuration..."
$litellmConfig = @"
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
"@
Set-Content -Path deploy/litellm-config.yaml -Value $litellmConfig

Write-Host "[*] Generating Control Drift Config..."
$appConfig = @"
{
  "database": {
    "provider": "supabase",
    "endpoint": "http://127.0.0.1:8000",
    "apiKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE"
  },
  "ai": {
    "enabled": true,
    "endpointUrl": "http://127.0.0.1:4000/v1/chat/completions",
    "model": "gpt-4o",
    "proxy": true
  }
}
"@
Set-Content -Path deploy/config.json -Value $appConfig

Write-Host "[*] Starting Control Drift and AI Proxy..."
Set-Location deploy
docker compose pull litellm
docker compose up -d --build

Write-Host "========================================================="
Write-Host " Deployment Complete!"
Write-Host "---------------------------------------------------------"
Write-Host " Supabase Studio: http://localhost:8000"
Write-Host " LiteLLM Proxy:   http://localhost:4000"
Write-Host " Control Drift:   http://localhost:80"
Write-Host "========================================================="
