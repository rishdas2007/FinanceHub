#!/usr/bin/env node

// Deployment validation script - checks for production readiness
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔍 Validating deployment readiness...\n');

// 1. Check build artifacts exist
const criticalPaths = [
  'package.json',
  'server/index.ts',
  'client/src/lib/zscoreUtils.ts',
  'shared/schema.ts'
];

let buildValid = true;
const missing = [];

for (const path of criticalPaths) {
  const fullPath = join(projectRoot, path);
  if (!existsSync(fullPath)) {
    missing.push(path);
    buildValid = false;
  }
}

if (buildValid) {
  console.log('✅ Build artifacts validation: PASSED');
} else {
  console.log('❌ Build artifacts validation: FAILED');
  console.log('Missing files:', missing);
}

// 2. Test module imports (ESM safety)
console.log('\n🔍 Testing module imports...');

try {
  // Test zscoreUtils import with correct ESM path
  const zscoreModule = await import('../client/src/lib/zscoreUtils.ts');
  if (zscoreModule.getZScoreColor && zscoreModule.formatZScore) {
    console.log('✅ Z-score utilities: Import successful');
  } else {
    console.log('❌ Z-score utilities: Missing exports');
  }
} catch (error) {
  console.log('❌ Z-score utilities: Import failed', error.message);
}

// 3. Test API endpoints
console.log('\n🔍 Testing API endpoints...');

const testEndpoints = [
  '/api/etf-metrics',
  '/api/market-status',
  '/api/health'
];

for (const endpoint of testEndpoints) {
  try {
    const response = await fetch(`http://localhost:5000${endpoint}`);
    const status = response.status;
    
    if (status === 200) {
      const data = await response.json();
      if (data.success !== false) {
        console.log(`✅ ${endpoint}: OK (${status})`);
      } else {
        console.log(`⚠️  ${endpoint}: OK but reports success:false`);
      }
    } else {
      console.log(`❌ ${endpoint}: HTTP ${status}`);
    }
  } catch (error) {
    console.log(`❌ ${endpoint}: ${error.message}`);
  }
}

// 4. Validate environment configuration
console.log('\n🔍 Checking environment configuration...');

const requiredEnvVars = ['DATABASE_URL', 'PGHOST', 'PGDATABASE'];
const missingEnv = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingEnv.push(envVar);
  }
}

if (missingEnv.length === 0) {
  console.log('✅ Environment variables: All required vars present');
} else {
  console.log('❌ Environment variables: Missing', missingEnv);
}

// 5. Database connectivity test
console.log('\n🔍 Testing database connectivity...');

try {
  const dbResponse = await fetch('http://localhost:5000/api/health/database');
  const dbData = await dbResponse.json();
  
  if (dbData.status === 'healthy') {
    console.log('✅ Database connectivity: HEALTHY');
  } else {
    console.log('❌ Database connectivity: UNHEALTHY');
  }
} catch (error) {
  console.log('❌ Database connectivity: Test failed', error.message);
}

console.log('\n🎯 Deployment validation complete!');
console.log('Note: Run this script before deploying to catch issues early.');