#!/usr/bin/env node

/**
 * Test direct SQL query to economic_calendar
 */

import pg from 'pg';
const { Client } = pg;

console.log('Testing direct PostgreSQL query...\n');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function testQuery() {
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Test 1: Simple count
    const countResult = await client.query('SELECT COUNT(*) FROM economic_calendar');
    console.log(`\nTotal rows: ${countResult.rows[0].count}`);
    
    // Test 2: Get some data
    const dataResult = await client.query(`
      SELECT 
        series_id,
        metric_name,
        category,
        release_date,
        actual_value
      FROM economic_calendar
      ORDER BY release_date DESC
      LIMIT 5
    `);
    
    console.log('\nLatest 5 records:');
    dataResult.rows.forEach(row => {
      console.log(`- ${row.metric_name} (${row.category}): ${row.actual_value}`);
    });
    
    // Test 3: With parameters
    const paramsResult = await client.query(
      'SELECT * FROM economic_calendar WHERE category = $1 LIMIT 3',
      ['Growth']
    );
    
    console.log(`\nGrowth category records: ${paramsResult.rows.length}`);
    
  } catch (error) {
    console.error('❌ Query failed:', error);
  } finally {
    await client.end();
    console.log('\n✅ Connection closed');
  }
}

testQuery();