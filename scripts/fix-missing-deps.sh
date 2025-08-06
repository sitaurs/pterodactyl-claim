#!/bin/bash
# Quick fix for missing @hapi/boom dependency
echo "🔧 Adding missing @hapi/boom dependency..."

cd apps/bot
echo "📦 Installing @hapi/boom..."
pnpm add "@hapi/boom@^10.0.1"

echo "📦 Installing @types/hapi__boom..."
pnpm add "@types/hapi__boom@^9.0.4" --save-dev

cd ../..

echo "🔨 Trying to build bot again..."
cd apps/bot
pnpm build

if [ $? -eq 0 ]; then
    echo "✅ Bot build successful!"
    cd ../..
    echo "🔨 Running full project build..."
    pnpm build
else
    echo "❌ Bot build still failing. Check TypeScript errors."
fi

echo "✅ Fix completed!"
