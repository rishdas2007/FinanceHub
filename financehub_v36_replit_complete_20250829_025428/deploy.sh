#!/bin/bash

# FinanceHub Pro Deployment Script
echo "🚀 Deploying FinanceHub Pro..."

# Set production environment
export NODE_ENV=production

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Run database migrations if needed
echo "🗄️ Checking database..."
npm run db:push

# Start the application
echo "🚀 Starting FinanceHub Pro on port ${PORT:-5000}..."
npm start