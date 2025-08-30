#!/usr/bin/env ts-node

/**
 * Economic Calendar Performance Benchmark Suite
 * Comprehensive testing of database optimizations and query performance
 */

import { performance } from 'perf_hooks';
import { sql } from 'drizzle-orm';
import { db } from '../server/db';
import { optimizedEconomicQueries } from '../server/services/optimized-economic-queries';
import { economicCalendarService } from '../server/services/economic-calendar-service';
import { economicCalendarCacheStrategy } from '../server/services/economic-calendar-cache-strategy';

interface BenchmarkResult {
  testName: string;
  executionTime: number;
  rowsReturned: number;
  fromCache: boolean;
  optimization?: string;
  success: boolean;
  error?: string;
}

class EconomicCalendarBenchmark {
  private results: BenchmarkResult[] = [];
  
  /**
   * RUN COMPREHENSIVE BENCHMARK SUITE
   */
  async runFullBenchmark() {
    console.log('🚀 Starting Economic Calendar Performance Benchmark Suite');
    console.log('================================================================');
    
    const startTime = performance.now();
    
    try {
      // 1. Apply database optimizations first
      await this.applyOptimizations();
      
      // 2. Run performance tests
      await this.runQueryPerformanceTests();
      
      // 3. Run cache performance tests
      await this.runCachePerformanceTests();
      
      // 4. Run concurrent load tests
      await this.runConcurrentLoadTests();
      
      // 5. Generate comprehensive report
      await this.generatePerformanceReport();
      
      const totalTime = performance.now() - startTime;
      console.log(`\n✅ Benchmark suite completed in ${Math.round(totalTime)}ms`);
      
    } catch (error) {
      console.error('❌ Benchmark suite failed:', error);
      throw error;
    }
  }

  /**
   * APPLY DATABASE OPTIMIZATIONS
   */
  private async applyOptimizations() {
    console.log('\n📊 Applying Database Optimizations...');
    
    try {
      // Apply the migration with all optimizations
      const migrationSQL = await import('fs').then(fs => 
        fs.readFileSync('../migrations/economic_calendar_optimization.sql', 'utf8')
      );
      
      // Execute optimization SQL (split by semicolon and execute separately)
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
      
      let appliedCount = 0;
      for (const statement of statements) {
        try {
          await db.execute(sql.raw(statement));
          appliedCount++;
        } catch (error) {
          // Some statements might fail if already exist - log but continue
          if (!error.message.includes('already exists') && 
              !error.message.includes('duplicate key')) {
            console.warn(`⚠️ Statement failed:`, error.message.substring(0, 100));
          }
        }
      }
      
      console.log(`✅ Applied ${appliedCount} optimization statements`);
      
      // Refresh materialized view
      await optimizedEconomicQueries.refreshMaterializedView();
      console.log('✅ Materialized view refreshed');
      
    } catch (error) {
      console.error('❌ Failed to apply optimizations:', error);
      throw error;
    }
  }

  /**
   * QUERY PERFORMANCE TESTS
   */
  private async runQueryPerformanceTests() {
    console.log('\n🔍 Running Query Performance Tests...');
    
    const tests = [
      {
        name: 'Critical Indicators (Target: <5ms)',
        test: () => optimizedEconomicQueries.getCriticalIndicators(),
        target: 5
      },
      {
        name: 'Latest Mode - Default (Target: <10ms)',
        test: () => optimizedEconomicQueries.getLatestEconomicData({ limit: 50 }),
        target: 10
      },
      {
        name: 'Latest Mode - Category Filter (Target: <15ms)',
        test: () => optimizedEconomicQueries.getLatestEconomicData({ 
          category: 'Labor', 
          limit: 100 
        }),
        target: 15
      },
      {
        name: 'Timeline Mode (Target: <50ms)',
        test: () => optimizedEconomicQueries.getTimelineEconomicData({ limit: 20 }),
        target: 50
      },
      {
        name: 'Category Query (Target: <10ms)',
        test: () => optimizedEconomicQueries.getCategoryEconomicData('Inflation'),
        target: 10
      },
      {
        name: 'Investment Signals (Target: <25ms)',
        test: () => optimizedEconomicQueries.getInvestmentSignals({
          signalType: 'BULLISH',
          minStrength: 0.5
        }),
        target: 25
      }
    ];

    for (const test of tests) {
      const startTime = performance.now();
      
      try {
        const result = await test.test();
        const executionTime = performance.now() - startTime;
        
        const success = executionTime <= test.target;
        const status = success ? '✅' : '❌';
        const performanceRating = success ? 'EXCELLENT' : 'NEEDS OPTIMIZATION';
        
        console.log(`${status} ${test.name}: ${Math.round(executionTime)}ms (${performanceRating})`);
        
        this.results.push({
          testName: test.name,
          executionTime: Math.round(executionTime),
          rowsReturned: result.data?.length || 0,
          fromCache: result.fromCache || false,
          optimization: result.optimization,
          success
        });
        
      } catch (error) {
        console.log(`❌ ${test.name}: FAILED - ${error.message}`);
        
        this.results.push({
          testName: test.name,
          executionTime: 0,
          rowsReturned: 0,
          fromCache: false,
          success: false,
          error: error.message
        });
      }
    }
  }

  /**
   * CACHE PERFORMANCE TESTS
   */
  private async runCachePerformanceTests() {
    console.log('\n💾 Running Cache Performance Tests...');
    
    // Test cache warming
    const warmingStart = performance.now();
    const warmResult = await economicCalendarCacheStrategy.warmCache();
    const warmingTime = performance.now() - warmingStart;
    
    console.log(`${warmResult.success ? '✅' : '❌'} Cache Warming: ${Math.round(warmingTime)}ms (${warmResult.warmed}/${warmResult.total} successful)`);
    
    // Test cache hit performance
    const cacheTests = [
      {
        name: 'Cache Hit - Critical Indicators',
        test: () => optimizedEconomicQueries.getCachedQuery(
          'critical_indicators',
          () => optimizedEconomicQueries.getCriticalIndicators(),
          5
        )
      },
      {
        name: 'Cache Hit - Recent Releases', 
        test: () => optimizedEconomicQueries.getCachedQuery(
          'recent_releases',
          () => optimizedEconomicQueries.getLatestEconomicData({ limit: 50 }),
          10
        )
      }
    ];

    for (const test of cacheTests) {
      const startTime = performance.now();
      
      try {
        // First call (cache miss)
        await test.test();
        
        // Second call (cache hit)
        const result = await test.test();
        const executionTime = performance.now() - startTime;
        
        const status = result.fromCache ? '✅' : '⚠️';
        console.log(`${status} ${test.name}: ${Math.round(executionTime)}ms (Cache: ${result.fromCache ? 'HIT' : 'MISS'})`);
        
      } catch (error) {
        console.log(`❌ ${test.name}: FAILED - ${error.message}`);
      }
    }

    // Get cache health metrics
    const healthMetrics = await economicCalendarCacheStrategy.getCacheHealthMetrics();
    if (healthMetrics.success) {
      console.log(`📊 Cache Health: ${healthMetrics.overall.active_entries} active, ${healthMetrics.overall.total_hits} total hits`);
    }
  }

  /**
   * CONCURRENT LOAD TESTS
   */
  private async runConcurrentLoadTests() {
    console.log('\n⚡ Running Concurrent Load Tests...');
    
    const concurrencyLevels = [5, 10, 20];
    
    for (const concurrency of concurrencyLevels) {
      const startTime = performance.now();
      
      // Create concurrent requests
      const requests = Array.from({ length: concurrency }, (_, i) => 
        optimizedEconomicQueries.getLatestEconomicData({
          category: i % 2 === 0 ? 'Labor' : 'Inflation',
          limit: 50
        })
      );
      
      try {
        const results = await Promise.all(requests);
        const totalTime = performance.now() - startTime;
        const avgTime = totalTime / concurrency;
        
        const success = avgTime <= 100; // Target: <100ms average under load
        const status = success ? '✅' : '❌';
        
        console.log(`${status} Concurrency ${concurrency}x: ${Math.round(totalTime)}ms total, ${Math.round(avgTime)}ms avg`);
        
      } catch (error) {
        console.log(`❌ Concurrency ${concurrency}x: FAILED - ${error.message}`);
      }
    }
  }

  /**
   * GENERATE COMPREHENSIVE PERFORMANCE REPORT
   */
  private async generatePerformanceReport() {
    console.log('\n📋 Performance Analysis Report');
    console.log('================================');
    
    const successfulTests = this.results.filter(r => r.success);
    const failedTests = this.results.filter(r => !r.success);
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successful tests: ${successfulTests.length}`);
    console.log(`   ❌ Failed tests: ${failedTests.length}`);
    console.log(`   📈 Success rate: ${Math.round((successfulTests.length / this.results.length) * 100)}%`);
    
    if (successfulTests.length > 0) {
      const avgExecutionTime = successfulTests.reduce((sum, r) => sum + r.executionTime, 0) / successfulTests.length;
      const totalRowsReturned = successfulTests.reduce((sum, r) => sum + r.rowsReturned, 0);
      
      console.log(`\n⚡ Performance Metrics:`);
      console.log(`   🏃 Average execution time: ${Math.round(avgExecutionTime)}ms`);
      console.log(`   📦 Total rows returned: ${totalRowsReturned}`);
      console.log(`   💾 Cache utilization: ${successfulTests.filter(r => r.fromCache).length}/${successfulTests.length} hits`);
    }

    // Sub-100ms achievement check
    const sub100msTests = successfulTests.filter(r => r.executionTime < 100);
    console.log(`\n🎯 Sub-100ms Goal Achievement:`);
    console.log(`   ⚡ Tests under 100ms: ${sub100msTests.length}/${successfulTests.length}`);
    console.log(`   📊 Achievement rate: ${Math.round((sub100msTests.length / successfulTests.length) * 100)}%`);

    // Individual test results
    console.log(`\n📋 Detailed Results:`);
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const cacheStatus = result.fromCache ? '💾' : '🔄';
      console.log(`   ${status} ${result.testName}: ${result.executionTime}ms ${cacheStatus} (${result.rowsReturned} rows)`);
    });

    // Recommendations
    console.log(`\n💡 Optimization Recommendations:`);
    
    if (failedTests.length > 0) {
      console.log(`   🔧 ${failedTests.length} tests failed - investigate query optimizations`);
    }
    
    const slowTests = successfulTests.filter(r => r.executionTime > 50);
    if (slowTests.length > 0) {
      console.log(`   ⏱️ ${slowTests.length} tests >50ms - consider additional indexing`);
    }
    
    const lowCacheHits = successfulTests.filter(r => !r.fromCache).length;
    if (lowCacheHits > successfulTests.length * 0.5) {
      console.log(`   💾 Low cache hit rate - extend TTL or improve warming strategy`);
    }

    if (sub100msTests.length === successfulTests.length) {
      console.log(`   🎉 EXCELLENT: All tests achieved sub-100ms target!`);
    }

    // Get final database statistics
    await this.getDatabaseStatistics();
  }

  /**
   * DATABASE STATISTICS AND INDEX USAGE
   */
  private async getDatabaseStatistics() {
    console.log(`\n📊 Database Statistics:`);
    
    try {
      // Table sizes
      const tableStatsQuery = sql`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples
        FROM pg_stat_user_tables 
        WHERE tablename IN ('economic_calendar', 'econ_derived_metrics', 'economic_calendar_cache')
        ORDER BY tablename
      `;
      
      const tableStats = await db.execute(tableStatsQuery);
      
      console.log(`   📋 Table Statistics:`);
      tableStats.rows.forEach(stat => {
        console.log(`     • ${stat.tablename}: ${stat.live_tuples} live rows, ${stat.dead_tuples} dead rows`);
      });

      // Index usage
      const indexStatsQuery = sql`
        SELECT 
          indexrelname as index_name,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched,
          idx_scan as scans
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public' 
          AND (indexrelname LIKE '%economic%' OR indexrelname LIKE '%econ%')
        ORDER BY idx_scan DESC
        LIMIT 10
      `;
      
      const indexStats = await db.execute(indexStatsQuery);
      
      console.log(`   🗂️ Top Index Usage:`);
      indexStats.rows.forEach(stat => {
        console.log(`     • ${stat.index_name}: ${stat.scans} scans, ${stat.tuples_fetched} fetched`);
      });

    } catch (error) {
      console.log(`   ⚠️ Could not retrieve database statistics: ${error.message}`);
    }
  }
}

/**
 * CLI EXECUTION
 */
async function main() {
  const benchmark = new EconomicCalendarBenchmark();
  
  try {
    await benchmark.runFullBenchmark();
    process.exit(0);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { EconomicCalendarBenchmark };