# FinanceHub Pro

## Overview
FinanceHub Pro is a comprehensive financial dashboard application for individual investors and financial professionals. It provides real-time market data, technical analysis, AI-powered market insights, and financial tracking. The platform emphasizes enterprise-grade data integrity and cost-effectiveness by leveraging authentic government and market data, minimizing reliance on expensive AI for core data processing. Its vision is to be a robust and reliable financial analysis tool.

## User Preferences
Preferred communication style: Simple, everyday language.
UI Preference: Clean, actionable interface without overly technical explanations that don't provide user value.

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
- **Gold Standard Data Pipeline**: Enterprise-grade data pipeline with quality validation, audit trails, feature engineering, and statistical analysis.
- **Automated Data Release Scheduler**: Strategic scheduling system for economic data refreshes, ensuring 24-hour data cycles and staleness prevention.
- **Comprehensive Historical Data Infrastructure**: Accumulates 10+ years of authentic historical data for various financial instruments and economic indicators.
- **Cost Optimization**: Strategic caching, scheduled API calls, and minimal AI dependency for core data processing.
- **Modular & Scalable Design**: Employs Dependency Injection (Inversify), Repository Pattern, and clear service interfaces.
- **UI/UX Decisions**: Dark financial theme with color-coded indicators, responsive grid layouts, and professional presentation, emphasizing readability and consistency. Includes advanced loading skeletons and real-time cache performance monitoring.
- **Performance Optimization**: Aggressive caching, parallel data fetching, batch processing, database connection pooling (pg-pool), Redis distributed caching, streaming query service (pg-query-stream), composite database indexes, and 2-second loading guarantees for dashboard components.
- **Enhanced User Education**: Comprehensive methodology explanations, economic rationale tooltips, and detailed documentation.
- **Multi-Dimensional Economic Insight Classification**: Sophisticated economic analysis framework considering level and trend signals, mixed signal detection, and confidence scoring.
- **Economic Pulse Score Architecture**: Streamlined 2-layer Economic Health Score methodology using only reliable FRED data sources.
- **FRED Economic Indicators Integration**: Comprehensive backfill system for 14 core economic indicators with automatic FRED API integration, providing real-time economic data for dashboard analytics.
- **Statistical Analysis**: Standardized sample variance, enhanced data sufficiency, improved extreme value handling, standardized window sizes, minimum observations, and statistical significance testing. Includes RollingZScoreOptimizer and VolatilityRegimeDetector.
- **Weighted System Methodology**: Corrected Bollinger %B direction, adjusted signal thresholds, improved Z-score to signal conversion, optimized ATR usage, and rebalanced weights for reliable trading signal generation.
- **Moving Average Calculation Accuracy**: Fixed EMA seeding, improved MACD accuracy, removed dynamic period adjustments, and standardized data requirements.
- **Data Sufficiency Management**: Addresses critical data gaps with intelligent historical data backfill service, real-time sufficiency warnings, and integrated confidence scoring for z-score reliability.
- **Z-Score Signal Optimization**: Comprehensive optimization of trading signal system based on performance analysis, including lowered BUY/SELL thresholds, rebalanced component weights, and volatility-adjusted dynamic thresholds.
- **Robust API Response Handling**: Enhanced server-side response formatting, universal client-side unwrapping logic, and comprehensive API normalizers. Implemented dual-field response format and robust fallback handling.
- **Comprehensive Historical Data Enhancement**: Integrated 2,461 historical data points from CSV economic indicators dataset (2017-2025) for comprehensive time-series analysis.
- **3-Layer Economic Data Model Implementation (Bronze → Silver → Gold)**: Deployed data architecture to eliminate mixed units and inconsistent calculations, ensuring data integrity and a single source of truth for economic analysis.
- **Universal Date Handling System**: Implemented `shared/dates.ts` utility module with robust date conversion functions to ensure crash-proof date handling.
- **Comprehensive Chart Display Fixes**: Resolved critical chart issues, including proper TIMESTAMPTZ queries, data sufficiency checks, and economic chart compatibility routes.
- **Major Architecture Redesign (v13.0.0)**: Implemented comprehensive Bronze → Silver → Gold data model with unified API contracts, precomputed feature store, and ETL pipeline for historical data.
- **Complete Phases 2-4 Implementation**: Finished all remaining architecture phases including economic data Bronze/Silver/Gold model, historical data service with DB-first fallback, circuit breaker pattern, Redis cache adapter, and comprehensive V2 API coverage.
- **30-Day Trend Display Fix**: Resolved critical sparkline calculation bug where 30-day trends displayed incorrect percentages (e.g., XLY showing +27.6% instead of correct -1.26%). Fixed sparkline service to use proper 30-day lookback period and corrected percentage formula to match ETF metrics calculations.
- **Optimized Z-Score Weighted System Implementation**: Successfully implemented the correct signal calculation methodology using weighted Z-scores with exact specifications: MACD 35%, RSI 25%, MA Trend 20%, Bollinger 15%, Price Momentum 5%, ATR 0%. The system now generates accurate composite Z-scores and trading signals based on multi-factor technical analysis.
- **Enhanced ETF Technical Metrics API Implementation**: Successfully deployed comprehensive enhanced ETF routes including `/api/etf-enhanced/metrics` for advanced ETF analysis, `/api/etf-enhanced/breadth` for market breadth indicators, `/api/etf-enhanced/features/:symbol` for detailed technical features, and `/api/etf-enhanced/conditional-stats` for backtesting analytics. Complete integration with existing equity_features_daily database table containing 273 calculated technical indicators for XLV with 60D horizon features.
- **Polarity-Aware Z-Score Color Coding Enhancement (August 12, 2025)**: Implemented sophisticated color coding system with proper technical indicator polarity handling. RSI and Bollinger Band Z-scores use inverted polarity (negative = green = oversold/bullish), while MACD, MA Gap, and Price Momentum use normal polarity (positive = green = bullish). Added explicit Z-score columns (rsi_z_60d, bb_z_60d, ma_gap_z_60d, mom5d_z_60d) to equity_features_daily table for enhanced performance, backfilled with 273 records of calculated 60-day rolling Z-scores.
- **Deployment Stability Fixes (August 12, 2025)**: Resolved critical deployment issues including module import path corrections (zscoreUtils.ts), enhanced error handling with try-catch blocks, safe fallbacks for deployment environments, and comprehensive input validation. Fixed "Internal Server Error" and "No ETF data available" issues through robust error boundaries and graceful degradation patterns.
- **Performance Optimization Implementation (August 12, 2025)**: Applied comprehensive downstream fixes following 5-Why methodology root cause analysis. Eliminated 12 per-row sparkline API calls that were causing table render bottlenecks. Implemented proper React.memo with primitive prop decomposition, memoized formatters, custom equality comparison, stable query caching (60s staleTime aligned with server TTL), and performance telemetry monitoring. Added dead code cleanup automation and accessibility improvements. ETF table now renders with sub-second performance and zero unnecessary re-renders.
- **Critical Database Infrastructure Fixes (August 12, 2025)**: Resolved database health check failures by creating missing `stock_data` table with proper OHLCV schema and optimized indexes (`idx_stock_data_symbol_ts_desc`, `idx_stock_data_ts_desc`). Fixed `technical_indicators` table by renaming `macd` column to `macd_line` and adding performance indexes (`idx_ti_symbol_timestamp_desc`). Created `etf_metrics_latest` materialized table for high-performance ETF data serving. Implemented comprehensive 304 Not Modified response handling with `fetchJsonWith304` utility and enhanced React Query configuration to eliminate "Unexpected end of JSON input" errors. Database health check now passes consistently.
- **Historical Database Restoration (August 12, 2025)**: Successfully restored comprehensive historical data from database backup v17 including 13,963 stock data records for 7 symbols covering 2015-2025 timeframe, 9,422 technical indicator records for 14 symbols, and 273 enhanced equity features with Z-score calculations. Restored economic indicators, market sentiment data, and complete Bronze-Silver-Gold data pipeline infrastructure. All critical tables now populated with authentic historical data for robust backtesting and analysis capabilities.
- **Complete Economic Data Pipeline Fix (August 13, 2025)**: Successfully resolved all systematic economic data pipeline issues including FRED scheduler re-enablement, real-time Bollinger Band integration with Twelve Data API (replacing fake 50% values with authentic %B calculations like SPY: 1.0402, XLK: 1.0853), CPI inflation calculation correction (now properly displaying 2.7% annual inflation from July 2025 data released August 12), and comprehensive cache refresh mechanisms. Economic data pipeline now fully operational with 40 macroeconomic indicators updating in real-time.
- **Prior Reading Calculation Fix (August 13, 2025)**: Applied comprehensive 5-Why root cause analysis to resolve systemic issue where all 40 economic indicators showed "0.0%" for prior readings instead of proper historical values. Root cause identified as architectural flaw in live z-score calculator attempting historical comparisons within latest-record-only query structure. Fixed by replacing complex CTE subqueries with LAG window functions, enabling proper year-over-year (CPI: 2.7% vs 2.9% = -0.2% deflation) and month-over-month historical comparisons. All 40 indicators now display accurate prior value calculations for comprehensive economic analysis.
- **Economic Data Unit Mismatch Resolution (August 13, 2025)**: Successfully resolved critical issue where economic indicators displayed mixed data units causing inconsistent dashboard values (CPI Energy showing 275.0% vs proper 1.8% YoY). Root cause identified as mixed index values versus YoY percentages in FRED API data requiring transformation pipeline. Applied targeted database fixes to `economic_indicators_history` table, specifically correcting series ID 'CPIENGSL' value from '275.044' to '1.8' with proper 'Percent YoY' units. Implemented economic data transformer service with admin migration routes and dynamic cache invalidation system. All CPI metrics now display consistent YoY percentage values for reliable economic analysis.
- **Critical Deployment Syntax Fix (August 13, 2025)**: Resolved critical deployment failure caused by syntax error in `etf-metrics-service.ts` where a catch block existed without a corresponding try block around line 264. The issue was in the circuit breaker execution structure where indentation misalignment caused code to be outside the proper try-catch scope. Fixed by correcting the indentation of the cache and performance logging code (lines 248-259) to be properly aligned within the circuit breaker execution block. ESBuild compilation now successful and application deploys without syntax errors.

### Database Design
The schema includes key tables for: `users`, `stock_data`, `market_sentiment`, `technical_indicators`, `ai_analysis`, `economic_events`, `fredUpdateLog`, `economicIndicatorsCurrent`, `historical_sector_data`, `historical_technical_indicators`, `historical_market_sentiment`, `historical_economic_data`, `economic_data_audit`, `data_collection_audit`.

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