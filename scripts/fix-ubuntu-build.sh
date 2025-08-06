#!/bin/bash
# Fix Ubuntu Build Issues - WA-Ptero-Claim System
echo "🔧 Fixing Ubuntu build issues..."

# 1. Remove problematic node_modules and lock files
echo "📦 Cleaning existing dependencies..."
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
rm -rf .pnpm-store
rm -f package-lock.json

# 2. Update package manager to latest version
echo "🔄 Updating pnpm..."
npm install -g pnpm@latest

# 3. Clear pnpm cache
echo "🧹 Clearing pnpm cache..."
pnpm store prune

# 4. Install dependencies with frozen lockfile
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile --no-optional

# 5. Build packages in correct order
echo "🔨 Building packages in dependency order..."

# Build shared packages first
echo "📦 Building shared-types..."
cd packages/shared-types
pnpm build
cd ../..

echo "📦 Building validation-schemas..."
cd packages/validation-schemas
pnpm build
cd ../..

# Build applications
echo "📦 Building backend..."
cd apps/backend
pnpm build
cd ../..

echo "📦 Building bot..."
cd apps/bot
pnpm build
cd ../..

echo "📦 Building frontend..."
cd apps/frontend
pnpm build
cd ../..

echo "✅ Build completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure your .env files"
echo "2. Start the application with: pnpm start"
