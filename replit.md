# FinanceHub Pro

## Overview

FinanceHub Pro is a comprehensive financial dashboard application built as a full-stack TypeScript application. It provides real-time market data, technical analysis, AI-powered market insights, and comprehensive financial tracking capabilities. The application features a modern React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration.

## Recent Changes (July 17, 2025)

### AI Market Commentary Enhancement (Latest Update)
- Added Substack link under main dashboard title for Rishabh's market insights
- FIXED: Restructured AI analysis format to eliminate repetitive content in Bottom Line Assessment
- First paragraph now generates proper technical and sentiment commentary (RSI, MACD, VIX, AAII insights)
- Second paragraph contains economic analysis with bold formatting for key metrics
- Third paragraph separated for sector performance and rotation analysis
- Enhanced number formatting: all prices/percentages display to exactly 1 decimal place
- Bold formatting implemented for economic readings (**Core CPI at 2.9%**, **Retail Sales at 1.0%**)
- RESOLVED: Fixed AI prompt issue where instruction text was appearing instead of actual analysis

### Market Hours Awareness Implementation
- Added market hours detection (9:30 AM - 4:00 PM ET) across all data display components
- Data pulls after market close reference "As of 4:00 PM ET (Market Closed)" timestamps
- Live market data indicators show "Live Market Data" during trading hours
- Optimized Twelve Data API usage to maximize 55 calls/minute rate limit

### Global Refresh System
- Implemented global refresh button in top-right header with comprehensive rate limiting
- Rate limits: 1 click per minute, maximum 5 refreshes per session to preserve API costs
- Refresh button forces fresh data pulls for all components (stocks, sectors, sentiment, technical indicators)
- Added countdown timer and session tracking to prevent API cost overruns

### Enhanced Sector Tracker
- Added 5-day performance column showing price changes from July 10-17, 2025
- Enhanced 1-month performance data with accurate historical calculations
- Fixed sector data structure: 1-Day, 5-Day, 1-Month performance columns now display correctly
- Market hours awareness in sector data timestamps
- Improved fallback data with realistic 5-day and 1-month performance metrics
- RESOLVED: Fixed missing fiveDayChange and oneMonthChange fields in API response
- All 12 sector ETFs now display complete performance data across all timeframes

### Technical Analysis Accuracy
- Corrected MACD bearish crossover detection: MACD line (8.256) vs Signal line (8.722)
- Fixed Technical Indicators title (removed "Show Caution" suffix)
- Always fetch fresh technical data to ensure real-time accuracy
- Enhanced MACD signal interpretation for proper bullish/bearish crossover identification

### Database Schema Enhancements
- Added historical economic data table for storing CPI, PPI, Retail Sales readings
- Enhanced sector data table with fiveDayChange and oneMonthChange columns
- Improved data persistence for offline/API limit fallback scenarios

### Data Authenticity Focus
- Eliminated all fake/static data sources throughout the dashboard
- VIX corrected to real 17.16, CPI updated to actual 2.7% June 2025 reading
- All economic events display precise timestamps and authentic market data
- Comprehensive fallback to database-stored historical data when API limits reached

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Monorepo Structure
The application uses a monorepo architecture with three main directories:
- `client/` - React frontend application
- `server/` - Express.js backend API
- `shared/` - Common TypeScript types and database schema

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom financial dashboard theme
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL with Neon serverless driver
- **Real-time**: WebSocket integration for live market data
- **External APIs**: Alpha Vantage for financial data, OpenAI for AI analysis

### Database Design
The schema includes several key tables:
- `users` - User authentication and management
- `stock_data` - Historical and real-time stock price data
- `market_sentiment` - VIX, put/call ratios, AAII sentiment data
- `technical_indicators` - RSI, MACD, Bollinger Bands, moving averages
- `ai_analysis` - GPT-4o generated market analysis and insights
- `economic_events` - Economic calendar and event tracking

## Key Components

### Real-Time Data Pipeline
- WebSocket connections for live market updates
- Periodic data fetching with configurable refresh intervals
- Caching strategy using TanStack Query for optimal performance
- Error handling and reconnection logic for reliable data flow

### Financial Data Services
- **FinancialDataService**: Integrates with Alpha Vantage API for stock quotes and technical indicators
- **AIAnalysisService**: Uses OpenAI GPT-4o for intelligent market analysis
- Data validation and transformation using Zod schemas

### Dashboard Components
- **LivePriceFeed**: Real-time stock price updates with WebSocket integration
- **MarketSentiment**: VIX, put/call ratios, and AAII sentiment indicators
- **PriceChart**: Interactive price charts with technical overlays
- **AIAnalysis**: GPT-4o powered market commentary and insights
- **SectorTracker**: Sector performance monitoring and rotation detection
- **EconomicCalendar**: Upcoming economic events and announcements

### UI/UX Design System
- Dark financial theme optimized for trading environments
- Color-coded indicators (green for gains, red for losses, yellow for warnings)
- Responsive grid layout adapting to different screen sizes
- Accessibility features including proper ARIA labels and keyboard navigation

## Data Flow

### Client-Side Data Management
1. TanStack Query manages all server state with automatic caching
2. WebSocket hook provides real-time updates for price feeds
3. Components subscribe to relevant data streams based on symbols/timeframes
4. Optimistic updates for better perceived performance

### Server-Side Processing
1. Express routes handle REST API requests for historical data
2. Background services fetch data from external APIs (Alpha Vantage, OpenAI)
3. Drizzle ORM handles database operations with full type safety
4. WebSocket server broadcasts real-time updates to connected clients

### Database Operations
1. Stock data ingestion with deduplication and validation
2. Technical indicator calculations stored for historical analysis
3. AI analysis generation triggered by significant market events
4. User session management with PostgreSQL session store

## External Dependencies

### Financial Data Provider
- **Alpha Vantage API**: Primary source for stock quotes, historical data, and technical indicators
- Rate limiting and error handling for API quotas
- Fallback mechanisms for service disruptions

### AI Services
- **OpenAI GPT-4o**: Advanced market analysis and commentary generation
- Structured prompts for consistent analysis format
- Confidence scoring and risk assessment integration

### Database Infrastructure
- **Neon PostgreSQL**: Serverless PostgreSQL for scalable data storage
- Connection pooling and automatic scaling
- Backup and recovery mechanisms

### UI Component Libraries
- **Radix UI**: Accessible component primitives
- **Lucide React**: Consistent icon library
- **Recharts**: Financial charting and visualization
- **Tailwind CSS**: Utility-first styling framework

## Deployment Strategy

### Development Environment
- Vite dev server with HMR for fast frontend development
- tsx for TypeScript execution in development
- Concurrent frontend and backend development with proxy configuration

### Production Build Process
1. Vite builds optimized frontend bundle
2. esbuild compiles backend TypeScript to ESM
3. Static assets served from Express server
4. Environment-specific configuration management

### Environment Configuration
- Database URL configuration for different environments
- API key management for external services
- WebSocket URL adaptation for production domains
- CORS and security headers for production deployment

### Monitoring and Reliability
- Structured logging for API requests and responses
- Error boundaries for graceful frontend error handling
- Database migration system using Drizzle Kit
- Health check endpoints for service monitoring