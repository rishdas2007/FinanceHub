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
