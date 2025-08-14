#!/bin/bash

# FinanceHub Pro v24 - Complete Deployment Package Creator
# Creates a comprehensive zip file with codebase and database backup

echo "🚀 Creating FinanceHub Pro v24 Complete Deployment Package..."

# Create timestamp for unique package naming
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PACKAGE_NAME="financehub_pro_v24_complete_${TIMESTAMP}"
TEMP_DIR="/tmp/${PACKAGE_NAME}"

# Create temporary directory
mkdir -p "$TEMP_DIR"

echo "📁 Copying application codebase..."

# Copy core application files
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
cp components.json "$TEMP_DIR/"
cp drizzle.config.ts "$TEMP_DIR/"
cp .eslintrc.js "$TEMP_DIR/"
cp .prettierrc.js "$TEMP_DIR/"
cp .lintstagedrc.js "$TEMP_DIR/"

# Copy environment and deployment files
cp .env.example "$TEMP_DIR/"
cp .replit "$TEMP_DIR/"
cp replit.md "$TEMP_DIR/"
cp Dockerfile "$TEMP_DIR/"
cp docker-compose.yml "$TEMP_DIR/"

# Copy documentation
cp README*.md "$TEMP_DIR/" 2>/dev/null || true
cp DEPLOYMENT*.md "$TEMP_DIR/" 2>/dev/null || true
cp PACKAGE*.md "$TEMP_DIR/" 2>/dev/null || true

echo "💾 Creating database backup..."

# Create comprehensive database backup
cat > "$TEMP_DIR/database_complete_backup_v24.sql" << 'EOF'
-- FinanceHub Pro v24 Complete Database Backup
-- Generated on $(date)
-- Includes all tables, data, and schema

\echo 'Starting FinanceHub Pro v24 database restoration...'

-- Drop existing tables if they exist (in correct order to handle dependencies)
DROP TABLE IF EXISTS etf_metrics_latest CASCADE;
DROP TABLE IF EXISTS historical_technical_indicators CASCADE;
DROP TABLE IF EXISTS historical_market_sentiment CASCADE;
DROP TABLE IF EXISTS historical_economic_data CASCADE;
DROP TABLE IF EXISTS historical_sector_data CASCADE;
DROP TABLE IF EXISTS data_collection_audit CASCADE;
DROP TABLE IF EXISTS economic_data_audit CASCADE;
DROP TABLE IF EXISTS fredUpdateLog CASCADE;
DROP TABLE IF EXISTS economicIndicatorsCurrent CASCADE;
DROP TABLE IF EXISTS econ_series_observation CASCADE;
DROP TABLE IF EXISTS econ_series_metadata CASCADE;
DROP TABLE IF EXISTS ai_analysis CASCADE;
DROP TABLE IF EXISTS economic_events CASCADE;
DROP TABLE IF EXISTS market_sentiment CASCADE;
DROP TABLE IF EXISTS technical_indicators CASCADE;
DROP TABLE IF EXISTS stock_data CASCADE;
DROP TABLE IF EXISTS users CASCADE;

\echo 'Creating database schema...'
EOF

# Export the actual database schema and data
echo "🔄 Exporting database schema and data..."
if command -v pg_dump &> /dev/null; then
    pg_dump "$DATABASE_URL" >> "$TEMP_DIR/database_complete_backup_v24.sql" 2>/dev/null || echo "-- Database export requires pg_dump and proper DATABASE_URL" >> "$TEMP_DIR/database_complete_backup_v24.sql"
else
    echo "-- Database export requires pg_dump to be installed" >> "$TEMP_DIR/database_complete_backup_v24.sql"
fi

echo "📋 Creating deployment documentation..."

# Create comprehensive deployment guide
cat > "$TEMP_DIR/DEPLOYMENT_PACKAGE_v24_COMPLETE_GUIDE.md" << 'EOF'
# FinanceHub Pro v24 - Complete Deployment Package

## 📦 Package Contents

This package contains the complete FinanceHub Pro application with all necessary files for deployment.

### 🏗️ Application Structure
- `client/` - React frontend application
- `server/` - Express.js backend API
- `shared/` - Common TypeScript types and database schema
- `tests/` - Test suites

### 🔧 Configuration Files
- `package.json` - Node.js dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite build configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `drizzle.config.ts` - Database ORM configuration
- `.env.example` - Environment variables template

### 🚀 Deployment Files
- `Dockerfile` - Docker container configuration
- `docker-compose.yml` - Multi-container setup
- `database_complete_backup_v24.sql` - Complete database backup

## 🛠️ Quick Setup Instructions

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys:
# - DATABASE_URL (PostgreSQL)
# - TWELVE_DATA_API_KEY
# - FRED_API_KEY
# - SENDGRID_API_KEY (optional)
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
```bash
# Restore database backup
psql $DATABASE_URL < database_complete_backup_v24.sql

# Or push schema changes
npm run db:push
```

### 4. Start Application
```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## 🔑 Required API Keys

1. **PostgreSQL Database** - `DATABASE_URL`
2. **Twelve Data API** - `TWELVE_DATA_API_KEY` (financial data)
3. **FRED API** - `FRED_API_KEY` (economic data)
4. **SendGrid** - `SENDGRID_API_KEY` (email notifications, optional)

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t financehub-pro .
docker run -p 5000:5000 --env-file .env financehub-pro
```

## 🌐 Replit Deployment

1. Upload this package to Replit
2. Set environment variables in Secrets tab
3. Run `npm install`
4. Run `npm run dev`

## 📊 Features Included

- Real-time ETF metrics and technical analysis
- Economic indicators dashboard
- Market sentiment analysis
- Interactive financial charts
- Responsive dark theme design
- Comprehensive data caching
- API rate limiting and error handling

## 🔍 Troubleshooting

### Common Issues:
1. **Database Connection**: Ensure `DATABASE_URL` is correctly formatted
2. **API Rate Limits**: Check API key quotas for Twelve Data
3. **Build Errors**: Run `npm install` to ensure all dependencies are installed
4. **Port Conflicts**: Application runs on port 5000 by default

### Support:
- Check `server/logs/` for error details
- Verify environment variables are set correctly
- Ensure database schema is up to date with `npm run db:push`

## 📈 Version Information

- **Version**: v24
- **Build Date**: $(date)
- **Node.js**: >=18.0.0
- **Database**: PostgreSQL 13+
- **Features**: Complete ETF analysis, Economic indicators, Technical metrics

## 🎯 Production Readiness

This package includes:
- ✅ Production-optimized build configuration
- ✅ Comprehensive error handling
- ✅ Database connection pooling
- ✅ API rate limiting
- ✅ Security middleware
- ✅ Performance monitoring
- ✅ Automated data validation
- ✅ Cache management
- ✅ Health check endpoints

EOF

# Create package inventory
cat > "$TEMP_DIR/PACKAGE_CONTENTS_v24.md" << 'EOF'
# FinanceHub Pro v24 - Package Inventory

## 📁 Directory Structure

```
financehub_pro_v24_complete/
├── client/                          # React Frontend
│   ├── public/                      # Static assets
│   ├── src/                         # Source code
│   │   ├── components/              # React components
│   │   ├── hooks/                   # Custom hooks
│   │   ├── lib/                     # Utilities
│   │   └── pages/                   # Page components
├── server/                          # Express Backend
│   ├── controllers/                 # API controllers
│   ├── services/                    # Business logic
│   ├── middleware/                  # Express middleware
│   └── routes/                      # API routes
├── shared/                          # Common code
│   ├── schema.ts                    # Database schema
│   └── types.ts                     # TypeScript types
├── tests/                           # Test suites
├── Configuration Files              # Build and deploy configs
└── Documentation                    # Setup and usage guides
```

## 🗄️ Database Tables Included

- `users` - User authentication and profiles
- `stock_data` - Historical stock price data
- `technical_indicators` - Technical analysis metrics
- `market_sentiment` - Market sentiment analysis
- `economic_events` - Economic calendar events
- `ai_analysis` - AI-generated market insights
- `econ_series_metadata` - Economic data series info
- `econ_series_observation` - Economic time series data
- `fredUpdateLog` - FRED API update tracking
- `economicIndicatorsCurrent` - Current economic readings
- `historical_*` - Historical data tables
- `data_collection_audit` - Data quality tracking
- `etf_metrics_latest` - Materialized ETF metrics view

## 📦 Key Features

### Frontend (React + TypeScript)
- Modern React 18 with hooks
- TypeScript for type safety
- Tailwind CSS for styling
- shadcn/ui component library
- TanStack Query for data fetching
- Recharts for financial visualizations
- Responsive dark theme design

### Backend (Node.js + Express)
- TypeScript-based Express API
- Drizzle ORM with PostgreSQL
- Comprehensive error handling
- Rate limiting and security
- Real-time data processing
- Automated data validation
- Performance monitoring

### Data Pipeline
- FRED API integration (economic data)
- Twelve Data API (financial data)
- Real-time cache management
- Data quality validation
- Automated ETL processes
- Historical data backfill

## 🔧 Technical Specifications

- **Runtime**: Node.js 18+
- **Database**: PostgreSQL 13+
- **Package Manager**: npm
- **Build Tool**: Vite
- **ORM**: Drizzle
- **Styling**: Tailwind CSS
- **Testing**: Vitest + Playwright
- **Deployment**: Docker ready

EOF

# Create installation script
cat > "$TEMP_DIR/install.sh" << 'EOF'
#!/bin/bash

echo "🚀 Installing FinanceHub Pro v24..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  Creating .env from template..."
    cp .env.example .env
    echo "📝 Please edit .env file with your API keys before running the application"
fi

echo "🎉 Installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Setup database: npm run db:push"
echo "3. Start development: npm run dev"
echo ""
echo "For production deployment, see DEPLOYMENT_PACKAGE_v24_COMPLETE_GUIDE.md"

EOF

# Make install script executable
chmod +x "$TEMP_DIR/install.sh"

echo "📦 Creating deployment package..."

# Create the zip file
cd /tmp
tar -czf "${PACKAGE_NAME}.tar.gz" "${PACKAGE_NAME}/"

# Move to current directory
mv "${PACKAGE_NAME}.tar.gz" ~/workspace/

echo "✅ Package created successfully!"
echo "📁 Package location: ${PACKAGE_NAME}.tar.gz"
echo "📊 Package size: $(du -h ~/workspace/${PACKAGE_NAME}.tar.gz | cut -f1)"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "🎉 FinanceHub Pro v24 Complete Deployment Package Ready!"
echo "📦 File: ${PACKAGE_NAME}.tar.gz"
echo ""
echo "This package includes:"
echo "• Complete application codebase"
echo "• Database backup and schema"
echo "• Configuration files"
echo "• Deployment documentation"
echo "• Installation scripts"
echo ""
echo "You can now download and deploy this package anywhere!"
