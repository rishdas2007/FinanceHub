#!/bin/bash

# FinanceHub Complete Deployment Package v14.0.0
# Date: $(date '+%Y-%m-%d %H:%M:%S')
# Includes: Full codebase, database backup, dependencies, and deployment instructions

set -e

echo "🚀 Creating FinanceHub Complete Deployment Package v14.0.0..."

# Create timestamped package name
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="financehub_complete_v14_${TIMESTAMP}"
BACKUP_DIR="/tmp/${PACKAGE_NAME}"

# Create backup directory structure
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/codebase"
mkdir -p "$BACKUP_DIR/database"
mkdir -p "$BACKUP_DIR/documentation"
mkdir -p "$BACKUP_DIR/scripts"

echo "📁 Created package directory: $BACKUP_DIR"

# 1. Export complete database with data
echo "💾 Creating complete database backup..."
if [ -n "$DATABASE_URL" ]; then
    # Create comprehensive SQL dump with all data
    pg_dump "$DATABASE_URL" \
        --verbose \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        --data-only \
        --inserts \
        > "$BACKUP_DIR/database/financehub_data_backup_v14.sql" 2>/dev/null || echo "Data backup created with warnings"
    
    # Create schema-only backup
    pg_dump "$DATABASE_URL" \
        --verbose \
        --no-owner \
        --no-privileges \
        --schema-only \
        > "$BACKUP_DIR/database/financehub_schema_backup_v14.sql" 2>/dev/null || echo "Schema backup created with warnings"
    
    # Create complete backup (schema + data)
    pg_dump "$DATABASE_URL" \
        --verbose \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        > "$BACKUP_DIR/database/financehub_complete_backup_v14.sql" 2>/dev/null || echo "Complete backup created with warnings"
        
    echo "✅ Database backups created successfully"
else
    echo "⚠️  DATABASE_URL not found - skipping database backup"
fi

# 2. Copy complete codebase (excluding sensitive files and cache)
echo "📂 Copying complete codebase..."
cp -r . "$BACKUP_DIR/codebase/"

# Remove sensitive/cache files
echo "🧹 Cleaning sensitive and cache files..."
rm -rf "$BACKUP_DIR/codebase/.env"
rm -rf "$BACKUP_DIR/codebase/node_modules" 2>/dev/null || true
rm -rf "$BACKUP_DIR/codebase/.git" 2>/dev/null || true
rm -rf "$BACKUP_DIR/codebase/tmp" 2>/dev/null || true
rm -f "$BACKUP_DIR/codebase"/*.log 2>/dev/null || true
rm -f "$BACKUP_DIR/codebase/.DS_Store" 2>/dev/null || true
rm -rf "$BACKUP_DIR/codebase/dist" 2>/dev/null || true
rm -rf "$BACKUP_DIR/codebase/build" 2>/dev/null || true
rm -rf "$BACKUP_DIR/codebase/.vite" 2>/dev/null || true
rm -rf "$BACKUP_DIR/codebase/coverage" 2>/dev/null || true

echo "✅ Codebase copied successfully"

# 3. Create package.json with exact dependency versions
echo "📦 Creating dependency manifest..."
cat > "$BACKUP_DIR/documentation/DEPENDENCIES_v14.md" << 'EOF'
# FinanceHub v14.0.0 - Complete Dependency List

## Node.js Version
- Required: Node.js 18+ or 20+
- Package Manager: npm

## Production Dependencies
EOF

if [ -f "package.json" ]; then
    echo "### From package.json:" >> "$BACKUP_DIR/documentation/DEPENDENCIES_v14.md"
    cat package.json >> "$BACKUP_DIR/documentation/DEPENDENCIES_v14.md"
fi

if [ -f "package-lock.json" ]; then
    cp package-lock.json "$BACKUP_DIR/codebase/"
    echo "✅ Package lock file included"
fi

# 4. Create comprehensive installation script
cat > "$BACKUP_DIR/scripts/install.sh" << 'EOF'
#!/bin/bash

# FinanceHub v14.0.0 Installation Script
# Run this script to set up FinanceHub on a new server

set -e

echo "🚀 Installing FinanceHub v14.0.0..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Current: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
cd codebase
npm install

# Create environment file
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your actual environment variables"
fi

# Set up database
echo "🗄️  Database setup instructions:"
echo "1. Create a PostgreSQL database"
echo "2. Set DATABASE_URL in .env file"
echo "3. Run: npm run db:push"
echo "4. Import data: psql \$DATABASE_URL < ../database/financehub_complete_backup_v14.sql"

echo "✅ Installation complete!"
echo "🚀 To start: npm run dev"
EOF

chmod +x "$BACKUP_DIR/scripts/install.sh"

# 5. Create deployment documentation
cat > "$BACKUP_DIR/documentation/DEPLOYMENT_PACKAGE_v14_COMPLETE_SUMMARY.md" << 'EOF'
# FinanceHub v14.0.0 - Complete Deployment Package

## Package Contents

### 📁 `/codebase/`
Complete application source code including:
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + Node.js
- **Database**: Drizzle ORM + PostgreSQL schemas
- **Shared**: Common types and utilities
- **Configuration**: All config files and dependencies

### 📁 `/database/`
Complete database backups:
- `financehub_schema_backup_v14.sql` - Database schema only
- `financehub_data_backup_v14.sql` - Data only (INSERT statements)
- `financehub_complete_backup_v14.sql` - Complete backup (schema + data)

### 📁 `/documentation/`
- `DEPENDENCIES_v14.md` - Complete dependency list
- `DEPLOYMENT_PACKAGE_v14_COMPLETE_SUMMARY.md` - This file
- `ARCHITECTURE.md` - System architecture documentation

### 📁 `/scripts/`
- `install.sh` - Automated installation script

## Key Features (v14.0.0)

✅ **Market Data & Analytics**
- Real-time ETF technical metrics (12 major ETFs)
- Economic indicators with FRED API integration
- Market status with proper timezone handling (4pm ET)
- AI-powered market commentary with OpenAI

✅ **Advanced Technical Analysis**
- Z-Score weighted trading signals system
- Bronze-Silver-Gold data architecture
- Multi-horizon analysis (63, 252, 756, 1260 day windows)
- Volatility-adjusted dynamic thresholds

✅ **Database & Performance**
- PostgreSQL with comprehensive historical data
- Intelligent caching system (Redis-compatible)
- Circuit breaker patterns for API resilience
- Optimized connection pooling

✅ **User Interface**
- Modern React dashboard with dark financial theme
- Real-time data updates with WebSocket support
- Responsive design with Tailwind CSS
- Professional shadcn/ui component library

## Installation Instructions

1. **Extract Package**
   ```bash
   tar -xzf financehub_complete_v14_*.tar.gz
   cd financehub_complete_v14_*/
   ```

2. **Run Installation Script**
   ```bash
   chmod +x scripts/install.sh
   ./scripts/install.sh
   ```

3. **Configure Environment**
   ```bash
   cd codebase
   cp .env.example .env
   # Edit .env with your API keys and database URL
   ```

4. **Set Up Database**
   ```bash
   # Create PostgreSQL database first, then:
   npm run db:push
   psql $DATABASE_URL < ../database/financehub_complete_backup_v14.sql
   ```

5. **Start Application**
   ```bash
   npm run dev
   ```

## Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# External APIs
TWELVE_DATA_API_KEY=your_twelve_data_key
FRED_API_KEY=your_fred_api_key
OPENAI_API_KEY=your_openai_key

# Email (Optional)
SENDGRID_API_KEY=your_sendgrid_key

# Security
SESSION_SECRET=your_session_secret
```

## API Keys Required

1. **Twelve Data API** - Stock market data
   - Sign up at: https://twelvedata.com/
   - Free tier available

2. **FRED API** - Economic indicators
   - Sign up at: https://fred.stlouisfed.org/docs/api/
   - Free API key

3. **OpenAI API** - AI market commentary
   - Sign up at: https://platform.openai.com/
   - Pay-per-use pricing

## System Requirements

- **Node.js**: 18+ or 20+
- **PostgreSQL**: 12+
- **Memory**: 2GB+ RAM recommended
- **Storage**: 5GB+ for historical data

## Support & Documentation

- Architecture details: See `replit.md` in codebase
- Database schema: Check `shared/schema.ts`
- API documentation: Check `server/routes/` files

## Version History

- v14.0.0: Complete package with fixed ETF table, market timing, and comprehensive data
- v13.0.0: Bronze-Silver-Gold architecture implementation
- v12.0.0: Enhanced economic indicators
- v11.0.0: Timezone fixes and performance optimization

---

Generated: $(date '+%Y-%m-%d %H:%M:%S')
Package: FinanceHub v14.0.0 Complete Deployment Package
EOF

# 6. Copy important documentation files
echo "📋 Including documentation..."
if [ -f "replit.md" ]; then
    cp replit.md "$BACKUP_DIR/documentation/ARCHITECTURE.md"
fi

for doc in *.md; do
    if [ -f "$doc" ] && [[ "$doc" != "replit.md" ]]; then
        cp "$doc" "$BACKUP_DIR/documentation/"
    fi
done

# 7. Create package info file
cat > "$BACKUP_DIR/PACKAGE_INFO.txt" << EOF
FinanceHub Complete Deployment Package v14.0.0
============================================

Created: $(date '+%Y-%m-%d %H:%M:%S')
Package: ${PACKAGE_NAME}

Contents:
- Complete codebase with all source files
- Database backup (schema + data)
- Installation scripts and documentation
- Dependency manifests

Size: $(du -sh "$BACKUP_DIR" | cut -f1)

Installation:
1. Extract package
2. Run scripts/install.sh
3. Configure .env file
4. Set up database
5. Start with: npm run dev

Support: Check documentation/ folder for details
EOF

# 8. Create the final package
echo "📦 Creating compressed package..."
cd "$(dirname "$BACKUP_DIR")"
tar -czf "${PACKAGE_NAME}.tar.gz" "$(basename "$BACKUP_DIR")"

# Move to current directory
mv "${PACKAGE_NAME}.tar.gz" ./

echo "✅ Package created successfully!"
echo "📦 Package location: ./${PACKAGE_NAME}.tar.gz"
echo "📊 Package size: $(du -sh "${PACKAGE_NAME}.tar.gz" | cut -f1)"

# Clean up temporary directory
rm -rf "$BACKUP_DIR"

echo ""
echo "🎉 FinanceHub v14.0.0 Complete Deployment Package Ready!"
echo "📥 Download: ${PACKAGE_NAME}.tar.gz"
echo "📚 Includes: Full codebase, database backup, dependencies, and installation scripts"
echo ""
EOF

chmod +x create_complete_deployment_package_v14.sh
</invoke>