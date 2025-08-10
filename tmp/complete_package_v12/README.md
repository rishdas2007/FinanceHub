# FinanceHub Pro - Complete Application Package

## Quick Start

### Using Docker (Recommended)
```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your API keys

# 2. Start application
docker-compose up -d

# 3. Access application
# http://localhost:5000
```

### Manual Setup
```bash
# 1. Install dependencies
npm install

# 2. Set up database
npm run db:push

# 3. Restore data (optional)
psql $DATABASE_URL < database_complete_backup_v12.sql

# 4. Start development server
npm run dev
```

## Required Environment Variables

Create `.env` file with:
```env
DATABASE_URL=postgresql://username:password@host:port/database
FRED_API_KEY=your_fred_api_key
TWELVE_DATA_API_KEY=your_twelve_data_key
SENDGRID_API_KEY=your_sendgrid_key (optional)
OPENAI_API_KEY=your_openai_key (optional)
NODE_ENV=production
PORT=5000
```

## Key Features Included

- Real-time financial data dashboard
- ETF metrics with statistical validation
- Economic indicators with FRED integration
- Stock history charts with proper date handling
- Z-score technical analysis
- Responsive UI with dark theme
- API rate limiting and caching
- Complete database backup with historical data

## Technical Specifications

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Charts**: Recharts with proper date axis handling
- **Caching**: Dual-tier system (120s + 300s TTL)
- **Performance**: Sub-300ms API responses

See `DEPLOYMENT_PACKAGE_v12.0.0_COMPLETE_SUMMARY.md` for complete documentation.