#!/bin/bash
# Simple Build Script (without turbo) - WA-Ptero-Claim System
echo "🔨 Building WA-Ptero-Claim without turbo..."

# Build in dependency order
packages=(
    "packages/shared-types"
    "packages/validation-schemas" 
    "apps/backend"
    "apps/bot"
    "apps/frontend"
)

for package in "${packages[@]}"; do
    echo "📦 Building $package..."
    cd "$package"
    
    if [ -f "package.json" ]; then
        if grep -q '"build"' package.json; then
            npm run build
            if [ $? -ne 0 ]; then
                echo "❌ Failed to build $package"
                exit 1
            fi
        else
            echo "⚠️  No build script found in $package"
        fi
    else
        echo "⚠️  No package.json found in $package"
    fi
    
    cd - > /dev/null
done

echo "✅ All packages built successfully!"
