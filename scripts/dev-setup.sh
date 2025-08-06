#!/bin/bash
set -e

echo "🔧 WA-Ptero-Claim Development Setup"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 20+${NC}"
    exit 1
fi

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    echo -e "${YELLOW}⚠️ Redis not found. Installing...${NC}"
    # For Ubuntu/Debian
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y redis-server
        sudo systemctl start redis-server
        sudo systemctl enable redis-server
    # For macOS
    elif command -v brew &> /dev/null; then
        brew install redis
        brew services start redis
    else
        echo -e "${RED}❌ Please install Redis manually${NC}"
        exit 1
    fi
fi

# Test Redis
if ! redis-cli ping &> /dev/null; then
    echo -e "${YELLOW}🔄 Starting Redis...${NC}"
    if command -v systemctl &> /dev/null; then
        sudo systemctl start redis-server
    elif command -v brew &> /dev/null; then
        brew services start redis
    else
        redis-server --daemonize yes
    fi
fi

echo -e "${GREEN}✅ Redis is running${NC}"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Build packages
echo -e "${YELLOW}🔨 Building packages...${NC}"
npm run build

# Setup environment files
echo -e "${YELLOW}⚙️ Setting up environment files...${NC}"

# Backend .env
if [ ! -f "apps/backend/.env" ]; then
    cp apps/backend/.env.example apps/backend/.env
    echo -e "${YELLOW}📝 Created apps/backend/.env - please configure it${NC}"
fi

# Bot .env
if [ ! -f "apps/bot/.env" ]; then
    cp apps/bot/.env.example apps/bot/.env
    echo -e "${YELLOW}📝 Created apps/bot/.env - please configure it${NC}"
fi

# Frontend .env
if [ ! -f "apps/frontend/.env.local" ]; then
    cp apps/frontend/.env.local.example apps/frontend/.env.local
    echo -e "${YELLOW}📝 Created apps/frontend/.env.local${NC}"
fi

# Create log directories
mkdir -p logs apps/backend/logs apps/bot/logs apps/frontend/logs

echo -e "${GREEN}🎉 Development setup completed!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Configure apps/backend/.env with your Pterodactyl settings"
echo "2. Configure apps/bot/.env with your WhatsApp group ID"
echo "3. Start development servers:"
echo "   - Backend: npm run dev (in apps/backend)"
echo "   - Bot: npm run dev (in apps/bot)"
echo "   - Frontend: npm run dev (in apps/frontend)"
echo ""
echo -e "${GREEN}🚀 Start all services: npm run dev${NC}"
