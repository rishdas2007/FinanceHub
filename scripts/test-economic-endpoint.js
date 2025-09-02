#!/usr/bin/env node

/**
 * Test the economic calendar endpoint directly
 */

import fetch from 'node-fetch';
import { spawn } from 'child_process';

console.log('🧪 Testing Economic Calendar Endpoint\n');
console.log('=' .repeat(50));

// Start the server in the background
console.log('\n1️⃣ Starting server...');
const server = spawn('npm', ['start'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: '8080' },
  detached: false,
  stdio: 'pipe'
});

let serverReady = false;

// Listen for server startup
server.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('serving on port') || output.includes('Server is now accepting')) {
    serverReady = true;
  }
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

// Wait for server to be ready
async function waitForServer() {
  console.log('   Waiting for server to start...');
  let attempts = 0;
  while (!serverReady && attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    
    // Also try to ping the health endpoint
    try {
      const response = await fetch('http://localhost:8080/api/health');
      if (response.ok) {
        serverReady = true;
        console.log('   ✅ Server is ready!');
        break;
      }
    } catch (error) {
      // Server not ready yet
    }
  }
  
  if (!serverReady) {
    console.log('   ❌ Server failed to start after 30 seconds');
    server.kill();
    process.exit(1);
  }
}

async function testEndpoints() {
  await waitForServer();
  
  console.log('\n2️⃣ Testing Economic Calendar Endpoints:\n');
  
  const endpoints = [
    {
      name: 'Basic economic calendar',
      url: 'http://localhost:8080/api/economic-calendar?limit=5'
    },
    {
      name: 'Recent releases',
      url: 'http://localhost:8080/api/economic-calendar/recent'
    },
    {
      name: 'Economic calendar with mode=all',
      url: 'http://localhost:8080/api/economic-calendar?mode=all&limit=5'
    },
    {
      name: 'Economic calendar simple',
      url: 'http://localhost:8080/api/economic-calendar-simple?limit=5'
    }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n📍 Testing: ${endpoint.name}`);
    console.log(`   URL: ${endpoint.url}`);
    
    try {
      const response = await fetch(endpoint.url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          console.log(`   ✅ Success!`);
          console.log(`   📊 Data returned: ${data.data?.length || 0} records`);
          
          if (data.data && data.data.length > 0) {
            console.log(`   Sample record:`);
            const sample = data.data[0];
            console.log(`     - ${sample.metricName || sample.metric_name}`);
            console.log(`     - Category: ${sample.category}`);
            console.log(`     - Value: ${sample.actualValue || sample.actual_value}`);
          }
        } else {
          console.log(`   ❌ Response indicates failure`);
          console.log(`   Error: ${data.error}`);
        }
      } else {
        const text = await response.text();
        console.log(`   ❌ HTTP Error`);
        console.log(`   Response: ${text.substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
  }
  
  console.log('\n3️⃣ Direct Database Query Test:');
  
  // Test direct database query
  try {
    const { execSync } = await import('child_process');
    const result = execSync(
      `echo "SELECT metric_name, category, actual_value FROM economic_calendar ORDER BY release_date DESC LIMIT 3;" | psql "${process.env.DATABASE_URL}" -t`,
      { encoding: 'utf8' }
    );
    
    console.log('   ✅ Direct database query works:');
    console.log(result.split('\n').map(line => '     ' + line).join('\n'));
  } catch (error) {
    console.log('   ❌ Direct query failed:', error.message);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('✨ Test complete\n');
  
  // Kill the server
  server.kill();
  process.exit(0);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.kill();
  process.exit(0);
});

// Run tests
testEndpoints().catch(error => {
  console.error('Test failed:', error);
  server.kill();
  process.exit(1);
});