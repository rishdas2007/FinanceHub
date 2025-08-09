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
- **Economic Pulse Score Architecture**: Streamlined 2-layer Economic Health Score methodology using only reliable FRED data sources. Removed Layer 3 (Forward-Looking Confidence) due to unreliable Consumer Confidence data availability, redistributing 15% weight across proven economic indicators.
- **FRED Economic Indicators Integration**: Comprehensive backfill system for 14 core economic indicators with automatic FRED API integration, providing real-time economic data for dashboard analytics.
- **Statistical Analysis**: Standardized sample variance, enhanced data sufficiency, improved extreme value handling, standardized window sizes (EQUITIES: 2520 days, ETF_TECHNICAL: 252 days), minimum observations (EQUITIES: 1260 minimum), and statistical significance testing. Includes RollingZScoreOptimizer and VolatilityRegimeDetector.
- **Weighted System Methodology**: Corrected Bollinger %B direction, adjusted signal thresholds, improved Z-score to signal conversion, optimized ATR usage, and rebalanced weights for reliable trading signal generation.
- **Moving Average Calculation Accuracy**: Fixed EMA seeding, improved MACD accuracy, removed dynamic period adjustments, and standardized data requirements.
- **Data Sufficiency Management**: Addresses critical data gaps with intelligent historical data backfill service using Twelve Data and FRED APIs, real-time sufficiency warnings, and integrated confidence scoring for z-score reliability. Includes optimized validation thresholds for 10-year datasets and dynamic minimum observation requirements.
- **Z-Score Signal Optimization**: Comprehensive optimization of trading signal system based on performance analysis, including lowered BUY/SELL thresholds, rebalanced component weights, and volatility-adjusted dynamic thresholds.
- **Data Integrity Enforcement (August 2025)**: Eliminated all placeholder/fallback values throughout the financial services. Removed 641+ corrupted database records with identical fake SMA/RSI values across different ETFs. Replaced hardcoded fallback values with proper null handling and authentic data validation. Services now throw descriptive errors instead of showing misleading synthetic data when real data is unavailable.
- **ETF Technical Metrics Performance Optimization (August 2025)**: Achieved 86% performance improvement by reducing API response time from 2.07s to under 300ms. Implemented parallel processing for all 12 ETFs, dual-tier caching system (fast cache 120s + standard cache 300s), timeout protection for database operations, and robust error handling. Fixed critical JavaScript runtime errors and syntax issues preventing server startup. Added comprehensive formatNumber() safety functions to handle null values gracefully.
- **API Quota Optimization (August 2025)**: Removed momentum analysis table and excessive API-heavy features that were consuming 1-day, 5-day, and 1-month percentage change calculations. Implemented rate limit detection to prevent storing corrupted null data when API limits are exceeded. Prioritized core ETF metrics and economic indicators over resource-intensive momentum calculations.
- **PAYEMS Data Correction (August 2025)**: Fixed critical PAYEMS (Nonfarm Payrolls) data corruption where employment levels (159M+ people) were being used instead of month-over-month job changes. Implemented proper change calculation logic that converts FRED employment levels to realistic job change values (14k-323k range) matching official BLS reporting standards. Restored data integrity for accurate Economic Pulse Score calculations.
- **Market Hours Caching Strategy Restoration (August 2025)**: Restored intelligent caching system that adjusts update frequencies and TTLs based on market status. During market hours: momentum updates every 2 minutes, economic data every 30 minutes. After hours: reduced frequencies (60-240 minutes) to optimize API usage while maintaining data freshness. Fixed cron scheduler errors preventing market-aware operations.
- **Complete Deployment Package v5.0.0 (August 2025)**: Created comprehensive deployment package including critical z-score data fix, all performance optimizations, complete database schema and data, Docker configurations, and full documentation. Package size: 2.7MB with complete application codebase ready for production deployment.
- **Economic Data Recovery System v6.0.0 (August 2025)**: Implemented comprehensive solution for missing historical economic data. Created Economic Delta Calculator for processing raw FRED data into delta-adjusted versions (monthly/annual changes, z-scores), Optimized FRED Scheduler with rate limiting and priority-based collection, and complete API system for data recovery. Addresses 21 missing economic indicators including critical jobless claims, payrolls, inflation, and housing data. System enables full economic z-score analysis alongside existing technical indicators.

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