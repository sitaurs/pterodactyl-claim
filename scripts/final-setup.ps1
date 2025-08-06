# Final Setup Script untuk WA-Ptero-Claim System (PowerShell)

Write-Host "🚀 Starting final setup for WA-Ptero-Claim System..." -ForegroundColor Green

# 1. Install Bot Dependencies
Write-Host "📦 Installing Bot dependencies..." -ForegroundColor Yellow
Set-Location "apps\bot"
npm install @whiskeysockets/baileys axios dotenv express qrcode-terminal winston --save
npm install @types/express @types/node @types/qrcode-terminal rimraf tsx typescript --save-dev

# 2. Install Frontend Dependencies  
Write-Host "📦 Installing Frontend dependencies..." -ForegroundColor Yellow
Set-Location "..\frontend"
npm install axios framer-motion react-hook-form react-hot-toast --save

# 3. Build Shared Packages
Write-Host "🔨 Building shared packages..." -ForegroundColor Yellow
Set-Location "..\..\packages\shared-types"
npm run build

Set-Location "..\validation-schemas"
npm run build

# 4. Build Backend
Write-Host "🔨 Building backend..." -ForegroundColor Yellow
Set-Location "..\..\apps\backend"
npm run build

# 5. Build Bot
Write-Host "🔨 Building bot..." -ForegroundColor Yellow
Set-Location "..\bot"
npm run build

# 6. Build Frontend
Write-Host "🔨 Building frontend..." -ForegroundColor Yellow
Set-Location "..\frontend"
npm run build

Write-Host "✅ Final setup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Copy .env.example files and configure with your actual values"
Write-Host "2. Start Redis server"
Write-Host "3. Test each component:"
Write-Host "   - Backend: cd apps\backend && npm run dev"
Write-Host "   - Bot: cd apps\bot && npm run dev"  
Write-Host "   - Frontend: cd apps\frontend && npm run dev"
Write-Host "4. Deploy with PM2: pm2 start ecosystem.config.json"
Write-Host ""
Write-Host "🎉 System is ready for production!" -ForegroundColor Green
