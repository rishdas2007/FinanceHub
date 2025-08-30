#!/usr/bin/env tsx
import { sql } from 'drizzle-orm';
import { db } from '../server/db';
import { economicCalendar, econDerivedMetrics } from '../shared/schema';
import { economicMetricsCalculator } from '../server/services/economic-metrics-calculator';
import { inflationMetricsEnhancer } from '../server/services/inflation-metrics-enhancer';
import { laborMarketIntelligence } from '../server/services/labor-market-intelligence';
import { financialMarketContext } from '../server/services/financial-market-context';
import { logger } from '../shared/utils/logger';

const BATCH_SIZE = 100;

/**
 * Populate investment metrics for existing economic calendar data
 */
async function populateInvestmentMetrics() {
  console.log('🚀 Starting investment metrics population...');
  
  try {
    // Get all unique series with sufficient data
    const seriesQuery = await db.execute(sql`
      SELECT DISTINCT 
        series_id,
        metric_name,
        category,
        unit,
        frequency,
        COUNT(*) as data_points,
        MIN(period_date) as earliest_date,
        MAX(period_date) as latest_date
      FROM economic_calendar 
      WHERE actual_value IS NOT NULL
      GROUP BY series_id, metric_name, category, unit, frequency
      HAVING COUNT(*) >= 12  -- Need at least 12 data points for YoY calculations
      ORDER BY series_id
    `);

    const allSeries = seriesQuery.rows;
    console.log(`📊 Found ${allSeries.length} series with sufficient data for calculations`);

    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    // Process each series
    for (const series of allSeries) {
      try {
        const seriesId = series.series_id as string;
        const category = series.category as string;
        
        console.log(`🔄 Processing ${seriesId} (${category}) - ${processedCount + 1}/${allSeries.length}`);
        
        // Get historical data for this series (last 5 years)
        const historicalData = await db.execute(sql`
          SELECT 
            series_id,
            period_date,
            actual_value::numeric as value,
            variance_percent::numeric as variance_percent
          FROM economic_calendar 
          WHERE series_id = ${seriesId} 
            AND actual_value IS NOT NULL
            AND period_date >= CURRENT_DATE - INTERVAL '5 years'
          ORDER BY period_date ASC
        `);

        const dataPoints = historicalData.rows;
        
        if (dataPoints.length < 12) {
          console.log(`⚠️  Skipping ${seriesId}: insufficient data (${dataPoints.length} points)`);
          continue;
        }

        // Calculate investment metrics for each data point
        const derivedMetrics = [];
        
        for (let i = 12; i < dataPoints.length; i++) { // Start from index 12 to allow YoY calculations
          const currentPoint = dataPoints[i];
          const yearAgoPoint = dataPoints[i - 12] || null;
          const quarterAgoPoint = dataPoints[Math.max(0, i - 3)] || null;
          const monthAgoPoint = dataPoints[Math.max(0, i - 1)] || null;
          
          const currentValue = parseFloat(currentPoint.value as string);
          const yearAgoValue = yearAgoPoint ? parseFloat(yearAgoPoint.value as string) : null;
          const quarterAgoValue = quarterAgoPoint ? parseFloat(quarterAgoPoint.value as string) : null;
          const monthAgoValue = monthAgoPoint ? parseFloat(monthAgoPoint.value as string) : null;
          
          // Calculate basic growth rates
          const yoyGrowth = economicMetricsCalculator.calculateYoYGrowth(currentValue, yearAgoValue);
          const qoqAnnualized = economicMetricsCalculator.calculateQoQAnnualized(currentValue, quarterAgoValue);
          const momAnnualized = economicMetricsCalculator.calculateMoMAnnualized(currentValue, monthAgoValue);
          
          // Calculate volatility (12-month rolling)
          const recent12Months = dataPoints.slice(Math.max(0, i - 11), i + 1);
          const returns = recent12Months.slice(1).map((point, idx) => {
            const prevValue = parseFloat(recent12Months[idx].value as string);
            const currValue = parseFloat(point.value as string);
            return prevValue > 0 ? (currValue - prevValue) / prevValue : 0;
          });
          
          const volatility12m = returns.length > 0 
            ? Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100 
            : null;
          
          // Calculate trend strength (simple linear regression slope)
          const trendStrength = economicMetricsCalculator.calculateTrendStrength(
            recent12Months.map(p => parseFloat(p.value as string))
          );
          
          // Calculate percentile rankings
          const allValues = dataPoints.slice(0, i + 1).map(p => parseFloat(p.value as string));
          const percentileRank1y = economicMetricsCalculator.calculatePercentileRank(
            currentValue,
            dataPoints.slice(Math.max(0, i - 11), i + 1).map(p => parseFloat(p.value as string))
          );
          const percentileRank5y = economicMetricsCalculator.calculatePercentileRank(currentValue, allValues);
          
          // Generate investment signal based on multiple factors
          const investmentSignal = generateInvestmentSignal(
            yoyGrowth, trendStrength, percentileRank1y, category
          );
          
          // Determine cycle position and regime
          const cyclePosition = determineCyclePosition(yoyGrowth, trendStrength, category);
          const regimeClassification = determineRegimeClassification(currentValue, yoyGrowth, category);
          
          // Category-specific enhancements
          let sectorImplication = null;
          let assetClassImpact = null;
          let inflationImpact = null;
          
          if (category === 'Inflation') {
            const inflationAnalysis = inflationMetricsEnhancer.analyzeInflationRegime(currentValue, yoyGrowth || 0);
            sectorImplication = inflationAnalysis.sectorRotation;
            assetClassImpact = inflationAnalysis.assetClassGuidance;
            inflationImpact = inflationAnalysis.inflationImpact;
          } else if (category === 'Labor') {
            const laborAnalysis = laborMarketIntelligence.analyzeLaborConditions(currentValue, yoyGrowth || 0);
            sectorImplication = laborAnalysis.sectorImplications;
          } else if (category === 'Finance') {
            const financialAnalysis = financialMarketContext.analyzeYieldCurve(currentValue);
            assetClassImpact = financialAnalysis.investmentImplications;
          }
          
          // Calculate confidence score
          const calculationConfidence = calculateConfidenceScore(
            dataPoints.length, volatility12m, yoyGrowth
          );
          
          derivedMetrics.push({
            seriesId: seriesId,
            baseTransformCode: 'INVESTMENT_ENHANCED',
            periodEnd: new Date(currentPoint.period_date as string),
            yoyGrowth: yoyGrowth,
            qoqAnnualized: qoqAnnualized,
            momAnnualized: momAnnualized,
            volatility12m: volatility12m,
            trendSlope: trendStrength,
            percentileRank1y: percentileRank1y,
            percentileRank5y: percentileRank5y,
            investmentSignal: investmentSignal,
            signalStrength: Math.abs(trendStrength || 0) > 0.3 ? 'STRONG' : 'MODERATE',
            cyclePosition: cyclePosition,
            regimeClassification: regimeClassification,
            sectorImplication: sectorImplication,
            assetClassImpact: assetClassImpact,
            inflationImpact: inflationImpact,
            calculationConfidence: calculationConfidence,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        
        if (derivedMetrics.length > 0) {
          // Insert derived metrics in batches
          for (let j = 0; j < derivedMetrics.length; j += BATCH_SIZE) {
            const batch = derivedMetrics.slice(j, j + BATCH_SIZE);
            
            await db.insert(econDerivedMetrics)
              .values(batch)
              .onConflictDoUpdate({
                target: [econDerivedMetrics.seriesId, econDerivedMetrics.periodEnd, econDerivedMetrics.baseTransformCode],
                set: {
                  yoyGrowth: sql.raw('EXCLUDED.yoy_growth'),
                  qoqAnnualized: sql.raw('EXCLUDED.qoq_annualized'), 
                  momAnnualized: sql.raw('EXCLUDED.mom_annualized'),
                  volatility12m: sql.raw('EXCLUDED.volatility_12m'),
                  trendSlope: sql.raw('EXCLUDED.trend_slope'),
                  percentileRank1y: sql.raw('EXCLUDED.percentile_rank_1y'),
                  percentileRank5y: sql.raw('EXCLUDED.percentile_rank_5y'),
                  investmentSignal: sql.raw('EXCLUDED.investment_signal'),
                  signalStrength: sql.raw('EXCLUDED.signal_strength'),
                  cyclePosition: sql.raw('EXCLUDED.cycle_position'),
                  regimeClassification: sql.raw('EXCLUDED.regime_classification'),
                  sectorImplication: sql.raw('EXCLUDED.sector_implication'),
                  assetClassImpact: sql.raw('EXCLUDED.asset_class_impact'),
                  inflationImpact: sql.raw('EXCLUDED.inflation_impact'),
                  calculationConfidence: sql.raw('EXCLUDED.calculation_confidence'),
                  updatedAt: sql.raw('NOW()')
                }
              });
          }
          
          console.log(`✅ Processed ${seriesId}: ${derivedMetrics.length} derived metrics calculated`);
          successCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${series.series_id}:`, error);
        errorCount++;
      }
      
      processedCount++;
      
      // Progress update every 5 series
      if (processedCount % 5 === 0) {
        console.log(`📈 Progress: ${processedCount}/${allSeries.length} series processed (${successCount} success, ${errorCount} errors)`);
      }
    }
    
    console.log(`🎉 Investment metrics population completed!`);
    console.log(`📊 Summary: ${successCount} successful, ${errorCount} errors out of ${processedCount} total`);
    
    // Verify the results
    const verificationQuery = await db.execute(sql`
      SELECT COUNT(*) as total_derived_metrics,
             COUNT(DISTINCT series_id) as unique_series
      FROM econ_derived_metrics
    `);
    
    console.log(`✅ Verification: ${verificationQuery.rows[0].total_derived_metrics} derived metrics for ${verificationQuery.rows[0].unique_series} series`);
    
  } catch (error) {
    console.error('❌ Fatal error during investment metrics population:', error);
    process.exit(1);
  }
}

function generateInvestmentSignal(
  yoyGrowth: number | null, 
  trendStrength: number | null, 
  percentileRank: number | null,
  category: string
): string {
  if (!yoyGrowth && !trendStrength) return 'NEUTRAL';
  
  let bullishScore = 0;
  let bearishScore = 0;
  
  // YoY Growth component
  if (yoyGrowth !== null) {
    if (category === 'Inflation') {
      // For inflation, moderate growth is good, extreme values are bad
      if (yoyGrowth > 1 && yoyGrowth < 4) bullishScore += 2;
      else if (yoyGrowth > 5) bearishScore += 3;
    } else {
      // For most metrics, positive growth is good
      if (yoyGrowth > 2) bullishScore += 2;
      else if (yoyGrowth < -2) bearishScore += 2;
    }
  }
  
  // Trend component
  if (trendStrength !== null) {
    if (trendStrength > 0.3) bullishScore += 1;
    else if (trendStrength < -0.3) bearishScore += 1;
  }
  
  // Percentile ranking component
  if (percentileRank !== null) {
    if (percentileRank > 80) bullishScore += 1;
    else if (percentileRank < 20) bearishScore += 1;
  }
  
  // Determine signal
  if (bullishScore >= 3) return 'STRONG_BUY';
  else if (bullishScore >= 2) return 'BULLISH';
  else if (bearishScore >= 3) return 'STRONG_SELL';
  else if (bearishScore >= 2) return 'BEARISH';
  else return 'NEUTRAL';
}

function determineCyclePosition(
  yoyGrowth: number | null,
  trendStrength: number | null,
  category: string
): string {
  if (!yoyGrowth && !trendStrength) return 'NEUTRAL';
  
  const growth = yoyGrowth || 0;
  const trend = trendStrength || 0;
  
  if (growth > 0 && trend > 0) return 'EXPANSION';
  else if (growth > 0 && trend < 0) return 'PEAK';
  else if (growth < 0 && trend < 0) return 'CONTRACTION';
  else if (growth < 0 && trend > 0) return 'TROUGH';
  else return 'NEUTRAL';
}

function determineRegimeClassification(
  currentValue: number,
  yoyGrowth: number | null,
  category: string
): string {
  if (category === 'Inflation') {
    if (!yoyGrowth) return 'STABLE';
    if (yoyGrowth > 4) return 'HIGH_INFLATION';
    else if (yoyGrowth < 1) return 'LOW_INFLATION';
    else return 'STABLE_INFLATION';
  } else if (category === 'Labor') {
    if (currentValue < 4) return 'TIGHT_LABOR';
    else if (currentValue > 7) return 'LOOSE_LABOR';
    else return 'BALANCED_LABOR';
  } else if (category === 'Growth') {
    if (!yoyGrowth) return 'STABLE';
    if (yoyGrowth > 3) return 'HIGH_GROWTH';
    else if (yoyGrowth < 1) return 'LOW_GROWTH';
    else return 'MODERATE_GROWTH';
  }
  
  return 'STABLE';
}

function calculateConfidenceScore(
  dataPoints: number,
  volatility: number | null,
  yoyGrowth: number | null
): number {
  let confidence = 0.5; // Base confidence
  
  // Data sufficiency component (0-0.3)
  confidence += Math.min(0.3, dataPoints / 100);
  
  // Volatility component (0-0.2) - lower volatility = higher confidence
  if (volatility !== null) {
    confidence += Math.max(0, 0.2 - volatility / 100);
  }
  
  // Growth consistency component (0-0.2)
  if (yoyGrowth !== null && Math.abs(yoyGrowth) < 50) { // Reasonable growth rate
    confidence += 0.2;
  }
  
  return Math.min(1.0, Math.max(0.1, confidence));
}

// Run the population script
populateInvestmentMetrics()
  .then(() => {
    console.log('🎉 Investment metrics population completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to populate investment metrics:', error);
    process.exit(1);
  });