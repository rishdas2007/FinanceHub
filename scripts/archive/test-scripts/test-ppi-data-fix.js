#!/usr/bin/env node

/**
 * PPI Data Fix Verification Script
 * Tests the critical fixes implemented for Producer Price Index data pipeline
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

async function testPPIDataFixes() {
  console.log('🔍 Testing PPI Data Pipeline Fixes...\n');
  
  const tests = [
    {
      name: 'FRED API Service Status',
      url: `${BASE_URL}/api/fred-incremental/status`,
      validator: (data) => data.status === 'enabled' || data.status === 'ready'
    },
    {
      name: 'Circuit Breaker Status',
      url: `${BASE_URL}/api/fred-incremental/circuit-breaker`,
      validator: (data) => data.fredApi && !data.fredApi.isOpen
    },
    {
      name: 'Data Freshness Monitor',
      url: `${BASE_URL}/api/economic-health/freshness`,
      validator: (data) => data.summary && Array.isArray(data.detailedChecks)
    },
    {
      name: 'PPI Series Configuration',
      url: `${BASE_URL}/api/fred-incremental/series-config`,
      validator: (data) => {
        const ppiSeries = ['PPIACO', 'PPIFIS', 'PPIENG', 'PPIFGS'];
        return ppiSeries.some(series => 
          data.curatedSeries?.some(s => s.id === series)
        );
      }
    },
    {
      name: 'Economic Health Dashboard',
      url: `${BASE_URL}/api/economic-health/dashboard`,
      validator: (data) => data.economicHealthScore && data.healthGrade
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}...`);
      const response = await axios.get(test.url, { timeout: 10000 });
      
      const isValid = test.validator(response.data);
      
      results.push({
        name: test.name,
        status: isValid ? 'PASS' : 'FAIL',
        details: isValid ? 'Working correctly' : 'Validation failed',
        data: response.data
      });
      
      console.log(`  ✅ ${test.name}: ${isValid ? 'PASS' : 'FAIL'}`);
      
    } catch (error) {
      results.push({
        name: test.name,
        status: 'ERROR',
        details: error.message,
        data: null
      });
      
      console.log(`  ❌ ${test.name}: ERROR - ${error.message}`);
    }
  }
  
  console.log('\n📊 Test Summary:');
  console.log('================');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total:  ${results.length}`);
  
  if (passed === results.length) {
    console.log('\n🎉 All PPI data fixes verified successfully!');
  } else {
    console.log('\n⚠️  Some issues detected - review test results above');
  }
  
  return results;
}

// Run the test
testPPIDataFixes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test script failed:', error);
    process.exit(1);
  });

export { testPPIDataFixes };