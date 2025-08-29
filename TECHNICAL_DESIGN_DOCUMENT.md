# FinanceHub Pro - Technical Design Document

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Core Subsystems](#core-subsystems)
4. [Database Design](#database-design)
5. [API Integrations](#api-integrations)
6. [Frontend Architecture](#frontend-architecture)
7. [Backend Architecture](#backend-architecture)
8. [Data Flow & Processing](#data-flow--processing)
9. [Security & Performance](#security--performance)
10. [Development Guidelines](#development-guidelines)
11. [Deployment & Operations](#deployment--operations)

---

## Project Overview

### Purpose
FinanceHub Pro is a comprehensive financial dashboard application designed for individual investors and financial professionals. It provides real-time market data, technical analysis, AI-powered market insights, and financial tracking with an emphasis on enterprise-grade data integrity and cost-effectiveness.

### Vision
To be a robust and reliable financial analysis tool that leverages authentic government and market data while minimizing reliance on expensive AI for core data processing.

### Target Users
- Individual investors seeking comprehensive market analysis
- Financial professionals requiring real-time technical indicators
- Portfolio managers needing economic health scoring
- Anyone requiring authentic, government-sourced economic data

### Key Features
- **Real-time ETF Technical Metrics**: Live RSI, Bollinger Bands, Z-score calculations
- **Economic Health Scoring**: Multi-dimensional economic analysis using FRED data
- **Market Status Tracking**: Live market session monitoring
- **Technical Analysis**: Advanced statistical calculations and signal generation
- **Performance Monitoring**: Enterprise-grade caching and response time tracking

---

## System Architecture

### Monorepo Structure
```
financehub-pro/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components (50+ components)
│   │   │   ├── ui/        # shadcn/ui component library
│   │   │   ├── market/    # Market-specific components
│   │   │   ├── movers/    # ETF/Economic movers components
│   │   │   └── v2/        # Next-generation components
│   │   ├── pages/         # Route-based page components
│   │   ├── lib/           # Utility functions and query client
│   │   ├── hooks/         # Custom React hooks
│   │   ├── context/       # React context providers
│   │   ├── adapters/      # Data adaptation layer
│   │   ├── types/         # Frontend-specific TypeScript types
│   │   └── utils/         # Frontend utilities
├── server/                 # Express.js backend API
│   ├── routes/            # API endpoint definitions (30+ route files)
│   ├── services/          # Business logic (80+ service files)
│   ├── middleware/        # Express middleware (15+ middleware)
│   ├── controllers/       # Request controllers
│   ├── repositories/      # Data access layer
│   ├── container/         # Dependency injection container
│   ├── config/            # Configuration management
│   ├── cache/             # Caching implementations
│   ├── utils/             # Backend utilities
│   ├── types/             # Backend TypeScript types
│   └── public/            # Static assets for production
├── shared/                 # Common code between client and server
│   ├── schema.ts          # Database schema (Drizzle ORM)
│   ├── schema-v2.ts       # Next-generation schema
│   ├── types/             # Shared TypeScript interfaces
│   │   ├── api.ts         # API contracts
│   │   ├── database-types.ts # Database type definitions
│   │   └── financial-interfaces.ts # Financial data types
│   ├── config/            # Shared configuration
│   ├── utils/             # Shared utility functions
│   ├── formatters/        # Data formatting utilities
│   ├── validation/        # Data validation schemas
│   └── dates.ts           # Universal date handling utilities
├── migrations/            # Database migration files
├── scripts/               # Utility and deployment scripts (40+ scripts)
├── codebase-agents/       # Automated code quality and deployment safety
├── tests/                 # Test suites and configurations
└── attached_assets/       # Implementation guides and analysis documents
```

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Wouter (routing)
- TanStack Query (state management)
- shadcn/ui + Radix UI (component library)
- Tailwind CSS (styling)
- Vite (build tool)

**Backend:**
- Node.js with Express.js
- TypeScript with ES modules
- Drizzle ORM (database)
- PostgreSQL with Neon serverless driver
- Pino (structured logging)
- WebSocket integration for real-time data

**Infrastructure:**
- PostgreSQL database (Neon serverless)
- Redis caching (with in-memory fallback)
- Background job processing with intelligent cron scheduler
- Real-time WebSocket connections
- SSH support for secure remote connections
- Production-ready deployment with Node.js optimization
- TypeScript execution in production environments

---

## Core Subsystems

### 1. ETF Technical Metrics Engine
**Purpose**: Provides real-time technical analysis for 12 major sector ETFs

**Components:**
- `ETFLiveDataService`: Fetches live market data from Twelve Data API
- `ETFCacheService`: Implements 5-minute caching with materialized views
- `TechnicalIndicatorCalculator`: Computes RSI, Bollinger Bands, Z-scores

**Key Features:**
- Real-time price data with 30-second frontend refresh
- Z-score based trading signals (BUY < -1.5, SELL > 1.5, HOLD otherwise)
- Performance optimization: 99.5% improvement (12.6s → 55ms)
- Signal calculation: Average of RSI Z-score and Bollinger %B Z-score only

### 2. Economic Health Scoring System
**Purpose**: Provides comprehensive economic analysis using authentic FRED data

**Components:**
- `EconomicDataService`: Integrates with Federal Reserve Economic Data API
- `StatisticalAnalysisEngine`: Performs advanced statistical calculations
- `EconomicHealthCalculator`: Generates composite health scores

**Data Sources:**
- GDP growth indicators
- Employment metrics (PAYEMS, UNRATE, CIVPART)
- Inflation measures (CPI, PPI)
- Market indicators (Treasury yields, spreads)

### 3. Market Status & Session Tracking
**Purpose**: Monitors real-time market session status

**Features:**
- Live market open/closed status
- Pre-market and after-hours detection
- Timezone-aware session calculations
- Next open/close time predictions

### 4. Caching & Performance System
**Purpose**: Ensures sub-second response times through intelligent caching

**Architecture:**
- **Memory Cache**: Hot data with millisecond access
- **Materialized Views**: Database-level caching for complex queries
- **Background Refresh**: 5-minute automated cache updates
- **Circuit Breakers**: Graceful fallback mechanisms

### 5. Data Quality & Validation System
**Purpose**: Ensures data integrity and prevents corruption

**Components:**
- `DataQualityValidator`: Validates incoming data for statistical anomalies
- `ZScoreValidator`: Prevents impossible Z-score values
- `HistoricalDataDeduplicator`: Removes duplicate records
- `DataAuditTrail`: Tracks all data modifications
- `CircuitBreakerService`: Prevents cascade failures
- `SufficiencyGates`: Ensures minimum data requirements
- `UnitTransformer`: Standardizes data units across sources

### 6. Automated Code Quality & Deployment Safety
**Purpose**: Ensures code quality and safe deployments

**Components:**
- `CodeQualityScanner`: Automated code analysis and quality reporting
- `DeploymentSafetyAgent`: Pre-deployment validation and safety checks
- Production safeguards and environment validation
- Automated performance monitoring and alerting

---

## Database Design

### Core Tables

**ETF & Technical Data:**
- `etf_metrics_latest`: Materialized view for current ETF metrics
- `historical_technical_indicators`: Time-series technical data
- `technical_indicators`: Current indicator values

**Economic Data:**
- `economicIndicatorsCurrent`: Latest economic indicators
- `historical_economic_data`: Time-series economic data
- `fredUpdateLog`: FRED API sync tracking
- `economic_data_audit`: Data quality audit trail

**Market Data:**
- `stock_data`: Real-time stock quotes and prices
- `market_sentiment`: Market sentiment indicators
- `historical_sector_data`: Sector performance history

**System Tables:**
- `users`: User authentication and preferences
- `data_collection_audit`: API call tracking and rate limiting

### Database Optimizations
- Composite indexes for time-series queries
- Connection pooling with pg-pool
- Streaming queries for large datasets
- Automated backup and restoration

---

## API Integrations

### External APIs

**1. Twelve Data API**
- **Purpose**: Real-time stock quotes and technical indicators
- **Rate Limits**: 144 calls/minute
- **Endpoints Used**: 
  - `/quote` - Real-time stock prices
  - `/time_series` - Historical price data
- **Authentication**: API key-based
- **Fallback Strategy**: Cached data with staleness warnings

**2. Federal Reserve Economic Data (FRED) API**
- **Purpose**: Official U.S. government economic indicators
- **Rate Limits**: 120 calls/minute
- **Data Series**: GDP, CPI, PPI, employment data, Treasury yields
- **Authentication**: API key-based
- **Refresh Strategy**: Daily updates with intelligent scheduling

**3. SendGrid Email API**
- **Purpose**: Daily email subscriptions and notifications
- **Features**: Economic health alerts, market summaries
- **Authentication**: API key-based

### Internal API Endpoints

**ETF Routes:**
- `GET /api/etf/robust` - Live ETF technical metrics with fallbacks
- `GET /api/etf/enhanced` - Enhanced ETF data with multiple fallbacks
- `GET /api/etf/cached-clean` - Cached ETF metrics with 5-minute refresh
- `GET /api/etf/technical-clean` - Clean technical indicator data

**Economic Routes:**
- `GET /api/economic-health/dashboard` - Economic health score
- `GET /api/macro/gdp-data` - GDP indicators
- `GET /api/macro/inflation-data` - Inflation metrics
- `POST /api/econ/sparklines/batch` - Economic trend sparklines
- `GET /api/fred-incremental` - Incremental FRED data updates
- `GET /api/economic-correlation` - Economic indicator correlations

**Market Routes:**
- `GET /api/market-status` - Current market session status
- `GET /api/momentum-analysis` - Sector momentum analysis
- `GET /api/unified-dashboard` - Complete dashboard data in single call

**System Routes:**
- `GET /api/health` - System health checks
- `GET /api/performance-monitoring` - Performance metrics
- `GET /api/data-quality` - Data quality reports

---

## Frontend Architecture

### Component Structure

**Core Components:**
- `ETFTechnicalMetricsTable`: Real-time ETF metrics display
- `EconomicHealthDashboard`: Economic indicators and scoring
- `MarketStatusIndicator`: Live market session status
- `TechnicalIndicatorChart`: Interactive financial charts

**UI Framework:**
- **Design System**: shadcn/ui with Radix UI primitives
- **Theme**: Dark financial dashboard optimized for readability
- **Responsive**: Mobile-first design with grid layouts
- **Accessibility**: WCAG 2.1 AA compliant

### State Management

**TanStack Query Configuration:**
- 30-second refetch intervals for real-time data
- Intelligent background refetching
- Optimistic updates for better UX
- Error boundaries with graceful degradation

**Query Structure:**
```typescript
// ETF metrics with auto-refresh
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/etf/robust'],
  refetchInterval: 30000,
});
```

### Routing & Navigation
- **Router**: Wouter for lightweight client-side routing
- **Navigation**: Responsive sidebar with market status integration
- **Deep Linking**: URL-based state for shareable dashboard views

---

## Backend Architecture

### Service Layer Architecture

**Dependency Injection:**
- Inversify container for service management
- Interface-based abstractions for testability
- Singleton pattern for stateful services
- Service container with 20+ registered services

**Error Handling:**
- Structured error responses with Zod validation
- Circuit breaker pattern for external API calls
- Graceful degradation with fallback data
- Production error analysis and monitoring
- Standardized error handler middleware

**Middleware Stack:**
```typescript
app.use(helmet());                    // Security headers
app.use(cors());                      // Cross-origin requests
app.use(compression());               // Response compression
app.use(rateLimiter);                // Rate limiting
app.use(requestLogging);             // Structured logging
app.use(productionSafeguards);       // Production protection
app.use(performanceMonitoring);     // Performance tracking
app.use(dataQualityValidation);     // Data quality checks
app.use(environmentValidation);     // Environment validation
app.use(memoryOptimization);        // Memory management
app.use(databaseHealthCheck);       // Database monitoring
```

### Background Processing

**Cron Job Scheduler:**
- Market-aware scheduling (no updates during market close)
- Exponential backoff for failed API calls
- Parallel processing for independent data sources
- Health monitoring and alerting

**Data Collection Pipeline:**
```
FRED API → Data Validation → Database Storage → Cache Refresh → WebSocket Broadcast
```

### Real-time Features

**WebSocket Integration:**
- Live market data streaming
- Cache invalidation notifications
- Performance monitoring alerts

---

## Data Flow & Processing

### ETF Technical Metrics Pipeline

1. **Data Collection**: Twelve Data API every 5 minutes
2. **Technical Calculation**: RSI, Bollinger Bands, moving averages
3. **Z-Score Generation**: Statistical normalization
4. **Signal Calculation**: Trading signals based on Z-score thresholds
5. **Caching**: Memory + materialized view storage
6. **Frontend Delivery**: 30-second refresh intervals

### Economic Health Scoring

1. **FRED Data Sync**: Daily collection of economic indicators
2. **Data Quality Validation**: Outlier detection and cleansing
3. **Statistical Analysis**: Z-score calculation with historical context
4. **Composite Scoring**: Weighted combination of indicators
5. **Trend Analysis**: Momentum and direction calculation
6. **Dashboard Updates**: Real-time score delivery

### Signal Generation Algorithm

```typescript
// Signal calculation using only RSI and Bollinger %B
const rsiZScore = (rsi - 50) / 15;
const bbZScore = (bollingerPercB - 0.5) * 4;
const overallZScore = (rsiZScore + bbZScore) / 2;

const signal = overallZScore > 1.5 ? 'SELL' 
             : overallZScore < -1.5 ? 'BUY' 
             : 'HOLD';
```

---

## Security & Performance

### Security Measures

**API Security:**
- Rate limiting: 100 requests/minute per IP
- CORS configuration for allowed origins
- Helmet.js for security headers
- Input validation with Zod schemas

**Data Protection:**
- Environment variable-based secrets
- API key rotation support
- Secure database connections
- Audit logging for sensitive operations

### Performance Optimizations

**Caching Strategy:**
- **L1 Cache**: Memory (sub-millisecond access)
- **L2 Cache**: Redis distributed cache
- **L3 Cache**: Database materialized views
- **TTL Strategy**: Adaptive expiration based on data volatility

**Database Optimizations:**
- Connection pooling (max 20 connections)
- Composite indexes on time-series columns
- Query optimization for large datasets
- Automated VACUUM and ANALYZE

**Frontend Performance:**
- Code splitting with React.lazy
- Image optimization and lazy loading
- Service worker for offline capability
- Bundle size monitoring

---

## Development Guidelines

### Code Standards

**TypeScript Configuration:**
- Strict mode enabled
- No implicit any
- Path mapping for clean imports
- ESLint + Prettier integration

**Testing Strategy:**
- Unit tests with Vitest
- Integration tests with Playwright
- API testing with Supertest
- Database testing with test containers

**Git Workflow:**
- Feature branches with descriptive names
- Conventional commit messages
- Automated testing on pull requests
- Code review requirements

### Data Integrity Principles

1. **Authentic Data Only**: Never use mock or synthetic data
2. **Source Validation**: Verify all data sources for authenticity
3. **Error Transparency**: Clear error messages for data issues
4. **Graceful Degradation**: Fallback to cached authentic data
5. **Audit Trails**: Track all data modifications

---

## Deployment & Operations

### Environment Configuration

**Development:**
- Local PostgreSQL with Docker
- Hot module reloading
- Debug logging enabled
- Mock external APIs for testing

**Production:**
- Neon PostgreSQL serverless
- Redis caching cluster
- Structured logging with Pino
- Health check endpoints

### Monitoring & Alerting

**Performance Monitoring:**
- Response time tracking (< 2 second SLA)
- Cache hit ratio monitoring
- Database connection health
- Memory and CPU usage

**Business Metrics:**
- API success rates
- Data freshness indicators
- User engagement metrics
- Error rate thresholds

### Backup & Recovery

**Database Backups:**
- Automated daily backups
- Point-in-time recovery capability
- Cross-region backup replication
- Automated restore testing

**Application Recovery:**
- Blue-green deployments
- Rollback capability
- Circuit breaker activation
- Graceful shutdown handling

---

## Recent Architecture Changes

### Version 36 (Current - Replit Optimized)
- **Production Deployment**: SSH support and secure remote connections
- **TypeScript Execution**: Full TypeScript support in production environments
- **Node.js Optimization**: Enhanced startup diagnostics and port handling
- **Code Quality Automation**: Deployment safety agents and code quality scanners
- **Enhanced Middleware**: 15+ middleware components for production stability
- **Service Architecture**: 80+ service files with dependency injection

### Version 35
- **MACD Removal**: Trading signals now use only RSI and Bollinger %B Z-scores
- **Enhanced ETF Routes**: Multiple fallback strategies for data reliability
- **5-Minute Caching**: ETF data cached with background refresh
- **Production Safeguards**: Comprehensive middleware for stability

### Version 34
- **Z-Score Deduplication**: Fixed historical data corruption affecting all 12 ETFs
- **Database Optimization**: Daily aggregation using DISTINCT ON queries
- **Data Quality Validation**: Statistical validity checks for Z-scores

### Version 33
- **Economic Data Pipeline**: Complete FRED integration with 104,625 historical records
- **Statistical Health Scoring**: Advanced economic analysis framework
- **Performance Optimization**: 99.5% improvement in ETF metrics loading

---

## Maintenance & Updates

### Regular Maintenance Tasks
- **Weekly**: Database performance review and optimization
- **Monthly**: Security dependency updates
- **Quarterly**: API integration health checks
- **Annually**: Full system architecture review

### Documentation Updates
This document should be updated whenever:
- New features are added to the system
- External API integrations change
- Database schema modifications occur
- Performance optimizations are implemented
- Security measures are enhanced

**Last Updated**: August 29, 2025  
**Version**: 36.0 (Replit Optimized)  
**Next Review**: September 29, 2025