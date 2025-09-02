#!/usr/bin/env node

/**
 * Test all API endpoints that the frontend might be calling
 */

import fetch from 'node-fetch';
import { spawn } from 'child_process';

console.log('🔍 Testing API Endpoints Used by Frontend\n');
console.log('=' .repeat(50));

// Start server
const server = spawn('npm', ['start'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: '8080' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverReady = false;

server.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('serving on port')) {
    serverReady = true;
  }
});

server.stderr.on('data', (data) => {
  // Capture errors silently
});

// Wait for server
async function waitForServer() {
  console.log('Starting server...');
  let attempts = 0;
  while (!serverReady && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  if (!serverReady) {
    console.log('❌ Server failed to start');
    server.kill();
    process.exit(1);
  }
  console.log('✅ Server ready\n');
}

async function testEndpoints() {
  await waitForServer();
  
  // Common API endpoints used by the frontend components
  const endpoints = [
    '/api/health',
    '/api/market-status',
    '/api/etf/robust',
    '/api/etf/enhanced',
    '/api/etf-metrics',
    '/api/economic-calendar',
    '/api/economic-health/dashboard',
    '/api/aaii-sentiment',
    '/api/spy-baseline',
    '/api/macro/gdp-data',
    '/api/macro/inflation-data',
    '/api/momentum-analysis',
    '/api/unified-dashboard'
  ];
  
  console.log('Testing API endpoints:\n');
  
  let failedEndpoints = [];
  let slowEndpoints = [];
  
  for (const endpoint of endpoints) {
    process.stdout.write(`📍 ${endpoint.padEnd(35)}`);
    
    try {
      const startTime = Date.now();
      const response = await fetch(`http://localhost:8080${endpoint}`, {
        timeout: 5000
      });
      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          
          if (data.success === false) {
            console.log(`⚠️  Returns success:false (${duration}ms)`);
            failedEndpoints.push(endpoint);
          } else {
            console.log(`✅ OK (${duration}ms)`);
            if (duration > 2000) {
              slowEndpoints.push({ endpoint, duration });
            }
          }
        } else {
          console.log(`⚠️  Non-JSON response (${duration}ms)`);
        }
      } else {
        console.log(`❌ ${response.status} (${duration}ms)`);
        failedEndpoints.push(endpoint);
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      failedEndpoints.push(endpoint);
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Summary:\n');
  
  if (failedEndpoints.length === 0) {
    console.log('✅ All endpoints working');
  } else {
    console.log(`❌ ${failedEndpoints.length} endpoints failed:`);
    failedEndpoints.forEach(ep => console.log(`   - ${ep}`));
  }
  
  if (slowEndpoints.length > 0) {
    console.log(`\n⏱️  ${slowEndpoints.length} slow endpoints (>2s):`);
    slowEndpoints.forEach(({ endpoint, duration }) => 
      console.log(`   - ${endpoint}: ${duration}ms`)
    );
  }
  
  // Test if any endpoint is hanging
  console.log('\n🔍 Testing for hanging endpoints...');
  const testEndpoint = '/api/etf/robust';
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`http://localhost:8080${testEndpoint}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    const duration = Date.now() - startTime;
    
    if (duration > 5000) {
      console.log(`   ⚠️  ${testEndpoint} is slow (${duration}ms) - might be blocking UI`);
    } else {
      console.log(`   ✅ No hanging endpoints detected`);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`   ❌ ${testEndpoint} timed out after 10s - BLOCKING UI!`);
    } else {
      console.log(`   ❌ Test failed: ${error.message}`);
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('✨ Test complete\n');
  
  server.kill();
  process.exit(failedEndpoints.length > 0 ? 1 : 0);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nCleaning up...');
  server.kill();
  process.exit(0);
});

// Run tests
testEndpoints().catch(error => {
  console.error('Test failed:', error);
  server.kill();
  process.exit(1);
});