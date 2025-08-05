# FinanceHub Pro

## Overview

FinanceHub Pro is a comprehensive financial dashboard application providing real-time market data, technical analysis, AI-powered market insights, and financial tracking. It features a modern React frontend and an Express.js backend with PostgreSQL database integration. The platform includes enterprise-grade data integrity validation systems to ensure accurate economic indicator displays. The business vision is to provide a robust, cost-effective financial analysis tool for individual investors and financial professionals, leveraging authentic government and market data without reliance on expensive AI for core data processing.

## Recent Changes (August 5, 2025)

**Week 1 Critical Production Stability Fixes - COMPLETED:**
✅ **Database Connection Pool Optimization**: Fixed Neon serverless pool configuration with max 10 connections, 30s idle timeout, 10s connection timeout, and 7500 max uses per connection.
✅ **Historical Context Query Consolidation**: Replaced multiple sequential database queries with single consolidated JOIN query in historical-context-analyzer.ts for significant performance improvement.
✅ **React Query Configuration Standardization**: Updated all components to use 5-minute staleTime and 10-minute gcTime, disabled aggressive refetchInterval across 8+ components (BreakoutAnalysis, MarketBreadth, MarketSentiment, PriceChart, SectorTracker, EconomicCalendar, MacroeconomicIndicators, AISummaryOptimized, MomentumAnalysis).
✅ **Parallel Dashboard Loading Implementation**: Added getFastDashboardData() method to fast-dashboard-service.ts enabling simultaneous loading of momentum, economic, technical, and sentiment data components.

**Week 2 Performance Improvements - COMPLETED:**
✅ **Smart Cache TTL System**: Implemented intelligent cache TTL based on data type, market hours, and volatility (smart-cache-ttl.ts) with adaptive stale times from 30s for real-time market data to 30min for historical data.
✅ **Server-Side Formatting Service**: Created comprehensive pre-formatting system (server-side-formatting.ts) reducing client-side processing load with formatted currency, percentages, technical signals, and economic indicators.
✅ **WebSocket Stability Improvements**: Enhanced connection management (websocket-stability.ts) with intelligent reconnection, heartbeat monitoring, connection health scoring, and comprehensive error handling.

**Week 3 Optimization Enhancements - COMPLETED:**
✅ **Lazy Loading Optimization**: Implemented intelligent component loading (lazy-loading-optimization.ts) with priority-based scheduling, dependency management, and performance metrics tracking.
✅ **Batch Processing System**: Created request batching optimization (batch-processing.ts) with priority queuing, intelligent scheduling, and concurrent batch management for improved throughput.

**Week 4 User Experience Improvements - COMPLETED:**  
✅ **Enhanced Loading States**: Comprehensive loading UI components (loading-states.tsx) with contextual indicators, progress tracking, and error states with actionable recovery options.
✅ **Smart Caching Hook**: Advanced client-side caching (useSmartCaching.ts) with adaptive TTL, coordinated loading, preloading strategies, and cache optimization recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.
UI Preference: Clean, actionable interface without overly technical explanations that don't provide user value.

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
- **Caching**: Three-tier intelligent caching system with adaptive TTLs and unified cache management.
- **Data Integrity**: Automated staleness detection, prevention, and validation systems for economic indicators.
- **Security**: Comprehensive security middleware including rate limiting, CORS, input validation (Zod), structured logging (Pino), and health check endpoints.
- **Error Handling**: Standardized error handling middleware with graceful degradation and robust fallbacks.

### Core Architectural Decisions & Design Patterns
- **Database-First Approach**: Prioritizes PostgreSQL database as the primary data source for economic indicators and historical data to reduce API calls and ensure data authenticity.
- **Gold Standard Data Pipeline**: Complete enterprise-grade ingress→processing→egress pipeline with comprehensive data quality validation, audit trail tracking, feature engineering (YoY/MoM calculations), and statistical analysis with confidence scoring.
- **Automated Data Release Scheduler**: Strategic scheduling system with 10:15am ET weekday refresh for fresh economic releases, plus 8:45am early refresh for employment data and 2:15pm afternoon refresh for late releases.
- **Unified Data Refresh Scheduler**: Consolidates all economic data refresh logic into a single system, ensuring 24-hour data cycles and proactive staleness prevention.
- **Comprehensive Historical Data Infrastructure**: Accumulates 24+ months of authentic historical data for VIX, SPY, sector ETFs, and economic indicators to enable sophisticated statistical analysis.
- **Cost Optimization**: Strategic caching, scheduled API calls, and elimination of AI dependencies for core data processing to minimize operational costs.
- **Modular & Scalable Design**: Employs Dependency Injection (Inversify), Repository Pattern, and clear service interfaces for improved maintainability, testability, and scalability.
- **UI/UX Decisions**: Dark financial theme with color-coded indicators, responsive grid layouts, and professional presentation for market data and AI insights. Emphasis on readability and consistency across sections.
- **Performance Optimization**: Aggressive caching, parallel data fetching, batch processing, and 2-second loading guarantees for dashboard components.
- **Enhanced User Education**: Comprehensive methodology explanations, economic rationale tooltips, and detailed documentation for metrics.
- **Multi-Dimensional Economic Insight Classification**: Sophisticated economic analysis framework considering both level and trend signals, including mixed signal detection, inflation-specific logic, confidence scoring, and professional economic reasoning.
- **Economic Pulse Score Architecture**: Revolutionary Economic Health Score redesign with a 3-layer validation-driven methodology, prioritizing simplicity and predictive accuracy, using evidence-based component weighting and dynamic regime detection.
- **Technical Debt Elimination**: Focus on unified data flow architecture, enterprise rate limiting, batch processing, and intelligent caching.
- **Schema Streamlining**: Reduced database tables to core active tables.
- **Statistical Analysis Fixes**: Corrected sample variance, enhanced data sufficiency, improved extreme value handling, and standardized window sizes for Z-score implementations.
- **Weighted System Methodology Fixes**: Corrected Bollinger %B direction, adjusted signal thresholds, improved Z-score to signal conversion, optimized ATR usage, and rebalanced weights for reliable trading signal generation.
- **Moving Average Calculation Accuracy Fixes**: Fixed EMA seeding, improved MACD accuracy, removed dynamic period adjustments, and standardized data requirements for industry compliance.

### Database Design
The schema includes key tables for: `users`, `stock_data`, `market_sentiment`, `technical_indicators`, `ai_analysis`, `economic_events`, `fredUpdateLog`, `economicIndicatorsCurrent`, `historical_sector_data`, `historical_technical_indicators`, `historical_market_sentiment`, `historical_economic_data`, `economic_data_audit`, `data_collection_audit`.

## External Dependencies

### Financial Data Providers
- **Twelve Data API**: Primary source for real-time stock quotes, historical data, and technical indicators.
- **Federal Reserve Economic Data (FRED) API**: Official source for U.S. government economic indicators.

### AI Services
- **OpenAI GPT-4o**: Used for advanced market commentary, AI-powered market insights, financial mood analysis, and narrative-driven market synthesis (used judiciously for cost optimization).

### Database Infrastructure
- **Neon PostgreSQL**: Serverless PostgreSQL for scalable data storage.

### Communication
- **SendGrid**: For sending daily email subscriptions and notifications.

### UI Component Libraries
- **Radix UI**: Accessible component primitives for UI.
- **Lucide React**: Icon library.
- **Recharts**: Financial charting and visualization.
- **Tailwind CSS**: Utility-first CSS framework.