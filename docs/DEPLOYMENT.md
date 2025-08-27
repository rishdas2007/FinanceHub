# FinanceHub Pro - Deployment Guide

## Quick Deploy to Replit (Recommended)

FinanceHub Pro is optimized for Replit deployment with zero configuration:

1. **Fork/Import** the repository to Replit
2. **Set Environment Variables** in the Secrets tab:
   ```bash
   TWELVE_DATA_API_KEY=your_api_key_here
   FRED_API_KEY=your_fred_key_here
   DATABASE_URL=your_neon_postgres_url
   ```
3. **Click Deploy** - Replit will handle the build and deployment automatically

Your app will be available at: `https://your-repl-name.your-username.replit.app`

---

## Manual Deployment

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Redis (optional, falls back to in-memory cache)

### Build Process
```bash
# Install dependencies
npm install

# Build the application
npm run build

# Push database schema
npm run db:push

# Start production server
npm start
```

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://user:password@host:port/database
TWELVE_DATA_API_KEY=your_twelve_data_api_key
FRED_API_KEY=your_fred_api_key

# Optional
REDIS_URL=redis://localhost:6379
SENDGRID_API_KEY=your_sendgrid_key
OPENAI_API_KEY=your_openai_key
NODE_ENV=production
PORT=5000
```

---

## Database Setup

### Neon PostgreSQL (Recommended)
1. Create account at [neon.tech](https://neon.tech)
2. Create new project with PostgreSQL 14+
3. Copy connection string to `DATABASE_URL`
4. Database schema will be automatically created

### Self-hosted PostgreSQL
```sql
-- Create database
CREATE DATABASE financehub_pro;

-- Create user (optional)
CREATE USER financehub WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE financehub_pro TO financehub;
```

### Schema Deployment
```bash
# Push schema to database
npm run db:push

# Force push (if needed)
npm run db:push --force

# Verify schema
npm run db:studio
```

---

## API Keys Setup

### Twelve Data API
1. Sign up at [twelvedata.com](https://twelvedata.com)
2. Get your API key from the dashboard
3. Add to environment as `TWELVE_DATA_API_KEY`
4. **Rate Limit**: 144 calls/minute (free tier)

### FRED API
1. Register at [fred.stlouisfed.org](https://fred.stlouisfed.org)
2. Request API key (usually instant approval)
3. Add to environment as `FRED_API_KEY`
4. **Rate Limit**: 120 calls/minute

### SendGrid (Optional)
1. Create account at [sendgrid.com](https://sendgrid.com)
2. Generate API key with mail send permissions
3. Add to environment as `SENDGRID_API_KEY`

---

## Production Configuration

### Docker Deployment
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000
CMD ["npm", "start"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - TWELVE_DATA_API_KEY=${TWELVE_DATA_API_KEY}
      - FRED_API_KEY=${FRED_API_KEY}
    depends_on:
      - redis
      
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### PM2 Process Manager
```json
{
  "apps": [{
    "name": "financehub-pro",
    "script": "server/index.js",
    "instances": "max",
    "exec_mode": "cluster",
    "env": {
      "NODE_ENV": "production",
      "PORT": 5000
    }
  }]
}
```

---

## Health Checks & Monitoring

### Health Endpoints
```bash
# Application health
curl http://localhost:5000/health

# Database health
curl http://localhost:5000/health/db

# External APIs health
curl http://localhost:5000/health/apis
```

### Performance Monitoring
The application includes built-in performance tracking:
- Response time monitoring
- Cache hit ratio tracking
- Database connection health
- External API success rates

### Logging
Structured logging with Pino:
```bash
# View logs in development
npm run dev

# Production logs (JSON format)
tail -f logs/app.log | npx pino-pretty
```

---

## Security Considerations

### Environment Security
- Never commit API keys to version control
- Use environment variables for all secrets
- Rotate API keys regularly
- Enable API key restrictions where possible

### Network Security
- Use HTTPS in production (handled by Replit)
- Configure CORS for your domain only
- Enable rate limiting (configured automatically)
- Regular security dependency updates

### Database Security
- Use connection pooling (enabled by default)
- Enable SSL connections (required by Neon)
- Regular database backups
- Monitor for unusual query patterns

---

## Performance Optimization

### Caching Configuration
```javascript
// Cache settings in production
const cacheConfig = {
  etf_data: {
    ttl: 300, // 5 minutes
    refreshInterval: 300000
  },
  economic_data: {
    ttl: 86400, // 24 hours
    refreshInterval: 3600000
  }
};
```

### Database Optimization
```sql
-- Recommended indexes (auto-created by Drizzle)
CREATE INDEX idx_technical_indicators_symbol_date ON technical_indicators(symbol, date);
CREATE INDEX idx_economic_data_series_date ON historical_economic_data(series_id, date);
CREATE INDEX idx_etf_metrics_symbol ON etf_metrics_latest(symbol);
```

---

## Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check environment variables
node -e "console.log(process.env.DATABASE_URL ? 'DB OK' : 'DB MISSING')"

# Test database connection
npm run db:studio
```

**External API errors:**
```bash
# Test Twelve Data API
curl "https://api.twelvedata.com/quote?symbol=SPY&apikey=YOUR_KEY"

# Test FRED API
curl "https://api.stlouisfed.org/fred/series?series_id=GDP&api_key=YOUR_KEY&file_type=json"
```

**High memory usage:**
- Check cache size: Visit `/health` endpoint
- Monitor Redis usage: `redis-cli info memory`
- Review database connections: Check connection pool status

### Log Analysis
```bash
# Filter error logs
grep "ERROR" logs/app.log

# Monitor API performance
grep "response_time" logs/app.log | tail -50

# Check external API failures
grep "external_api_error" logs/app.log
```

---

## Backup & Recovery

### Database Backup
```bash
# Automated daily backups (Neon Pro)
# Manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Application State
- Source code: Version controlled in Git
- Environment variables: Documented in deployment
- Database schema: Managed by Drizzle migrations
- Cache: Rebuilt automatically from source data

### Recovery Process
1. Deploy latest code from Git
2. Restore database from backup (if needed)
3. Set environment variables
4. Run health checks
5. Verify data integrity

---

## Scaling Considerations

### Horizontal Scaling
- Application is stateless (suitable for load balancing)
- Database connection pooling handles concurrent users
- Redis cache can be shared across instances

### Vertical Scaling
- Monitor memory usage (Redis cache size)
- Database connection limits (adjust pool size)
- API rate limits (upgrade plans if needed)

### Performance Targets
- **Response Time**: < 2 seconds for all endpoints
- **Uptime**: 99.9% availability target
- **Concurrent Users**: 100+ supported with basic setup
- **Data Freshness**: ETF data < 5 minutes old, Economic data < 24 hours old