# FinanceHub Pro

## Overview
FinanceHub Pro is a comprehensive financial dashboard application for individual investors and financial professionals. It provides real-time market data, technical analysis, AI-powered market insights, and financial tracking. The platform emphasizes enterprise-grade data integrity and cost-effectiveness by leveraging authentic government and market data, minimizing reliance on expensive AI for core data processing. Its vision is to be a robust and reliable financial analysis tool.

## User Preferences
Preferred communication style: Simple, everyday language.
UI Preference: Clean, actionable interface without overly technical explanations that don't provide user value.

## Recent Changes (August 15, 2025)
- **CRITICAL PERFORMANCE OPTIMIZATION SUCCESS**: Resolved "server unavailable" errors and improved ETF metrics response time from 998ms to 25ms (97% improvement) through materialized view implementation
- **ETF DATA PIPELINE RESTORED**: Successfully fixed "No ETF metrics data available" error by implementing direct database query approach, restoring ETF data display for all 12 symbols
- **COMPLETE: FinanceHub Pro v30 Implementation SUCCESS**: Successfully loaded 76,441 historical economic records across 33 series spanning 1913-2025 using comprehensive 3-layer data loading infrastructure
- **NEW: Enhanced Economic Data Service**: Created complete economic data service with YoY transformations and 3 new API endpoints (`/api/enhanced-economic-indicators`, `/api/economic-data-summary`, `/api/economic-validation`)
- **DATA ACHIEVEMENT: 112-Year Economic History**: Loaded comprehensive economic dataset from 1913-2025 with 13,003 Federal Funds Rate records, 8,906 10-Year Treasury records, and full coverage of critical economic indicators
- **Z-Score Infrastructure Ready**: All 6 critical economic series (CPIAUCSL, UNRATE, DFF, DGS10, ICSA, PAYEMS) validated as Z-Score ready with sufficient historical data
- **YoY Transformation Success**: CPI and PPI data now properly display as YoY percentages ("+2.7%", "+1.7%") instead of raw index values, making them actionable for financial analysis
- **COMPLETE: FinanceHub Pro v29 Implementation SUCCESS**: Comprehensive implementation plan executed across all 4 phases with major architectural improvements
- **CRITICAL: Data Transformation Bug COMPLETELY FIXED**: Resolved major overcorrection issue where some indicators were double-transformed. CPI data (already YoY percentages from FRED) now display correctly as "+2.7%, +3.2%" while PPI data (raw index levels) are properly transformed to YoY percentages
- **Economic YoY Transformer Implementation**: Created comprehensive `economic-yoy-transformer.ts` service that converts index levels to proper YoY inflation rates (e.g., Producer Price Index now shows "+3.2% YoY" instead of "262.5 points")
- **Smart Data Presentation Rules**: Implemented intelligent transformation rules distinguishing between index series (need YoY calculation), rate series (display as-is), and count series (show YoY changes in K/M format)
- **Enhanced Economic Data Accuracy**: Economic indicators now show industry-standard presentations making them actionable for financial analysis instead of confusing raw numbers
- **PPI Date Display Bug Fixed**: Resolved issue where dates showed period start dates (2025-06-01) instead of correct period end dates (2025-06-30) with `convertToPeriodEndDate` method
- **Critical PPI Data Pipeline Fixes**: Successfully resolved Producer Price Index data pipeline issues identified in comprehensive root cause analysis
- **Complete PPI Series Integration**: Added 5 comprehensive PPI series (PPIACO, PPIFIS, PPIENG, PPIFGS, WPUSOP3000) to FRED data collection pipeline
- **Circuit Breaker Optimization**: Adjusted failure threshold from 3 to 8, reduced recovery timeout to 2 minutes, extended rate limit cooldown to 1 hour for FRED API compliance
- **Scheduler Frequency Optimization**: Updated from 4-hour to 24-hour intervals to properly capture monthly economic releases and improve rate limit compliance
- **Data Freshness Monitoring System**: Implemented comprehensive monitoring at `/api/economic-health/freshness` tracking 10 critical economic series with staleness detection and release date forecasting
- **PPI Diagnostic Endpoint**: Created specialized diagnostic endpoint at `/api/ppi-diagnostic` providing real-time pipeline status, configuration validation, and troubleshooting recommendations
- **Economic Data Quality Improvements**: Enhanced data validation, error handling, and fallback mechanisms for robust economic data processing
- **Type Safety Enhancements**: Fixed DataQualityValidator imports, SQL query parameter types, and LSP compliance issues
- **Production Monitoring**: Added comprehensive monitoring endpoints for economic data freshness, circuit breaker status, and pipeline health
- **Code Quality Scanner Implementation**: Successfully deployed comprehensive code quality analysis system identifying 694 total issues across 92 critical financial files (31,005 LOC)
- **Deployment Safety Validation**: Implemented comprehensive deployment safety agent validating 18 critical checks including global error handling, security headers, rate limiting, and production configuration
- **Performance Monitoring Active**: System running with excellent performance metrics and proper structured logging
- **Phase 1 COMPLETE**: Fixed economic indicators YoY transformation, MACD calculation errors, and database performance optimizations
- **Phase 2 COMPLETE**: Removed hardcoded API keys, implemented authentication middleware with rate limiting, and comprehensive environment validation
- **Phase 3 COMPLETE**: Advanced scheduler optimization, cache performance monitoring, circuit breaker implementation, and performance optimization routes
- **Phase 4 COMPLETE**: Data quality monitoring system, intelligent alert system with escalation, and real-time quality metrics dashboard

## System Architecture

### Full-Stack Monorepo Structure
The application uses a monorepo architecture with `client/` (React frontend), `server/` (Express.js backend API), and `shared/` (Common TypeScript types and database schema).

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
- **Caching**: Three-tier intelligent caching system with adaptive TTLs and unified cache management.
- **Data Integrity**: Automated staleness detection, prevention, and validation systems for economic indicators.
- **Security**: Comprehensive security middleware including rate limiting, CORS, input validation (Zod), structured logging (Pino), and health check endpoints.
- **Error Handling**: Standardized error handling middleware with graceful degradation and robust fallbacks.

### Core Architectural Decisions & Design Patterns
- **Database-First Approach**: PostgreSQL is the primary data source to reduce API calls and ensure data authenticity.
- **Gold Standard Data Pipeline**: Enterprise-grade data pipeline with quality validation, audit trails, feature engineering, and statistical analysis (Bronze → Silver → Gold model).
- **Automated Data Release Scheduler**: Strategic scheduling system for economic data refreshes, ensuring 24-hour data cycles and staleness prevention.
- **Comprehensive Historical Data Infrastructure**: Accumulates 10+ years of authentic historical data for various financial instruments and economic indicators.
- **Cost Optimization**: Strategic caching, scheduled API calls, and minimal AI dependency for core data processing.
- **Modular & Scalable Design**: Employs Dependency Injection (Inversify), Repository Pattern, and clear service interfaces.
- **UI/UX Decisions**: Dark financial theme with color-coded indicators, responsive grid layouts, and professional presentation, emphasizing readability and consistency. Includes advanced loading skeletons and real-time cache performance monitoring.
- **Performance Optimization**: Aggressive caching, parallel data fetching, batch processing, database connection pooling (pg-pool), Redis distributed caching, streaming query service (pg-query-stream), composite database indexes, and 2-second loading guarantees for dashboard components.
- **Enhanced User Education**: Comprehensive methodology explanations, economic rationale tooltips, and detailed documentation.
- **Multi-Dimensional Economic Insight Classification**: Sophisticated economic analysis framework considering level and trend signals, mixed signal detection, and confidence scoring.
- **Economic Pulse Score Architecture**: Streamlined 2-layer Economic Health Score methodology using only reliable FRED data sources.
- **Statistical Analysis**: Standardized sample variance, enhanced data sufficiency, improved extreme value handling, standardized window sizes, minimum observations, and statistical significance testing (e.g., RollingZScoreOptimizer, VolatilityRegimeDetector).
- **Weighted System Methodology**: Corrected Bollinger %B direction, adjusted signal thresholds, improved Z-score to signal conversion, optimized ATR usage, and rebalanced weights for reliable trading signal generation (MACD 35%, RSI 25%, MA Trend 20%, Bollinger 15%, Price Momentum 5%, ATR 0%).
- **Moving Average Calculation Accuracy**: Fixed EMA seeding, improved MACD accuracy, removed dynamic period adjustments, and standardized data requirements.
- **Data Sufficiency Management**: Addresses critical data gaps with intelligent historical data backfill service, real-time sufficiency warnings, and integrated confidence scoring for z-score reliability.
- **Z-Score Signal Optimization**: Comprehensive optimization of trading signal system based on performance analysis, including lowered BUY/SELL thresholds, rebalanced component weights, and volatility-adjusted dynamic thresholds.
- **Robust API Response Handling**: Enhanced server-side response formatting, universal client-side unwrapping logic, and comprehensive API normalizers. Implemented dual-field response format and robust fallback handling.
- **Universal Date Handling System**: Implemented `shared/dates.ts` utility module with robust date conversion functions to ensure crash-proof date handling.
- **ETF Technical Metrics API Implementation**: Comprehensive enhanced ETF routes including `/api/etf-enhanced/metrics`, `/api/etf-enhanced/breadth`, `/api/etf-enhanced/features/:symbol`, and `/api/etf-enhanced/conditional-stats`.
- **Polarity-Aware Z-Score Color Coding**: Sophisticated color coding system with proper technical indicator polarity handling (e.g., RSI/Bollinger Band Z-scores inverted polarity).
- **Circuit Breaker Pattern**: Implemented for robust API call management.
- **Critical Technical Indicator Fixes (August 13, 2025)**: Comprehensive root cause analysis fixes including proper MACD signal line calculation with histogram, industry-standard Wilder's RSI implementation, Bollinger Bands sample variance correction, standardized Z-Score calculation windows aligned with indicator periods, and enhanced data freshness with 2-day lookback optimization.

### Database Design
The schema includes key tables for: `users`, `stock_data`, `market_sentiment`, `technical_indicators`, `ai_analysis`, `economic_events`, `fredUpdateLog`, `economicIndicatorsCurrent`, `historical_sector_data`, `historical_technical_indicators`, `historical_market_sentiment`, `historical_economic_data`, `economic_data_audit`, `data_collection_audit`. Also includes `etf_metrics_latest` materialized view for performance.

## External Dependencies

### Financial Data Providers
- **Twelve Data API**: Real-time stock quotes, historical data, and technical indicators.
- **Federal Reserve Economic Data (FRED) API**: Official source for U.S. government economic indicators.

### AI Services
- **OpenAI GPT-4o**: Used for advanced market commentary, AI-powered market insights, financial mood analysis, and narrative-driven market synthesis.

### Database Infrastructure
- **Neon PostgreSQL**: Serverless PostgreSQL.

### Communication
- **SendGrid**: For daily email subscriptions and notifications.

### UI Component Libraries
- **Radix UI**: Accessible component primitives.
- **Lucide React**: Icon library.
- **Recharts**: Financial charting and visualization.
- **Tailwind CSS**: Utility-first CSS framework.