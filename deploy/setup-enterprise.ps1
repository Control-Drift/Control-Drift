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

Write-Host "[*] Force-removing any remaining Supabase containers from previous failed runs..."
$oldErr = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
docker ps -a --filter "name=supabase-" -q | ForEach-Object { docker rm -f -v $_ 2>&1 | Out-Null }
docker ps -a --filter "name=realtime-dev.supabase-realtime" -q | ForEach-Object { docker rm -f -v $_ 2>&1 | Out-Null }
$ErrorActionPreference = $oldErr

Write-Host "[*] Fetching official Supabase docker repository (using sparse-checkout for speed)..."
if (Test-Path supabase) {
    Write-Host "[*] Tearing down existing deployment networks..."
    if (Test-Path "supabase/docker/docker-compose.yml") {
        Set-Location supabase/docker
        $oldErr = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        docker compose down -v 2>&1 | Out-Null
        $ErrorActionPreference = $oldErr
        Set-Location ../../
    }
    Remove-Item -Recurse -Force supabase
}
Write-Host "[*] Fetching official Supabase docker repository (via Git sparse-checkout)..."
$oldErr = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase.git supabase_temp 2>&1 | Out-Null
Set-Location supabase_temp
git sparse-checkout set docker 2>&1 | Out-Null
Set-Location ..
$ErrorActionPreference = $oldErr
New-Item -ItemType Directory -Force -Path "supabase" | Out-Null
Move-Item -Path "supabase_temp\docker" -Destination "supabase\docker" -Force
Remove-Item -Recurse -Force "supabase_temp"
if (Test-Path "supabase.zip") { Remove-Item -Force "supabase.zip" }
Set-Location supabase/docker

Write-Host "[*] Copying default Supabase configuration..."
Copy-Item .env.example .env
(Get-Content .env) -replace '^API_EXTERNAL_URL=.*', "API_EXTERNAL_URL=http://${ServerIP}:8000/auth/v1" -replace '^SUPABASE_PUBLIC_URL=.*', "SUPABASE_PUBLIC_URL=http://${ServerIP}:8000" -replace '^SITE_URL=.*', "SITE_URL=http://${ServerIP}:3000" -replace '^ADDITIONAL_REDIRECT_URLS=.*', "ADDITIONAL_REDIRECT_URLS=http://${ServerIP},http://${ServerIP}:80,http://${ServerIP}:3000,http://localhost:3000,http://localhost:80" -replace '^COMPOSE_FILE=', '#COMPOSE_FILE=' | Set-Content .env
Add-Content -Path .env -Value "GOTRUE_MAILER_AUTOCONFIRM=true"

# Safely remap the external supavisor port to 54320 to avoid host collisions, 
# without breaking internal networking or the pg_isready healthcheck
(Get-Content docker-compose.yml) -replace '- \$\{POSTGRES_PORT\}:5432', '- 54320:5432' | Set-Content docker-compose.yml

Write-Host "[*] Exposing Supabase Studio and Injecting Schema..."
$overrideConfig = @"
services:
  studio:
    ports:
      - `"3000:3000/tcp`"
  db:
    healthcheck:
      start_period: 1800s
"@
Set-Content -Path docker-compose.override.yml -Value $overrideConfig

Write-Host "[*] Preparing to start Supabase stack..."

Write-Host "[*] Starting Supabase backend stack..."
docker compose pull
docker compose up -d

Write-Host "[*] Waiting up to 30 minutes for database initialization and health checks (this takes a very long time on low-spec servers)..."
$WaitTime = 0
$IsHealthy = $false
while ($WaitTime -lt 1800) {
    Start-Sleep -Seconds 5
    $WaitTime += 5
    $status = docker inspect --format="{{.State.Health.Status}}" supabase-db 2>$null
    Write-Host "Current supabase-db status: '$status'"
    if ($status -match "healthy") {
        $IsHealthy = $true
        break
    }
}
if (-not $IsHealthy) {
    Write-Error "Error: supabase-db failed to become healthy within 30 minutes."
    Exit 1
}
Write-Host "[+] Database is healthy!"

Write-Host "[*] Injecting Control Drift Database Schema..."
Get-Content ../../deploy/schema.sql | docker exec -i supabase-db psql -U postgres -d postgres
Write-Host "[+] Schema injected successfully!"

Set-Location ../../

Write-Host "[*] Generating Control Drift Config..."
if (Test-Path deploy/config.json) { Remove-Item -Recurse -Force deploy/config.json }
$AnonKey = (Select-String -Path supabase/docker/.env -Pattern "^ANON_KEY=(.*)$").Matches.Groups[1].Value

Write-Host ""
Write-Host "--- AI Configuration ---"
Write-Host "Select the AI Provider:"
Write-Host "1) OpenAI (or OpenAI-compatible models)"
Write-Host "2) Anthropic (Claude)"
Write-Host "3) Gemini"
$ProviderChoice = Read-Host "Choice [1]"

switch ($ProviderChoice) {
    "2" { $UserProvider = "anthropic" }
    "3" { $UserProvider = "gemini" }
    default { $UserProvider = "openai" }
}

$UserAiModel = Read-Host "Enter AI Model Name"

$UserAiEndpoint = Read-Host "Enter Target AI Endpoint URL (e.g. http://192.168.1.100:1234/v1, leave blank for default)"
$UserAiEndpoint = $UserAiEndpoint -replace "/chat/completions/?$", ""

$UserApiKey = Read-Host "Enter API Key (Leave blank if none)"

Write-Host "[*] Generating AI Proxy Config..."
if (Test-Path deploy/litellm-config.yaml) { Remove-Item -Recurse -Force deploy/litellm-config.yaml }

$litellmConfigLines = @(
    "litellm_settings:",
    "  master_key: dummy",
    "model_list:",
    "  - model_name: $UserAiModel",
    "    litellm_params:",
    "      model: ${UserProvider}/${UserAiModel}"
)

if (-not [string]::IsNullOrWhiteSpace($UserAiEndpoint)) {
    $litellmConfigLines += "      api_base: $UserAiEndpoint"
}

if (-not [string]::IsNullOrWhiteSpace($UserApiKey)) {
    $litellmConfigLines += "      api_key: $UserApiKey"
}

$litellmConfigLines += @(
    "  - model_name: gpt-4o",
    "    litellm_params:",
    "      model: openai/gpt-4o",
    "  - model_name: claude-3-5-sonnet-20240620",
    "    litellm_params:",
    "      model: anthropic/claude-3-5-sonnet-20240620"
)

$litellmConfigLines -join "`n" | Out-File -FilePath deploy/litellm-config.yaml -Encoding ASCII

$appConfig = @"
{
  "database": {
    "provider": "supabase",
    "endpoint": "http://${ServerIP}:8000",
    "apiKey": "$AnonKey"
  },
  "ai": {
    "enabled": true,
    "endpointUrl": "http://${ServerIP}:4000/v1/chat/completions",
    "model": "$UserAiModel",
    "proxy": true
  }
}
"@
$appConfig | Out-File -FilePath deploy/config.json -Encoding ASCII

Write-Host "[*] Starting Control Drift and AI Proxy..."
Set-Location deploy
docker compose pull litellm
docker compose up -d --build
docker compose restart litellm

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
