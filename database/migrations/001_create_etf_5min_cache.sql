-- ETF 5-Minute Caching Materialized View
CREATE MATERIALIZED VIEW public.etf_metrics_5min_cache AS
SELECT 
    symbol,
    symbol || ' ETF' as name,
    last_price,
    pct_change_1d,
    volume,
    rsi,
    macd,
    bb_percent_b,
    sma_50,
    sma_200,
    composite_zscore,
    rsi_zscore,
    macd_zscore,
    CASE 
        WHEN composite_zscore < -1.5 THEN 'BUY'
        WHEN composite_zscore > 1.5 THEN 'SELL' 
        ELSE 'HOLD'
    END as signal,
    CURRENT_TIMESTAMP as cache_timestamp,
    'materialized_view' as data_source,
    5 as cache_ttl_minutes
FROM public.etf_metrics_latest_new
WHERE symbol IN ('SPY','XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLU','XLB','XLRE')
ORDER BY symbol
WITH DATA;

-- Create indexes for fast access
CREATE INDEX idx_etf_5min_cache_symbol ON public.etf_metrics_5min_cache(symbol);
CREATE INDEX idx_etf_5min_cache_timestamp ON public.etf_metrics_5min_cache(cache_timestamp);
CREATE UNIQUE INDEX idx_etf_5min_cache_symbol_unique ON public.etf_metrics_5min_cache(symbol);

-- Grant permissions
ALTER MATERIALIZED VIEW public.etf_metrics_5min_cache OWNER TO neondb_owner;

-- Function to refresh ETF 5-minute cache
CREATE OR REPLACE FUNCTION public.refresh_etf_5min_cache()
RETURNS TABLE(
    refresh_duration interval,
    rows_refreshed integer,
    status text,
    timestamp_refreshed timestamp
) AS $$
DECLARE
    start_time timestamp;
    end_time timestamp;
    row_count integer;
BEGIN
    start_time := clock_timestamp();
    
    -- Refresh the materialized view
    REFRESH MATERIALIZED VIEW public.etf_metrics_5min_cache;
    
    end_time := clock_timestamp();
    
    -- Get row count
    SELECT count(*) INTO row_count FROM public.etf_metrics_5min_cache;
    
    -- Log the refresh
    INSERT INTO public.performance_logs (event_type, message, timestamp)
    VALUES (
        'ETF_CACHE_REFRESH', 
        'ETF 5-minute cache refreshed successfully. Rows: ' || row_count || ', Duration: ' || (end_time - start_time),
        NOW()
    );
    
    -- Return refresh statistics
    RETURN QUERY SELECT 
        (end_time - start_time)::interval as refresh_duration,
        row_count as rows_refreshed,
        'SUCCESS'::text as status,
        end_time as timestamp_refreshed;
        
EXCEPTION WHEN others THEN
    -- Log error
    INSERT INTO public.performance_logs (event_type, message, timestamp)
    VALUES (
        'ETF_CACHE_REFRESH_ERROR', 
        'ETF 5-minute cache refresh failed: ' || SQLERRM,
        NOW()
    );
    
    -- Return error status
    RETURN QUERY SELECT 
        (clock_timestamp() - start_time)::interval as refresh_duration,
        0 as rows_refreshed,
        ('ERROR: ' || SQLERRM)::text as status,
        clock_timestamp() as timestamp_refreshed;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.refresh_etf_5min_cache() TO neondb_owner;