# FinanceHub Pro

## Overview

FinanceHub Pro is a comprehensive financial dashboard application providing real-time market data, technical analysis, AI-powered market insights, and financial tracking. It features a modern React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration. The platform includes enterprise-grade data integrity validation systems to ensure accurate economic indicator displays. The business vision is to provide a robust, cost-effective financial analysis tool for individual investors and financial professionals, leveraging authentic government and market data without reliance on expensive AI for core data processing.

## User Preferences

Preferred communication style: Simple, everyday language.
UI Preference: Clean, actionable interface without overly technical explanations that don't provide user value.

## Recent Major Updates

### Technical Debt Cleanup & Unified Data Flow Implementation (August 5, 2025)
**COMPLETED**: Major technical debt elimination and enterprise architecture implementation
- ✅ **20 orphaned database tables removed** (technical debt cleanup) 
- ✅ **Unified Data Flow Architecture implemented** (API → Cache → Database → Frontend)
- ✅ **Enterprise Rate Limiting Service** with adaptive throttling
- ✅ **Batch Processing Service** with priority queues and auto-scaling
- ✅ **Intelligent Cache System** with multi-tier caching and adaptive TTLs
- ✅ **Zero technical debt tolerance** policy successfully enforced
- ✅ **Schema streamlined** from 25+ tables to 5 core active tables
- ✅ **TypeScript compilation errors resolved** with ES2015+ iteration fixes

### Deployment Schema Fix (August 5, 2025)
**COMPLETED**: Resolved deployment build failures caused by missing schema exports
- ✅ **Missing schema exports restored** for `historicalStockData`, `historicalMarketSentiment`, `historicalTechnicalIndicators`
- ✅ **Service import compatibility** updated across comprehensive-historical-collector and historical-context-analyzer
- ✅ **Database field mappings** corrected to match actual schema definitions
- ✅ **TypeScript compilation** now successful with all LSP diagnostics resolved
- ✅ **Build process** verified working with vite build and esbuild compilation
- ✅ **Deployment readiness** confirmed with successful application startup and data flow

### Z-Score Statistical Analysis Fix (August 5, 2025)
**COMPLETED**: Comprehensive resolution of statistical calculation issues across dashboard
- ✅ **Sample variance calculations** corrected from population (N) to sample (N-1) in ETF technical service
- ✅ **Missing schema import** fixed - added `historicalStockData` import to resolve runtime errors
- ✅ **Data sufficiency validation** enhanced with strict rejection of insufficient data sets
- ✅ **Extreme value handling** improved from arbitrary ±50 capping to ±5 statistical threshold with unprecedented event flagging
- ✅ **Window size standardization** documented - 20-day for ETF metrics, 12-month for economic indicators
- ✅ **Mathematical accuracy** verified across all z-score implementations for reliable statistical analysis
- ✅ **Error handling enhanced** with comprehensive validation and logging for data quality assurance

### Z-Score Weighted System Methodology Fix (August 5, 2025)
**COMPLETED**: Critical signal reliability issues resolved in ETF technical analysis system
- ✅ **Bollinger %B direction corrected** - High %B now properly identified as bearish (overbought) signal  
- ✅ **Signal thresholds adjusted** from ±0.25 to ±0.6 for appropriate sensitivity in weighted signal range
- ✅ **Z-score to signal conversion improved** from stepped thresholds to smooth scaling (zscore/2)
- ✅ **ATR usage optimized** - Removed from directional signals, implemented as volatility signal strength modifier
- ✅ **Weight rebalancing** - Increased RSI (35%), MACD (30%), MA Trend (15%) focus for better momentum detection
- ✅ **Signal logic validation** - All directional inconsistencies resolved for reliable trading signal generation
- ✅ **Mathematical soundness** - Weighted calculations now statistically valid and properly calibrated

## System Architecture

### Full-Stack Monorepo Structure
The application uses a monorepo architecture with three main directories: `client/` (React frontend), `server/` (Express.js backend API), and `shared/` (Common TypeScript types and database schema).

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with a custom dark financial dashboard theme
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM
- **Database**: PostgreSQL with Neon serverless driver
- **Real-time**: WebSocket integration for live market data
- **Cron Jobs**: Intelligent cron scheduler for market-aware data fetching and updates.
- **Caching**: Three-tier intelligent caching system (Memory -> Database -> API Calls) with adaptive TTLs and unified cache management.
- **Data Integrity**: Automated staleness detection, prevention, and validation systems for economic indicators.
- **Security**: Comprehensive security middleware including rate limiting, CORS, input validation (Zod), structured logging (Pino), and health check endpoints.
- **Error Handling**: Standardized error handling middleware with graceful degradation and robust fallbacks.

### Core Architectural Decisions & Design Patterns
- **Database-First Approach**: Prioritizes PostgreSQL database as the primary data source for economic indicators and historical data to reduce API calls and ensure data authenticity.
- **Gold Standard Data Pipeline**: Complete enterprise-grade ingress→processing→egress pipeline with comprehensive data quality validation, audit trail tracking, feature engineering (YoY/MoM calculations), and statistical analysis with confidence scoring.
- **Automated Data Release Scheduler**: Strategic scheduling system with 10:15am ET weekday refresh to capture fresh economic releases (Nonfarm Payrolls, unemployment, PMI), plus 8:45am early refresh for employment data and 2:15pm afternoon refresh for late releases.
- **Unified Data Refresh Scheduler**: Consolidates all economic data refresh logic into a single system, ensuring 24-hour data cycles and proactive staleness prevention.
- **Comprehensive Historical Data Infrastructure**: Accumulates 24+ months of authentic historical data for VIX, SPY, sector ETFs, and economic indicators to enable sophisticated statistical analysis (e.g., Z-scores, percentile rankings) without data fabrication.
- **Cost Optimization**: Strategic caching, scheduled API calls, and elimination of AI dependencies for core data processing to minimize operational costs.
- **Modular & Scalable Design**: Employs Dependency Injection (Inversify), Repository Pattern, and clear service interfaces for improved maintainability, testability, and scalability.
- **UI/UX Decisions**: Dark financial theme with color-coded indicators, responsive grid layouts, and professional presentation for market data and AI insights. Emphasis on readability and consistency across sections.
- **Performance Optimization**: Aggressive caching, parallel data fetching, batch processing, and 2-second loading guarantees for dashboard components.
- **Enhanced User Education (August 4, 2025)**: Added comprehensive Delta Adjustment methodology explanations, economic rationale tooltips for each indicator, and detailed documentation of why metrics are inverted (inflation, unemployment) versus direct interpretation (GDP, employment).
- **Multi-Dimensional Economic Insight Classification (August 4, 2025)**: Implemented sophisticated economic analysis framework that considers both level (current vs historical) and trend (period-to-period changes) signals. Features include mixed signal detection, inflation-specific logic for rapidly rising prices despite low levels, confidence scoring, and professional-grade economic reasoning for each classification.

### Database Design
The schema includes key tables for:
- `users`
- `stock_data`
- `market_sentiment` (VIX, AAII)
- `technical_indicators` (RSI, MACD, BBANDS, ADX, VWAP, ATR, WILLR, STOCH)
- `ai_analysis`
- `economic_events`
- `fredUpdateLog`
- `economicIndicatorsCurrent`
- `historical_sector_data`
- `historical_technical_indicators`
- `historical_market_sentiment`
- `historical_economic_data`
- `economic_data_audit`
- `data_collection_audit`

## External Dependencies

### Financial Data Providers
- **Twelve Data API**: Primary source for real-time stock quotes, historical data, and a wide range of technical indicators (RSI, MACD, BBANDS, ADX, STOCH, VWAP, ATR, WILLR).
- **Federal Reserve Economic Data (FRED) API**: Official source for 50+ U.S. government economic indicators.

### AI Services
- **OpenAI GPT-4o**: Used for advanced market commentary, AI-powered market insights, financial mood analysis, and narrative-driven market synthesis. (Used judiciously for cost optimization).

### Database Infrastructure
- **Neon PostgreSQL**: Serverless PostgreSQL for scalable data storage.

### Communication
- **SendGrid**: For sending daily email subscriptions and notifications.

### UI Component Libraries
- **Radix UI**: Accessible component primitives for UI.
- **Lucide React**: Icon library.
- **Recharts**: Financial charting and visualization.
- **Tailwind CSS**: Utility-first CSS framework.

## Development & Deployment Infrastructure

### CI/CD Pipeline (Added August 3, 2025)
- **GitHub Actions**: Complete CI/CD workflows for testing, security, and deployment
- **Automated Testing**: Vitest (unit/integration), Playwright (E2E), coverage reporting
- **Code Quality**: ESLint, Prettier, TypeScript checking with pre-commit hooks
- **Security Scanning**: Dependency audits, secrets detection, SAST with CodeQL
- **Performance Testing**: Lighthouse CI, Artillery load testing
- **Container Orchestration**: Optimized Docker builds, Docker Compose for local development

### Development Tools
- **Testing Framework**: Comprehensive test suites with 70% coverage thresholds
- **Quality Assurance**: Automated linting, formatting, and type checking
- **Security Compliance**: Automated vulnerability scanning and license checking
- **Performance Monitoring**: Response time tracking and bundle analysis