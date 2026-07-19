$ErrorActionPreference = 'Stop'

if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Please run this script as Administrator."
    Exit 1
}

Write-Host "========================================================="
Write-Host " Control Drift - Enterprise Setup"
Write-Host "========================================================="

Write-Host "[*] Checking system dependencies..."
$requiredCommands = @("git", "docker")
foreach ($cmd in $requiredCommands) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "Error: $cmd is not installed or not in PATH."
        Exit 1
    }
}

try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw }
} catch {
    Write-Error "Error: Docker daemon is not running. Please start Docker and try again."
    Exit 1
}

$ServerIP = Read-Host "Enter the IP address or domain for this server (default: localhost)"
if ([string]::IsNullOrWhiteSpace($ServerIP)) {
    $ServerIP = "localhost"
}

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
(Get-Content .env) -replace 'http://localhost:8000', "http://${ServerIP}:8000" -replace 'http://localhost:3000', "http://${ServerIP}:3000" | Set-Content .env
Add-Content -Path .env -Value "GOTRUE_MAILER_AUTOCONFIRM=true"
Add-Content -Path .env -Value "COMPOSE_FILE=docker-compose.yml:docker-compose.override.yml"

Write-Host "[*] Exposing Supabase Studio and Injecting Schema..."
$overrideConfig = @"
services:
  studio:
    ports:
      - `"3000:3000/tcp`"
  db:
    volumes:
      - ./volumes/db/init/01-schema.sql:/docker-entrypoint-initdb.d/init-scripts/99-control-drift.sql:Z
"@
Set-Content -Path docker-compose.override.yml -Value $overrideConfig

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
    "endpoint": "http://${ServerIP}:8000",
    "apiKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE"
  },
  "ai": {
    "enabled": true,
    "endpointUrl": "http://${ServerIP}:4000/v1/chat/completions",
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

Write-Host "[*] Waiting for Supabase API to initialize (this may take a minute)..." -NoNewline
$maxRetries = 30
$retryCount = 0
$supabaseReady = $false
while (-not $supabaseReady -and $retryCount -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://${ServerIP}:8000/rest/v1/" -Method Get -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 404 -or $response.StatusCode -eq 401) {
            $supabaseReady = $true
            break
        }
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404 -or $_.Exception.Response.StatusCode -eq 200 -or $_.Exception.Response.StatusCode -eq 401) {
            $supabaseReady = $true
            break
        }
    }
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 5
    $retryCount++
}
Write-Host ""
if (-not $supabaseReady) {
    Write-Error "Error: Supabase API failed to become ready in time. Check docker logs."
    Exit 1
}
Write-Host "[*] Supabase is ready!"

Write-Host "[*] Waiting for Control Drift frontend..." -NoNewline
$retryCount = 0
$driftReady = $false
while (-not $driftReady -and $retryCount -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:80" -Method Get -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $driftReady = $true
            break
        }
    } catch {
        if ($_.Exception.Response.StatusCode -eq 200) {
            $driftReady = $true
            break
        }
    }
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 5
    $retryCount++
}
Write-Host ""
if (-not $driftReady) {
    Write-Error "Error: Control Drift frontend failed to start. Check docker logs."
    Exit 1
}
Write-Host "[*] Control Drift is ready!"

Write-Host "========================================================="
Write-Host " Deployment Complete!"
Write-Host "---------------------------------------------------------"
Write-Host " Supabase Studio: http://localhost:3000"
Write-Host " LiteLLM Proxy:   http://localhost:4000"
Write-Host " Control Drift:   http://localhost:80"
Write-Host "========================================================="
