#!/usr/bin/env node

/**
 * Economic Data Pipeline Diagnostic Script
 * Checks every step of the data pipeline to find where it's breaking
 */

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Economic Data Pipeline Diagnostic\n');
console.log('=' .repeat(50));

// Configure Neon
neonConfig.webSocketConstructor = ws;

// Step 1: Check Database Connection
console.log('\n1️⃣ CHECKING DATABASE CONNECTION...');
if (!process.env.DATABASE_URL) {
  console.log('   ❌ DATABASE_URL not set!');
  process.exit(1);
}

console.log('   ✅ DATABASE_URL is set');
console.log(`   📍 Host: ${new URL(process.env.DATABASE_URL).hostname}`);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1
});

const db = drizzle({ client: pool });

// Step 2: Check if economic_calendar table exists
console.log('\n2️⃣ CHECKING ECONOMIC_CALENDAR TABLE...');
try {
  const tableCheck = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'economic_calendar'
    );
  `);
  
  const exists = tableCheck.rows[0]?.exists;
  if (exists) {
    console.log('   ✅ Table economic_calendar exists');
    
    // Check row count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM economic_calendar
    `);
    const count = countResult.rows[0]?.count || 0;
    console.log(`   📊 Row count: ${count}`);
    
    if (count === '0' || count === 0) {
      console.log('   ⚠️  Table is EMPTY - no data has been populated!');
    } else {
      // Get sample data
      const sampleResult = await db.execute(sql`
        SELECT series_id, metric_name, category, release_date 
        FROM economic_calendar 
        ORDER BY release_date DESC 
        LIMIT 5
      `);
      console.log('   📋 Sample data:');
      sampleResult.rows.forEach(row => {
        console.log(`      - ${row.metric_name} (${row.category}): ${new Date(row.release_date).toISOString().split('T')[0]}`);
      });
    }
  } else {
    console.log('   ❌ Table economic_calendar does NOT exist!');
    console.log('   💡 Need to run migrations to create the table');
  }
} catch (error) {
  console.log('   ❌ Error checking table:', error.message);
}

// Step 3: Check other economic-related tables
console.log('\n3️⃣ CHECKING OTHER ECONOMIC TABLES...');
const economicTables = [
  'economicIndicatorsCurrent',
  'economicIndicatorsHistory', 
  'historical_economic_data',
  'economic_data_audit',
  'fredUpdateLog',
  'econDerivedMetrics'
];

for (const tableName of economicTables) {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
    `);
    
    const exists = result.rows[0]?.count > 0;
    if (exists) {
      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}`);
      const count = countResult.rows[0]?.count || 0;
      console.log(`   ✅ ${tableName}: ${count} rows`);
    } else {
      console.log(`   ❌ ${tableName}: does not exist`);
    }
  } catch (error) {
    console.log(`   ⚠️  ${tableName}: ${error.message}`);
  }
}

// Step 4: Check FRED API Configuration
console.log('\n4️⃣ CHECKING FRED API CONFIGURATION...');
if (!process.env.FRED_API_KEY) {
  console.log('   ❌ FRED_API_KEY not set!');
} else {
  console.log('   ✅ FRED_API_KEY is set');
  console.log(`   🔑 Key starts with: ${process.env.FRED_API_KEY.substring(0, 8)}...`);
  
  // Test FRED API
  console.log('   🧪 Testing FRED API with GDP data...');
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=${process.env.FRED_API_KEY}&file_type=json&limit=1`;
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      if (data.observations && data.observations.length > 0) {
        console.log('   ✅ FRED API is working!');
        console.log(`   📊 Latest GDP: $${data.observations[0].value} billion (${data.observations[0].date})`);
      } else {
        console.log('   ⚠️  FRED API returned no data');
      }
    } else {
      console.log(`   ❌ FRED API error: ${response.status} ${response.statusText}`);
      if (response.status === 400) {
        console.log('   💡 Invalid API key - check your FRED_API_KEY');
      }
    }
  } catch (error) {
    console.log('   ❌ Failed to call FRED API:', error.message);
  }
}

// Step 5: Check for sync/cron jobs
console.log('\n5️⃣ CHECKING DATA SYNC SERVICES...');
const syncFiles = [
  'server/services/economic-calendar-service.ts',
  'server/services/fred-scheduler.ts',
  'server/services/fred-scheduler-incremental.ts',
  'server/services/intelligent-cron-scheduler.ts',
  'server/services/economic-data-backfill-service.ts'
];

import fs from 'fs';
import path from 'path';

for (const file of syncFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    console.log(`   ✅ ${path.basename(file)} exists`);
  } else {
    console.log(`   ❌ ${path.basename(file)} missing`);
  }
}

// Step 6: Diagnosis and Recommendations
console.log('\n' + '=' .repeat(50));
console.log('📋 DIAGNOSIS SUMMARY\n');

// Collect all issues
const issues = [];

try {
  const tableResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'economic_calendar'
    );
  `);
  
  if (!tableResult.rows[0]?.exists) {
    issues.push('Economic calendar table does not exist');
  } else {
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM economic_calendar`);
    if (countResult.rows[0]?.count === '0') {
      issues.push('Economic calendar table is empty - no data populated');
    }
  }
} catch (error) {
  issues.push('Cannot access database');
}

if (!process.env.FRED_API_KEY) {
  issues.push('FRED API key not configured');
}

if (issues.length === 0) {
  console.log('✅ All checks passed! Economic data pipeline should be working.');
} else {
  console.log('🔴 ISSUES FOUND:');
  issues.forEach((issue, i) => {
    console.log(`   ${i + 1}. ${issue}`);
  });
  
  console.log('\n🛠️  RECOMMENDED FIXES:\n');
  
  if (issues.includes('Economic calendar table does not exist')) {
    console.log('1. Create the table by running migrations:');
    console.log('   npm run db:push\n');
  }
  
  if (issues.includes('Economic calendar table is empty - no data populated')) {
    console.log('2. Populate economic data:');
    console.log('   node scripts/populate-economic-data.js\n');
  }
  
  if (issues.includes('FRED API key not configured')) {
    console.log('3. Set FRED API key in .env:');
    console.log('   FRED_API_KEY=your_key_here\n');
  }
}

console.log('\n' + '=' .repeat(50));
console.log('✨ Diagnostic complete\n');

// Close database connection
await pool.end();