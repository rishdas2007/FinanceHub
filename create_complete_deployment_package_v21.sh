#!/bin/bash

# FinanceHub Pro v21 - Complete Deployment Package with Data Quality-First Architecture
# Includes full codebase, database backup, and comprehensive documentation

echo "🚀 Creating FinanceHub Pro v21 Complete Deployment Package..."
echo "📊 Including Data Quality-First Architecture implementation"

# Set package details
PACKAGE_NAME="financehub_pro_v21_data_quality_complete_$(date +%Y%m%d_%H%M%S)"
TEMP_DIR="/tmp/$PACKAGE_NAME"
FINAL_ARCHIVE="$PACKAGE_NAME.tar.gz"

# Create temporary directory
mkdir -p "$TEMP_DIR"

echo "📁 Copying core application files..."

# Copy main application structure
cp -r client/ "$TEMP_DIR/" 2>/dev/null || echo "⚠️ client/ not found"
cp -r server/ "$TEMP_DIR/" 2>/dev/null || echo "⚠️ server/ not found"
cp -r shared/ "$TEMP_DIR/" 2>/dev/null || echo "⚠️ shared/ not found"
cp -r tests/ "$TEMP_DIR/" 2>/dev/null || echo "⚠️ tests/ not found"

# Copy configuration files
cp package.json "$TEMP_DIR/" 2>/dev/null
cp package-lock.json "$TEMP_DIR/" 2>/dev/null
cp tsconfig.json "$TEMP_DIR/" 2>/dev/null
cp vite.config.ts "$TEMP_DIR/" 2>/dev/null
cp tailwind.config.ts "$TEMP_DIR/" 2>/dev/null
cp drizzle.config.ts "$TEMP_DIR/" 2>/dev/null
cp components.json "$TEMP_DIR/" 2>/dev/null
cp postcss.config.js "$TEMP_DIR/" 2>/dev/null
cp .eslintrc.js "$TEMP_DIR/" 2>/dev/null
cp .prettierrc.js "$TEMP_DIR/" 2>/dev/null
cp .lintstagedrc.js "$TEMP_DIR/" 2>/dev/null

# Copy environment and deployment files
cp .env.example "$TEMP_DIR/" 2>/dev/null
cp .replit "$TEMP_DIR/" 2>/dev/null
cp Dockerfile "$TEMP_DIR/" 2>/dev/null
cp docker-compose.yml "$TEMP_DIR/" 2>/dev/null
cp ecosystem.config.js "$TEMP_DIR/" 2>/dev/null

# Copy documentation
cp replit.md "$TEMP_DIR/" 2>/dev/null
cp README.md "$TEMP_DIR/" 2>/dev/null || echo "No README.md found"
cp DEPLOYMENT.md "$TEMP_DIR/" 2>/dev/null
cp IMPLEMENTATION_COMPLETE_DATA_QUALITY_FIRST.md "$TEMP_DIR/" 2>/dev/null

# Copy migration and script files
cp -r migrations/ "$TEMP_DIR/" 2>/dev/null || echo "⚠️ migrations/ not found"
cp -r scripts/ "$TEMP_DIR/" 2>/dev/null || echo "⚠️ scripts/ not found"

echo "🗄️ Creating database backup..."

# Create database backup
if command -v pg_dump >/dev/null 2>&1; then
    echo "📊 Performing PostgreSQL database backup..."
    
    # Try to create database backup
    if [ ! -z "$DATABASE_URL" ]; then
        pg_dump "$DATABASE_URL" > "$TEMP_DIR/database_complete_backup_v21.sql" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "✅ Database backup completed successfully"
        else
            echo "⚠️ Database backup failed, creating placeholder"
            echo "-- Database backup placeholder for v21" > "$TEMP_DIR/database_complete_backup_v21.sql"
            echo "-- Run your own pg_dump to create actual backup" >> "$TEMP_DIR/database_complete_backup_v21.sql"
        fi
    else
        echo "⚠️ No DATABASE_URL found, creating backup instructions"
        cat > "$TEMP_DIR/database_backup_instructions.md" << 'EOF'
# Database Backup Instructions

To create a complete database backup, run:

```bash
pg_dump $DATABASE_URL > database_complete_backup_v21.sql
```

Or using specific connection parameters:
```bash
pg_dump -h hostname -U username -d database_name > database_complete_backup_v21.sql
```

## Restore Instructions

To restore the database:
```bash
psql $DATABASE_URL < database_complete_backup_v21.sql
```
EOF
    fi
else
    echo "⚠️ pg_dump not available, creating backup instructions"
    cat > "$TEMP_DIR/database_backup_instructions.md" << 'EOF'
# Database Backup Instructions

PostgreSQL tools not available in this environment.

To create a complete database backup on your target system:

```bash
pg_dump $DATABASE_URL > database_complete_backup_v21.sql
```

To restore:
```bash
psql $DATABASE_URL < database_complete_backup_v21.sql
```
EOF
fi

echo "📋 Creating comprehensive documentation..."

# Create deployment summary
cat > "$TEMP_DIR/DEPLOYMENT_PACKAGE_v21_SUMMARY.md" << 'EOF'
# FinanceHub Pro v21 - Complete Deployment Package

## 🏗️ Data Quality-First Architecture Implementation

This package includes the complete implementation of the Data Quality-First Architecture:

### ✅ Phase 1: Data Contracts System
- **Runtime validation framework** with quality gates
- **Contract registry** for centralized validation management
- **ETF and Economic data contracts** with specific validation rules
- **Confidence scoring** and validation result reporting

### ✅ Phase 2: Cross-System Consistency
- **Data quality validation middleware** with response interception
- **Economic unit transformer** for standardized data formats
- **Universal date handling** system for crash-proof operations
- **Cross-series consistency** validation

### ✅ Phase 3: Sufficiency Gates
- **Data completeness validation** before calculations
- **Historical data sufficiency** checking with confidence scoring
- **Technical indicator availability** assessment
- **Quality-based recommendations** (PROCEED/DEGRADE/SKIP)

### ✅ Phase 4: Fail-Fast Mechanisms
- **Circuit breaker pattern** preventing cascading failures
- **Enhanced Z-Score validation** with business logic checks
- **Quality-aware processing** logic with automatic adjustments
- **Comprehensive monitoring** and health metrics

## 🔧 New API Endpoints

### Enhanced Services:
- `GET /api/etf-metrics-v2` - ETF metrics with full data quality validation
- `GET /api/data-quality/status` - Overall data quality health dashboard
- `GET /api/data-quality/validate/:symbol` - Individual ETF validation
- `GET /api/data-quality/sufficiency/:symbol` - Data sufficiency checking
- `GET /api/data-quality/circuit-breakers` - Circuit breaker health monitoring
- `POST /api/data-quality/circuit-breakers/reset` - Reset circuit breakers
- `GET /api/data-quality/contracts` - Available data contracts

## 📊 Key Architecture Files

### Core Data Quality Implementation:
- `shared/validation/data-contracts.ts` - Runtime validation framework
- `shared/validation/etf-contracts.ts` - ETF-specific validation rules
- `shared/validation/economic-contracts.ts` - Economic indicator validation
- `shared/validation/contract-registry.ts` - Centralized contract management

### Services:
- `server/services/data-quality/sufficiency-gates.ts` - Data completeness validation
- `server/services/data-quality/zscore-validator.ts` - Enhanced Z-Score validation
- `server/services/data-quality/unit-transformer.ts` - Economic data standardization
- `server/services/data-quality/circuit-breaker.ts` - Failure prevention system
- `server/services/etf-metrics-service-v2.ts` - Quality-first ETF metrics

### Middleware & Routes:
- `server/middleware/data-quality-validation.ts` - Response validation middleware
- `server/routes/data-quality.ts` - Data quality management endpoints

## 🚀 Deployment Instructions

### Prerequisites:
- Node.js 18+ and npm
- PostgreSQL database
- API keys for external services (FRED, Twelve Data, etc.)

### Quick Setup:
1. Extract the package
2. Run `npm install`
3. Configure environment variables (copy .env.example to .env)
4. Restore database: `psql $DATABASE_URL < database_complete_backup_v21.sql`
5. Run migrations: `npm run db:push`
6. Start the application: `npm run dev`

### Environment Variables Required:
```
DATABASE_URL=postgresql://...
FRED_API_KEY=your_fred_key
TWELVE_DATA_API_KEY=your_twelve_data_key
OPENAI_API_KEY=your_openai_key (optional)
SENDGRID_API_KEY=your_sendgrid_key (optional)
```

## 📈 Benefits Achieved

### 1. Proactive Quality Assurance
- Issues caught at data ingestion, not display
- Runtime validation prevents bad calculations
- Quality metadata for informed decision-making

### 2. Systematic Issue Resolution
- Root cause addressing vs symptom management
- Consistent quality standards across all data
- Automated quality degradation handling

### 3. Enhanced Reliability
- Circuit breakers prevent system-wide failures
- Sufficiency gates ensure calculation validity
- Quality-aware processing logic

### 4. Developer Experience
- Clear quality contracts for all data
- Comprehensive validation feedback
- Standardized error handling

## 🔍 Monitoring and Health Checks

The system provides comprehensive monitoring through:
- Real-time data quality dashboards
- Circuit breaker health metrics
- Validation confidence tracking
- Performance budget monitoring

## 📚 Additional Documentation

- `IMPLEMENTATION_COMPLETE_DATA_QUALITY_FIRST.md` - Detailed implementation guide
- `replit.md` - Project architecture and preferences
- `DEPLOYMENT.md` - Detailed deployment instructions

## 🎯 Production Readiness

This implementation provides:
- Enterprise-grade data validation
- Automated failure recovery
- Comprehensive monitoring
- Quality-based decision making
- Scalable architecture patterns

The Data Quality-First Architecture systematically addresses recurring data integrity issues and eliminates symptom-management patterns for reliable financial data processing.
EOF

# Create package inventory
cat > "$TEMP_DIR/PACKAGE_CONTENTS_v21.md" << 'EOF'
# Package Contents - FinanceHub Pro v21

## Application Structure
```
financehub_pro_v21/
├── client/                     # React frontend application
├── server/                     # Express.js backend API
├── shared/                     # Shared TypeScript types and utilities
├── tests/                      # Test suites
├── migrations/                 # Database migrations
├── scripts/                    # Utility scripts
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite build configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── drizzle.config.ts          # Database ORM configuration
├── docker-compose.yml         # Docker containerization
├── .env.example               # Environment variables template
└── replit.md                  # Project documentation
```

## Data Quality-First Architecture Files
```
shared/validation/
├── data-contracts.ts          # Runtime validation framework
├── etf-contracts.ts           # ETF validation rules
├── economic-contracts.ts      # Economic data validation
└── contract-registry.ts       # Contract management

server/services/data-quality/
├── sufficiency-gates.ts       # Data completeness validation
├── zscore-validator.ts        # Enhanced Z-Score validation
├── unit-transformer.ts        # Economic data standardization
└── circuit-breaker.ts         # Failure prevention system

server/middleware/
└── data-quality-validation.ts # Response validation middleware

server/routes/
└── data-quality.ts            # Quality management endpoints
```

## Database
- Complete PostgreSQL backup (if available)
- Database restore instructions
- Migration files for schema setup

## Documentation
- Implementation guide for Data Quality-First Architecture
- API endpoint documentation
- Deployment and setup instructions
- Project architecture overview
EOF

# Copy any additional important files
cp *.md "$TEMP_DIR/" 2>/dev/null || true
cp *.sql "$TEMP_DIR/" 2>/dev/null || true
cp *.sh "$TEMP_DIR/" 2>/dev/null || true

echo "📦 Creating final archive..."

# Create the final tar.gz archive
cd /tmp
tar -czf "$FINAL_ARCHIVE" "$PACKAGE_NAME/"

# Move to current directory
mv "$FINAL_ARCHIVE" "$(pwd)/"

# Cleanup
rm -rf "$TEMP_DIR"

echo "✅ Package created successfully: $FINAL_ARCHIVE"
echo ""
echo "📊 Package Summary:"
echo "   • Complete FinanceHub Pro v21 codebase"
echo "   • Data Quality-First Architecture implementation"
echo "   • Database backup (if available)"
echo "   • Comprehensive documentation"
echo "   • Deployment instructions"
echo ""
echo "🚀 Ready for deployment!"

# Show package size
if [ -f "$FINAL_ARCHIVE" ]; then
    PACKAGE_SIZE=$(du -h "$FINAL_ARCHIVE" | cut -f1)
    echo "📦 Package size: $PACKAGE_SIZE"
fi
EOF