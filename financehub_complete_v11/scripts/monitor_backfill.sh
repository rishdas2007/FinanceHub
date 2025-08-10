#!/bin/bash

# Historical Data Backfill Monitor
# Checks progress every 5 minutes and notifies when complete

LOG_FILE="/tmp/backfill_monitor.log"
PROGRESS_FILE="/tmp/backfill_progress.json"

echo "$(date): Historical Data Backfill Monitor Started" >> $LOG_FILE

while true; do
    # Check current progress
    PROGRESS=$(curl -s "http://localhost:5000" -X POST -H "Content-Type: application/json" -d '{
        "query": "SELECT symbol, COUNT(*) as total_records, COUNT(DISTINCT DATE(timestamp)) as unique_days, CASE WHEN COUNT(DISTINCT DATE(timestamp)) >= 365 AND COUNT(*) >= 1000 THEN true ELSE false END as sufficient FROM technical_indicators WHERE symbol IN ('"'"'XLK'"'"', '"'"'XLV'"'"', '"'"'XLF'"'"', '"'"'XLY'"'"', '"'"'XLI'"'"', '"'"'XLC'"'"', '"'"'XLP'"'"', '"'"'XLE'"'"', '"'"'XLU'"'"', '"'"'XLB'"'"', '"'"'XLRE'"'"') GROUP BY symbol ORDER BY total_records DESC"
    }' 2>/dev/null || echo "[]")
    
    # Count how many ETFs have sufficient data
    SUFFICIENT_COUNT=$(echo "$PROGRESS" | grep -o '"sufficient":true' | wc -l)
    TOTAL_ETFS=11
    
    # Log current status
    echo "$(date): Progress - $SUFFICIENT_COUNT/$TOTAL_ETFS ETFs have sufficient historical data" >> $LOG_FILE
    
    # Check if complete
    if [ "$SUFFICIENT_COUNT" -eq "$TOTAL_ETFS" ]; then
        echo "$(date): ✅ BACKFILL COMPLETE! All $TOTAL_ETFS ETFs now have 365+ days of historical data" >> $LOG_FILE
        
        # Create completion notification
        echo "{\"status\":\"complete\",\"timestamp\":\"$(date)\",\"message\":\"Historical data backfill complete for all 11 ETFs\"}" > $PROGRESS_FILE
        
        echo "Historical data backfill is now complete! All ETFs have sufficient data for accurate moving average calculations."
        break
    else
        # Save progress
        echo "{\"status\":\"in_progress\",\"timestamp\":\"$(date)\",\"sufficient_count\":$SUFFICIENT_COUNT,\"total_etfs\":$TOTAL_ETFS}" > $PROGRESS_FILE
    fi
    
    # Wait 5 minutes before next check
    sleep 300
done