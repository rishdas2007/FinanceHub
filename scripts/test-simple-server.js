#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

// Serve static files
app.use(express.static(path.join(__dirname, '../dist/public')));

// Basic API endpoints (stubs)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/market-status', (req, res) => {
  res.json({ isOpen: true, nextOpen: null, nextClose: null });
});

app.get('/api/etf/robust', (req, res) => {
  res.json({ success: true, data: [] });
});

app.get('/api/etf-metrics', (req, res) => {
  res.json({ success: true, data: [] });
});

app.get('/api/economic-calendar', (req, res) => {
  res.json({ success: true, data: { events: [] } });
});

app.get('/api/economic-health/dashboard', (req, res) => {
  res.json({ success: true, data: {} });
});

// Stub endpoints for missing APIs
app.get('/api/aaii-sentiment', (req, res) => {
  res.json({ 
    success: true, 
    data: {
      bullish: 35,
      neutral: 40,
      bearish: 25
    }
  });
});

app.get('/api/spy-baseline', (req, res) => {
  res.json({ 
    success: true, 
    data: {
      current: 450,
      change: 1.5
    }
  });
});

app.get('/api/macro/gdp-data', (req, res) => {
  res.json({ 
    success: true, 
    data: {
      current: 2.8
    }
  });
});

app.get('/api/macro/inflation-data', (req, res) => {
  res.json({ 
    success: true, 
    data: {
      cpi: 3.2
    }
  });
});

// Catch-all for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Simple test server running on http://localhost:${PORT}`);
});