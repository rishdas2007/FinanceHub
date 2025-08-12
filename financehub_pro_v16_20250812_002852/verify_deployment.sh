#!/bin/bash

echo "🔍 FinanceHub Pro v16.0.0 - Deployment Verification"
echo "=================================================="

# Check if server is running
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo "✅ Server is running"
else
    echo "❌ Server is not responding"
    exit 1
fi

# Check ETF metrics endpoint
ETF_RESPONSE=$(curl -s http://localhost:5000/api/etf-metrics)
ETF_COUNT=$(echo "$ETF_RESPONSE" | jq '.data | length' 2>/dev/null || echo "0")

if [ "$ETF_COUNT" -eq 12 ]; then
    echo "✅ ETF Metrics: 12 ETFs loaded successfully"
else
    echo "❌ ETF Metrics: Only $ETF_COUNT ETFs loaded (expected 12)"
fi

# Check database connectivity
DB_RESPONSE=$(curl -s http://localhost:5000/api/health)
DB_STATUS=$(echo "$DB_RESPONSE" | jq -r '.db' 2>/dev/null || echo "false")

if [ "$DB_STATUS" = "true" ]; then
    echo "✅ Database: Connected and healthy"
else
    echo "❌ Database: Connection issues detected"
fi

# Check for 500 errors in recent logs
echo "🔍 Checking for recent errors..."
if [ -f "/tmp/financehub.log" ]; then
    ERROR_COUNT=$(grep -c "500\|Internal Server Error" /tmp/financehub.log 2>/dev/null || echo "0")
    if [ "$ERROR_COUNT" -eq 0 ]; then
        echo "✅ Error Logs: No 500 errors detected"
    else
        echo "⚠️  Error Logs: $ERROR_COUNT 500 errors found"
    fi
else
    echo "ℹ️  Error Logs: No log file found (normal for new deployment)"
fi

echo "=================================================="
echo "🎯 Deployment verification complete!"
