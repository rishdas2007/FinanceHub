#!/usr/bin/env tsx

/**
 * Test script for V2 APIs
 * Validates all new endpoints and architecture components
 */

import { logger } from '../server/middleware/logging';

const API_BASE = 'http://localhost:5000/api/v2';

async function testEndpoint(path: string, description: string): Promise<void> {
  try {
    logger.info(`🧪 Testing: ${description}`);
    const response = await fetch(`${API_BASE}${path}`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      logger.info(`✅ ${description}: OK`);
      logger.info(`   Response keys: ${Object.keys(data).join(', ')}`);
      if (data.data) {
        logger.info(`   Data keys: ${Object.keys(data.data).join(', ')}`);
      }
    } else {
      logger.warn(`⚠️ ${description}: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    logger.error(`❌ ${description}: ${error.message}`);
  }
}

async function main() {
  logger.info('🚀 Testing V2 API Architecture');
  
  const endpoints = [
    { path: '/health', description: 'Health Check with Circuit Breakers' },
    { path: '/market-status', description: 'Market Status' },
    { path: '/etf-metrics?symbols=SPY,XLK', description: 'ETF Metrics from Feature Store' },
    { path: '/stocks/SPY/history?window=30D', description: 'Stock History with Fallback Strategy' },
    { path: '/sparkline?symbol=SPY&days=30', description: 'Sparkline Data' },
    { path: '/economic-indicators', description: 'Economic Features from Gold Layer' }
  ];
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint.path, endpoint.description);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }
  
  logger.info('🎉 V2 API testing completed');
}

main().catch(console.error);