#!/bin/bash

# FinanceHub Pro Complete Deployment Package Creator v2.0.0
echo "🚀 Creating FinanceHub Pro Complete Deployment Package v2.0.0..."

# Create deployment directory
DEPLOY_DIR="FinanceHub_Pro_Complete_Deployment_Package_v2"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# Copy core application files
echo "📁 Copying application files..."
cp -r client "$DEPLOY_DIR/"
cp -r server "$DEPLOY_DIR/"
cp -r shared "$DEPLOY_DIR/"
cp -r migrations "$DEPLOY_DIR/"
cp -r scripts "$DEPLOY_DIR/"
cp -r tests "$DEPLOY_DIR/"

# Copy configuration files
echo "⚙️ Copying configuration files..."
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/"
cp tsconfig.json "$DEPLOY_DIR/"
cp vite.config.ts "$DEPLOY_DIR/"
cp vitest.config.ts "$DEPLOY_DIR/"
cp vitest.integration.config.ts "$DEPLOY_DIR/"
cp tailwind.config.ts "$DEPLOY_DIR/"
cp postcss.config.js "$DEPLOY_DIR/"
cp components.json "$DEPLOY_DIR/"
cp drizzle.config.ts "$DEPLOY_DIR/"
cp .eslintrc.js "$DEPLOY_DIR/"
cp .prettierrc.js "$DEPLOY_DIR/"
cp .lintstagedrc.js "$DEPLOY_DIR/"
cp .env.example "$DEPLOY_DIR/"

# Copy Docker and deployment files
echo "🐳 Copying deployment configurations..."
cp Dockerfile "$DEPLOY_DIR/" 2>/dev/null || true
cp Dockerfile.optimized "$DEPLOY_DIR/" 2>/dev/null || true
cp docker-compose.yml "$DEPLOY_DIR/" 2>/dev/null || true
cp ecosystem.config.js "$DEPLOY_DIR/" 2>/dev/null || true
cp .replit "$DEPLOY_DIR/" 2>/dev/null || true

# Copy Python dependencies
echo "🐍 Copying Python configuration..."
cp pyproject.toml "$DEPLOY_DIR/" 2>/dev/null || true
cp uv.lock "$DEPLOY_DIR/" 2>/dev/null || true

# Copy documentation
echo "📚 Copying documentation..."
cp *.md "$DEPLOY_DIR/" 2>/dev/null || true

# Copy database backup
echo "🗄️ Including database backup..."
cp database_backup.sql "$DEPLOY_DIR/"

# Create requirements.txt for Python dependencies
echo "📦 Creating Python requirements file..."
cat > "$DEPLOY_DIR/requirements.txt" << EOF
numpy>=1.24.0
pandas>=2.0.0
psycopg2-binary>=2.9.0
requests>=2.31.0
python-dotenv>=1.0.0
sqlalchemy>=2.0.0
EOF

# Create comprehensive README for deployment
echo "📖 Creating deployment README..."
cat > "$DEPLOY_DIR/README_DEPLOYMENT.md" << EOF
# FinanceHub Pro - Complete Deployment Package v2.0.0

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Python 3.11+
- 4GB RAM minimum
- 20GB storage recommended

### 1. Database Setup
\`\`\`bash
# Create PostgreSQL database
createdb financehub_pro

# Import complete database with all data
psql financehub_pro < database_backup.sql
\`\`\`

### 2. Environment Configuration
\`\`\`bash
cp .env.example .env
# Edit .env with your API keys:
# - TWELVE_DATA_API_KEY=your_key_here
# - FRED_API_KEY=your_key_here  
# - OPENAI_API_KEY=your_key_here
# - SENDGRID_API_KEY=your_key_here
# - DATABASE_URL=your_postgresql_url
\`\`\`

### 3. Install Dependencies
\`\`\`bash
# Node.js dependencies
npm install

# Python dependencies (if needed)
pip install -r requirements.txt
\`\`\`

### 4. Database Migration (if needed)
\`\`\`bash
npm run db:push
\`\`\`

### 5. Start Application
\`\`\`bash
npm run dev
\`\`\`

Application will be available at: http://localhost:5000

## 🔧 Key Features
- ✅ Live Z-Score Technical Analysis (Fixed hardcoded fallbacks)
- ✅ Real-time Market Data (Twelve Data WebSocket)
- ✅ Economic Indicators (FRED API)
- ✅ AI Market Analysis (OpenAI GPT-4)
- ✅ Email Notifications (SendGrid)
- ✅ 18+ months Historical Data included
- ✅ Complete Database Export included

## 📊 Database Contents
- **technical_indicators**: 1.8MB - All ETF technical analysis
- **market_sentiment**: 720KB - Market sentiment data
- **economic_indicators_history**: 456KB - Economic data history
- **vix_data**: 432KB - VIX volatility data
- **zscore_technical_indicators**: 280KB - Z-score calculations
- **Total**: ~19,000 records across all tables

## 🔐 Security Features
- Rate limiting middleware
- CORS protection  
- Input validation (Zod)
- Structured logging (Pino)
- Health check endpoints

## 📈 Recent Updates (v2.0.0)
- Fixed all hardcoded Z-score fallback values (SPY: 0.102 → live calculations)
- Enhanced data integrity validation
- Complete database export with all historical data
- Improved technical analysis accuracy
- Updated security middleware

## 🆘 Troubleshooting
1. **Database connection issues**: Check DATABASE_URL in .env
2. **API rate limits**: Verify API keys are valid
3. **Missing data**: Run database migration: \`npm run db:push\`
4. **Port conflicts**: Change port in server/index.ts if needed

## 📞 Support
Refer to included documentation files for detailed configuration and troubleshooting.
EOF

# Create installation script
echo "📜 Creating installation script..."
cat > "$DEPLOY_DIR/install.sh" << 'EOF'
#!/bin/bash
echo "🚀 Installing FinanceHub Pro..."

# Check requirements
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "❌ PostgreSQL is required but not installed."; exit 1; }

echo "✅ Requirements check passed"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Python dependencies if pip is available
if command -v pip >/dev/null 2>&1; then
    echo "🐍 Installing Python dependencies..."
    pip install -r requirements.txt
fi

# Setup environment file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚙️ Created .env file - please edit with your API keys"
fi

echo "✅ Installation complete!"
echo "📝 Next steps:"
echo "1. Create PostgreSQL database: createdb financehub_pro"  
echo "2. Import database: psql financehub_pro < database_backup.sql"
echo "3. Edit .env file with your API keys"
echo "4. Run: npm run dev"
EOF

chmod +x "$DEPLOY_DIR/install.sh"

# Create comprehensive package info
echo "📋 Creating package information..."
cat > "$DEPLOY_DIR/PACKAGE_INFO.txt" << EOF
FinanceHub Pro Complete Deployment Package v2.0.0
Generated: $(date)
Package Size: $(du -sh "$DEPLOY_DIR" | cut -f1)
Files Included: $(find "$DEPLOY_DIR" -type f | wc -l)

Database Export: 19,137 lines (Complete schema + data)
Total Database Size: ~4.2MB compressed

Key Fixes in v2.0.0:
- Eliminated hardcoded Z-score fallbacks (SPY: 0.102 → live calculations)  
- Fixed simplified-sector-analysis.ts getVerifiedZScore calls
- Enhanced ETF Metrics Service live calculation integration
- Complete database export with all historical data
- Updated all documentation and deployment guides

Application Features:
- Real-time market data integration
- Advanced technical analysis with live Z-scores
- Economic indicators dashboard  
- AI-powered market insights
- Email notification system
- Comprehensive historical data (18+ months)
- Enterprise-grade security middleware

System Requirements:
- Node.js 18+, PostgreSQL 14+, Python 3.11+
- 4GB RAM minimum, 20GB storage recommended
EOF

# Create the final tar archive
echo "📦 Creating deployment archive..."
tar -czf "FinanceHub_Pro_Complete_Deployment_Package_v2.tar.gz" "$DEPLOY_DIR"

# Cleanup temporary directory
rm -rf "$DEPLOY_DIR"

echo "✅ Deployment package created successfully!"
echo "📦 Package: FinanceHub_Pro_Complete_Deployment_Package_v2.tar.gz"
echo "📏 Size: $(du -sh FinanceHub_Pro_Complete_Deployment_Package_v2.tar.gz | cut -f1)"
echo "🚀 Ready for deployment!"
EOF