# FinanceHub Pro

## Overview

FinanceHub Pro is a comprehensive financial dashboard application providing real-time market data, technical analysis, AI-powered market insights, and financial tracking. It features a modern React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration. The platform includes enterprise-grade data integrity validation systems to ensure accurate economic indicator displays. The business vision is to provide a robust, cost-effective financial analysis tool for individual investors and financial professionals, leveraging authentic government and market data without reliance on expensive AI for core data processing.

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