#!/bin/bash
# WA-Ptero-Claim Quick Setup Script
# Automates installation and basic configuration

echo "🚀 WA-Ptero-Claim Quick Setup"
echo "================================"

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if command -v node &> /dev/null; then
    node_version=$(node --version)
    echo "✅ Node.js found: $node_version"
else
    echo "❌ Node.js not found. Please install Node.js 20+ first."
    exit 1
fi

# Check Redis
if redis-cli ping &> /dev/null; then
    echo "✅ Redis server is running"
else
    echo "⚠️ Redis not running. Please start Redis server first."
    echo "   Ubuntu/Debian: sudo systemctl start redis-server"
    echo "   MacOS: brew services start redis"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."

# Root dependencies
npm install

# Bot dependencies (manual installation)
echo "📱 Installing bot dependencies..."
cd apps/bot
npm install @whiskeysockets/baileys axios dotenv express qrcode-terminal winston
npm install @types/express @types/node rimraf tsx typescript --save-dev

# Frontend dependencies  
echo "🎨 Installing frontend dependencies..."
cd ../frontend
npm install axios framer-motion react-hook-form react-hot-toast

# Return to root
cd ../..

# Create environment files
echo ""
echo "⚙️ Creating environment files..."

# Generate random secrets
backend_secret=$(openssl rand -hex 32)
bot_secret=$(openssl rand -hex 32)

# Backend .env
cat > apps/backend/.env << EOF
# Server Configuration
PORT=3000
NODE_ENV=development

# Pterodactyl Configuration
PT_APP_BASE_URL=https://your-panel.com
PT_APP_API_KEY=your_application_api_key_here
PT_NODE_ID=1

# Security
INTERNAL_SECRET=$backend_secret
CORS_ALLOWED_ORIGIN=http://localhost:3001

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_IP=20
RATE_LIMIT_JID=5

# Logging
LOG_LEVEL=info
LOG_REDACT_SENSITIVE=true
EOF

echo "✅ Backend .env created"

# Bot .env
cat > apps/bot/.env << EOF
# WhatsApp Configuration
TARGET_GROUP_ID=123456789-123456789@g.us

# Backend Integration
BACKEND_WEBHOOK_URL=http://localhost:3000/webhook/whatsapp
INTERNAL_SECRET=$bot_secret

# RPC Server
RPC_PORT=3002

# Logging
LOG_LEVEL=info
EOF

echo "✅ Bot .env created"

# Frontend .env.local
cat > apps/frontend/.env.local << EOF
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_POLLING_INTERVAL=5000

# Development
NODE_ENV=development
EOF

echo "✅ Frontend .env.local created"

# Build packages
echo ""
echo "🔨 Building shared packages..."
npm run build

echo ""
echo "🎉 Setup complete!"
echo "================================"

echo ""
echo "📋 Next steps:"
echo "1. Edit apps/backend/.env with your Pterodactyl panel URL and API key"
echo "2. Start Redis server if not running: redis-server"
echo "3. Start services in separate terminals:"
echo "   • Backend: cd apps/backend && npm run dev"
echo "   • Bot: cd apps/bot && npm run dev"
echo "   • Frontend: cd apps/frontend && npm run dev"
echo "4. Access frontend at http://localhost:3001"

echo ""
echo "🔧 Configuration needed:"
echo "• Pterodactyl API key in apps/backend/.env"
echo "• WhatsApp group ID in apps/bot/.env (after bot connects)"
echo "• Scan QR code when starting bot"

echo ""
echo "📖 For detailed instructions, see README.md"
