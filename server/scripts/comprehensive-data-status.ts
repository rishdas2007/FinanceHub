#!/usr/bin/env tsx
/**
 * Comprehensive Data Collection Status Report
 * Shows status of both ETF historical data and FRED economic indicators
 */

import { logger } from '../utils/logger';
import { db } from '../db.js';
import { historicalStockData, economicIndicatorsCurrent } from '@shared/schema';
import { sql } from 'drizzle-orm';

class ComprehensiveDataStatus {
  /**
   * Generate complete data collection status report
   */
  async generateStatusReport(): Promise<{
    etfData: any;
    economicIndicators: any;
    summary: any;
  }> {
    logger.info('📊 Generating comprehensive data status report');

    // ETF Historical Data Status
    const etfStatus = await this.getETFDataStatus();
    
    // Economic Indicators Status  
    const economicStatus = await this.getEconomicIndicatorsStatus();
    
    // Overall Summary
    const summary = {
      totalDataSources: 2,
      operationalSources: [etfStatus.operational, economicStatus.operational].filter(Boolean).length,
      dataCollectionHealth: this.calculateHealthScore(etfStatus, economicStatus),
      lastUpdated: new Date().toISOString(),
      recommendations: this.generateRecommendations(etfStatus, economicStatus)
    };

    return {
      etfData: etfStatus,
      economicIndicators: economicStatus,
      summary
    };
  }

  /**
   * Get ETF historical data status
   */
  private async getETFDataStatus(): Promise<any> {
    try {
      const result = await db
        .select({
          symbol: historicalStockData.symbol,
          count: sql<number>`count(*)`.as('count'),
          minDate: sql<string>`min(date::text)`.as('minDate'),
          maxDate: sql<string>`max(date::text)`.as('maxDate'),
          avgVolume: sql<number>`round(avg(volume::numeric))`.as('avgVolume')
        })
        .from(historicalStockData)
        .groupBy(historicalStockData.symbol);

      const totalRecords = result.reduce((sum, r) => sum + r.count, 0);
      const symbols = result.length;
      
      return {
        operational: true,
        type: 'ETF Historical Data',
        source: 'Twelve Data API',
        symbols: symbols,
        totalRecords: totalRecords,
        averageRecordsPerSymbol: Math.round(totalRecords / symbols),
        dataRange: {
          earliest: result.length > 0 ? result[0].minDate : null,
          latest: result.length > 0 ? result[0].maxDate : null
        },
        averageVolume: result.length > 0 ? Math.round(result[0].avgVolume / 1000000) : 0,
        reliability: symbols >= 12 && totalRecords >= 300 ? 'HIGH' : 'MEDIUM',
        details: result
      };
    } catch (error) {
      return {
        operational: false,
        type: 'ETF Historical Data',
        error: (error as Error).message,
        reliability: 'OFFLINE'
      };
    }
  }

  /**
   * Get economic indicators status
   */
  private async getEconomicIndicatorsStatus(): Promise<any> {
    try {
      const result = await db
        .select({
          category: economicIndicatorsCurrent.category,
          count: sql<number>`count(*)`.as('count')
        })
        .from(economicIndicatorsCurrent)
        .groupBy(economicIndicatorsCurrent.category);

      const indicators = await db
        .select({
          metric: economicIndicatorsCurrent.metric,
          category: economicIndicatorsCurrent.category,
          value: economicIndicatorsCurrent.valueNumeric,
          date: economicIndicatorsCurrent.periodDateDesc,
          updated: economicIndicatorsCurrent.updatedAt
        })
        .from(economicIndicatorsCurrent)
        .orderBy(economicIndicatorsCurrent.updatedAt);

      const totalIndicators = indicators.length;
      const categories = result.length;
      
      return {
        operational: true,
        type: 'Economic Indicators',
        source: 'FRED API',
        totalIndicators: totalIndicators,
        categories: categories,
        categoryBreakdown: result.reduce((acc, r) => {
          acc[r.category] = r.count;
          return acc;
        }, {} as Record<string, number>),
        latestUpdate: indicators.length > 0 ? indicators[indicators.length - 1].updated : null,
        reliability: totalIndicators >= 10 ? 'HIGH' : totalIndicators >= 5 ? 'MEDIUM' : 'LOW',
        sampleIndicators: indicators.slice(0, 5).map(i => ({
          metric: i.metric,
          value: i.value,
          date: i.date
        }))
      };
    } catch (error) {
      return {
        operational: false,
        type: 'Economic Indicators',
        error: (error as Error).message,
        reliability: 'OFFLINE'
      };
    }
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(etf: any, economic: any): string {
    let score = 0;
    let maxScore = 0;

    // ETF Data Health (50% weight)
    maxScore += 50;
    if (etf.operational) {
      if (etf.reliability === 'HIGH') score += 50;
      else if (etf.reliability === 'MEDIUM') score += 35;
      else score += 20;
    }

    // Economic Data Health (50% weight)
    maxScore += 50;
    if (economic.operational) {
      if (economic.reliability === 'HIGH') score += 50;
      else if (economic.reliability === 'MEDIUM') score += 35;
      else score += 20;
    }

    const percentage = Math.round((score / maxScore) * 100);
    
    if (percentage >= 90) return 'EXCELLENT';
    if (percentage >= 75) return 'GOOD';
    if (percentage >= 60) return 'FAIR';
    return 'NEEDS ATTENTION';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(etf: any, economic: any): string[] {
    const recommendations: string[] = [];

    if (etf.operational && etf.totalRecords < 400) {
      recommendations.push('Consider extending ETF historical data collection beyond current 42-day window');
    }

    if (economic.operational && economic.totalIndicators < 15) {
      recommendations.push('Add more economic indicators for comprehensive market analysis');
    }

    if (!etf.operational) {
      recommendations.push('URGENT: ETF data collection system is offline');
    }

    if (!economic.operational) {
      recommendations.push('URGENT: Economic indicators system is offline');
    }

    if (etf.operational && economic.operational && recommendations.length === 0) {
      recommendations.push('Data collection systems are operating optimally');
    }

    return recommendations;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const statusService = new ComprehensiveDataStatus();
  
  statusService.generateStatusReport()
    .then(report => {
      console.log('\n🎯 Comprehensive Data Collection Status Report');
      console.log('==============================================');
      
      console.log('\n📈 ETF Historical Data:');
      console.log(`   Status: ${report.etfData.operational ? '✅ OPERATIONAL' : '❌ OFFLINE'}`);
      if (report.etfData.operational) {
        console.log(`   Symbols: ${report.etfData.symbols}`);
        console.log(`   Total Records: ${report.etfData.totalRecords}`);
        console.log(`   Average Volume: ${report.etfData.averageVolume}M`);
        console.log(`   Reliability: ${report.etfData.reliability}`);
        console.log(`   Date Range: ${report.etfData.dataRange.earliest} to ${report.etfData.dataRange.latest}`);
      }
      
      console.log('\n📊 Economic Indicators:');
      console.log(`   Status: ${report.economicIndicators.operational ? '✅ OPERATIONAL' : '❌ OFFLINE'}`);
      if (report.economicIndicators.operational) {
        console.log(`   Total Indicators: ${report.economicIndicators.totalIndicators}`);
        console.log(`   Categories: ${report.economicIndicators.categories}`);
        console.log(`   Reliability: ${report.economicIndicators.reliability}`);
        console.log(`   Latest Update: ${report.economicIndicators.latestUpdate}`);
        
        console.log('\n   Sample Indicators:');
        report.economicIndicators.sampleIndicators.forEach((indicator: any) => {
          console.log(`     • ${indicator.metric}: ${indicator.value} (${indicator.date})`);
        });
      }
      
      console.log('\n🎯 Overall Health:');
      console.log(`   Data Collection Health: ${report.summary.dataCollectionHealth}`);
      console.log(`   Operational Sources: ${report.summary.operationalSources}/${report.summary.totalDataSources}`);
      
      console.log('\n📋 Recommendations:');
      report.summary.recommendations.forEach((rec: string) => {
        console.log(`   • ${rec}`);
      });
      
      process.exit(0);
    })
    .catch(error => {
      logger.error('💥 Status report failed:', error);
      process.exit(1);
    });
}

export { ComprehensiveDataStatus };