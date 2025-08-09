#!/bin/bash

# FinanceHub Pro - Comprehensive Deployment Package Creator
# Creates complete downloadable package with code, data, and dependencies

echo "🚀 Creating FinanceHub Pro Complete Package v6.0.0"
echo "=================================================="

# Package metadata
PACKAGE_NAME="FinanceHub_Complete_Package_v6.0.0_$(date +%Y%m%d_%H%M%S)"
TEMP_DIR="tmp/package_build"
FINAL_PACKAGE="$PACKAGE_NAME.tar.gz"

# Create build directory
echo "📁 Setting up package structure..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR/$PACKAGE_NAME"
cd "$TEMP_DIR/$PACKAGE_NAME"

# Core application files
echo "📦 Copying core application files..."
cp -r ../../../client ./
cp -r ../../../server ./
cp -r ../../../shared ./
cp -r ../../../tests ./
cp -r ../../../migrations ./
cp -r ../../../scripts ./

# Configuration files
echo "⚙️ Adding configuration files..."
cp ../../../package.json ./
cp ../../../package-lock.json ./
cp ../../../tsconfig.json ./
cp ../../../vite.config.ts ./
cp ../../../tailwind.config.ts ./
cp ../../../postcss.config.js ./
cp ../../../drizzle.config.ts ./
cp ../../../components.json ./
cp ../../../.eslintrc.js ./
cp ../../../.prettierrc.js ./
cp ../../../.lintstagedrc.js ./
cp ../../../.env.example ./
cp ../../../.gitignore ./
cp ../../../.replit ./
cp ../../../pyproject.toml ./
cp ../../../uv.lock ./

# Documentation
echo "📚 Adding documentation..."
cp ../../../replit.md ./
cp ../../../DEPLOYMENT.md ./
cp ../../../README.md ./ 2>/dev/null || echo "# FinanceHub Pro Complete Package" > ./README.md

# Docker configuration
echo "🐳 Adding Docker configuration..."
cp ../../../Dockerfile ./
cp ../../../Dockerfile.optimized ./
cp ../../../docker-compose.yml ./
cp ../../../ecosystem.config.js ./

# Testing configuration
echo "🧪 Adding testing configuration..."
cp ../../../playwright.config.ts ./
cp ../../../vitest.config.ts ./
cp ../../../vitest.integration.config.ts ./
cp ../../../lighthouserc.json ./

# Database backup
echo "💾 Creating complete database backup..."
cd ../../../
npm run db:backup > /dev/null 2>&1 || echo "Note: Database backup may require manual setup"

# Copy latest database backup
if [ -f "database_backup_v5.sql" ]; then
    cp database_backup_v5.sql "$TEMP_DIR/$PACKAGE_NAME/"
elif [ -f "database_backup.sql" ]; then
    cp database_backup.sql "$TEMP_DIR/$PACKAGE_NAME/"
fi

cd "$TEMP_DIR/$PACKAGE_NAME"

# Create comprehensive README
echo "📋 Creating comprehensive setup documentation..."
cat > README_COMPLETE_SETUP.md << 'EOF'
# FinanceHub Pro - Complete Deployment Package v6.0.0

## Package Contents
This package contains everything needed to deploy FinanceHub Pro:

### Application Code
- `client/` - React frontend with TypeScript
- `server/` - Express.js backend API
- `shared/` - Common types and database schema
- `scripts/` - Utility scripts and data processors

### Database & Data
- Complete PostgreSQL database schema
- Enhanced historical economic data (2017-2025)
- Sample data and migrations
- Data processing scripts

### Configuration
- Docker configuration for containerized deployment
- Environment configuration templates
- Build and deployment scripts
- Testing configuration

### Dependencies
- Complete package.json with all dependencies
- Lock files for reproducible builds
- Python dependencies for data processing

## Quick Start

### 1. Prerequisites
```bash
# Install Node.js 20+
# Install PostgreSQL 14+
# Install Docker (optional)
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Configure your environment variables:
# - DATABASE_URL
# - FRED_API_KEY
# - TWELVE_DATA_API_KEY
# - SENDGRID_API_KEY
```

### 3. Installation
```bash
# Install dependencies
npm install

# Set up database
npm run db:push

# Import sample data (optional)
npm run db:import
```

### 4. Development
```bash
# Start development server
npm run dev

# Application will be available at http://localhost:5000
```

### 5. Production Deployment
```bash
# Using Docker
docker-compose up -d

# Or build for production
npm run build
npm start
```

## Features Included
- Real-time financial data integration
- Advanced technical analysis
- Economic indicators dashboard
- Portfolio management
- AI-powered market insights
- Historical data analysis (8+ years)
- Performance optimization
- Comprehensive caching system

## Support & Documentation
- See DEPLOYMENT.md for detailed deployment instructions
- Check replit.md for architectural decisions
- Review tests/ directory for usage examples

Package created: $(date)
Version: 6.0.0
Total Size: Enhanced with 2,461+ historical data points
EOF

# Create deployment verification script
cat > verify_deployment.js << 'EOF'
// FinanceHub Pro Deployment Verification
const fs = require('fs');
const path = require('path');

console.log('🔍 FinanceHub Pro Deployment Verification');
console.log('==========================================');

// Check required files
const requiredFiles = [
    'package.json',
    'server/index.ts',
    'client/src/App.tsx',
    'shared/schema.ts',
    '.env.example'
];

let allFilesPresent = true;
requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - MISSING`);
        allFilesPresent = false;
    }
});

// Check package.json
try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log(`\n📦 Package: ${pkg.name} v${pkg.version}`);
    console.log(`📝 Description: ${pkg.description || 'No description'}`);
    console.log(`🔧 Dependencies: ${Object.keys(pkg.dependencies || {}).length}`);
    console.log(`🛠️  Dev Dependencies: ${Object.keys(pkg.devDependencies || {}).length}`);
} catch (error) {
    console.log('❌ Error reading package.json');
}

// Final status
console.log('\n' + '='.repeat(40));
if (allFilesPresent) {
    console.log('✅ Deployment package is complete and ready!');
} else {
    console.log('⚠️  Some files are missing. Please check the package.');
}
EOF

# Make scripts executable
chmod +x verify_deployment.js 2>/dev/null || true

echo "📊 Calculating package size..."
cd ..

# Create final compressed package
echo "🗜️ Creating compressed package..."
tar -czf "../$FINAL_PACKAGE" "$PACKAGE_NAME/"

# Get package info
PACKAGE_SIZE=$(ls -lh "../$FINAL_PACKAGE" | awk '{print $5}')
FILE_COUNT=$(find "$PACKAGE_NAME" -type f | wc -l)

cd ../..

echo ""
echo "✅ Package Creation Complete!"
echo "============================"
echo "📦 Package: $FINAL_PACKAGE"
echo "📏 Size: $PACKAGE_SIZE"
echo "📁 Files: $FILE_COUNT"
echo "📍 Location: $(pwd)/$FINAL_PACKAGE"
echo ""
echo "🚀 Ready for download and deployment!"
echo "💡 Run 'node verify_deployment.js' in extracted folder to verify"