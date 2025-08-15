/**
 * Real Data Source Discovery
 * Identifies existing working APIs and databases with real market data
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { logger } from '../server/utils/logger';

interface DataSourceAnalysis {
  source: string;
  status: 'REAL_DATA' | 'FAKE_DATA' | 'NO_DATA' | 'ERROR';
  details: any;
  recommendation: string;
}

/**
 * Analyze existing ETF historical data for real vs fake data
 */
export async function analyzeExistingETFData(): Promise<DataSourceAnalysis[]> {
  const results: DataSourceAnalysis[] = [];
  
  try {
    logger.info('🔍 Analyzing existing ETF data sources...');
    
    // Check 1: Original historical_sector_data table
    const historicalCheck = await db.execute(sql`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT symbol) as unique_symbols,
        MIN(date) as earliest_date,
        MAX(date) as latest_date,
        -- Check for realistic price variations (real data should have variance)
        STDDEV(close) as price_stddev,
        AVG(close) as avg_price,
        -- Check for weekend dates (real market data shouldn't have weekends)
        COUNT(CASE WHEN EXTRACT(DOW FROM date) IN (0,6) THEN 1 END) as weekend_records,
        -- Sample recent data for manual inspection
        ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'symbol', symbol,
            'date', date,
            'close', close,
            'volume', volume
          ) ORDER BY date DESC LIMIT 5
        ) as recent_sample
      FROM historical_sector_data
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    `);
    
    const histData = historicalCheck.rows[0];
    
    // Detect if data is real or fake based on patterns
    const hasRealisticVariance = histData.price_stddev > 10; // Real ETF prices should vary
    const hasRecentData = histData.total_records > 0;
    const hasWeekendData = histData.weekend_records > 0; // Fake data often has weekends
    const avgPriceRealistic = histData.avg_price > 10 && histData.avg_price < 1000; // Realistic ETF price range
    
    let dataStatus: 'REAL_DATA' | 'FAKE_DATA' | 'NO_DATA';
    let recommendation: string;
    
    if (!hasRecentData) {
      dataStatus = 'NO_DATA';
      recommendation = 'No recent ETF data found. Need to restore real market data source.';
    } else if (hasWeekendData > 10 || !hasRealisticVariance || !avgPriceRealistic) {
      dataStatus = 'FAKE_DATA';
      recommendation = 'Data appears to be synthetic/fake. Need to restore real market data.';
    } else {
      dataStatus = 'REAL_DATA';
      recommendation = 'Data appears to be real market data. Create caching layer to preserve it.';
    }
    
    results.push({
      source: 'historical_sector_data table',
      status: dataStatus,
      details: {
        records: histData.total_records,
        symbols: histData.unique_symbols,
        date_range: `${histData.earliest_date} to ${histData.latest_date}`,
        price_variance: histData.price_stddev,
        avg_price: histData.avg_price,
        weekend_records: histData.weekend_records,
        sample_data: histData.recent_sample
      },
      recommendation
    });
    
    // Check 2: ETF metrics cache table  
    try {
      const cacheCheck = await db.execute(sql`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT symbol) as unique_symbols,
          AVG(close_price) as avg_price,
          MAX(date) as latest_date,
          -- Check for realistic volume data
          AVG(volume) as avg_volume,
          STDDEV(close_price) as price_variance
        FROM etf_metrics_cache
        WHERE date >= CURRENT_DATE - INTERVAL '7 days'
      `);
      
      const cacheData = cacheCheck.rows[0];
      
      const hasRecentCache = cacheData.total_records > 0;
      const hasRealisticPrices = cacheData.avg_price > 10 && cacheData.avg_price < 1000;
      const hasVariance = cacheData.price_variance > 5;
      
      const cacheStatus = hasRecentCache && hasRealisticPrices && hasVariance ? 'REAL_DATA' : 'FAKE_DATA';
      
      results.push({
        source: 'etf_metrics_cache table',
        status: cacheStatus,
        details: {
          records: cacheData.total_records,
          symbols: cacheData.unique_symbols,
          avg_price: cacheData.avg_price,
          latest_date: cacheData.latest_date,
          price_variance: cacheData.price_variance
        },
        recommendation: cacheStatus === 'REAL_DATA' 
          ? 'Cache contains real data. Optimize cache refresh strategy.'
          : 'Cache needs real data population from working sources.'
      });
      
    } catch (cacheError) {
      results.push({
        source: 'etf_metrics_cache table',
        status: 'NO_DATA',
        details: { error: 'Table not found or inaccessible' },
        recommendation: 'ETF cache table missing. Need to create caching infrastructure.'
      });
    }
    
    return results;
    
  } catch (error) {
    logger.error('Failed to analyze existing ETF data:', error);
    results.push({
      source: 'Data Source Discovery',
      status: 'ERROR', 
      details: { error: error.message },
      recommendation: 'Could not analyze data sources. Check database connectivity.'
    });
    return results;
  }
}

/**
 * Test existing API endpoints for real data
 */
export async function testAPIEndpoints(): Promise<DataSourceAnalysis[]> {
  const results: DataSourceAnalysis[] = [];
  
  try {
    logger.info('🔍 Testing existing API endpoints...');
    
    // Test ETF metrics endpoint
    try {
      const response = await fetch('http://localhost:5000/api/etf-metrics');
      const data = await response.json();
      
      if (data.success && data.data && data.data.length > 0) {
        const firstETF = data.data[0];
        const hasRealisticPrice = firstETF.price > 10 && firstETF.price < 1000;
        const hasVariedData = data.data.some(etf => etf.price !== firstETF.price);
        const hasRealSymbols = data.data.some(etf => ['SPY', 'QQQ', 'XLK'].includes(etf.symbol));
        
        const apiStatus = hasRealisticPrice && hasVariedData && hasRealSymbols ? 'REAL_DATA' : 'FAKE_DATA';
        
        results.push({
          source: '/api/etf-metrics endpoint',
          status: apiStatus,
          details: {
            response_time: data.metadata?.responseTime,
            record_count: data.data.length,
            sample_symbols: data.data.slice(0, 3).map(etf => etf.symbol),
            sample_prices: data.data.slice(0, 3).map(etf => etf.price),
            has_volume_data: data.data.every(etf => etf.volume > 0)
          },
          recommendation: apiStatus === 'REAL_DATA' 
            ? 'API returning real ETF data. Cache these responses for performance.'
            : 'API returning synthetic data. Need to restore real data source.'
        });
      } else {
        results.push({
          source: '/api/etf-metrics endpoint',
          status: 'NO_DATA',
          details: { error: 'No data returned' },
          recommendation: 'API not returning data. Check endpoint functionality.'
        });
      }
    } catch (apiError) {
      results.push({
        source: '/api/etf-metrics endpoint',
        status: 'ERROR',
        details: { error: apiError.message },
        recommendation: 'API endpoint error. Check server status.'
      });
    }
    
    return results;
    
  } catch (error) {
    logger.error('Failed to test API endpoints:', error);
    results.push({
      source: 'API Testing',
      status: 'ERROR',
      details: { error: error.message },
      recommendation: 'Could not test API endpoints.'
    });
    return results;
  }
}

/**
 * Execute complete real data source discovery
 */
export async function executeRealDataSourceDiscovery() {
  const startTime = Date.now();
  
  try {
    console.log('🔍 === REAL DATA SOURCE DISCOVERY STARTING ===');
    console.log('🎯 Goal: Find existing real market data to preserve and cache');
    console.log('');
    
    // Phase 1: Analyze existing ETF data
    console.log('📊 Phase 1: Analyzing existing ETF data...');
    const etfAnalysis = await analyzeExistingETFData();
    
    console.log('📋 ETF Data Analysis Results:');
    etfAnalysis.forEach(result => {
      const icon = result.status === 'REAL_DATA' ? '✅' : 
                   result.status === 'FAKE_DATA' ? '🔄' : 
                   result.status === 'NO_DATA' ? '❌' : '⚠️';
      console.log(`  ${icon} ${result.source}: ${result.status}`);
      console.log(`     → ${result.recommendation}`);
      
      if (result.status === 'REAL_DATA') {
        console.log(`     📊 Details: ${JSON.stringify(result.details, null, 6)}`);
      }
    });
    console.log('');
    
    // Phase 2: Test API endpoints  
    console.log('🔌 Phase 2: Testing API endpoints...');
    const apiAnalysis = await testAPIEndpoints();
    
    console.log('📋 API Endpoint Analysis Results:');
    apiAnalysis.forEach(result => {
      const icon = result.status === 'REAL_DATA' ? '✅' : 
                   result.status === 'NO_DATA' ? '❌' : '⚠️';
      console.log(`  ${icon} ${result.source}: ${result.status}`);
      console.log(`     → ${result.recommendation}`);
    });
    console.log('');
    
    // Analysis Summary
    const allResults = [...etfAnalysis, ...apiAnalysis];
    const realDataSources = allResults.filter(r => r.status === 'REAL_DATA');
    const fakeDataSources = allResults.filter(r => r.status === 'FAKE_DATA');
    const noDataSources = allResults.filter(r => r.status === 'NO_DATA');
    
    console.log('📋 === DISCOVERY SUMMARY ===');
    console.log(`✅ Real data sources: ${realDataSources.length}`);
    console.log(`🔄 Fake data sources: ${fakeDataSources.length}`); 
    console.log(`❌ Missing data sources: ${noDataSources.length}`);
    console.log('');
    
    // Strategic recommendations
    console.log('🎯 STRATEGIC RECOMMENDATIONS:');
    
    if (realDataSources.length > 0) {
      console.log('🎉 GOOD NEWS: Found existing real data sources!');
      console.log('💡 Strategy: Create caching layer to preserve and accelerate real data');
      console.log('📋 Real data sources to preserve:');
      realDataSources.forEach((source, i) => {
        console.log(`  ${i + 1}. ${source.source} - ${source.recommendation}`);
      });
    } else {
      console.log('⚠️ WARNING: No real data sources found!');
      console.log('💡 Strategy: Restore real market data connections first, then cache');
    }
    
    const executionTime = Date.now() - startTime;
    console.log('');
    console.log(`⏱️ Discovery completed in ${executionTime}ms`);
    console.log('🎯 Next: Implement caching strategy based on findings');
    
    return {
      summary: {
        real_sources: realDataSources.length,
        fake_sources: fakeDataSources.length,
        missing_sources: noDataSources.length,
        execution_time: executionTime
      },
      real_data_sources: realDataSources,
      recommendations: realDataSources.length > 0 ? 'IMPLEMENT_CACHING' : 'RESTORE_REAL_DATA'
    };
    
  } catch (error) {
    console.error('Discovery failed:', error);
    return {
      summary: { error: error.message },
      real_data_sources: [],
      recommendations: 'ERROR_RECOVERY'
    };
  }
}

// Execute if run directly
if (import.meta.main) {
  executeRealDataSourceDiscovery()
    .then(result => {
      console.log('✅ Discovery complete:', result.recommendations);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Discovery failed:', error);
      process.exit(1);
    });
}