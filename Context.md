# FinanceHub Pro - Master Context Document

*Last Updated: 2025-09-01*  
*Version: 36.0.0-replit (Replit Optimized)*

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Key Features](#key-features)
4. [Design Philosophy & Goals](#design-philosophy--goals)
5. [Technical Stack Details](#technical-stack-details)
6. [Performance Benchmarks](#performance-benchmarks)
7. [Recent Changes & Implementations](#recent-changes--implementations)
8. [Data Model Summary](#data-model-summary)
9. [API Documentation](#api-documentation)
10. [Operational Context](#operational-context)
11. [Known Issues / TODOs](#known-issues--todos)

---

## Project Overview

**Name**: FinanceHub Pro  
**Purpose**: Comprehensive financial dashboard application providing real-time market data, technical analysis, AI-powered market insights, and financial tracking with enterprise-grade data integrity and cost-effectiveness.  
**Intended Audience**: Individual investors, financial professionals, portfolio managers, and anyone requiring authentic government-sourced economic data.  
**Vision**: To be a robust and reliable financial analysis tool leveraging authentic government and market data while minimizing reliance on expensive AI for core data processing.

---

## Architecture

### Stack Outline
- **Frontend**: React 18 with TypeScript, Vite build system
- **Backend**: Express.js with Node.js runtime, TypeScript with ES modules
- **Database**: PostgreSQL with Neon serverless driver, Drizzle ORM
- **Real-time**: WebSocket integration for live market data
- **Caching**: Three-tier intelligent caching (Memory + Redis + Materialized Views)

### Monorepo Organization

```
financehub-pro/
├── client/                    # React frontend application
│   ├── src/
│   │   ├── components/        # 95+ reusable UI components
│   │   │   ├── ui/           # shadcn/ui component library
│   │   │   ├── market/       # Market-specific components
│   │   │   ├── movers/       # ETF/Economic movers components
│   │   │   └── v2/           # Next-generation components
│   │   ├── pages/            # Route-based page components
│   │   ├── lib/              # Query client and utilities
│   │   ├── hooks/            # Custom React hooks
│   │   ├── context/          # React context providers
│   │   ├── adapters/         # Data adaptation layer
│   │   └── types/            # Frontend TypeScript types
├── server/                    # Express.js backend API
│   ├── routes/               # 58+ API endpoint definitions
│   ├── services/             # 175+ business logic services
│   ├── middleware/           # 15+ Express middleware components
│   ├── repositories/         # Data access layer
│   ├── container/            # Dependency injection (Inversify)
│   ├── cache/                # Caching implementations
│   └── public/               # Static assets for production
├── shared/                    # Common code between client/server
│   ├── schema.ts             # Database schema (Drizzle ORM)
│   ├── types/                # Shared TypeScript interfaces
│   ├── validation/           # Data validation schemas (Zod)
│   └── dates.ts              # Universal date handling utilities
├── migrations/                # Database migration files
├── scripts/                   # 40+ utility and deployment scripts
├── codebase-agents/          # Automated code quality and deployment safety
├── tests/                    # Test suites and configurations
└── attached_assets/          # Implementation guides and analysis documents
```

### Main Entry Points
- **Frontend**: `client/src/main.tsx`
- **Backend**: `server/index.ts`
- **Database Schema**: `shared/schema.ts`
- **Development**: `npm run dev` (concurrent frontend/backend)
- **Production**: `npm start` (NODE_ENV=production)

---

## Key Features

### Real-time Market Data
- Live ETF technical metrics for 12 major sector ETFs
- 30-second frontend refresh intervals
- WebSocket streaming for price updates
- Market session status tracking (pre-market, regular, after-hours)

### Technical Analysis
- **Indicators**: RSI, Bollinger Bands, Moving Averages
- **Z-Score Calculations**: Statistical normalization for all indicators
- **Trading Signals**: BUY (<-1.5), HOLD, SELL (>1.5) based on Z-scores
- **Signal Formula**: Average of RSI Z-score and Bollinger %B Z-score only (MACD removed in v35)

### AI-Powered Insights
- OpenAI GPT-4o integration for market commentary
- Financial mood analysis
- Narrative-driven market synthesis
- Minimized for cost optimization (used only when necessary)

### Economic Indicators
- 112-year historical coverage from FRED API
- GDP, employment, inflation, market indicators
- Multi-dimensional economic health scoring
- Daily automated updates with intelligent scheduling

### Feature-to-File Mapping

| Feature | Primary Files |
|---------|--------------|
| ETF Metrics | `server/services/etf/ETFLiveDataService.ts`, `client/src/components/ETFTechnicalMetricsTable.tsx` |
| Economic Health | `server/services/economic/EconomicDataService.ts`, `client/src/components/EconomicHealthDashboard.tsx` |
| Market Status | `server/services/market/MarketStatusService.ts`, `client/src/components/MarketStatusIndicator.tsx` |
| Caching System | `server/cache/ETFCacheService.ts`, `server/cache/UnifiedCacheManager.ts` |
| Technical Indicators | `server/services/technical/TechnicalIndicatorCalculator.ts` |
| Data Quality | `server/services/validation/DataQualityValidator.ts` |

---

## Design Philosophy & Goals

### Database-First Principles
- PostgreSQL as primary data source to reduce API calls
- Materialized views for complex query optimization
- Data integrity through audit trails and validation
- Automated backup and recovery systems

### Data Pipeline Strategy
**Bronze → Silver → Gold Model**:
1. **Bronze**: Raw data ingestion from APIs
2. **Silver**: Validated and cleaned data
3. **Gold**: Feature-engineered, analysis-ready data

**Enterprise-Grade Attributes**:
- Quality validation at each stage
- Audit trails for compliance
- Statistical analysis and anomaly detection
- Automated staleness prevention

### Cost Optimization Tactics
- **Strategic Caching**: 3-tier system with adaptive TTLs
- **Scheduled API Calls**: Market-aware timing to minimize calls
- **Minimal AI Dependency**: AI used only for insights, not core data
- **Batch Processing**: Parallel fetching and bulk operations
- **Connection Pooling**: Optimized database connections (max 20)

---

## Technical Stack Details

### Frontend Stack
- **React**: 18.3.1 with TypeScript 5.5.3
- **Routing**: Wouter 3.3.5 (lightweight alternative to React Router)
- **State Management**: TanStack Query 5.51.23
- **UI Components**: shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS 3.4.10 with custom dark financial theme
- **Build Tool**: Vite 5.4.2 with HMR and code splitting
- **Charts**: Recharts 2.12.7 for financial visualizations

### Backend Stack
- **Runtime**: Node.js 20.x with Express.js 4.19.2
- **Language**: TypeScript 5.5.3 with ES modules
- **ORM**: Drizzle ORM 0.33.0 with PostgreSQL adapter
- **Database**: PostgreSQL 15 with Neon serverless driver
- **Logging**: Pino 9.3.2 for structured logging
- **Security**: Helmet, CORS, rate limiting, Zod validation
- **WebSockets**: Socket.io for real-time updates
- **Dependency Injection**: Inversify for service management

### Infrastructure Configuration
- **Cron Jobs**: Node-cron with market-aware scheduling
- **Background Processing**: Parallel job execution with circuit breakers
- **SSH Support**: Secure remote connections for production
- **Environment Management**: dotenv with validation
- **Compression**: gzip for API responses
- **Memory Management**: Automated garbage collection optimization

---

## Performance Benchmarks

### Response Time Targets
- **ETF Metrics**: <100ms (achieved: 55ms average)
- **Economic Dashboard**: <2 seconds
- **Market Status**: <50ms
- **Cache Hit**: <10ms (memory), <50ms (Redis)

### Caching Impact
- **Performance Improvement**: 99.5% (12.6s → 55ms)
- **API Call Reduction**: 95% through 5-minute refresh cycles
- **Cache Hit Rate**: >80% for frequent requests
- **Memory Usage**: <500MB with automatic cleanup

### Data Coverage
- **Historical Economic Data**: 112 years (1913-2025)
- **ETF Technical Data**: 10+ years per instrument
- **Database Records**: 76,441+ economic indicators
- **Daily Updates**: 100+ economic series from FRED

---

## Recent Changes & Implementations

### Version 36 (Current - Replit Optimized)
- **Production Deployment**: Enhanced SSH support and secure remote connections
- **TypeScript Execution**: Full TypeScript support in production environments
- **Node.js Optimization**: Improved startup diagnostics and port handling
- **Code Quality Automation**: Deployment safety agents and scanners
- **Enhanced Middleware**: 15+ production stability components

### Version 35 (ETF Critical Fixes)
- **Signal Calculation Refinement**: MACD removed, using only RSI and Bollinger %B
- **Frontend Migration**: Switched from `/api/etf-metrics` to `/api/etf/robust`
- **Multiple Fallback Strategies**: 4-phase implementation for data reliability
- **Health Monitoring**: Comprehensive checks and performance tracking

### Version 34 (Data Quality)
- **Z-Score Deduplication**: Fixed 79-93% duplicate records across all ETFs
- **Daily Aggregation**: DISTINCT ON (DATE(date)) SQL implementation
- **Bollinger %B Fix**: Corrected scale from 0-100 to proper 0-1
- **Statistical Validation**: Automatic fallback to realistic parameters

### Version 33 (Economic Pipeline)
- **FRED Integration**: Complete pipeline with 104,625 historical records
- **Economic Health Scoring**: 2-layer methodology using reliable FRED data
- **Performance Optimization**: 99.5% improvement in ETF loading times

### Version 32 (Caching Infrastructure)
- **5-Minute ETF Caching**: Dual-layer architecture with materialized views
- **Background Refresh**: Automatic cache updates every 5 minutes
- **Circuit Breaker Pattern**: Robust API call management
- **Unified Cache Manager**: Centralized cache coordination

---

## Data Model Summary

### Core Database Tables

#### ETF & Technical Data
```sql
-- Materialized view for performance
etf_metrics_latest (
  symbol, name, price, change, changePercent,
  rsi, bollingerUpper, bollingerMiddle, bollingerLower,
  bollingerPercB, volume, marketCap, signal,
  lastUpdated, cacheTimestamp
)

historical_technical_indicators (
  id, symbol, date, rsi, macd, signal_line,
  bollinger_upper, bollinger_middle, bollinger_lower,
  volume, created_at
)
```

#### Economic Data
```sql
economicIndicatorsCurrent (
  id, series_id, name, value, units,
  last_updated, category, importance,
  data_source, description
)

historical_economic_data (
  id, indicator_id, date, value,
  year_over_year_change, created_at
)

fredUpdateLog (
  id, series_id, last_successful_update,
  last_attempted_update, update_count,
  last_error, created_at, updated_at
)
```

#### Market Data
```sql
stock_data (
  id, symbol, price, volume, market_cap,
  pe_ratio, dividend_yield, week_52_high,
  week_52_low, updated_at
)

market_sentiment (
  id, date, vix, put_call_ratio,
  advance_decline, sentiment_score,
  created_at
)
```

### Key Relationships
- ETF metrics linked to historical technical indicators by symbol
- Economic indicators tied to historical data through indicator_id
- Audit trails connected to all data modifications
- Cache entries reference source tables for invalidation

---

## API Documentation

### Main Endpoints

#### ETF Routes
- `GET /api/etf/robust` - Live ETF metrics with multiple fallbacks
- `GET /api/etf/enhanced` - Enhanced data with v35 fixes
- `GET /api/etf/cached-clean` - 5-minute cached metrics
- `GET /api/etf/technical-clean` - Clean technical indicators

#### Economic Routes
- `GET /api/economic-health/dashboard` - Composite health score
- `GET /api/macro/gdp-data` - GDP indicators and trends
- `GET /api/macro/inflation-data` - CPI, PPI metrics
- `POST /api/econ/sparklines/batch` - Trend visualizations
- `GET /api/fred-incremental` - Incremental FRED updates

#### Market Routes
- `GET /api/market-status` - Session status and timing
- `GET /api/momentum-analysis` - Sector momentum metrics
- `GET /api/unified-dashboard` - All dashboard data (single call)

#### System Routes
- `GET /api/health` - System health checks
- `GET /api/performance-monitoring` - Performance metrics
- `GET /api/data-quality` - Data quality reports

### Authentication
- API key-based for external services (Twelve Data, FRED)
- Environment variable management for secrets
- No user authentication currently (planned for future)

### Error Handling Policy
```typescript
// Standard error response format
{
  error: string,
  code: string,
  details?: any,
  timestamp: string,
  requestId?: string
}
```

**Error Codes**:
- 400: Bad Request (validation errors)
- 401: Unauthorized (API key issues)
- 429: Rate Limited
- 500: Internal Server Error
- 503: Service Unavailable (circuit breaker open)

---

## Operational Context

### Deployment Guide

#### Development Setup
```bash
# Clone repository
git clone [repository-url]
cd financehub-pro

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run migrations
npm run db:push

# Start development
npm run dev
```

#### Production Deployment
```bash
# Build for production
npm run build

# Start production server
NODE_ENV=production npm start

# Or with PM2
pm2 start ecosystem.config.js
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host/db

# External APIs
TWELVE_DATA_API_KEY=your_key
FRED_API_KEY=your_fred_key
OPENAI_API_KEY=your_openai_key  # Optional
SENDGRID_API_KEY=your_sendgrid_key  # Optional

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Cache Configuration
REDIS_URL=redis://localhost:6379  # Optional
CACHE_TTL=300  # 5 minutes

# Security
RATE_LIMIT_WINDOW=60000  # 1 minute
RATE_LIMIT_MAX=100
```

### Third-Party Services

| Service | Purpose | Rate Limits | Fallback Strategy |
|---------|---------|------------|-------------------|
| Twelve Data API | Real-time stock quotes | 144/min | Cached data with staleness warning |
| FRED API | Economic indicators | 120/min | Previous day's data |
| OpenAI API | Market insights | 3/min | Disable AI features |
| SendGrid | Email notifications | 100/day | Queue for retry |
| Neon PostgreSQL | Database | N/A | Connection pool retry |

### Monitoring & Alerts
- Health checks every 30 seconds
- Performance metrics dashboard
- Error rate monitoring (threshold: 1%)
- Data freshness alerts (>6 hours stale)
- Memory usage warnings (>80%)

---

## Known Issues / TODOs

### Active Issues
1. **WebSocket Reconnection**: Occasional disconnections during high load
2. **Cache Invalidation**: Rare race conditions in multi-tier cache
3. **FRED API Delays**: Some indicators update with 1-2 day lag
4. **Mobile Responsiveness**: Tables need better mobile optimization

### Technical Debt
1. **Test Coverage**: Currently at 65%, target 80%
2. **Error Boundaries**: Need more granular React error boundaries
3. **Database Indices**: Additional composite indices needed
4. **API Rate Limiting**: Per-user limits not implemented
5. **Documentation**: API documentation needs OpenAPI spec

### Future Plans

#### Q4 2025
- User authentication and personalization
- Portfolio tracking functionality
- Custom watchlists and alerts
- Mobile app development

#### Q1 2026
- Machine learning price predictions
- Options chain analysis
- International market support
- Advanced backtesting engine

#### Long-term Vision
- Social trading features
- Automated trading strategies
- Regulatory compliance (SOC2)
- Enterprise API offerings

### Contributing Guidelines
- Follow TypeScript strict mode
- Maintain test coverage above 80%
- Use conventional commits
- Update Context.md for significant changes
- Peer review required for production changes

---

## Maintenance Notes

### Regular Tasks
- **Daily**: FRED data sync, technical indicator calculations
- **Weekly**: Database optimization, cache performance review
- **Monthly**: Security updates, dependency upgrades
- **Quarterly**: Performance audits, architecture reviews

### Emergency Procedures
1. **Data Corruption**: Restore from latest backup, run validation
2. **API Outage**: Activate circuit breakers, use cached data
3. **Database Failure**: Failover to read replica, notify team
4. **High Load**: Scale horizontally, enable rate limiting

### Contact Information
- **Technical Lead**: [Contact via GitHub Issues]
- **Bug Reports**: https://github.com/[org]/financehub-pro/issues
- **Documentation**: This file (Context.md)
- **Backup Location**: `database_complete_backup.sql`

---

*This document is automatically maintained by `scripts/update-context.js`*
*Last automatic update: 2025-09-01*