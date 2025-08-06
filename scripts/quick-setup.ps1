#!/usr/bin/env pwsh
# WA-Ptero-Claim Quick Setup Script
# Automates installation and basic configuration

Write-Host "🚀 WA-Ptero-Claim Quick Setup" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 20+ first." -ForegroundColor Red
    exit 1
}

# Check Redis
try {
    redis-cli ping | Out-Null
    Write-Host "✅ Redis server is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Redis not running. Please start Redis server first." -ForegroundColor Yellow
    Write-Host "   Windows: redis-server" -ForegroundColor Gray
    Write-Host "   Linux: sudo systemctl start redis-server" -ForegroundColor Gray
}

# Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow

# Root dependencies
npm install

# Bot dependencies (manual installation)
Write-Host "📱 Installing bot dependencies..." -ForegroundColor Yellow
Set-Location "apps/bot"
npm install @whiskeysockets/baileys axios dotenv express qrcode-terminal winston
npm install @types/express @types/node rimraf tsx typescript --save-dev

# Frontend dependencies  
Write-Host "🎨 Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location "../frontend"
npm install axios framer-motion react-hook-form react-hot-toast

# Return to root
Set-Location "../.."

# Create environment files
Write-Host "`n⚙️ Creating environment files..." -ForegroundColor Yellow

# Backend .env
$backendEnv = @"
# Server Configuration
PORT=3000
NODE_ENV=development

# Pterodactyl Configuration
PT_APP_BASE_URL=https://your-panel.com
PT_APP_API_KEY=your_application_api_key_here
PT_NODE_ID=1

# Security
INTERNAL_SECRET=$(New-Guid)
CORS_ALLOWED_ORIGIN=http://localhost:3001

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_IP=20
RATE_LIMIT_JID=5

# Logging
LOG_LEVEL=info
LOG_REDACT_SENSITIVE=true
"@

$backendEnv | Out-File -FilePath "apps/backend/.env" -Encoding UTF8
Write-Host "✅ Backend .env created" -ForegroundColor Green

# Bot .env
$botEnv = @"
# WhatsApp Configuration
TARGET_GROUP_ID=123456789-123456789@g.us

# Backend Integration
BACKEND_WEBHOOK_URL=http://localhost:3000/webhook/whatsapp
INTERNAL_SECRET=$(New-Guid)

# RPC Server
RPC_PORT=3002

# Logging
LOG_LEVEL=info
"@

$botEnv | Out-File -FilePath "apps/bot/.env" -Encoding UTF8
Write-Host "✅ Bot .env created" -ForegroundColor Green

# Frontend .env.local
$frontendEnv = @"
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_POLLING_INTERVAL=5000

# Development
NODE_ENV=development
"@

$frontendEnv | Out-File -FilePath "apps/frontend/.env.local" -Encoding UTF8
Write-Host "✅ Frontend .env.local created" -ForegroundColor Green

# Build packages
Write-Host "`n🔨 Building shared packages..." -ForegroundColor Yellow
npm run build

Write-Host "`n🎉 Setup complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

Write-Host "`n📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit apps/backend/.env with your Pterodactyl panel URL and API key" -ForegroundColor White
Write-Host "2. Start Redis server if not running: redis-server" -ForegroundColor White
Write-Host "3. Start services in separate terminals:" -ForegroundColor White
Write-Host "   • Backend: cd apps/backend && npm run dev" -ForegroundColor Gray
Write-Host "   • Bot: cd apps/bot && npm run dev" -ForegroundColor Gray
Write-Host "   • Frontend: cd apps/frontend && npm run dev" -ForegroundColor Gray
Write-Host "4. Access frontend at http://localhost:3001" -ForegroundColor White

Write-Host "`n🔧 Configuration needed:" -ForegroundColor Yellow
Write-Host "• Pterodactyl API key in apps/backend/.env" -ForegroundColor White
Write-Host "• WhatsApp group ID in apps/bot/.env (after bot connects)" -ForegroundColor White
Write-Host "• Scan QR code when starting bot" -ForegroundColor White

Write-Host "`n📖 For detailed instructions, see README.md" -ForegroundColor Cyan
