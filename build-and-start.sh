#!/bin/bash

# Complete Build and Start Script for FinanceHub Pro
# This script handles both compilation and startup for production deployment

set -e

echo "🚀 FinanceHub Pro - Complete Production Deploy"

# Build the application
echo "📦 Building application..."
./build.sh

echo ""
echo "🚀 Starting production server..."

# Start the server
./start.sh