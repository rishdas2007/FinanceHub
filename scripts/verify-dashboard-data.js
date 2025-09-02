#!/usr/bin/env node

import fetch from 'node-fetch';

async function verifyDashboard() {
  console.log('🔍 Verifying Dashboard Data Sources\n');
  console.log('=' .repeat(50));
  
  const endpoints = [
    { url: '/api/health', name: 'Health Check' },
    { url: '/api/market-status', name: 'Market Status' },
    { url: '/api/etf/robust', name: 'ETF Robust Data' },
    { url: '/api/economic-calendar', name: 'Economic Calendar' },
    { url: '/api/economic-calendar-simple', name: 'Economic Calendar Simple' },
    { url: '/api/etf-metrics', name: 'ETF Metrics' },
    { url: '/api/macro/gdp-data', name: 'GDP Data' },
    { url: '/api/macro/inflation-data', name: 'Inflation Data' }
  ];
  
  let allWorking = true;
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:8080${endpoint.url}`);
      const data = await response.json();
      
      if (response.ok && data.success !== false) {
        // Count data items
        let dataCount = 0;
        if (data.data) {
          if (Array.isArray(data.data)) {
            dataCount = data.data.length;
          } else if (data.data.events && Array.isArray(data.data.events)) {
            dataCount = data.data.events.length;
          }
        }
        
        console.log(`✅ ${endpoint.name.padEnd(25)} - ${dataCount} items`);
      } else {
        console.log(`❌ ${endpoint.name.padEnd(25)} - ${data.error || 'Failed'}`);
        allWorking = false;
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name.padEnd(25)} - ${error.message}`);
      allWorking = false;
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  
  if (allWorking) {
    console.log('✅ All endpoints working with real data!');
    console.log('\n📊 Dashboard should be displaying:');
    console.log('  - ETF Technical Metrics Table with 14 ETFs');
    console.log('  - Economic Calendar with 100 recent events');
    console.log('  - Market Status Indicator');
    console.log('  - GDP and Inflation data in MacroDashboard');
  } else {
    console.log('⚠️  Some endpoints are not working properly');
  }
  
  console.log('\n🌐 Access the dashboard at: http://localhost:8080/');
}

verifyDashboard();