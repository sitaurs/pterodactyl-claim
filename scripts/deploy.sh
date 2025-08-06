#!/bin/bash
set -e

echo "🚀 Starting WA-Ptero-Claim deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/wa-ptero-claim"
BACKUP_DIR="/opt/wa-ptero-claim-backup"
LOG_FILE="/var/log/wa-ptero-deployment.log"

# Logging function
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling function
handle_error() {
    log "${RED}❌ Error occurred in deployment. Rolling back...${NC}"
    if [ -d "$BACKUP_DIR" ]; then
        log "${YELLOW}🔄 Restoring from backup...${NC}"
        rm -rf "$PROJECT_DIR"
        mv "$BACKUP_DIR" "$PROJECT_DIR"
        cd "$PROJECT_DIR"
        pm2 restart ecosystem.config.json
        log "${GREEN}✅ Rollback completed${NC}"
    fi
    exit 1
}

trap 'handle_error' ERR

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    log "${YELLOW}⚠️ Running as root. Consider using a non-root user for security.${NC}"
fi

# Prerequisites check
log "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check Node.js version
if ! command -v node &> /dev/null; then
    log "${RED}❌ Node.js is not installed. Please install Node.js 20+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    log "${RED}❌ Node.js version 20+ required. Current: $(node -v)${NC}"
    exit 1
fi

# Check PM2
if ! command -v pm2 &> /dev/null; then
    log "${YELLOW}📦 Installing PM2...${NC}"
    npm install -g pm2
fi

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    log "${RED}❌ Redis is not installed. Please install Redis server${NC}"
    exit 1
fi

# Test Redis connection
if ! redis-cli ping &> /dev/null; then
    log "${RED}❌ Redis server is not running. Please start Redis${NC}"
    exit 1
fi

log "${GREEN}✅ Prerequisites check passed${NC}"

# Backup existing deployment
if [ -d "$PROJECT_DIR" ]; then
    log "${YELLOW}📦 Creating backup of existing deployment...${NC}"
    rm -rf "$BACKUP_DIR"
    cp -r "$PROJECT_DIR" "$BACKUP_DIR"
    log "${GREEN}✅ Backup created${NC}"
fi

# Create project directory
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Clone/update repository
if [ -d ".git" ]; then
    log "${YELLOW}🔄 Updating repository...${NC}"
    git fetch origin
    git reset --hard origin/main
else
    log "${YELLOW}📥 Cloning repository...${NC}"
    # git clone <YOUR_REPO_URL> .
    # For now, assume code is already in place
    log "${YELLOW}ℹ️ Code should be manually placed in $PROJECT_DIR${NC}"
fi

# Install dependencies
log "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Build packages
log "${YELLOW}🔨 Building packages...${NC}"
npm run build

# Setup environment files
log "${YELLOW}⚙️ Setting up environment files...${NC}"

# Backend .env
if [ ! -f "apps/backend/.env" ]; then
    log "${YELLOW}📝 Creating backend .env file...${NC}"
    cat > apps/backend/.env << EOF
# Pterodactyl Configuration
PT_APP_BASE_URL=https://your-panel.com
PT_APP_API_KEY=your_application_api_key
PT_NODE_ID=1
PT_FALLBACK_NODE_IDS=2,3

# Resource Defaults
DEFAULT_SERVER_MEMORY_MB=1024
DEFAULT_SERVER_DISK_MB=2048
DEFAULT_SERVER_CPU_PCT=100

# Queue & Redis
REDIS_URL=redis://localhost:6379
QUEUE_PREFIX=wa-ptero

# Security
INTERNAL_SECRET=$(openssl rand -base64 32)
CORS_ALLOWED_ORIGIN=https://your-frontend.com
CLAIM_STATUS_REQUIRE_TOKEN=true

# Alerts (optional)
DISCORD_WEBHOOK_URL=
SLACK_WEBHOOK_URL=
ALERT_ENV=production

# Server
PORT=3000
NODE_ENV=production
EOF
    log "${RED}❗ Please edit apps/backend/.env with your actual configuration${NC}"
fi

# Bot .env
if [ ! -f "apps/bot/.env" ]; then
    log "${YELLOW}📝 Creating bot .env file...${NC}"
    cat > apps/bot/.env << EOF
# WhatsApp Bot Configuration
TARGET_GROUP_ID=your_group_id@g.us
BACKEND_WEBHOOK_URL=http://localhost:3000
INTERNAL_SECRET=$(grep INTERNAL_SECRET apps/backend/.env | cut -d'=' -f2)
RPC_PORT=3001
LOG_LEVEL=info
NODE_ENV=production
EOF
    log "${RED}❗ Please edit apps/bot/.env with your actual configuration${NC}"
fi

# Setup log directories
log "${YELLOW}📁 Setting up log directories...${NC}"
mkdir -p logs
chmod 755 logs

# Setup logrotate
log "${YELLOW}🔄 Setting up log rotation...${NC}"
cat > /etc/logrotate.d/wa-ptero-claim << EOF
$PROJECT_DIR/logs/*.log {
    daily
    rotate 30
    compress
    missingok
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Stop existing PM2 processes
log "${YELLOW}🛑 Stopping existing PM2 processes...${NC}"
pm2 delete ecosystem.config.json 2>/dev/null || true

# Start applications
log "${YELLOW}🚀 Starting applications with PM2...${NC}"
pm2 start ecosystem.config.json

# Save PM2 configuration
log "${YELLOW}💾 Saving PM2 configuration...${NC}"
pm2 save

# Setup PM2 startup script
log "${YELLOW}⚡ Setting up PM2 startup script...${NC}"
pm2 startup | grep -E '^sudo' | bash || true

# Health check
log "${YELLOW}🏥 Running health checks...${NC}"
sleep 10

# Check backend health
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    log "${GREEN}✅ Backend health check passed${NC}"
else
    log "${RED}❌ Backend health check failed${NC}"
    pm2 logs wa-ptero-backend --lines 20
    exit 1
fi

# Check bot RPC health
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    log "${GREEN}✅ Bot RPC health check passed${NC}"
else
    log "${RED}❌ Bot RPC health check failed${NC}"
    pm2 logs wa-ptero-bot --lines 20
    exit 1
fi

# Setup monitoring alerts
log "${YELLOW}📊 Setting up monitoring...${NC}"
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30

# Cleanup backup if deployment successful
if [ -d "$BACKUP_DIR" ]; then
    log "${YELLOW}🧹 Cleaning up backup...${NC}"
    rm -rf "$BACKUP_DIR"
fi

log "${GREEN}🎉 Deployment completed successfully!${NC}"
log "${GREEN}✅ Applications running:${NC}"
pm2 status

log "${YELLOW}📋 Next steps:${NC}"
log "1. Edit environment files in apps/backend/.env and apps/bot/.env"
log "2. Configure your Pterodactyl panel API key and settings"
log "3. Set up your WhatsApp group ID"
log "4. Configure your frontend domain in CORS settings"
log "5. Set up monitoring and alerting webhooks"
log ""
log "${GREEN}📊 Monitor with: pm2 monit${NC}"
log "${GREEN}🔍 View logs with: pm2 logs${NC}"
log "${GREEN}🔄 Restart with: pm2 restart ecosystem.config.json${NC}"
