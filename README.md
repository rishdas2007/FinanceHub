# FinanceHub Pro

> A comprehensive financial dashboard application for individual investors and financial professionals.

![FinanceHub Pro](https://img.shields.io/badge/status-active-brightgreen) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB) ![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)

## Overview

FinanceHub Pro provides real-time market data, technical analysis, AI-powered market insights, and financial tracking. The platform emphasizes enterprise-grade data integrity and cost-effectiveness by leveraging authentic government and market data sources.

## Features

### 📊 Real-Time Market Analysis
- **ETF Technical Indicators**: RSI, MACD, Bollinger Bands with Z-score calculations
- **12 Major ETFs**: SPY, QQQ, XLK, XLF, XLE, XLV, XLI, XLY, XLP, XLB, XLC, XLRE
- **Trading Signals**: Buy/Hold/Sell recommendations based on technical analysis
- **5-Day Performance Tracking**: Historical price changes and momentum analysis

### 🏛️ Economic Data Integration
- **Federal Reserve (FRED) API**: Official U.S. government economic indicators
- **Economic Calendar**: Key releases and market-moving events
- **Market Sentiment**: AAII investor sentiment tracking
- **Automated Data Collection**: Scheduled updates during market hours

### 🎯 Advanced Analytics
- **Z-Score Analysis**: Statistical deviation calculations for technical indicators
- **Moving Average Analysis**: 20-day, 50-day, 200-day trend analysis
- **Sector Performance**: Cross-sector ETF comparison and analysis
- **Historical Data**: 10+ years of accumulated financial data

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Wouter** for routing
- **TanStack Query** for state management
- **shadcn/ui** components (Radix UI primitives)
- **Tailwind CSS** with custom financial theme
- **Vite** for build tooling

### Backend
- **Node.js** with Express.js
- **TypeScript** with ES modules
- **Drizzle ORM** for database management
- **PostgreSQL** with Neon serverless driver
- **WebSocket** integration for real-time data
- **Intelligent cron scheduling** for market-aware updates

### Data Sources
- **Twelve Data API**: Real-time stock quotes and technical indicators
- **Federal Reserve Economic Data (FRED)**: Official economic indicators
- **parse.bot**: ETF percentage change calculations
- **Market sentiment providers**: AAII investor sentiment

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database
- API keys for:
  - [Twelve Data](https://twelvedata.com/) 
  - [FRED (Federal Reserve)](https://fred.stlouisfed.org/docs/api/api_key.html)
  - [parse.bot](https://parse.bot/) (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/financehub-pro.git
   cd financehub-pro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/financehub
   FRED_API_KEY=your_fred_api_key
   TWELVE_DATA_API_KEY=your_twelve_data_key
   PARSE_BOT_API_KEY=your_parse_bot_key
   PORT=5000
   ```

4. **Initialize database**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5000`

## Architecture

### Monorepo Structure
```
├── client/          # React frontend
├── server/          # Express.js backend
├── shared/          # Common TypeScript types and database schema
└── scripts/         # Utility scripts and archived code
```

### Key Design Patterns
- **Database-First Approach**: PostgreSQL as primary data source
- **Gold Standard Data Pipeline**: Bronze → Silver → Gold data quality model
- **Intelligent Caching**: Three-tier caching with adaptive TTLs
- **Circuit Breaker Pattern**: Robust API call management
- **Dependency Injection**: Modular and scalable service design

## API Endpoints

### ETF Data
- `GET /api/etf/robust` - Real-time ETF data with technical indicators
- `GET /api/etf-five-day-changes` - 5-day percentage changes
- `GET /api/etf-metrics` - Historical ETF metrics

### Economic Data
- `GET /api/econ/dashboard` - Economic indicators dashboard
- `GET /api/economic-calendar-simple` - Upcoming economic events
- `POST /api/admin/refresh-economic-data` - Manual FRED data refresh

### Market Data
- `GET /api/market-status` - Current market session status
- `GET /api/momentum-analysis` - Market momentum indicators

## Performance Optimizations

- **ETF 5-Minute Caching**: 99.5% performance improvement (12.6s → 55ms)
- **Database Connection Pooling**: Optimized PostgreSQL connections
- **Materialized Views**: Pre-computed ETF metrics for fast access
- **Parallel Data Fetching**: Concurrent API calls and processing
- **Memory Management**: Optimized scheduler frequencies to prevent leaks

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Federal Reserve Economic Data (FRED)** for providing official economic indicators
- **Twelve Data** for real-time financial market data
- **shadcn/ui** for excellent React component library
- **Neon** for serverless PostgreSQL hosting

---

**Live Demo**: [https://your-replit-url.replit.app](https://719f66fe-5d99-46e3-807b-82ae03bf00d5-00-3dmdpf2rwqm1n.riker.replit.dev)

*Built with ❤️ for the financial community*