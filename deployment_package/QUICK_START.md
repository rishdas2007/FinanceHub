# FinanceHub Pro - Quick Start Guide

## Prerequisites
- Node.js 20+
- PostgreSQL 14+
- API Keys (see .env.example)

## 1. Quick Setup (5 minutes)

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Setup database
createdb financehub_pro
# Edit DATABASE_URL in .env

# Initialize database
npm run db:push

# Start application
npm run dev
```

## 2. Required API Keys

Get these API keys and add them to your `.env` file:

1. **FRED API Key** (Free): https://fred.stlouisfed.org/docs/api/api_key.html
2. **Twelve Data API Key** (Free tier available): https://twelvedata.com/
3. **OpenAI API Key**: https://platform.openai.com/api-keys
4. **SendGrid API Key** (Optional): https://sendgrid.com/

## 3. Production Deployment

### Docker (Recommended)
```bash
docker build -t financehub-pro .
docker run -p 5000:5000 --env-file .env financehub-pro
```

### PM2 (Traditional Server)
```bash
npm install -g pm2
npm run build
pm2 start ecosystem.config.js
```

### Platform Deployment
Works with: Vercel, Railway, Render, DigitalOcean App Platform
- Upload files
- Set environment variables
- Connect PostgreSQL database

## 4. Verify Installation

1. Open http://localhost:5000
2. Check Economic Analysis shows 25+ indicators
3. Verify Momentum Analysis displays sector data
4. Confirm no "N/A" values in dashboard

## 5. Key Features Included

✅ **40+ Economic Indicators** from Federal Reserve  
✅ **Real-time Z-Score Analysis** with statistical significance  
✅ **Sector Momentum Tracking** with 12 ETFs  
✅ **Data Integrity Monitoring** (mixed units fixed)  
✅ **Delta-Adjusted Z-Scores** with economic directionality  
✅ **Performance Optimized** (<1 second load times)  

## 6. Troubleshooting

**Database Connection Issues**:
- Verify PostgreSQL is running
- Check DATABASE_URL format: `postgresql://user:pass@host:port/db`

**API Key Issues**:
- Verify all required keys are in .env
- Check API key permissions and quotas

**Build Issues**:
- Use Node.js 20+
- Run `npm install` to ensure all dependencies

**Performance Issues**:
- Verify database indexes are created
- Check API key rate limits
- Enable caching in production

## Support
See README.md for complete documentation and architecture details.