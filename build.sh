#!/bin/bash

# Production Build Script for FinanceHub Pro
# This script compiles TypeScript and prepares the application for deployment

set -e  # Exit on any error

echo "🚀 Starting FinanceHub Pro production build..."

# Check Node.js version
echo "🔍 Checking Node.js version..."
NODE_VERSION=$(node -v)
NODE_MAJOR_VERSION=$(echo "$NODE_VERSION" | sed 's/v\([0-9]\+\).*/\1/')

if [ "$NODE_MAJOR_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js version $NODE_VERSION detected."
    echo "   This project requires Node.js 18 or higher."
    echo "   Please update your Node.js version and try again."
    exit 1
else
    echo "✅ Node.js $NODE_VERSION is supported (requires 18+)"
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf client/dist/

# Generate database schema
echo "📊 Generating database schema..."
npm run db:generate

echo "🔧 Building backend with ESBuild..."
npx esbuild --config=esbuild.config.js

echo "🔧 Building frontend with Vite..."
npm run build:frontend

echo "✅ Build completed successfully!"
echo ""
echo "To start the production server, use one of these methods:"
echo "1. With tsx (recommended): node start-production.js"
echo "2. With compiled JS: node dist/server/index.js"
echo "3. Direct tsx: npx tsx server/index.ts"