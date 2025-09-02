#!/usr/bin/env node

import pg from 'pg';
const { Client } = pg;

async function checkSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check economic_calendar columns
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'economic_calendar' 
      ORDER BY ordinal_position
    `);
    
    console.log('\neconomic_calendar columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Get sample data
    const sampleResult = await client.query(`
      SELECT * FROM economic_calendar 
      LIMIT 2
    `);
    
    console.log('\nSample data:');
    console.log(JSON.stringify(sampleResult.rows, null, 2));

    // Check historical_stock_data columns
    const stockResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'historical_stock_data' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nhistorical_stock_data columns:');
    stockResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();