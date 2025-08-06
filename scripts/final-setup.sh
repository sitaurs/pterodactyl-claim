#!/bin/bash
# Final Setup Script untuk WA-Ptero-Claim System

echo "🚀 Starting final setup for WA-Ptero-Claim System..."

# 1. Install Bot Dependencies
echo "📦 Installing Bot dependencies..."
cd apps/bot
npm install @whiskeysockets/baileys axios dotenv express qrcode-terminal winston --save
npm install @types/express @types/node @types/qrcode-terminal rimraf tsx typescript --save-dev

# 2. Install Frontend Dependencies  
echo "📦 Installing Frontend dependencies..."
cd ../frontend
npm install axios framer-motion react-hook-form react-hot-toast --save

# 3. Build Shared Packages
echo "🔨 Building shared packages..."
cd ../../packages/shared-types
npm run build

cd ../validation-schemas
npm run build

# 4. Build Backend
echo "🔨 Building backend..."
cd ../../apps/backend
npm run build

# 5. Build Bot
echo "🔨 Building bot..."
cd ../bot
npm run build

# 6. Build Frontend
echo "🔨 Building frontend..."
cd ../frontend
npm run build

echo "✅ Final setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Copy .env.example files and configure with your actual values"
echo "2. Start Redis server"
echo "3. Test each component:"
echo "   - Backend: cd apps/backend && npm run dev"
echo "   - Bot: cd apps/bot && npm run dev"  
echo "   - Frontend: cd apps/frontend && npm run dev"
echo "4. Deploy with PM2: pm2 start ecosystem.config.json"
echo ""
echo "🎉 System is ready for production!"
