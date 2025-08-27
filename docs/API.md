# FinanceHub Pro API Documentation

## Base URL
```
Development: http://localhost:5000/api
Production: https://your-domain.replit.app/api
```

## Authentication
Most endpoints are publicly accessible. External API keys are configured server-side.

## Rate Limiting
- **Default**: 100 requests per minute per IP
- **ETF Endpoints**: Cached responses with 5-minute refresh
- **Economic Data**: Cached with 24-hour refresh

---

## ETF Endpoints

### GET /api/etf/robust
Returns real-time ETF technical metrics with multiple fallback strategies.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "SPY",
      "name": "SPY ETF",
      "price": 646.61,
      "changePercent": 0.22475462,
      "volume": 2281646,
      "rsi": 45.41604405970731,
      "bollingerPercB": 0.5278560847898528,
      "sma50": 658.3591970557272,
      "sma200": 673.847585560051,
      "zScore": -0.09708636176338406,
      "rsiZScore": -0.3055970626861793,
      "bbZScore": 0.11142433915941119,
      "signal": "HOLD",
      "lastUpdated": "2025-08-27T20:32:52.102Z",
      "source": "live_api"
    }
  ],
  "source": "live_twelve_data_api",
  "timestamp": "2025-08-27T20:32:52.102Z",
  "performance": {
    "response_time_ms": 592,
    "data_count": 12,
    "api_version": "live_v1"
  }
}
```

### GET /api/etf/enhanced
Enhanced ETF data with comprehensive fallback mechanisms.

---

## Economic Data Endpoints

### GET /api/economic-health/dashboard
Returns comprehensive economic health scoring.

**Response:**
```json
{
  "economicHealthScore": 65,
  "scoreBreakdown": {
    "gdpHealth": 70,
    "employmentHealth": 75,
    "inflationStability": 60,
    "marketStability": 55
  },
  "confidence": 0.85,
  "timestamp": "2025-08-27T20:32:52Z"
}
```

### GET /api/macro/gdp-data
Returns latest GDP indicators from FRED.

### GET /api/macro/inflation-data
Returns inflation metrics (CPI, PPI) from FRED.

### POST /api/econ/sparklines/batch
Returns economic trend sparklines for multiple indicators.

**Request Body:**
```json
{
  "series": ["UNRATE", "PAYEMS", "CPIAUCSL"],
  "transform": "YOY",
  "periods": 12
}
```

---

## Market Status Endpoints

### GET /api/market-status
Returns current market session status.

**Response:**
```json
{
  "success": true,
  "status": {
    "isOpen": false,
    "isPremarket": false,
    "isAfterHours": true,
    "nextOpen": "2025-08-28T13:30:00.000Z",
    "nextClose": "2025-08-27T20:00:00.000Z",
    "session": "afterhours"
  },
  "frequencies": {
    "momentum": "5min",
    "technical": "1min",
    "economic": "daily"
  }
}
```

### GET /api/momentum-analysis
Returns sector momentum analysis with cached results.

---

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "DATA_UNAVAILABLE",
    "message": "Unable to fetch live market data",
    "details": "Twelve Data API rate limit exceeded",
    "timestamp": "2025-08-27T20:32:52Z"
  }
}
```

### Error Codes
- `DATA_UNAVAILABLE` - External API failed
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INVALID_PARAMETERS` - Bad request parameters
- `INTERNAL_ERROR` - Server error
- `CACHE_MISS` - Cached data unavailable

---

## Data Sources

### Twelve Data API
- **Rate Limit**: 144 calls/minute
- **Endpoints Used**: `/quote`, `/time_series`
- **Fallback**: Cached data with staleness warnings

### Federal Reserve Economic Data (FRED)
- **Rate Limit**: 120 calls/minute
- **Update Frequency**: Daily at market close
- **Coverage**: 100+ economic indicators

---

## Caching Strategy

### ETF Data
- **Memory Cache**: Sub-millisecond access
- **Materialized Views**: Database-level caching
- **Background Refresh**: Every 5 minutes
- **TTL**: 5 minutes for live data

### Economic Data
- **Cache Duration**: 24 hours
- **Refresh Strategy**: Daily at 6 AM EST
- **Fallback**: Last known good values

---

## WebSocket Integration

### Connection
```javascript
const ws = new WebSocket('ws://localhost:5000/ws');
```

### Events
- `market_status_update` - Market session changes
- `etf_data_refresh` - New ETF metrics available
- `cache_invalidation` - Cache refresh notifications

---

## Performance Metrics

### Response Time SLA
- ETF endpoints: < 2 seconds
- Economic data: < 1 second
- Market status: < 500ms

### Monitoring
All endpoints include performance tracking headers:
```
X-Response-Time: 592ms
X-Cache-Status: MISS
X-Data-Source: live_api
```