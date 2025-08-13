#!/bin/bash

# FinanceHub Pro - Simple Deployment Package v18
# Creates comprehensive zip with codebase and database
# Date: August 13, 2025

set -e

PACKAGE_NAME="financehub_pro_v18_$(date +%Y%m%d_%H%M%S)"
TEMP_DIR="/tmp/$PACKAGE_NAME"

echo "🚀 Creating FinanceHub Pro Simple Deployment Package v18..."
echo "📦 Package: $PACKAGE_NAME"

# Create temporary directory
mkdir -p "$TEMP_DIR"

echo "📁 Copying application files..."

# Copy all essential files and directories
cp -r client "$TEMP_DIR/" 2>/dev/null || true
cp -r server "$TEMP_DIR/" 2>/dev/null || true 
cp -r shared "$TEMP_DIR/" 2>/dev/null || true
cp -r tests "$TEMP_DIR/" 2>/dev/null || true

# Copy configuration files
cp package.json "$TEMP_DIR/" 2>/dev/null || true
cp package-lock.json "$TEMP_DIR/" 2>/dev/null || true
cp tsconfig.json "$TEMP_DIR/" 2>/dev/null || true
cp vite.config.ts "$TEMP_DIR/" 2>/dev/null || true
cp tailwind.config.ts "$TEMP_DIR/" 2>/dev/null || true
cp postcss.config.js "$TEMP_DIR/" 2>/dev/null || true
cp drizzle.config.ts "$TEMP_DIR/" 2>/dev/null || true
cp components.json "$TEMP_DIR/" 2>/dev/null || true
cp .env.example "$TEMP_DIR/" 2>/dev/null || true
cp .eslintrc.js "$TEMP_DIR/" 2>/dev/null || true
cp .prettierrc.js "$TEMP_DIR/" 2>/dev/null || true
cp .gitignore "$TEMP_DIR/" 2>/dev/null || true
cp .replit "$TEMP_DIR/" 2>/dev/null || true
cp replit.md "$TEMP_DIR/" 2>/dev/null || true

# Copy all markdown files
cp *.md "$TEMP_DIR/" 2>/dev/null || true

echo "💾 Creating database backup..."

# Create simple database backup
mkdir -p "$TEMP_DIR/database"
pg_dump "$DATABASE_URL" --verbose --clean --if-exists --format=plain --no-owner --no-privileges > "$TEMP_DIR/database/full_backup_v18.sql" 2>/dev/null || echo "Database backup skipped"

echo "📋 Creating deployment documentation..."

# Create deployment README
cat > "$TEMP_DIR/DEPLOYMENT_GUIDE.md" << 'EOL'
# FinanceHub Pro - Deployment Package v18

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup (if backup exists)
```bash
# Create database
createdb financehub_pro

# Restore backup
psql financehub_pro < database/full_backup_v18.sql
```

### 4. Start Application
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Required Environment Variables
```
DATABASE_URL=postgresql://user:password@host:port/database
TWELVE_DATA_API_KEY=your_key_here
FRED_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here (optional)
```

## Architecture
- Frontend: React 18 + TypeScript + Tailwind CSS
- Backend: Express.js + TypeScript + Drizzle ORM
- Database: PostgreSQL
- Real-time: WebSocket integration
- Caching: Multi-tier caching system

## Support
Refer to replit.md for detailed architecture and troubleshooting.
EOL

echo "🗜️ Creating package..."

# Create tar.gz package
cd /tmp
tar -czf "$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME"

# Move to workspace
mv "$PACKAGE_NAME.tar.gz" /home/runner/workspace/

# Cleanup
rm -rf "$TEMP_DIR"

# Calculate size
PACKAGE_SIZE=$(du -h "/home/runner/workspace/$PACKAGE_NAME.tar.gz" | cut -f1)

echo "✅ Package created successfully!"
echo "📁 Location: /home/runner/workspace/$PACKAGE_NAME.tar.gz"
echo "📊 Package size: $PACKAGE_SIZE"

# Success message
cat << EOF

🎉 FinanceHub Pro Deployment Package v18 Ready!

📦 Package: $PACKAGE_NAME.tar.gz
📁 Contains:
   ✓ Complete React + Express application
   ✓ All TypeScript source code
   ✓ Configuration files and dependencies
   ✓ Database backup (if available)
   ✓ Deployment documentation

📥 Download Instructions:
   1. Click on the file in your workspace file manager
   2. Download the .tar.gz file
   3. Extract and follow DEPLOYMENT_GUIDE.md

🚀 Ready for deployment!

EOF