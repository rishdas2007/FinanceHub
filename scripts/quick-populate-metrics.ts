#!/usr/bin/env tsx
import { sql } from 'drizzle-orm';
import { db } from '../server/db';
import { economicCalendar, econDerivedMetrics } from '../shared/schema';

/**
 * Quick population of investment metrics with basic calculations
 */
async function quickPopulateMetrics() {
  console.log('🚀 Quick populating investment metrics...');
  
  try {
    // Get sample of series with data
    const seriesQuery = await db.execute(sql`
      SELECT DISTINCT series_id, metric_name, category
      FROM economic_calendar 
      WHERE series_id IN ('GDP', 'GDPC1', 'CPIAUCSL', 'PCEPI', 'UNRATE', 'PAYEMS', 'FEDFUNDS')
        AND actual_value IS NOT NULL
      LIMIT 10
    `);

    console.log(`📊 Processing ${seriesQuery.rows.length} key series...`);

    for (const series of seriesQuery.rows) {
      const seriesId = series.series_id as string;
      const category = series.category as string;
      
      console.log(`🔄 Processing ${seriesId}...`);
      
      // Get last 24 months of data for this series
      const dataQuery = await db.execute(sql`
        SELECT 
          period_date,
          actual_value::numeric as value
        FROM economic_calendar 
        WHERE series_id = ${seriesId}
          AND actual_value IS NOT NULL
          AND period_date >= CURRENT_DATE - INTERVAL '24 months'
        ORDER BY period_date ASC
      `);
      
      const dataPoints = dataQuery.rows;
      console.log(`   Found ${dataPoints.length} data points`);
      
      if (dataPoints.length < 12) continue;
      
      // Process each data point starting from month 12 (for YoY calculations)
      for (let i = 12; i < dataPoints.length; i++) {
        const currentPoint = dataPoints[i];
        const yearAgoPoint = dataPoints[i - 12];
        
        const currentValue = parseFloat(currentPoint.value as string);
        const yearAgoValue = parseFloat(yearAgoPoint.value as string);
        
        // Calculate YoY growth
        const yoyGrowth = yearAgoValue > 0 ? 
          ((currentValue - yearAgoValue) / yearAgoValue) * 100 : null;
        
        // Simple volatility calculation (last 6 months)
        const recentPoints = dataPoints.slice(Math.max(0, i - 5), i + 1);
        const values = recentPoints.map(p => parseFloat(p.value as string));
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const volatility = Math.sqrt(variance) / mean * 100;
        
        // Generate simple investment signal
        let investmentSignal = 'NEUTRAL';
        if (yoyGrowth !== null) {
          if (category === 'Inflation') {
            if (yoyGrowth > 1 && yoyGrowth < 4) investmentSignal = 'BULLISH';
            else if (yoyGrowth > 5) investmentSignal = 'BEARISH';
          } else if (category === 'Labor') {
            // For unemployment, lower is better
            if (seriesId === 'UNRATE') {
              if (yoyGrowth < -10) investmentSignal = 'BULLISH';
              else if (yoyGrowth > 20) investmentSignal = 'BEARISH';
            } else {
              // For payrolls, higher growth is better
              if (yoyGrowth > 2) investmentSignal = 'BULLISH';
              else if (yoyGrowth < -2) investmentSignal = 'BEARISH';
            }
          } else {
            // For growth metrics, positive growth is generally good
            if (yoyGrowth > 2) investmentSignal = 'BULLISH';
            else if (yoyGrowth < -2) investmentSignal = 'BEARISH';
          }
        }
        
        // Calculate simple trend (last 3 vs previous 3 months)
        const recent3 = dataPoints.slice(i - 2, i + 1).map(p => parseFloat(p.value as string));
        const previous3 = dataPoints.slice(i - 5, i - 2).map(p => parseFloat(p.value as string));
        const recent3Avg = recent3.reduce((a, b) => a + b, 0) / 3;
        const previous3Avg = previous3.reduce((a, b) => a + b, 0) / 3;
        const trendStrength = previous3Avg > 0 ? (recent3Avg - previous3Avg) / previous3Avg : 0;
        
        // Determine percentile rank (simple approximation)
        const allHistoricalValues = dataPoints.slice(0, i + 1).map(p => parseFloat(p.value as string));
        const sortedValues = allHistoricalValues.sort((a, b) => a - b);
        const rank = sortedValues.indexOf(currentValue);
        const percentileRank1y = (rank / sortedValues.length) * 100;
        
        // Insert derived metric
        try {
          await db.insert(econDerivedMetrics).values({
            seriesId: seriesId,
            baseTransformCode: 'QUICK_POPULATE',
            periodEnd: new Date(currentPoint.period_date as string),
            yoyGrowth: yoyGrowth,
            qoqAnnualized: null,
            momAnnualized: null,
            volatility3m: null,
            volatility12m: volatility,
            trendSlope: trendStrength,
            percentileRank1y: percentileRank1y,
            percentileRank5y: null,
            percentileRank10y: null,
            investmentSignal: investmentSignal,
            signalStrength: Math.abs(trendStrength) > 0.05 ? 'STRONG' : 'MODERATE',
            cyclePosition: yoyGrowth && yoyGrowth > 0 ? 'EXPANSION' : 'CONTRACTION',
            regimeClassification: 'STABLE',
            sectorImplication: category === 'Inflation' ? 'Monitor bond yields and REIT exposure' :
                             category === 'Labor' ? 'Watch consumer discretionary and wage-sensitive sectors' :
                             'Broad market implications',
            assetClassImpact: investmentSignal === 'BULLISH' ? 'Positive for equities, negative for bonds' :
                            investmentSignal === 'BEARISH' ? 'Negative for equities, positive for bonds' :
                            'Mixed signals across asset classes',
            calculationConfidence: dataPoints.length > 20 ? 0.8 : 0.6,
            createdAt: new Date(),
            updatedAt: new Date()
          }).onConflictDoNothing();
          
        } catch (error) {
          console.log(`   Warning: Could not insert data point for ${currentPoint.period_date}:`, error.message);
        }
      }
      
      console.log(`   ✅ Processed ${seriesId} successfully`);
    }
    
    // Verify results
    const countQuery = await db.execute(sql`
      SELECT 
        COUNT(*) as total_metrics,
        COUNT(DISTINCT series_id) as unique_series
      FROM econ_derived_metrics
    `);
    
    console.log(`✅ Created ${countQuery.rows[0].total_metrics} derived metrics for ${countQuery.rows[0].unique_series} series`);
    
    console.log('🎉 Quick population completed!');
    
  } catch (error) {
    console.error('❌ Error during quick population:', error);
    throw error;
  }
}

// Run the script
quickPopulateMetrics()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });