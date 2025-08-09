#!/bin/bash

echo "🚀 Starting Historical Economic Data Import using \copy..."
echo "📊 Processing 6,185 rows of economic indicators data..."

# Connect to database and run the import
psql $DATABASE_URL << 'EOF'

-- Create temporary table for CSV import
CREATE TEMP TABLE IF NOT EXISTS temp_economic_import (
    metric_name TEXT,
    series_id TEXT,
    type TEXT,
    category TEXT,
    unit TEXT,
    frequency TEXT,
    value_text TEXT,
    period_date TEXT,
    release_date TEXT,
    monthly_change TEXT,
    annual_change TEXT
);

-- Import CSV data using \copy (client-side import)
\copy temp_economic_import(metric_name, series_id, type, category, unit, frequency, value_text, period_date, release_date, monthly_change, annual_change) FROM 'attached_assets/economic_indicators_history_1754716986196.csv' WITH (FORMAT CSV, HEADER TRUE, DELIMITER ',');

-- Insert valid data into historical_economic_data table
INSERT INTO historical_economic_data (series_id, indicator, value, category, frequency, release_date, period_date, unit)
SELECT 
    series_id,
    metric_name,
    CAST(value_text AS DECIMAL),
    category,
    frequency,
    CASE 
        WHEN release_date IS NULL OR release_date = '' THEN NOW()
        ELSE CAST(release_date AS TIMESTAMP)
    END,
    CAST(period_date AS DATE),
    unit
FROM temp_economic_import
WHERE 
    series_id IS NOT NULL 
    AND value_text IS NOT NULL 
    AND value_text != ''
    AND period_date IS NOT NULL
    AND period_date != ''
    AND value_text ~ '^-?[0-9]+\.?[0-9]*$'; -- Only numeric values

-- Show import summary
SELECT 
    'Import Summary' as status,
    COUNT(*) as total_imported,
    COUNT(DISTINCT series_id) as unique_indicators,
    MIN(period_date) as earliest_date,
    MAX(period_date) as latest_date
FROM historical_economic_data;

-- Show breakdown by indicator
SELECT 
    series_id,
    LEFT(indicator, 50) as indicator_name,
    COUNT(*) as observations,
    MIN(period_date) as start_date,
    MAX(period_date) as end_date,
    frequency
FROM historical_economic_data
GROUP BY series_id, indicator, frequency
ORDER BY series_id;

EOF

echo "✅ Historical Economic Data Import completed!"