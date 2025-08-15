#!/usr/bin/env node

// RCA Monitoring Script - Comprehensive Health Check Implementation
// Executes the systematic health checks described in the RCA analysis

const BASE_URL = process.env.SERVER_URL || 'http://localhost:5000';

async function performHealthCheck(endpoint, description) {
  try {
    console.log(`\n🔍 Testing: ${description}`);
    console.log(`📡 Endpoint: ${endpoint}`);
    
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json();
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response:`, JSON.stringify(data, null, 2));
    
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    console.error(`❌ Error testing ${endpoint}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runRCAHealthChecks() {
  console.log('🔍 Starting RCA-based Comprehensive Health Check Analysis');
  console.log(`🌐 Server: ${BASE_URL}`);
  console.log('=' .repeat(80));

  // RCA Test 1: Basic Health Check
  const basicHealth = await performHealthCheck('/health', 'Basic Application Health');
  
  // RCA Test 2: Database Health Check (Quick)
  const dbHealth = await performHealthCheck('/health/db', 'Database Health Check (Quick)');
  
  // RCA Test 3: Detailed Database Analysis
  const detailedHealth = await performHealthCheck('/health/db/detailed', 'Detailed Database Schema Validation');
  
  // RCA Test 4: ETF Metrics Specific Check
  const etfHealth = await performHealthCheck('/health/etf-metrics', 'ETF Metrics Health Check');
  
  // RCA Test 5: ETF Metrics API Endpoint
  const etfMetrics = await performHealthCheck('/api/etf-metrics', 'ETF Metrics API Endpoint');
  
  // RCA Test 6: Market Status
  const marketStatus = await performHealthCheck('/api/market-status', 'Market Status API');
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 RCA HEALTH CHECK SUMMARY');
  console.log('='.repeat(80));
  
  const tests = [
    { name: 'Basic Health', result: basicHealth },
    { name: 'Database Health', result: dbHealth },
    { name: 'Schema Validation', result: detailedHealth },
    { name: 'ETF Health Check', result: etfHealth },
    { name: 'ETF Metrics API', result: etfMetrics },
    { name: 'Market Status', result: marketStatus }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  tests.forEach(test => {
    const status = test.result.success ? '✅' : '❌';
    const statusCode = test.result.status ? `(${test.result.status})` : '';
    console.log(`${status} ${test.name} ${statusCode}`);
    
    if (test.result.success) passedTests++;
    
    // Show key details for failed tests
    if (!test.result.success) {
      console.log(`   🔍 Error: ${test.result.error || 'Failed with status ' + test.result.status}`);
    }
  });
  
  console.log('\n📈 OVERALL HEALTH SCORE');
  console.log(`✅ ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
  
  // RCA-specific analysis
  console.log('\n🔬 RCA ANALYSIS FINDINGS');
  
  if (detailedHealth.success && detailedHealth.data.recommendations) {
    console.log('\n💡 System Recommendations:');
    detailedHealth.data.recommendations.forEach(rec => {
      console.log(`   • ${rec}`);
    });
  }
  
  if (etfHealth.success && etfHealth.data.etfMetrics) {
    console.log('\n📊 ETF Metrics Analysis:');
    const etfData = etfHealth.data.etfMetrics.details;
    console.log(`   • Data Source: ${etfData.dataSource || 'Unknown'}`);
    console.log(`   • Precomputed Features: ${etfData.hasPrecomputedFeatures ? 'Available' : 'Missing'}`);
    console.log(`   • ETF Coverage: ${etfData.completeness || 'Unknown'}`);
    if (etfData.fallbackReason) {
      console.log(`   • Fallback Reason: ${etfData.fallbackReason}`);
    }
  }
  
  // Root cause analysis - check for the specific issue found
  if (detailedHealth.success && detailedHealth.data.checks) {
    console.log('\n🔍 ROOT CAUSE ANALYSIS');
    const featuresTable = detailedHealth.data.checks.find(c => c.table === 'equity_features_daily');
    const barsTable = detailedHealth.data.checks.find(c => c.table === 'equity_daily_bars');
    
    if (featuresTable && barsTable) {
      console.log(`   • equity_features_daily: ${featuresTable.rowCount} rows`);
      console.log(`   • equity_daily_bars: ${barsTable.rowCount} rows`);
      
      if (featuresTable.rowCount === 0 && barsTable.rowCount > 0) {
        console.log('\n🚨 ROOT CAUSE IDENTIFIED:');
        console.log('   Empty equity_features_daily table while equity_daily_bars has data');
        console.log('   This explains ETF metrics "Database connection issue"');
        console.log('   ETF metrics route depends on precomputed Z-scores that are missing');
        console.log('\n🔧 RECOMMENDED FIXES:');
        console.log('   1. Run ETL pipeline to populate equity_features_daily');
        console.log('   2. ETF metrics will use fallback data from stock_data table');
        console.log('   3. Verify fallback system is working correctly');
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  const overallHealth = passedTests >= totalTests * 0.8 ? 'HEALTHY' : 'NEEDS ATTENTION';
  console.log(`🏥 OVERALL SYSTEM STATUS: ${overallHealth}`);
  console.log('='.repeat(80));
  
  return passedTests === totalTests;
}

// Execute if run directly
if (require.main === module) {
  runRCAHealthChecks().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Health check script failed:', error);
    process.exit(1);
  });
}

module.exports = { runRCAHealthChecks };