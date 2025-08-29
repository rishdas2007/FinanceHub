-- Multi-Timeframe Technical Convergence Analysis Tables

-- Technical indicators across multiple timeframes
CREATE TABLE IF NOT EXISTS technical_indicators_multi_timeframe (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL, -- 1m, 5m, 1h, 1d, 1w, 1M
    rsi DECIMAL(5,2),
    macd_line DECIMAL(10,4),
    macd_signal DECIMAL(10,4),
    macd_histogram DECIMAL(10,4),
    bollinger_upper DECIMAL(10,2),
    bollinger_middle DECIMAL(10,2),
    bollinger_lower DECIMAL(10,2),
    bollinger_width DECIMAL(10,4),
    bollinger_position DECIMAL(5,4),
    volume_sma_20 DECIMAL(15,0),
    volume_ratio DECIMAL(5,2),
    atr DECIMAL(10,4),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS symbol_timeframe_idx ON technical_indicators_multi_timeframe(symbol, timeframe);
CREATE INDEX IF NOT EXISTS multi_timeframe_timestamp_idx ON technical_indicators_multi_timeframe(timestamp);

-- Convergence signals tracking
CREATE TABLE IF NOT EXISTS convergence_signals (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    signal_type TEXT NOT NULL, -- bollinger_squeeze, ma_convergence, rsi_divergence, volume_confirmation
    timeframes JSONB NOT NULL, -- Array of timeframes
    strength INTEGER NOT NULL CHECK (strength >= 0 AND strength <= 100),
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    direction TEXT NOT NULL CHECK (direction IN ('bullish', 'bearish', 'neutral')),
    detected_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for convergence signals
CREATE INDEX IF NOT EXISTS convergence_symbol_idx ON convergence_signals(symbol);
CREATE INDEX IF NOT EXISTS signal_type_idx ON convergence_signals(signal_type);
CREATE INDEX IF NOT EXISTS detected_at_idx ON convergence_signals(detected_at);
CREATE INDEX IF NOT EXISTS is_active_idx ON convergence_signals(is_active);

-- Signal quality scores for historical performance tracking
CREATE TABLE IF NOT EXISTS signal_quality_scores (
    id SERIAL PRIMARY KEY,
    signal_type TEXT NOT NULL,
    symbol TEXT NOT NULL,
    timeframe_combination TEXT NOT NULL,
    total_occurrences INTEGER NOT NULL DEFAULT 0,
    successful_occurrences INTEGER NOT NULL DEFAULT 0,
    success_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    avg_return_24h DECIMAL(10,4) NOT NULL DEFAULT 0,
    avg_return_7d DECIMAL(10,4) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(signal_type, symbol, timeframe_combination)
);

-- Create indexes for signal quality
CREATE INDEX IF NOT EXISTS signal_symbol_idx ON signal_quality_scores(signal_type, symbol);
CREATE INDEX IF NOT EXISTS success_rate_idx ON signal_quality_scores(success_rate);

-- Bollinger squeeze events tracking
CREATE TABLE IF NOT EXISTS bollinger_squeeze_events (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    squeeze_start TIMESTAMP NOT NULL,
    squeeze_end TIMESTAMP,
    squeeze_duration_hours INTEGER,
    breakout_direction TEXT CHECK (breakout_direction IN ('up', 'down')),
    breakout_strength DECIMAL(5,2),
    price_at_squeeze DECIMAL(10,2) NOT NULL,
    price_at_breakout DECIMAL(10,2),
    volume_at_squeeze DECIMAL(15,0) NOT NULL,
    volume_at_breakout DECIMAL(15,0),
    return_24h DECIMAL(10,4),
    return_7d DECIMAL(10,4),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for bollinger squeeze events
CREATE INDEX IF NOT EXISTS squeeze_symbol_timeframe_idx ON bollinger_squeeze_events(symbol, timeframe);
CREATE INDEX IF NOT EXISTS squeeze_start_idx ON bollinger_squeeze_events(squeeze_start);
CREATE INDEX IF NOT EXISTS squeeze_is_active_idx ON bollinger_squeeze_events(is_active);