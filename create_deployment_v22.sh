#!/bin/bash

# FinanceHub Pro v22 - Complete Deployment Package
echo "🚀 Creating FinanceHub Pro v22 Deployment Package..."

PACKAGE_NAME="financehub_pro_v22_$(date +%Y%m%d_%H%M%S)"
echo "📦 Package: $PACKAGE_NAME"

# Create package directory
mkdir -p "$PACKAGE_NAME"

echo "📁 Copying files..."

# Copy main application directories
cp -r client "$PACKAGE_NAME/" 2>/dev/null
cp -r server "$PACKAGE_NAME/" 2>/dev/null
cp -r shared "$PACKAGE_NAME/" 2>/dev/null
cp -r tests "$PACKAGE_NAME/" 2>/dev/null
cp -r migrations "$PACKAGE_NAME/" 2>/dev/null
cp -r scripts "$PACKAGE_NAME/" 2>/dev/null

# Copy configuration files
cp package*.json "$PACKAGE_NAME/" 2>/dev/null
cp *.config.* "$PACKAGE_NAME/" 2>/dev/null
cp *.json "$PACKAGE_NAME/" 2>/dev/null
cp *.js "$PACKAGE_NAME/" 2>/dev/null
cp *.ts "$PACKAGE_NAME/" 2>/dev/null
cp .env.example "$PACKAGE_NAME/" 2>/dev/null
cp .replit "$PACKAGE_NAME/" 2>/dev/null
cp Dockerfile* "$PACKAGE_NAME/" 2>/dev/null
cp docker-compose.yml "$PACKAGE_NAME/" 2>/dev/null

# Copy documentation
cp *.md "$PACKAGE_NAME/" 2>/dev/null
cp *.sql "$PACKAGE_NAME/" 2>/dev/null

echo "📊 Creating deployment summary..."

# Create deployment summary
cat > "$PACKAGE_NAME/DEPLOYMENT_INSTRUCTIONS.md" << 'EOF'
# FinanceHub Pro v22 - Deployment Instructions

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Setup database:**
   ```bash
   npm run db:push
   ```

4. **Start application:**
   ```bash
   npm run dev
   ```

## Features Included

- Data Quality-First Architecture with runtime validation
- Enhanced ETF metrics with quality gates
- Circuit breaker patterns for reliability
- Comprehensive economic data processing
- Real-time financial dashboard

## API Endpoints

- `/api/etf-metrics-v2` - Quality-validated ETF metrics
- `/api/data-quality/status` - Data quality monitoring
- `/api/data-quality/validate/:symbol` - Individual validation

## Environment Variables

```
DATABASE_URL=postgresql://...
FRED_API_KEY=your_fred_key
TWELVE_DATA_API_KEY=your_twelve_data_key
OPENAI_API_KEY=your_openai_key (optional)
```

Visit http://localhost:5000 after starting the application.
EOF

# Create the archive
echo "🗜️ Creating archive..."
tar -czf "${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME"

# Cleanup temporary directory
rm -rf "$PACKAGE_NAME"

echo "✅ Package created: ${PACKAGE_NAME}.tar.gz"
ls -lh "${PACKAGE_NAME}.tar.gz"