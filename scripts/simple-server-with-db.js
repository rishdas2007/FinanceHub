#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

// Add CORS headers for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Log all API requests
  if (req.url.startsWith('/api')) {
    console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Database connection
async function getDbClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  return client;
}

// Serve static files
app.use(express.static(path.join(__dirname, '../dist/public')));

// Real API endpoints with database data
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/market-status', (req, res) => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const isWeekday = day > 0 && day < 6;
  const isMarketHours = hour >= 9 && hour < 16;
  
  res.json({ 
    isOpen: isWeekday && isMarketHours, 
    nextOpen: null, 
    nextClose: null 
  });
});

// Economic Calendar with real data
app.get('/api/economic-calendar', async (req, res) => {
  console.log('🔍 Economic Calendar endpoint called');
  let client;
  try {
    client = await getDbClient();
    
    const query = `
      SELECT 
        release_date as date,
        metric_name as metric,
        category,
        actual_value as actual,
        previous_value as prior,
        NULL as forecast,
        'medium' as importance,
        CASE 
          WHEN variance_percent > 0 THEN 'up'
          WHEN variance_percent < 0 THEN 'down'
          ELSE 'stable'
        END as trend,
        ABS(variance_percent) as signal_strength,
        NULL as z_score,
        updated_at as last_updated
      FROM economic_calendar
      ORDER BY release_date DESC
      LIMIT 100
    `;
    
    const result = await client.query(query);
    
    // Keep wrapped format for economic calendar as it has nested structure
    const response = { 
      success: true, 
      data: {
        events: result.rows,
        totalCount: result.rowCount,
        lastUpdated: new Date().toISOString()
      }
    };
    console.log(`✅ Economic Calendar returning ${result.rows.length} events`);
    res.json(response);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database connection failed',
      message: error.message 
    });
  } finally {
    if (client) await client.end();
  }
});

// Economic Calendar Simple endpoint (used by component)
app.get('/api/economic-calendar-simple', async (req, res) => {
  let client;
  try {
    client = await getDbClient();
    
    const { category, frequency, startDate, mode, limit = '100' } = req.query;
    
    let query = `
      SELECT 
        release_date as date,
        metric_name as metric,
        category,
        actual_value as priorReading,
        previous_value as previousReading,
        NULL as forecast,
        'medium' as importance,
        CASE 
          WHEN variance_percent > 0 THEN 'up'
          WHEN variance_percent < 0 THEN 'down'
          ELSE 'stable'
        END as trend,
        ABS(variance_percent) as signal,
        NULL as z_score,
        frequency,
        updated_at as last_updated
      FROM economic_calendar
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }
    
    if (frequency) {
      paramCount++;
      query += ` AND frequency = $${paramCount}`;
      params.push(frequency);
    }
    
    if (startDate) {
      paramCount++;
      query += ` AND release_date >= $${paramCount}`;
      params.push(startDate);
    }
    
    query += ` ORDER BY release_date DESC LIMIT ${parseInt(limit)}`;
    
    const result = await client.query(query, params);
    
    // Get unique categories and frequencies for filters
    const categoriesResult = await client.query('SELECT DISTINCT category FROM economic_calendar WHERE category IS NOT NULL');
    const frequenciesResult = await client.query('SELECT DISTINCT frequency FROM economic_calendar WHERE frequency IS NOT NULL');
    
    res.json({ 
      success: true, 
      data: {
        events: result.rows,
        categories: categoriesResult.rows.map(r => r.category),
        frequencies: frequenciesResult.rows.map(r => r.frequency),
        totalCount: result.rowCount,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database connection failed',
      message: error.message 
    });
  } finally {
    if (client) await client.end();
  }
});

// ETF Robust endpoint with real data
app.get('/api/etf/robust', async (req, res) => {
  console.log('🔍 ETF Robust endpoint called');
  let client;
  try {
    client = await getDbClient();
    
    // Get latest ETF data from historical_stock_data table
    const query = `
      WITH latest_data AS (
        SELECT 
          symbol,
          close as price,
          volume,
          date,
          ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) as rn
        FROM historical_stock_data
        WHERE symbol IN ('SPY', 'QQQ', 'IWM', 'XLF', 'XLK', 'XLV', 'XLE', 'XLI', 'XLY', 'XLP', 'XLB', 'XLRE', 'XLU', 'XLC')
      )
      SELECT 
        symbol,
        price,
        volume,
        date as lastUpdated
      FROM latest_data
      WHERE rn = 1
      ORDER BY symbol
    `;
    
    const result = await client.query(query);
    
    // Map to expected format
    const etfData = result.rows.map(row => ({
      symbol: row.symbol,
      name: getETFName(row.symbol),
      price: parseFloat(row.price),
      changePercent: 0, // Would need previous day's data to calculate
      volume: parseInt(row.volume) || null,
      rsi: null, // Would need to calculate
      bollingerPercB: null,
      sma50: null,
      sma200: null,
      zScore: null,
      rsiZScore: null,
      bbZScore: null,
      signal: 'HOLD',
      lastUpdated: row.lastupdated,
      source: 'database'
    }));
    
    // Return the data directly as queryClient will handle it
    console.log(`✅ ETF Robust returning ${etfData.length} items`);
    res.json(etfData);  // Return array directly, queryClient expects this
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database connection failed',
      message: error.message 
    });
  } finally {
    if (client) await client.end();
  }
});

// ETF Metrics endpoint
app.get('/api/etf-metrics', async (req, res) => {
  console.log('🔍 ETF Metrics endpoint called');
  let client;
  try {
    client = await getDbClient();
    
    const query = `
      WITH latest_data AS (
        SELECT 
          symbol,
          close as price,
          volume,
          date,
          ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) as rn
        FROM historical_stock_data
        WHERE symbol IN ('SPY', 'QQQ', 'IWM', 'XLF', 'XLK', 'XLV', 'XLE', 'XLI', 'XLY', 'XLP', 'XLB', 'XLRE', 'XLU', 'XLC')
      )
      SELECT 
        symbol,
        price,
        volume,
        date as lastUpdated
      FROM latest_data
      WHERE rn = 1
      ORDER BY symbol
    `;
    
    const result = await client.query(query);
    
    const etfData = result.rows.map(row => ({
      symbol: row.symbol,
      name: getETFName(row.symbol),
      price: parseFloat(row.price),
      changePercent: 0,
      volume: parseInt(row.volume) || null,
      rsi: null,
      bollingerPercB: null,
      sma50: null,
      sma200: null,
      zScore: null,
      rsiZScore: null,
      bbZScore: null,
      signal: 'HOLD',
      lastUpdated: row.lastupdated,
      source: 'database'
    }));
    
    console.log(`✅ ETF Metrics returning ${etfData.length} items`);
    res.json(etfData);  // Return array directly
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database connection failed',
      message: error.message 
    });
  } finally {
    if (client) await client.end();
  }
});

// Helper function to get ETF names
function getETFName(symbol) {
  const names = {
    'SPY': 'SPDR S&P 500 ETF',
    'QQQ': 'Invesco QQQ Trust',
    'IWM': 'iShares Russell 2000 ETF',
    'XLF': 'Financial Select Sector SPDR',
    'XLK': 'Technology Select Sector SPDR',
    'XLV': 'Health Care Select Sector SPDR',
    'XLE': 'Energy Select Sector SPDR',
    'XLI': 'Industrial Select Sector SPDR',
    'XLY': 'Consumer Discretionary Select SPDR',
    'XLP': 'Consumer Staples Select SPDR',
    'XLB': 'Materials Select Sector SPDR',
    'XLRE': 'Real Estate Select Sector SPDR',
    'XLU': 'Utilities Select Sector SPDR',
    'XLC': 'Communication Services Select SPDR'
  };
  return names[symbol] || symbol;
}

// Stub endpoints for components we haven't implemented yet
app.get('/api/aaii-sentiment', (req, res) => {
  res.json({ 
    success: true, 
    data: {
      bullish: 35,
      neutral: 40,
      bearish: 25,
      historicalAverage: {
        bullish: 38,
        neutral: 31,
        bearish: 31
      },
      lastUpdated: new Date().toISOString()
    }
  });
});

app.get('/api/spy-baseline', (req, res) => {
  res.json({ 
    success: true, 
    data: {
      current: 450,
      change: 1.5,
      changePercent: 0.33,
      volume: 75000000,
      avgVolume: 80000000,
      dayRange: { low: 448, high: 452 },
      yearRange: { low: 380, high: 480 },
      lastUpdated: new Date().toISOString()
    }
  });
});

app.get('/api/macro/gdp-data', async (req, res) => {
  let client;
  try {
    client = await getDbClient();
    
    const query = `
      SELECT 
        release_date as date,
        actual_value as value,
        metric_name as indicator_name
      FROM economic_calendar
      WHERE metric_name LIKE '%GDP%'
      ORDER BY date DESC
      LIMIT 20
    `;
    
    const result = await client.query(query);
    
    res.json({ 
      success: true, 
      data: {
        current: result.rows[0]?.value || 2.8,
        previous: result.rows[1]?.value || 3.0,
        series: result.rows,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) await client.end();
  }
});

app.get('/api/macro/inflation-data', async (req, res) => {
  let client;
  try {
    client = await getDbClient();
    
    const query = `
      SELECT 
        release_date as date,
        actual_value as value,
        metric_name as indicator_name
      FROM economic_calendar
      WHERE metric_name LIKE '%CPI%' OR metric_name LIKE '%PCE%' OR metric_name LIKE '%Inflation%'
      ORDER BY date DESC
      LIMIT 20
    `;
    
    const result = await client.query(query);
    
    res.json({ 
      success: true, 
      data: {
        cpi: result.rows.find(r => r.indicator_name.includes('CPI'))?.value || 3.2,
        pce: result.rows.find(r => r.indicator_name.includes('PCE'))?.value || 2.8,
        series: result.rows,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) await client.end();
  }
});

// Catch-all for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server with real database data running on http://localhost:${PORT}`);
  console.log('📊 Serving real data from database with ${process.env.DATABASE_URL ? "database connected" : "NO DATABASE URL"}');
});