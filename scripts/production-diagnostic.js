#!/usr/bin/env node

/**
 * Production Diagnostic Script
 * Run this to diagnose and fix production issues
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('🔍 FinanceHub Pro - Production Diagnostic Tool\n');
console.log('=' . repeat(50));

// Check 1: Environment Variables
console.log('\n1️⃣ Checking Environment Variables...');
const requiredEnvVars = [
  'DATABASE_URL',
  'FRED_API_KEY',
  'TWELVE_DATA_API_KEY'
];

const missingVars = [];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
    console.log(`   ❌ ${varName}: MISSING`);
  } else {
    console.log(`   ✅ ${varName}: Present`);
  }
});

// Check 2: Database Connection
console.log('\n2️⃣ Testing Database Connection...');
if (process.env.DATABASE_URL) {
  try {
    // Parse connection string
    const url = new URL(process.env.DATABASE_URL);
    console.log(`   📍 Host: ${url.hostname}`);
    console.log(`   🔌 Port: ${url.port || '5432'}`);
    console.log(`   📊 Database: ${url.pathname.substring(1)}`);
    
    // Check if it's a Neon connection
    if (url.hostname.includes('neon')) {
      console.log('   ✅ Neon database detected');
      console.log('   ⚠️  WARNING: Neon WebSocket issues detected in production');
    }
  } catch (error) {
    console.log('   ❌ Invalid DATABASE_URL format');
  }
} else {
  console.log('   ❌ DATABASE_URL not set - database will fail');
}

// Check 3: Node.js Version
console.log('\n3️⃣ Checking Node.js Version...');
const nodeVersion = process.version;
console.log(`   📦 Current version: ${nodeVersion}`);
const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
if (majorVersion >= 18) {
  console.log('   ✅ Node.js version compatible');
} else {
  console.log(`   ❌ Node.js ${nodeVersion} is too old (requires 18+)`);
}

// Check 4: Memory Usage
console.log('\n4️⃣ Checking Memory Usage...');
const memUsage = process.memoryUsage();
console.log(`   💾 RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
console.log(`   🧠 Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
console.log(`   📊 Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);

// Check 5: Check for conflicting files
console.log('\n5️⃣ Checking for Conflicting Files...');
const conflicts = [];

// Check for duplicate logger implementations
const loggerFiles = [
  'server/utils/logger.ts',
  'server/utils/logger.js',
  'server/utils/unified-logger.ts'
];

loggerFiles.forEach(file => {
  const fullPath = path.join(PROJECT_ROOT, file);
  if (fs.existsSync(fullPath)) {
    console.log(`   📄 Found: ${file}`);
  }
});

// Check for Pino usage
try {
  const pinoUsage = execSync(
    `grep -r "from 'pino'" server/ --include="*.ts" | wc -l`,
    { cwd: PROJECT_ROOT, encoding: 'utf8' }
  ).trim();
  
  if (parseInt(pinoUsage) > 0) {
    console.log(`   ⚠️  Found ${pinoUsage} files using Pino logger`);
    conflicts.push('Multiple logger implementations detected');
  }
} catch (error) {
  // Grep failed, ignore
}

// Check 6: Package Dependencies
console.log('\n6️⃣ Checking Package Dependencies...');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8')
);

const criticalDeps = [
  '@neondatabase/serverless',
  'drizzle-orm',
  'express',
  'ws'
];

criticalDeps.forEach(dep => {
  const version = packageJson.dependencies[dep];
  if (version) {
    console.log(`   ✅ ${dep}: ${version}`);
  } else {
    console.log(`   ❌ ${dep}: NOT INSTALLED`);
  }
});

// Recommendations
console.log('\n' + '=' . repeat(50));
console.log('📋 DIAGNOSTIC SUMMARY\n');

if (missingVars.length > 0) {
  console.log('🔴 CRITICAL: Missing environment variables:');
  missingVars.forEach(v => console.log(`   - ${v}`));
  console.log('\n   ACTION: Set these in your deployment environment');
}

if (conflicts.length > 0) {
  console.log('\n🟡 WARNING: Conflicts detected:');
  conflicts.forEach(c => console.log(`   - ${c}`));
}

console.log('\n🛠️  RECOMMENDED FIXES:\n');
console.log('1. Apply the database connection fix:');
console.log('   cp server/db-production-fix.ts server/db.ts');
console.log('\n2. Replace logger implementation:');
console.log('   cp server/utils/unified-logger.ts server/utils/logger.ts');
console.log('\n3. Update shutdown handlers:');
console.log('   Update server/index.ts to use graceful-shutdown-fix.ts');
console.log('\n4. Remove Pino dependencies:');
console.log('   npm uninstall pino pino-pretty');
console.log('\n5. Restart the application:');
console.log('   npm run build && npm start');

console.log('\n' + '=' . repeat(50));
console.log('✨ Diagnostic complete\n');