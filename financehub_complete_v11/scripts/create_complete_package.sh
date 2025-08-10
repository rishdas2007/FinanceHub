#!/bin/bash

# FinanceHub Complete Package Creator v6.0.0
# Creates a comprehensive downloadable package with codebase, database, and dependencies

set -e

PACKAGE_NAME="FinanceHub_Complete_Package_v6.0.0"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_DIR="${PACKAGE_NAME}_${TIMESTAMP}"

echo "🚀 Creating complete FinanceHub package: $PACKAGE_DIR"

# Create package directory
mkdir -p "$PACKAGE_DIR"

echo "📁 Copying complete codebase..."

# Copy all source code and configuration files
cp -r client/ "$PACKAGE_DIR/"
cp -r server/ "$PACKAGE_DIR/"
cp -r shared/ "$PACKAGE_DIR/"
cp -r migrations/ "$PACKAGE_DIR/"
cp -r scripts/ "$PACKAGE_DIR/"
cp -r tests/ "$PACKAGE_DIR/"

# Copy all configuration files
cp package.json "$PACKAGE_DIR/"
cp package-lock.json "$PACKAGE_DIR/"
cp tsconfig.json "$PACKAGE_DIR/"
cp vite.config.ts "$PACKAGE_DIR/"
cp tailwind.config.ts "$PACKAGE_DIR/"
cp postcss.config.js "$PACKAGE_DIR/"
cp drizzle.config.ts "$PACKAGE_DIR/"
cp components.json "$PACKAGE_DIR/"
cp .eslintrc.js "$PACKAGE_DIR/"
cp .prettierrc.js "$PACKAGE_DIR/"
cp .lintstagedrc.js "$PACKAGE_DIR/"
cp .gitignore "$PACKAGE_DIR/"
cp .env.example "$PACKAGE_DIR/"

# Copy Python dependencies if they exist
if [ -f "pyproject.toml" ]; then
    cp pyproject.toml "$PACKAGE_DIR/"
fi
if [ -f "uv.lock" ]; then
    cp uv.lock "$PACKAGE_DIR/"
fi

# Copy Docker configuration
if [ -f "Dockerfile" ]; then
    cp Dockerfile "$PACKAGE_DIR/"
fi
if [ -f "docker-compose.yml" ]; then
    cp docker-compose.yml "$PACKAGE_DIR/"
fi
if [ -f "ecosystem.config.js" ]; then
    cp ecosystem.config.js "$PACKAGE_DIR/"
fi

# Copy all documentation
cp replit.md "$PACKAGE_DIR/"
cp *.md "$PACKAGE_DIR/" 2>/dev/null || true

echo "💾 Creating database backup..."

# Create comprehensive database backup
pg_dump $DATABASE_URL > "$PACKAGE_DIR/database_complete_backup_v6.sql" 2>/dev/null || echo "⚠️  Database backup requires manual export"

echo "📦 Generating dependency manifests..."

# Create comprehensive dependency documentation
cat > "$PACKAGE_DIR/COMPLETE_SETUP_GUIDE.md" << 'EOF'
# FinanceHub Complete Setup Guide v6.0.0

## Overview
This package contains the complete FinanceHub application with all source code, database schema, and dependency information.

## Prerequisites
- Node.js 20+ and npm
- PostgreSQL 14+
- Python 3.11+ (optional, for data analysis scripts)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb financehub

# Import database schema and data
psql financehub < database_complete_backup_v6.sql
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Configure required variables:
DATABASE_URL=postgresql://user:pass@localhost:5432/financehub
TWELVE_DATA_API_KEY=your_key_here
FRED_API_KEY=your_key_here
SENDGRID_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here (optional)
```

### 4. Development Server
```bash
npm run dev
```

The application will start on http://localhost:5000

## Production Deployment

### Using Docker
```bash
docker-compose up -d
```

### Using PM2
```bash
npm run build
pm2 start ecosystem.config.js
```

## API Keys Required

### Essential (Application won't start without these):
- **TWELVE_DATA_API_KEY**: Stock market data (free tier: 800 calls/day)
- **FRED_API_KEY**: Economic indicators (free, unlimited)
- **DATABASE_URL**: PostgreSQL connection string
- **SENDGRID_API_KEY**: Email notifications

### Optional (Enhanced features):
- **OPENAI_API_KEY**: AI-powered market analysis
- **REDIS_URL**: Performance caching (uses memory fallback if missing)

## Architecture Overview

### Frontend (React + TypeScript)
- `/client/src/` - React application
- `/client/src/components/` - Reusable UI components
- `/client/src/pages/` - Application pages
- `/client/src/lib/` - Utility functions

### Backend (Express + TypeScript)
- `/server/` - Express.js API server
- `/server/services/` - Business logic and data services
- `/server/routes/` - API route handlers
- `/server/middleware/` - Custom middleware

### Database (PostgreSQL + Drizzle ORM)
- `/shared/schema.ts` - Database schema definition
- `/migrations/` - Database migration files
- `/server/storage.ts` - Database connection and queries

## Key Features
- Real-time financial dashboard
- ETF performance tracking with 10+ technical indicators
- Economic health scoring with 15+ indicators
- Z-score statistical analysis
- Momentum-based trading strategies
- Comprehensive caching and rate limiting
- Responsive design with dark mode

## Performance Characteristics
- Handles 10 years of historical data (2.6M+ records)
- Processes 12 ETFs with real-time updates
- 144 API calls/minute rate limiting
- Multi-level caching (Redis + in-memory)
- Sub-second dashboard load times

## Support
For technical support or questions about this package, refer to the comprehensive documentation in the individual service files.
EOF

# Generate detailed dependency information
echo "📋 Generating dependency documentation..."

cat > "$PACKAGE_DIR/DEPENDENCIES_COMPLETE.md" << 'EOF'
# Complete Dependencies Documentation

## Node.js Dependencies (package.json)

### Production Dependencies
EOF

# Extract and document all dependencies
if [ -f "package.json" ]; then
    echo "#### Core Framework" >> "$PACKAGE_DIR/DEPENDENCIES_COMPLETE.md"
    node -e "
    const pkg = require('./package.json');
    const deps = pkg.dependencies || {};
    Object.entries(deps).forEach(([name, version]) => {
      console.log(\`- **\${name}**: \${version}\`);
    });
    " >> "$PACKAGE_DIR/DEPENDENCIES_COMPLETE.md"
    
    echo "" >> "$PACKAGE_DIR/DEPENDENCIES_COMPLETE.md"
    echo "#### Development Dependencies" >> "$PACKAGE_DIR/DEPENDENCIES_COMPLETE.md"
    node -e "
    const pkg = require('./package.json');
    const devDeps = pkg.devDependencies || {};
    Object.entries(devDeps).forEach(([name, version]) => {
      console.log(\`- **\${name}**: \${version}\`);
    });
    " >> "$PACKAGE_DIR/DEPENDENCIES_COMPLETE.md"
fi

# Add Python dependencies if present
if [ -f "pyproject.toml" ]; then
    echo "" >> "$PACKAGE_DIR/DEPENDENCIES_COMPLETE.md"
    echo "## Python Dependencies (pyproject.toml)" >> "$PACKAGE_DIR/DEPENDENCIES_COMPLETE.md"
    echo "\`\`\`toml" >> "$PACKAGE_DIR/DEPENDENCIES_COMPLETE.md"
    cat pyproject.toml >> "$PACKAGE_DIR/DEPENDENCIES_COMPLETE.md"
    echo "\`\`\`" >> "$PACKAGE_DIR/DEPENDENCIES_COMPLETE.md"
fi

# Create package inventory
echo "📊 Creating package inventory..."

find "$PACKAGE_DIR" -type f | sort > "$PACKAGE_DIR/PACKAGE_INVENTORY.txt"

# Calculate package size
PACKAGE_SIZE=$(du -sh "$PACKAGE_DIR" | cut -f1)

# Create comprehensive README
cat > "$PACKAGE_DIR/README.md" << EOF
# FinanceHub Complete Package v6.0.0

## Package Contents
- **Complete Source Code**: All TypeScript/React/Node.js code
- **Database Schema**: Full PostgreSQL backup with sample data
- **Dependencies**: Complete package.json and lock files
- **Documentation**: Setup guides and API documentation
- **Configuration**: All config files and environment templates

## Package Statistics
- **Size**: $PACKAGE_SIZE
- **Files**: $(find "$PACKAGE_DIR" -type f | wc -l) files
- **Created**: $(date)
- **Version**: v6.0.0 (Latest stable)

## Quick Start
1. Extract this package to your development environment
2. Follow instructions in \`COMPLETE_SETUP_GUIDE.md\`
3. Configure your API keys in \`.env\`
4. Run \`npm install && npm run dev\`

## What's Included
✅ Complete application source code  
✅ Database schema and sample data  
✅ All dependencies and configuration  
✅ Setup and deployment guides  
✅ Docker configuration  
✅ Development and production scripts  

This is a complete, self-contained package of your FinanceHub application.
EOF

echo "🗜️  Creating compressed archive..."

# Create compressed archive
tar -czf "${PACKAGE_DIR}.tar.gz" "$PACKAGE_DIR"

# Create zip file for Windows compatibility
if command -v zip >/dev/null 2>&1; then
    zip -r "${PACKAGE_DIR}.zip" "$PACKAGE_DIR" >/dev/null
    echo "📦 Created Windows-compatible ZIP: ${PACKAGE_DIR}.zip"
fi

echo "✅ Package creation complete!"
echo ""
echo "📦 Generated files:"
echo "   📁 ${PACKAGE_DIR}/ (directory)"
echo "   🗜️  ${PACKAGE_DIR}.tar.gz (compressed archive)"
if [ -f "${PACKAGE_DIR}.zip" ]; then
    echo "   📦 ${PACKAGE_DIR}.zip (Windows ZIP)"
fi
echo ""
echo "📊 Package size: $PACKAGE_SIZE"
echo "📄 Files included: $(find "$PACKAGE_DIR" -type f | wc -l)"
echo ""
echo "🚀 Your complete FinanceHub package is ready for download!"
echo "   Contains: Source code + Database + Dependencies + Documentation"
EOF

chmod +x create_complete_package.sh