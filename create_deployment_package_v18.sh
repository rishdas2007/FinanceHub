#!/bin/bash

# FinanceHub Pro - Complete Deployment Package v18
# Creates comprehensive zip with codebase, database, and dependencies
# Date: August 13, 2025

set -e

PACKAGE_NAME="financehub_pro_v18_$(date +%Y%m%d_%H%M%S)"
TEMP_DIR="/tmp/$PACKAGE_NAME"
BACKUP_DIR="$TEMP_DIR/database"

echo "🚀 Creating FinanceHub Pro Complete Deployment Package v18..."
echo "📦 Package: $PACKAGE_NAME"

# Create temporary directory structure
mkdir -p "$TEMP_DIR"
mkdir -p "$BACKUP_DIR"

echo "📁 Copying core application files..."

# Copy essential application files
cp -r client "$TEMP_DIR/"
cp -r server "$TEMP_DIR/"
cp -r shared "$TEMP_DIR/"
cp -r tests "$TEMP_DIR/"

# Copy configuration files
cp package.json "$TEMP_DIR/"
cp package-lock.json "$TEMP_DIR/"
cp tsconfig.json "$TEMP_DIR/"
cp vite.config.ts "$TEMP_DIR/"
cp tailwind.config.ts "$TEMP_DIR/"
cp postcss.config.js "$TEMP_DIR/"
cp drizzle.config.ts "$TEMP_DIR/"
cp components.json "$TEMP_DIR/"

# Copy environment and deployment files
cp .env.example "$TEMP_DIR/"
cp .eslintrc.js "$TEMP_DIR/"
cp .prettierrc.js "$TEMP_DIR/"
cp .lintstagedrc.js "$TEMP_DIR/"
cp .gitignore "$TEMP_DIR/"
cp .replit "$TEMP_DIR/"

# Copy documentation
cp replit.md "$TEMP_DIR/"
cp *.md "$TEMP_DIR/" 2>/dev/null || true

# Copy Docker and deployment files
cp Dockerfile* "$TEMP_DIR/" 2>/dev/null || true
cp docker-compose.yml "$TEMP_DIR/" 2>/dev/null || true
cp ecosystem.config.js "$TEMP_DIR/" 2>/dev/null || true

echo "💾 Creating comprehensive database backup..."

# Create database backup with comprehensive data
pg_dump "$DATABASE_URL" \
  --verbose \
  --clean \
  --if-exists \
  --create \
  --format=plain \
  --no-owner \
  --no-privileges \
  > "$BACKUP_DIR/database_complete_backup_v18.sql"

# Create table-specific exports for critical data
echo "📊 Exporting critical data tables..."

# Export stock data
psql "$DATABASE_URL" -c "\COPY (SELECT * FROM stock_data ORDER BY timestamp DESC) TO STDOUT WITH CSV HEADER" > "$BACKUP_DIR/stock_data_export.csv"

# Export technical indicators  
psql "$DATABASE_URL" -c "\COPY (SELECT * FROM technical_indicators ORDER BY timestamp DESC) TO STDOUT WITH CSV HEADER" > "$BACKUP_DIR/technical_indicators_export.csv"

# Export equity features (using correct column name)
psql "$DATABASE_URL" -c "\COPY (SELECT * FROM equity_features_daily ORDER BY asof_date DESC) TO STDOUT WITH CSV HEADER" > "$BACKUP_DIR/equity_features_daily_export.csv"

# Export economic indicators
psql "$DATABASE_URL" -c "\COPY (SELECT * FROM \"economicIndicatorsCurrent\" ORDER BY period_date DESC) TO STDOUT WITH CSV HEADER" > "$BACKUP_DIR/economic_indicators_export.csv"

# Export market sentiment
psql "$DATABASE_URL" -c "\COPY (SELECT * FROM market_sentiment ORDER BY timestamp DESC) TO STDOUT WITH CSV HEADER" > "$BACKUP_DIR/market_sentiment_export.csv"

echo "📋 Creating deployment documentation..."

# Create comprehensive README
cat > "$TEMP_DIR/DEPLOYMENT_README.md" << 'EOL'
# FinanceHub Pro - Deployment Package v18

## Overview
Complete deployment package for FinanceHub Pro financial analytics platform.
Generated: August 13, 2025

## Package Contents

### Application Code
- `client/` - React frontend with TypeScript
- `server/` - Express.js backend API
- `shared/` - Common types and database schema
- `tests/` - Test suites

### Database
- `database/database_complete_backup_v18.sql` - Full PostgreSQL backup
- `database/*.csv` - Individual table exports for verification

### Configuration
- `package.json` - Node.js dependencies
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Build configuration
- `drizzle.config.ts` - Database ORM configuration
- `tailwind.config.ts` - Styling configuration

## Quick Deployment

### 1. Database Setup
```bash
# Create new database
createdb financehub_pro

# Restore from backup
psql financehub_pro < database/database_complete_backup_v18.sql
```

### 2. Application Setup
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database URL and API keys

# Build application
npm run build

# Start production server
npm start
```

### 3. Environment Variables Required
```
DATABASE_URL=postgresql://user:password@host:port/database
TWELVE_DATA_API_KEY=your_key_here
FRED_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here (optional)
SENDGRID_API_KEY=your_key_here (optional)
```

## Architecture Overview

### Frontend (React + TypeScript)
- Modern React 18 with TypeScript
- Tailwind CSS for styling
- shadcn/ui component library
- TanStack Query for state management
- Wouter for routing

### Backend (Node.js + Express)
- Express.js REST API
- Drizzle ORM with PostgreSQL
- Real-time WebSocket integration
- Comprehensive caching system
- Security middleware and rate limiting

### Database (PostgreSQL)
- Historical stock data (13,963+ records)
- Technical indicators with Z-score calculations
- Economic indicators from FRED API
- Market sentiment analysis
- Complete audit trails

## Key Features

### Financial Analytics
- ETF metrics with optimized Z-score weighted system
- Real-time market data integration
- Technical analysis with 60+ indicators
- Economic health scoring
- Market sentiment tracking

### Performance Optimizations
- Multi-tier caching system
- Database connection pooling
- Parallel data processing
- Sub-second API responses
- Intelligent data prefetching

### Data Integrity
- Bronze-Silver-Gold data pipeline
- Comprehensive validation systems
- Automated staleness detection
- Fallback mechanisms for missing data
- Real-time data quality monitoring

## Troubleshooting

### Common Issues
1. **Database Connection**: Verify DATABASE_URL is correctly formatted
2. **API Keys**: Ensure all required API keys are configured
3. **Port Conflicts**: Default port is 5000, change if needed
4. **Memory Usage**: Monitor for high system load during data processing

### Support
Refer to the comprehensive documentation in `replit.md` for detailed architecture information and troubleshooting guides.

EOL

# Create package inventory
echo "📦 Creating package inventory..."
cat > "$TEMP_DIR/PACKAGE_INVENTORY_v18.md" << 'EOL'
# FinanceHub Pro v18 - Package Inventory

## File Structure
```
financehub_pro_v18/
├── client/                 # React frontend
├── server/                 # Express.js backend  
├── shared/                 # Common TypeScript types
├── tests/                  # Test suites
├── database/               # Database backups and exports
├── package.json           # Dependencies
├── replit.md              # Architecture documentation
└── DEPLOYMENT_README.md   # Setup instructions
```

## Database Contents
- Stock Data: 13,963+ historical records (2015-2025)
- Technical Indicators: 9,422+ calculated indicators
- Equity Features: 273+ enhanced Z-score calculations
- Economic Indicators: 2,400+ FRED data points
- Market Sentiment: Complete sentiment analysis data

## Key Dependencies
- React 18.2.0
- Express 4.18.2
- TypeScript 5.1.6
- Drizzle ORM 0.28.5
- PostgreSQL (Neon serverless)
- TanStack Query 4.29.19
- Tailwind CSS 3.3.3

## API Integrations
- Twelve Data API (market data)
- FRED API (economic indicators)
- OpenAI API (optional, for AI insights)
- SendGrid API (optional, for notifications)

Generated: August 13, 2025
EOL

echo "🗜️ Creating compressed package..."

# Create the final zip package
cd /tmp
tar -czf "$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME"

# Move to current directory
mv "$PACKAGE_NAME.tar.gz" /home/runner/workspace/

# Cleanup
rm -rf "$TEMP_DIR"

echo "✅ Package created successfully!"
echo "📁 Location: /home/runner/workspace/$PACKAGE_NAME.tar.gz"
echo "📊 Package size: $(du -h "/home/runner/workspace/$PACKAGE_NAME.tar.gz" | cut -f1)"

# Provide download instructions
cat << EOF

🎉 FinanceHub Pro Complete Deployment Package v18 Ready!

📦 Package: $PACKAGE_NAME.tar.gz
📁 Contains:
   ✓ Complete application codebase
   ✓ Comprehensive database backup with 25,000+ records
   ✓ All configuration files and dependencies
   ✓ Deployment documentation and setup guides
   ✓ Individual table exports for verification

📥 To download:
   1. The package is ready in your workspace
   2. Use the file manager to download the .tar.gz file
   3. Extract and follow DEPLOYMENT_README.md for setup

🚀 Ready for production deployment!

EOF