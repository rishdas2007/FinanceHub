#!/usr/bin/env node

/**
 * Test app loading and static file serving
 */

import fetch from 'node-fetch';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔍 App Loading Diagnostic\n');
console.log('=' .repeat(50));

// Check if dist files exist
console.log('\n1️⃣ Checking build files:');
const distPath = path.join(process.cwd(), 'dist', 'public');
if (fs.existsSync(distPath)) {
  console.log('   ✅ dist/public exists');
  const files = fs.readdirSync(distPath);
  console.log(`   📁 Contents: ${files.join(', ')}`);
  
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    const size = fs.statSync(indexPath).size;
    console.log(`   ✅ index.html exists (${size} bytes)`);
    
    // Check index.html content
    const content = fs.readFileSync(indexPath, 'utf8');
    if (content.includes('<script')) {
      console.log('   ✅ index.html has script tags');
    }
    if (content.includes('type="module"')) {
      console.log('   ✅ index.html has module scripts');
    }
  } else {
    console.log('   ❌ index.html missing!');
  }
} else {
  console.log('   ❌ dist/public directory missing!');
}

// Kill existing servers
console.log('\n2️⃣ Cleaning up existing processes...');
try {
  const { execSync } = await import('child_process');
  execSync('pkill -f "node.*dist" 2>/dev/null || true');
  execSync('pkill -f "npm start" 2>/dev/null || true');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('   ✅ Cleanup complete');
} catch (error) {
  console.log('   ℹ️  No processes to clean');
}

// Start server
console.log('\n3️⃣ Starting server...');
const server = spawn('npm', ['start'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: '8080' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverReady = false;
let serverErrors = [];

server.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('serving on port') || output.includes('Server is now accepting')) {
    serverReady = true;
  }
  if (output.includes('Static files should be served from')) {
    const match = output.match(/Static files should be served from: (.*)/);
    if (match) {
      console.log(`   📁 Static path: ${match[1]}`);
    }
  }
});

server.stderr.on('data', (data) => {
  const error = data.toString();
  serverErrors.push(error);
});

// Wait for server
async function waitForServer() {
  let attempts = 0;
  while (!serverReady && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  if (!serverReady) {
    console.log('   ❌ Server failed to start');
    if (serverErrors.length > 0) {
      console.log('   Errors:', serverErrors[0].substring(0, 200));
    }
    server.kill();
    process.exit(1);
  }
  console.log('   ✅ Server started');
}

async function testEndpoints() {
  await waitForServer();
  
  console.log('\n4️⃣ Testing endpoints:\n');
  
  const endpoints = [
    { name: 'Root (index.html)', url: 'http://localhost:8080/' },
    { name: 'API Health', url: 'http://localhost:8080/api/health' },
    { name: 'Static JS', url: 'http://localhost:8080/assets/index-D7iRLMo_.js' },
    { name: 'Static CSS', url: 'http://localhost:8080/assets/index-l4kU_MKX.css' }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`📍 ${endpoint.name}:`);
    try {
      const response = await fetch(endpoint.url);
      console.log(`   Status: ${response.status}`);
      
      const contentType = response.headers.get('content-type');
      console.log(`   Content-Type: ${contentType}`);
      
      if (response.ok) {
        const content = await response.text();
        console.log(`   Size: ${content.length} bytes`);
        
        if (endpoint.name === 'Root (index.html)') {
          if (content.includes('<!DOCTYPE html>')) {
            console.log('   ✅ Valid HTML');
          } else {
            console.log('   ❌ Not HTML:', content.substring(0, 100));
          }
        }
        
        if (endpoint.name === 'Static JS' && content.length > 0) {
          console.log('   ✅ JavaScript loaded');
        }
        
        if (endpoint.name === 'Static CSS' && content.length > 0) {
          console.log('   ✅ CSS loaded');
        }
      } else {
        const text = await response.text();
        console.log('   ❌ Error:', text.substring(0, 100));
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
    console.log('');
  }
  
  // Check specific React app issues
  console.log('5️⃣ React App Checks:');
  try {
    const response = await fetch('http://localhost:8080/');
    if (response.ok) {
      const html = await response.text();
      
      // Check for React root
      if (html.includes('id="root"')) {
        console.log('   ✅ React root div found');
      } else {
        console.log('   ❌ No React root div');
      }
      
      // Check for script tags
      const scriptMatches = html.match(/<script.*?src="([^"]+)"/g);
      if (scriptMatches) {
        console.log(`   ✅ ${scriptMatches.length} script tags found`);
      } else {
        console.log('   ❌ No script tags found');
      }
      
      // Check if it's serving API response instead of HTML
      if (html.startsWith('{') || html.startsWith('[')) {
        console.log('   ❌ WARNING: Root is returning JSON instead of HTML!');
      }
    }
  } catch (error) {
    console.log('   ❌ Failed to check React app:', error.message);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('✨ Diagnostic complete\n');
  
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