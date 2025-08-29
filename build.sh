#!/bin/bash

# Production Build Script for FinanceHub Pro
# This script compiles TypeScript and prepares the application for deployment

set -e  # Exit on any error

echo "🚀 Starting FinanceHub Pro production build..."

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