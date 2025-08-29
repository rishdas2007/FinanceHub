#!/bin/bash

# Production Start Script for FinanceHub Pro
# Alternative to package.json start script that works in production

echo "🚀 Starting FinanceHub Pro in production mode..."

# Set environment variables
export NODE_ENV=production

# Check if we have a compiled version
if [ -f "dist/server/index.js" ]; then
    echo "📦 Found compiled JavaScript, using compiled version..."
    node dist/server/index.js
elif command -v tsx &> /dev/null; then
    echo "📦 Using tsx to run TypeScript directly..."
    npx tsx server/index.ts
elif [ -f "start-production.js" ]; then
    echo "📦 Using start-production.js script..."
    node start-production.js
else
    echo "❌ No suitable execution method found!"
    echo "Please run ./build.sh first or ensure tsx is available"
    exit 1
fi