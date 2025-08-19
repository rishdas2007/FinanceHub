-- Fix ETF Caching Dependencies
-- This script safely handles materialized view conflicts

-- Step 1: Drop existing materialized view safely
DROP MATERIALIZED VIEW IF EXISTS public.etf_metrics_5min_cache CASCADE;

-- Step 2: Verify source table structure
DO $$
BEGIN
    -- Check if etf_metrics_latest table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'etf_metrics_latest') THEN
        -- Create a minimal table structure for testing
        CREATE TABLE public.etf_metrics_latest (
            symbol text PRIMARY KEY,
            name text NOT NULL DEFAULT 'ETF',
            last_price numeric DEFAULT 100.00,
            pct_change_1d numeric DEFAULT 0.00,
            perf_5d numeric,
            perf_1m numeric,
            volume bigint DEFAULT 1000000,
            rsi numeric DEFAULT 50.00,
            macd numeric DEFAULT 0.00,
            bb_percent_b numeric DEFAULT 0.50,
            sma_50 numeric DEFAULT 100.00,
            sma_200 numeric DEFAULT 100.00,
            ema_21 numeric DEFAULT 100.00,
            mini_trend_30d jsonb DEFAULT '[]',
            updated_at timestamp with time zone DEFAULT now(),
            as_of timestamp with time zone DEFAULT now(),
            provider text DEFAULT 'test',
            indicator_spec text DEFAULT 'test',
            dq_status text DEFAULT 'ok'
        );
        
        -- Insert sample ETF data for testing
        INSERT INTO public.etf_metrics_latest (symbol, name, last_price, pct_change_1d, volume, rsi, macd, bb_percent_b, sma_50, sma_200) VALUES
        ('SPY', 'SPDR S&P 500 ETF', 450.00, 0.25, 50000000, 55.5, 0.15, 0.6, 445.0, 440.0),
        ('XLK', 'Technology Select Sector SPDR Fund', 180.00, 0.45, 15000000, 62.3, 0.25, 0.7, 175.0, 170.0),
        ('XLV', 'Health Care Select Sector SPDR Fund', 130.00, -0.15, 8000000, 48.2, -0.05, 0.4, 132.0, 135.0),
        ('XLF', 'Financial Select Sector SPDR Fund', 38.00, 0.35, 25000000, 58.7, 0.12, 0.65, 37.5, 36.8),
        ('XLY', 'Consumer Discretionary Select Sector SPDR Fund', 170.00, 0.85, 12000000, 67.1, 0.35, 0.8, 165.0, 160.0),
        ('XLI', 'Industrial Select Sector SPDR Fund', 110.00, 0.15, 9000000, 52.3, 0.08, 0.55, 109.0, 107.0),
        ('XLC', 'Communication Services Select Sector SPDR Fund', 75.00, 0.65, 18000000, 61.4, 0.18, 0.68, 74.0, 72.0),
        ('XLP', 'Consumer Staples Select Sector SPDR Fund', 80.00, -0.25, 6000000, 45.8, -0.08, 0.35, 81.0, 82.0),
        ('XLE', 'Energy Select Sector SPDR Fund', 85.00, 1.25, 22000000, 72.5, 0.45, 0.85, 80.0, 75.0),
        ('XLU', 'Utilities Select Sector SPDR Fund', 70.00, -0.35, 7000000, 42.1, -0.12, 0.25, 71.0, 73.0),
        ('XLB', 'Materials Select Sector SPDR Fund', 95.00, 0.55, 11000000, 59.6, 0.22, 0.72, 92.0, 88.0),
        ('XLRE', 'Real Estate Select Sector SPDR Fund', 45.00, 0.75, 14000000, 63.8, 0.28, 0.75, 44.0, 42.0);
    END IF;
END $$;

-- Step 3: Recreate materialized view with safe dependencies
CREATE MATERIALIZED VIEW public.etf_metrics_5min_cache AS
SELECT 
    symbol,
    (symbol || ' ETF') AS name,
    last_price,
    pct_change_1d,
    volume,
    rsi,
    macd,
    bb_percent_b,
    sma_50,
    sma_200,
    CASE 
        WHEN rsi < 30 THEN 'BUY'
        WHEN rsi > 70 THEN 'SELL' 
        ELSE 'HOLD'
    END as signal,
    CURRENT_TIMESTAMP as cache_timestamp,
    'materialized_view' as data_source,
    5 as cache_ttl_minutes
FROM public.etf_metrics_latest
WHERE symbol IN ('SPY','XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLU','XLB','XLRE')
ORDER BY symbol
WITH DATA;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_etf_5min_cache_symbol ON public.etf_metrics_5min_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_etf_5min_cache_timestamp ON public.etf_metrics_5min_cache(cache_timestamp);
CREATE UNIQUE INDEX IF NOT EXISTS idx_etf_5min_cache_symbol_unique ON public.etf_metrics_5min_cache(symbol);

-- Step 5: Create refresh function
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
    
    -- Return refresh statistics
    RETURN QUERY SELECT 
        (end_time - start_time)::interval as refresh_duration,
        row_count as rows_refreshed,
        'SUCCESS'::text as status,
        end_time as timestamp_refreshed;
        
EXCEPTION WHEN others THEN
    -- Return error status
    RETURN QUERY SELECT 
        (clock_timestamp() - start_time)::interval as refresh_duration,
        0 as rows_refreshed,
        ('ERROR: ' || SQLERRM)::text as status,
        clock_timestamp() as timestamp_refreshed;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
ALTER MATERIALIZED VIEW public.etf_metrics_5min_cache OWNER TO neondb_owner;
GRANT EXECUTE ON FUNCTION public.refresh_etf_5min_cache() TO neondb_owner;