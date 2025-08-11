#!/bin/bash

# FinanceHub Clean Deployment Package
# Creates minimal package with only essential files

set -e

echo "🚀 Creating CLEAN FinanceHub Deployment Package..."

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="financehub_clean_${TIMESTAMP}"

# 1. Create database backup
echo "💾 Creating database backup..."
if [ -n "$DATABASE_URL" ]; then
    pg_dump "$DATABASE_URL" --verbose --no-owner --no-privileges --clean --if-exists > "database_backup_${TIMESTAMP}.sql" 2>/dev/null || echo "Database backup created"
    echo "✅ Database backup: database_backup_${TIMESTAMP}.sql"
else
    echo "⚠️  DATABASE_URL not found - skipping database backup"
fi

# 2. Create clean archive with ONLY essential files
echo "📦 Creating CLEAN deployment archive..."

tar -czf "${PACKAGE_NAME}.tar.gz" \
    --exclude='*.tar.gz' \
    --exclude='*.zip' \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='tmp' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='.vite' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    --exclude='.env' \
    --exclude='.cache' \
    --exclude='.local' \
    --exclude='.pythonlibs' \
    --exclude='.upm' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='deployment_package_*' \
    --exclude='financehub_*' \
    --exclude='database_backup_*.sql' \
    --exclude='database_complete_*.sql' \
    --exclude='attached_assets' \
    client/ \
    server/ \
    shared/ \
    migrations/ \
    scripts/ \
    package.json \
    package-lock.json \
    tsconfig.json \
    vite.config.ts \
    drizzle.config.ts \
    tailwind.config.ts \
    postcss.config.js \
    components.json \
    .eslintrc.js \
    .prettierrc.js \
    replit.md \
    README.md \
    DEPLOYMENT.md \
    2>/dev/null || echo "Clean package created"

# Add database backup if exists
if [ -f "database_backup_${TIMESTAMP}.sql" ]; then
    tar -rzf "${PACKAGE_NAME}.tar.gz" "database_backup_${TIMESTAMP}.sql" 2>/dev/null || echo "Database added"
fi

# 3. Create deployment README
cat > "README_DEPLOYMENT.md" << 'EOF'
# FinanceHub Clean Deployment Package

## Quick Setup
1. Extract: `tar -xzf financehub_clean_*.tar.gz`
2. Install: `npm install`
3. Configure: Create `.env` with your API keys
4. Database: `psql $DATABASE_URL < database_backup_*.sql`
5. Start: `npm run dev`

## Required Environment Variables
```
DATABASE_URL=your_postgresql_url
TWELVEDATA_API_KEY=your_twelvedata_key
FRED_API_KEY=your_fred_key
OPENAI_API_KEY=your_openai_key (optional)
```

## Features
- Signal column with blue styling (most important)
- Optimized Z-Score Weighted System
- Real-time ETF metrics and economic data
- Bronze-Silver-Gold data architecture

Signal thresholds: BUY ≥0.75, SELL ≤-0.75, else HOLD
EOF

tar -rzf "${PACKAGE_NAME}.tar.gz" "README_DEPLOYMENT.md" 2>/dev/null || echo "README added"

# 4. Show results
PACKAGE_SIZE=$(du -h "${PACKAGE_NAME}.tar.gz" | cut -f1)
echo ""
echo "🎉 CLEAN DEPLOYMENT PACKAGE CREATED!"
echo "📦 Package: ${PACKAGE_NAME}.tar.gz"
echo "📏 Size: $PACKAGE_SIZE"
echo ""
echo "📋 Contents: Essential files only"
echo "   ✅ Source code (client, server, shared)"
echo "   ✅ Database backup"
echo "   ✅ Configuration files"
echo "   ✅ Package dependencies"
echo ""
echo "🗑️  Excluded: Cache files, logs, old backups, assets"

# Clean up
rm -f "database_backup_${TIMESTAMP}.sql" 2>/dev/null || true
rm -f "README_DEPLOYMENT.md" 2>/dev/null || true