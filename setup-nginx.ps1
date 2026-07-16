param (
    [Parameter(Mandatory=$true)]
    [string]$VmIp,

    [Parameter(Mandatory=$true)]
    [string]$Username,

    [string]$SshKeyPath = ""
)

# Fix Windows SSH trying to use a Linux home path
$env:HOME = $env:USERPROFILE

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "⚙️ Configuring Nginx on VM" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Create the Nginx configuration file locally
$nginxConfigTemplate = "server {`n" +
    "    listen 80;`n" +
    "    server_name {{VM_IP}};`n`n" +
    "    root /var/www/eclipse-ops;`n" +
    "    index index.html;`n`n" +
    "    # Serve the React application`n" +
    "    location / {`n" +
    "        try_files `$uri `$uri/ /index.html;`n" +
    "    }`n`n" +
    "    # Proxy directly to Ollama (Local LLM - Option B)`n" +
    "    location /api/ai/ {`n" +
    "        proxy_pass http://localhost:11434/;`n" +
    "        proxy_http_version 1.1;`n" +
    "        proxy_set_header Host `$host;`n" +
    "    }`n" +
    "}"

$nginxConfig = $nginxConfigTemplate -replace "{{VM_IP}}", $VmIp

$localConfigPath = Join-Path $PWD "eclipse-ops-nginx.conf"
Set-Content -Path $localConfigPath -Value $nginxConfig -Encoding UTF8

$sshKeyArg = "-o StrictHostKeyChecking=no"
if ($SshKeyPath) {
    $sshKeyArg = "-i $SshKeyPath -o StrictHostKeyChecking=no"
}

# 2. SCP the config file to the VM
Write-Host "`n[1/2] Transferring Nginx config to VM..." -ForegroundColor Yellow
scp $sshKeyArg $localConfigPath "${Username}@${VmIp}:~/eclipse-ops-nginx.conf"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to transfer config file." -ForegroundColor Red
    Remove-Item $localConfigPath
    exit 1
}

# 3. SSH into the VM to apply the config and restart Nginx
Write-Host "`n[2/2] Applying config and restarting Nginx..." -ForegroundColor Yellow
Write-Host "⚠️  Note: You may be prompted to enter your VM password for sudo access." -ForegroundColor DarkGray

$sshCommand = "sudo mv ~/eclipse-ops-nginx.conf /etc/nginx/sites-available/eclipse-ops && " +
              "sudo ln -sf /etc/nginx/sites-available/eclipse-ops /etc/nginx/sites-enabled/ && " +
              "sudo rm -f /etc/nginx/sites-enabled/default && " +
              "sudo nginx -t && " +
              "sudo systemctl restart nginx"

ssh $sshKeyArg -t -t ${Username}@${VmIp} $sshCommand

# Clean up local file
Remove-Item $localConfigPath

Write-Host "`n✅ Nginx is fully configured! Refresh your browser." -ForegroundColor Green
