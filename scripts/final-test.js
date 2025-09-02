#!/usr/bin/env node

/**
 * Final test to verify server starts and economic calendar works
 */

import { spawn } from 'child_process';
import fetch from 'node-fetch';

console.log('🧪 Final Server and Economic Calendar Test\n');
console.log('=' .repeat(50));

// Kill any existing servers
console.log('\n1️⃣ Cleaning up existing processes...');
try {
  const { execSync } = await import('child_process');
  execSync('pkill -f "node.*dist" 2>/dev/null || true');
  execSync('pkill -f "npm start" 2>/dev/null || true');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('   ✅ Cleanup complete');
} catch (error) {
  console.log('   ℹ️  No processes to clean');
}

// Start the server
console.log('\n2️⃣ Starting production server...');
const server = spawn('npm', ['start'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: '8080' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
let serverReady = false;

server.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  if (output.includes('serving on port') || output.includes('Server is now accepting')) {
    serverReady = true;
  }
});

server.stderr.on('data', (data) => {
  const error = data.toString();
  if (error.includes('path is not defined')) {
    console.log('   ❌ Path error still present!');
  }
  if (error.includes('UNCAUGHT EXCEPTION')) {
    console.log('   ❌ Uncaught exception:', error.substring(0, 100));
  }
});

// Wait for server
async function waitForServer() {
  let attempts = 0;
  while (!serverReady && attempts < 15) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    
    // Try health endpoint
    try {
      const response = await fetch('http://localhost:8080/api/health');
      if (response.ok) {
        serverReady = true;
        console.log('   ✅ Server is ready!');
        break;
      }
    } catch (error) {
      // Server not ready
    }
  }
  
  if (!serverReady) {
    console.log('   ❌ Server failed to start');
    console.log('   Last output:', serverOutput.substring(serverOutput.length - 500));
    server.kill();
    process.exit(1);
  }
}

async function testEndpoints() {
  await waitForServer();
  
  console.log('\n3️⃣ Testing endpoints:\n');
  
  // Test health
  console.log('📍 Health Check:');
  try {
    const response = await fetch('http://localhost:8080/api/health');
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      console.log('   ✅ Health check passed');
    }
  } catch (error) {
    console.log('   ❌ Health check failed:', error.message);
  }
  
  // Test economic calendar
  console.log('\n📍 Economic Calendar:');
  try {
    const response = await fetch('http://localhost:8080/api/economic-calendar?limit=2');
    console.log(`   Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success && data.data && data.data.length > 0) {
        console.log('   ✅ Economic calendar working!');
        console.log(`   📊 Returned ${data.data.length} records`);
        console.log(`   📈 First record: ${data.data[0].metricName}`);
      } else if (data.success && data.data && data.data.length === 0) {
        console.log('   ⚠️  No data returned (but endpoint works)');
      } else {
        console.log('   ❌ Invalid response structure');
      }
    } else {
      console.log('   ❌ HTTP error');
    }
  } catch (error) {
    console.log('   ❌ Request failed:', error.message);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('✨ Test complete\n');
  
  // Kill server
  server.kill();
  process.exit(0);
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