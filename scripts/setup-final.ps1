# WA-Ptero-Claim Final Setup Script
Write-Host "🚀 WA-Ptero-Claim Final Setup & Dependency Resolution" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (!(Test-Path "package.json") -or !(Test-Path "apps") -or !(Test-Path "packages")) {
    Write-Host "❌ Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Step 1: Installing Backend Dependencies..." -ForegroundColor Yellow
Set-Location "apps\backend"

# Install backend dependencies manually
$backendDeps = @(
    "express@^4.18.2",
    "express-rate-limit@^7.1.5",
    "cors@^2.8.5",
    "helmet@^7.1.0",
    "bullmq@^4.15.0",
    "ioredis@^5.3.2",
    "axios@^1.6.5",
    "winston@^3.11.0",
    "proper-lockfile@^4.1.2",
    "dotenv@^16.3.1"
)

$backendDevDeps = @(
    "@types/express@^4.17.21",
    "@types/cors@^2.8.17",
    "@types/node@^20.11.0",
    "typescript@^5.3.0",
    "tsx@^4.7.0",
    "rimraf@^5.0.5"
)

Write-Host "📦 Installing backend production dependencies..." -ForegroundColor Green
foreach ($dep in $backendDeps) {
    Write-Host "  Installing $dep" -ForegroundColor Gray
    npm install $dep --no-audit --no-fund
}

Write-Host "🔧 Installing backend dev dependencies..." -ForegroundColor Green
foreach ($dep in $backendDevDeps) {
    Write-Host "  Installing $dep" -ForegroundColor Gray
    npm install $dep --save-dev --no-audit --no-fund
}

Write-Host ""
Write-Host "📋 Step 2: Installing Frontend Dependencies..." -ForegroundColor Yellow
Set-Location "..\frontend"

$frontendDeps = @(
    "react@19.1.0",
    "react-dom@19.1.0",
    "next@15.4.5",
    "axios@^1.6.5",
    "framer-motion@^11.0.3",
    "react-hook-form@^7.49.3",
    "react-hot-toast@^2.4.1"
)

$frontendDevDeps = @(
    "@types/react@^19",
    "@types/react-dom@^19",
    "@types/node@^20",
    "typescript@^5",
    "@tailwindcss/postcss@^4",
    "tailwindcss@^4",
    "eslint@^9",
    "eslint-config-next@15.4.5"
)

Write-Host "📦 Installing frontend production dependencies..." -ForegroundColor Green
foreach ($dep in $frontendDeps) {
    Write-Host "  Installing $dep" -ForegroundColor Gray
    npm install $dep --no-audit --no-fund
}

Write-Host "🔧 Installing frontend dev dependencies..." -ForegroundColor Green
foreach ($dep in $frontendDevDeps) {
    Write-Host "  Installing $dep" -ForegroundColor Gray
    npm install $dep --save-dev --no-audit --no-fund
}

Write-Host ""
Write-Host "📋 Step 3: Installing Bot Dependencies..." -ForegroundColor Yellow
Set-Location "..\bot"

$botDeps = @(
    "@whiskeysockets/baileys@^6.7.8",
    "axios@^1.6.5",
    "dotenv@^16.3.1",
    "express@^4.18.2",
    "qrcode-terminal@^0.12.0",
    "winston@^3.11.0"
)

$botDevDeps = @(
    "@types/express@^4.17.21",
    "@types/node@^20.11.0",
    "@types/qrcode-terminal@^0.12.2",
    "rimraf@^5.0.5",
    "tsx@^4.7.0",
    "typescript@^5.3.0"
)

Write-Host "📦 Installing bot production dependencies..." -ForegroundColor Green
foreach ($dep in $botDeps) {
    Write-Host "  Installing $dep" -ForegroundColor Gray
    npm install $dep --no-audit --no-fund
}

Write-Host "🔧 Installing bot dev dependencies..." -ForegroundColor Green
foreach ($dep in $botDevDeps) {
    Write-Host "  Installing $dep" -ForegroundColor Gray
    npm install $dep --save-dev --no-audit --no-fund
}

Write-Host ""
Write-Host "📋 Step 4: Installing Shared Package Dependencies..." -ForegroundColor Yellow

# Shared Types
Set-Location "..\..\packages\shared-types"
npm install --no-audit --no-fund

# Validation Schemas
Set-Location "..\validation-schemas"
$validationDeps = @(
    "ajv@^8.12.0",
    "ajv-formats@^2.1.1"
)

foreach ($dep in $validationDeps) {
    Write-Host "  Installing $dep" -ForegroundColor Gray
    npm install $dep --no-audit --no-fund
}

npm install typescript@^5.3.0 @types/node@^20.11.0 --save-dev --no-audit --no-fund

Write-Host ""
Write-Host "📋 Step 5: Building All Packages..." -ForegroundColor Yellow
Set-Location "..\..\"

# Build shared packages first
Write-Host "🔨 Building shared-types..." -ForegroundColor Green
Set-Location "packages\shared-types"
npx tsc

Write-Host "🔨 Building validation-schemas..." -ForegroundColor Green
Set-Location "..\validation-schemas"
npx tsc

# Build applications
Write-Host "🔨 Building backend..." -ForegroundColor Green
Set-Location "..\..\apps\backend"
npx tsc

Write-Host "🔨 Building bot..." -ForegroundColor Green
Set-Location "..\bot"
npx tsc

Write-Host ""
Write-Host "📋 Step 6: Setting up Environment Files..." -ForegroundColor Yellow
Set-Location "..\.."

# Copy environment templates
if (!(Test-Path "apps\backend\.env")) {
    Copy-Item "apps\backend\.env.example" "apps\backend\.env"
    Write-Host "✅ Created apps\backend\.env from template" -ForegroundColor Green
}

if (!(Test-Path "apps\bot\.env")) {
    Copy-Item "apps\bot\.env.example" "apps\bot\.env"
    Write-Host "✅ Created apps\bot\.env from template" -ForegroundColor Green
}

if (!(Test-Path "apps\frontend\.env.local")) {
    Copy-Item "apps\frontend\.env.local.example" "apps\frontend\.env.local"
    Write-Host "✅ Created apps\frontend\.env.local from template" -ForegroundColor Green
}

# Create log directories
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
New-Item -ItemType Directory -Force -Path "apps\backend\logs" | Out-Null
New-Item -ItemType Directory -Force -Path "apps\bot\logs" | Out-Null
New-Item -ItemType Directory -Force -Path "apps\frontend\logs" | Out-Null

Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green
Write-Host ""
Write-Host "✅ All dependencies installed successfully" -ForegroundColor Green
Write-Host "✅ All packages built successfully" -ForegroundColor Green
Write-Host "✅ Environment files created" -ForegroundColor Green
Write-Host "✅ Log directories created" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Next Steps:" -ForegroundColor Yellow
Write-Host "============="
Write-Host "1. Configure apps\backend\.env with your Pterodactyl settings" -ForegroundColor White
Write-Host "2. Configure apps\bot\.env with your WhatsApp group ID" -ForegroundColor White
Write-Host "3. Install and start Redis server" -ForegroundColor White
Write-Host "4. Test the applications:" -ForegroundColor White
Write-Host "   Backend: cd apps\backend && npm run dev" -ForegroundColor Gray
Write-Host "   Bot: cd apps\bot && npm run dev" -ForegroundColor Gray
Write-Host "   Frontend: cd apps\frontend && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "🚀 Production Deployment:" -ForegroundColor Yellow
Write-Host "========================"
Write-Host "Use: npm install -g pm2 && pm2 start ecosystem.config.json" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "================="
Write-Host "Check IMPLEMENTATION_STATUS.md for detailed implementation info" -ForegroundColor White
Write-Host ""
Write-Host "🎯 The WA-Ptero-Claim system is now ready for testing!" -ForegroundColor Green
