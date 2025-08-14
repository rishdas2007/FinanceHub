#!/bin/bash

# FinanceHub Pro v25 Simple Package Creator
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PACKAGE_NAME="financehub_pro_v25_complete_${TIMESTAMP}"

echo "🚀 Creating FinanceHub Pro v25 Complete Package..."

# Create the package in current directory
mkdir -p "$PACKAGE_NAME"

# Copy core files
echo "📁 Copying application files..."
cp -r client "$PACKAGE_NAME/"
cp -r server "$PACKAGE_NAME/"
cp -r shared "$PACKAGE_NAME/"
cp -r tests "$PACKAGE_NAME/" 2>/dev/null || echo "No tests directory"

# Copy config files
cp package*.json "$PACKAGE_NAME/"
cp *.config.* "$PACKAGE_NAME/" 2>/dev/null || true
cp tsconfig.json "$PACKAGE_NAME/" 2>/dev/null || true
cp components.json "$PACKAGE_NAME/" 2>/dev/null || true
cp .eslintrc.js "$PACKAGE_NAME/" 2>/dev/null || true
cp .prettierrc.js "$PACKAGE_NAME/" 2>/dev/null || true
cp .env.example "$PACKAGE_NAME/" 2>/dev/null || true
cp .replit "$PACKAGE_NAME/" 2>/dev/null || true

# Copy Docker files
cp Dockerfile* "$PACKAGE_NAME/" 2>/dev/null || true
cp docker-compose.yml "$PACKAGE_NAME/" 2>/dev/null || true
cp ecosystem.config.js "$PACKAGE_NAME/" 2>/dev/null || true

# Copy documentation
cp *.md "$PACKAGE_NAME/" 2>/dev/null || true

# Create database backup
echo "🗄️ Creating database backup..."
if [ ! -z "$DATABASE_URL" ]; then
    pg_dump "$DATABASE_URL" > "$PACKAGE_NAME/database_backup_v25.sql" 2>/dev/null || echo "Database backup failed - check DATABASE_URL"
else
    echo "DATABASE_URL not set - skipping database backup"
fi

# Create package info
cat > "$PACKAGE_NAME/PACKAGE_INFO_v25.md" << 'EOF'
# FinanceHub Pro v25 Complete Package

## Version Information
- **Version**: v25
- **Created**: August 14, 2025
- **Changes**: Removed 12M Trend column, optimized performance

## Contents
- Complete source code (client/, server/, shared/)
- Database backup (if available)
- Configuration files
- Documentation
- Docker deployment files

## Installation
1. Extract package
2. Run `npm install`
3. Setup database: `psql your_db < database_backup_v25.sql`
4. Configure .env file
5. Run `npm run dev`

## Performance
- Dashboard loads in <1 second
- No more 12M sparkline overhead
- Optimized API calls

## Support
See replit.md for full documentation
EOF

# Create tarball
echo "📦 Creating archive..."
tar -czf "${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME"

# Cleanup
rm -rf "$PACKAGE_NAME"

# Show results
SIZE=$(du -h "${PACKAGE_NAME}.tar.gz" | cut -f1)
echo "✅ Package created: ${PACKAGE_NAME}.tar.gz"
echo "📏 Size: $SIZE"
echo "📂 Ready for download!"