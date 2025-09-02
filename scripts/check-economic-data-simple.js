#!/usr/bin/env node

/**
 * Simplified Economic Data Pipeline Check
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔍 Economic Data Pipeline Diagnostic\n');
console.log('=' .repeat(50));

// Step 1: Check environment
console.log('\n1️⃣ ENVIRONMENT CHECK:');
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
console.log(`   FRED_API_KEY: ${process.env.FRED_API_KEY ? '✅ Set' : '❌ Not set'}`);

if (process.env.FRED_API_KEY) {
  console.log(`   Key prefix: ${process.env.FRED_API_KEY.substring(0, 8)}...`);
}

// Step 2: Test database query using psql
console.log('\n2️⃣ DATABASE TABLE CHECK:');
if (process.env.DATABASE_URL) {
  try {
    // Check if economic_calendar table exists
    const tableCheck = execSync(
      `echo "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'economic_calendar';" | psql "${process.env.DATABASE_URL}" -t`,
      { encoding: 'utf8' }
    ).trim();
    
    if (tableCheck === '1') {
      console.log('   ✅ Table economic_calendar EXISTS');
      
      // Check row count
      const rowCount = execSync(
        `echo "SELECT COUNT(*) FROM economic_calendar;" | psql "${process.env.DATABASE_URL}" -t`,
        { encoding: 'utf8' }
      ).trim();
      
      console.log(`   📊 Row count: ${rowCount}`);
      
      if (rowCount === '0') {
        console.log('   ⚠️  Table is EMPTY - no data populated!');
      } else {
        // Get latest entry
        const latest = execSync(
          `echo "SELECT metric_name, release_date FROM economic_calendar ORDER BY release_date DESC LIMIT 1;" | psql "${process.env.DATABASE_URL}" -t`,
          { encoding: 'utf8' }
        ).trim();
        console.log(`   📅 Latest entry: ${latest}`);
      }
    } else {
      console.log('   ❌ Table economic_calendar does NOT exist');
    }
  } catch (error) {
    console.log('   ❌ Database query failed:', error.message);
  }
}

// Step 3: Check sync service files
console.log('\n3️⃣ DATA SYNC SERVICE FILES:');
const syncFiles = [
  'server/services/economic-calendar-service.ts',
  'server/services/fred-scheduler.ts',
  'server/services/fred-scheduler-incremental.ts'
];

syncFiles.forEach(file => {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  console.log(`   ${exists ? '✅' : '❌'} ${path.basename(file)}`);
});

// Step 4: Test FRED API
console.log('\n4️⃣ FRED API TEST:');
if (process.env.FRED_API_KEY) {
  try {
    const testUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=${process.env.FRED_API_KEY}&file_type=json&limit=1`;
    console.log('   Testing FRED API with GDP data...');
    
    const response = execSync(`curl -s "${testUrl}"`, { encoding: 'utf8' });
    const data = JSON.parse(response);
    
    if (data.observations && data.observations.length > 0) {
      console.log('   ✅ FRED API is working!');
      console.log(`   GDP: $${data.observations[0].value}B (${data.observations[0].date})`);
    } else if (data.error_code) {
      console.log(`   ❌ FRED API error: ${data.error_message}`);
    } else {
      console.log('   ⚠️  No data returned');
    }
  } catch (error) {
    console.log('   ❌ FRED API test failed:', error.message);
  }
} else {
  console.log('   ❌ Cannot test - FRED_API_KEY not set');
}

// Step 5: Check for cron job configuration
console.log('\n5️⃣ CRON JOB STATUS:');
const cronFiles = [
  'server/services/intelligent-cron-scheduler.ts',
  'server/index.ts'
];

cronFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes('economic') || content.includes('fred')) {
      console.log(`   ✅ ${path.basename(file)} has economic data sync`);
    } else {
      console.log(`   ⚠️  ${path.basename(file)} - no economic sync found`);
    }
  }
});

// Step 6: Diagnosis
console.log('\n' + '=' .repeat(50));
console.log('📋 DIAGNOSIS:\n');

const problems = [];

// Check for issues
if (!process.env.DATABASE_URL) {
  problems.push('DATABASE_URL not configured');
}

if (!process.env.FRED_API_KEY) {
  problems.push('FRED_API_KEY not configured');
}

// Try to check if table is empty
try {
  if (process.env.DATABASE_URL) {
    const rowCount = execSync(
      `echo "SELECT COUNT(*) FROM economic_calendar;" | psql "${process.env.DATABASE_URL}" -t 2>/dev/null`,
      { encoding: 'utf8' }
    ).trim();
    
    if (rowCount === '0') {
      problems.push('Economic calendar table is empty');
    }
  }
} catch (error) {
  if (error.message.includes('does not exist')) {
    problems.push('Economic calendar table does not exist');
  }
}

if (problems.length === 0) {
  console.log('✅ Everything looks good!');
} else {
  console.log('🔴 PROBLEMS FOUND:');
  problems.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p}`);
  });
  
  console.log('\n🛠️  HOW TO FIX:\n');
  
  if (problems.includes('Economic calendar table does not exist')) {
    console.log('1. Run database migrations:');
    console.log('   npm run db:push');
    console.log('');
  }
  
  if (problems.includes('Economic calendar table is empty')) {
    console.log('2. Populate economic data:');
    console.log('   Run: node scripts/populate-economic-data.js');
    console.log('');
  }
  
  if (problems.includes('FRED_API_KEY not configured')) {
    console.log('3. Add FRED API key to .env:');
    console.log('   FRED_API_KEY=your_api_key_here');
    console.log('   Get a free key at: https://fred.stlouisfed.org/docs/api/api_key.html');
    console.log('');
  }
}

console.log('=' .repeat(50));
console.log('✨ Diagnostic complete\n');