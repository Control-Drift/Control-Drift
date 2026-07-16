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
Write-Host "🚀 Deploying Eclipse Ops" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Step 1: Build the React Application
Write-Host "`n[1/3] Installing dependencies and building static assets..." -ForegroundColor Yellow
npm install
node ./node_modules/vite/bin/vite.js build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Aborting deployment." -ForegroundColor Red
    exit 1
}

$sshKeyArg = "-o StrictHostKeyChecking=no"
if ($SshKeyPath) {
    $sshKeyArg = "-i $SshKeyPath -o StrictHostKeyChecking=no"
}

# Step 2: Transfer files to a staging directory on the VM
Write-Host "`n[2/3] Transferring files to VM staging area..." -ForegroundColor Yellow
ssh $sshKeyArg ${Username}@${VmIp} "mkdir -p ~/eclipse-ops-staging"
scp $sshKeyArg -r dist/* "${Username}@${VmIp}:~/eclipse-ops-staging/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ File transfer failed! Aborting deployment." -ForegroundColor Red
    exit 1
}

# Step 3: Move files to the Nginx web directory
Write-Host "`n[3/3] Moving files to /var/www/eclipse-ops..." -ForegroundColor Yellow
Write-Host "⚠️  Note: You may be prompted to enter your VM password for sudo access." -ForegroundColor DarkGray

ssh $sshKeyArg -t -t ${Username}@${VmIp} "sudo mkdir -p /var/www/eclipse-ops && sudo cp -r ~/eclipse-ops-staging/* /var/www/eclipse-ops/ && sudo chown -R www-data:www-data /var/www/eclipse-ops && sudo rm -rf ~/eclipse-ops-staging"

Write-Host "`n✅ Deployment complete! Your app should now be live." -ForegroundColor Green
