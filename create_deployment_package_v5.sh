#!/bin/bash

# FinanceHub Pro Complete Deployment Package v5 Creator
# Updated: August 7, 2025
# Includes: Z-Score Data Fix, Performance Optimizations, Database Schema Updates

echo "🚀 Creating FinanceHub Pro Complete Deployment Package v5..."
echo "📅 Package Date: $(date)"
echo ""

# Create temporary directory for package assembly
TEMP_DIR="financehub_pro_deployment_v5"
PACKAGE_NAME="FinanceHub_Pro_Complete_Deployment_Package_v5.tar.gz"

# Clean previous package if exists
rm -rf "$TEMP_DIR" 2>/dev/null
rm -f "$PACKAGE_NAME" 2>/dev/null

# Create deployment directory structure
mkdir -p "$TEMP_DIR"
echo "✅ Created deployment directory structure"

# Copy core application files
echo "📂 Copying application files..."
cp -r client "$TEMP_DIR/" 2>/dev/null || echo "⚠️  Client directory not found"
cp -r server "$TEMP_DIR/" 2>/dev/null || echo "⚠️  Server directory not found"
cp -r shared "$TEMP_DIR/" 2>/dev/null || echo "⚠️  Shared directory not found"
cp -r migrations "$TEMP_DIR/" 2>/dev/null || echo "⚠️  Migrations directory not found"
cp -r scripts "$TEMP_DIR/" 2>/dev/null || echo "⚠️  Scripts directory not found"
cp -r tests "$TEMP_DIR/" 2>/dev/null || echo "⚠️  Tests directory not found"

# Copy configuration files
echo "⚙️  Copying configuration files..."
cp package.json "$TEMP_DIR/" 2>/dev/null
cp package-lock.json "$TEMP_DIR/" 2>/dev/null
cp tsconfig.json "$TEMP_DIR/" 2>/dev/null
cp vite.config.ts "$TEMP_DIR/" 2>/dev/null
cp vitest.config.ts "$TEMP_DIR/" 2>/dev/null
cp vitest.integration.config.ts "$TEMP_DIR/" 2>/dev/null
cp tailwind.config.ts "$TEMP_DIR/" 2>/dev/null
cp postcss.config.js "$TEMP_DIR/" 2>/dev/null
cp drizzle.config.ts "$TEMP_DIR/" 2>/dev/null
cp components.json "$TEMP_DIR/" 2>/dev/null
cp .eslintrc.js "$TEMP_DIR/" 2>/dev/null
cp .prettierrc.js "$TEMP_DIR/" 2>/dev/null
cp .lintstagedrc.js "$TEMP_DIR/" 2>/dev/null
cp .env.example "$TEMP_DIR/" 2>/dev/null
cp .replit "$TEMP_DIR/" 2>/dev/null
cp .gitignore "$TEMP_DIR/" 2>/dev/null

# Copy Python configuration
cp pyproject.toml "$TEMP_DIR/" 2>/dev/null || echo "⚠️  Python config not found"
cp uv.lock "$TEMP_DIR/" 2>/dev/null || echo "⚠️  Python lock file not found"

# Copy Docker and deployment files
echo "🐳 Copying deployment files..."
cp Dockerfile "$TEMP_DIR/" 2>/dev/null
cp Dockerfile.optimized "$TEMP_DIR/" 2>/dev/null
cp docker-compose.yml "$TEMP_DIR/" 2>/dev/null
cp ecosystem.config.js "$TEMP_DIR/" 2>/dev/null

# Copy documentation
echo "📚 Copying documentation..."
cp replit.md "$TEMP_DIR/" 2>/dev/null
cp DEPLOYMENT.md "$TEMP_DIR/" 2>/dev/null
cp DEPLOYMENT_PACKAGE_README.md "$TEMP_DIR/" 2>/dev/null
cp DOWNLOAD_INSTRUCTIONS.md "$TEMP_DIR/" 2>/dev/null
cp PACKAGE_INVENTORY.md "$TEMP_DIR/" 2>/dev/null
cp PACKAGE_INVENTORY_v3.md "$TEMP_DIR/" 2>/dev/null
cp PACKAGE_INVENTORY_v4.md "$TEMP_DIR/" 2>/dev/null
cp PACKAGE_VERIFICATION.md "$TEMP_DIR/" 2>/dev/null
cp TRAFFIC_SCALABILITY_ANALYSIS.md "$TEMP_DIR/" 2>/dev/null

# Copy previous deployment summaries
cp DEPLOYMENT_PACKAGE_v2.0.0_FINAL_SUMMARY.md "$TEMP_DIR/" 2>/dev/null
cp DEPLOYMENT_PACKAGE_v3.0.0_FINAL_SUMMARY.md "$TEMP_DIR/" 2>/dev/null
cp DEPLOYMENT_PACKAGE_v4_SUMMARY.md "$TEMP_DIR/" 2>/dev/null
cp DEPLOYMENT_PACKAGE_v5_SUMMARY.md "$TEMP_DIR/" 2>/dev/null

# Export current database schema and data
echo "🗄️  Exporting database..."
if command -v pg_dump >/dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
    echo "📊 Creating database backup..."
    pg_dump "$DATABASE_URL" > "$TEMP_DIR/database_backup_v5.sql" 2>/dev/null || echo "⚠️  Database export failed - will include schema only"
else
    echo "⚠️  pg_dump not available or DATABASE_URL not set"
fi

# Copy existing database backup if export failed
cp database_backup_v5.sql "$TEMP_DIR/" 2>/dev/null || cp database_backup_v4.sql "$TEMP_DIR/database_backup_v5.sql" 2>/dev/null || echo "⚠️  No database backup available"

# Copy monitoring and scripts
cp monitor_backfill.sh "$TEMP_DIR/" 2>/dev/null
cp lighthouserc.json "$TEMP_DIR/" 2>/dev/null

# Copy test files
cp playwright.config.ts "$TEMP_DIR/" 2>/dev/null
cp test-enhanced-reasoning.js "$TEMP_DIR/" 2>/dev/null
cp test-import.js "$TEMP_DIR/" 2>/dev/null

echo ""
echo "📋 Creating deployment summary..."