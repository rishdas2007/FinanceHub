import { db } from '../db';
import { economicCalendar, econDerivedMetrics, type InsertEconDerivedMetrics } from '../../shared/schema';
import { sql, eq, and, desc } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';

/**
 * Inflation Metrics Enhancement Service
 * Specialized calculations for inflation data with investment context
 */

interface InflationDataPoint {
  periodDate: Date;
  actualValue: number;
  seriesId: string;
  category: string;
}

interface InflationAnalysis {
  inflationRate: number; // YoY inflation rate
  coreInflationRate?: number; // If available
  realRate?: number; // Nominal rate - inflation
  inflationTrend: 'ACCELERATING' | 'DECELERATING' | 'STABLE';
  inflationRegime: 'DEFLATIONARY' | 'LOW' | 'MODERATE' | 'HIGH' | 'HYPERINFLATION';
  fedTargetDeviation?: number; // Deviation from 2% target
  marketImplications: {
    bondYields: 'RISING' | 'FALLING' | 'STABLE';
    equityImpact: 'POSITIVE' | 'NEGATIVE' | 'MIXED';
    sectorRotation: string[];
  };
}

export class InflationMetricsEnhancer {
  private readonly FED_INFLATION_TARGET = 2.0; // Federal Reserve 2% target
  private readonly PIPELINE_VERSION = 'v2.0-inflation-enhanced';

  // Inflation series mapping for comprehensive analysis
  private readonly INFLATION_SERIES = {
    // Core inflation measures
    'CPIAUCSL': { name: 'Consumer Price Index', type: 'headline', weight: 1.0 },
    'CPILFESL': { name: 'Core CPI', type: 'core', weight: 1.0 },
    'PCEPI': { name: 'PCE Price Index', type: 'headline', weight: 0.9 },
    'PCEPILFE': { name: 'Core PCE Price Index', type: 'core', weight: 0.9 }, // Fed's preferred measure
    'PPIFIS': { name: 'Producer Price Index', type: 'producer', weight: 0.7 },
    
    // Commodity inflation
    'DCOILWTICO': { name: 'WTI Crude Oil', type: 'commodity', weight: 0.8 },
    'GOLDAMGBD228NLBM': { name: 'Gold Price', type: 'commodity', weight: 0.6 },
    
    // Import/Currency effects
    'DEXUSEU': { name: 'USD/EUR Exchange Rate', type: 'currency', weight: 0.5 },
  };

  /**
   * Calculate inflation rate from index values
   */
  private calculateInflationRate(currentIndex: number, yearAgoIndex: number): number | null {
    if (!yearAgoIndex || yearAgoIndex <= 0) return null;
    return ((currentIndex - yearAgoIndex) / yearAgoIndex) * 100;
  }

  /**
   * Classify inflation regime based on rate
   */
  private classifyInflationRegime(inflationRate: number): 'DEFLATIONARY' | 'LOW' | 'MODERATE' | 'HIGH' | 'HYPERINFLATION' {
    if (inflationRate < 0) return 'DEFLATIONARY';
    if (inflationRate < 1) return 'LOW';
    if (inflationRate < 4) return 'MODERATE';
    if (inflationRate < 10) return 'HIGH';
    return 'HYPERINFLATION';
  }

  /**
   * Determine inflation trend based on recent data
   */
  private determineInflationTrend(recentRates: number[]): 'ACCELERATING' | 'DECELERATING' | 'STABLE' {
    if (recentRates.length < 3) return 'STABLE';
    
    const recent = recentRates.slice(-3);
    const avgChange = (recent[2] - recent[0]) / 2; // Average change over 3 periods
    
    if (avgChange > 0.3) return 'ACCELERATING';
    if (avgChange < -0.3) return 'DECELERATING';
    return 'STABLE';
  }

  /**
   * Analyze market implications of inflation data
   */
  private analyzeMarketImplications(
    inflationRate: number,
    trend: string,
    regime: string,
    fedDeviation: number
  ): InflationAnalysis['marketImplications'] {
    let bondYields: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';
    let equityImpact: 'POSITIVE' | 'NEGATIVE' | 'MIXED' = 'MIXED';
    let sectorRotation: string[] = [];

    // Bond yield implications
    if (inflationRate > 3 || trend === 'ACCELERATING') {
      bondYields = 'RISING';
    } else if (inflationRate < 1 || trend === 'DECELERATING') {
      bondYields = 'FALLING';
    }

    // Equity market implications
    if (regime === 'MODERATE' && Math.abs(fedDeviation) < 1) {
      equityImpact = 'POSITIVE'; // Goldilocks scenario
      sectorRotation = ['Technology', 'Consumer Discretionary', 'Communication Services'];
    } else if (regime === 'HIGH' || trend === 'ACCELERATING') {
      equityImpact = 'NEGATIVE';
      sectorRotation = ['Energy', 'Materials', 'Real Estate', 'Utilities'];
    } else if (regime === 'LOW' || regime === 'DEFLATIONARY') {
      equityImpact = 'MIXED';
      sectorRotation = ['Technology', 'Healthcare', 'Consumer Staples'];
    }

    return { bondYields, equityImpact, sectorRotation };
  }

  /**
   * Calculate real interest rates (nominal - inflation)
   */
  private async calculateRealRates(inflationRate: number): Promise<{ realFedFunds?: number; real10Y?: number }> {
    try {
      // Get latest Fed Funds Rate
      const fedFundsData = await db
        .select({ actualValue: economicCalendar.actualValue })
        .from(economicCalendar)
        .where(eq(economicCalendar.seriesId, 'FEDFUNDS'))
        .orderBy(desc(economicCalendar.periodDate))
        .limit(1);

      // Get latest 10-Year Treasury Rate
      const treasury10YData = await db
        .select({ actualValue: economicCalendar.actualValue })
        .from(economicCalendar)
        .where(eq(economicCalendar.seriesId, 'DGS10'))
        .orderBy(desc(economicCalendar.periodDate))
        .limit(1);

      const results: { realFedFunds?: number; real10Y?: number } = {};

      if (fedFundsData.length > 0) {
        const nominalFedFunds = parseFloat(fedFundsData[0].actualValue);
        results.realFedFunds = nominalFedFunds - inflationRate;
      }

      if (treasury10YData.length > 0) {
        const nominal10Y = parseFloat(treasury10YData[0].actualValue);
        results.real10Y = nominal10Y - inflationRate;
      }

      return results;
    } catch (error) {
      logger.error('Failed to calculate real rates:', error);
      return {};
    }
  }

  /**
   * Get historical inflation data for a series
   */
  private async getInflationData(seriesId: string, limitMonths: number = 120): Promise<InflationDataPoint[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - limitMonths);

      const results = await db
        .select({
          periodDate: economicCalendar.periodDate,
          actualValue: economicCalendar.actualValue,
          seriesId: economicCalendar.seriesId,
          category: economicCalendar.category,
        })
        .from(economicCalendar)
        .where(
          and(
            eq(economicCalendar.seriesId, seriesId),
            sql`period_date >= ${cutoffDate.toISOString()}`
          )
        )
        .orderBy(desc(economicCalendar.periodDate));

      return results.map(row => ({
        periodDate: new Date(row.periodDate),
        actualValue: parseFloat(row.actualValue),
        seriesId: row.seriesId,
        category: row.category,
      }));
    } catch (error) {
      logger.error(`Failed to get inflation data for ${seriesId}:`, error);
      return [];
    }
  }

  /**
   * Enhance inflation metrics with investment-focused analysis
   */
  async enhanceInflationMetrics(seriesId: string): Promise<void> {
    try {
      logger.info(`🔥 Enhancing inflation metrics for series: ${seriesId}`);

      const seriesInfo = this.INFLATION_SERIES[seriesId as keyof typeof this.INFLATION_SERIES];
      if (!seriesInfo) {
        logger.info(`ℹ️ Series ${seriesId} is not classified as an inflation metric, skipping enhancement`);
        return;
      }

      // Get historical data
      const dataPoints = await this.getInflationData(seriesId);
      
      if (dataPoints.length < 24) { // Need at least 2 years of data
        logger.warn(`⚠️ Insufficient data for inflation analysis: ${seriesId} (${dataPoints.length} points)`);
        return;
      }

      logger.info(`📊 Processing ${dataPoints.length} inflation data points for ${seriesId}`);

      // Calculate inflation rates for recent periods
      const enhancedMetrics: InsertEconDerivedMetrics[] = [];
      
      for (let i = 12; i < Math.min(dataPoints.length, 36); i++) { // Last 24 periods
        const current = dataPoints[i];
        const yearAgo = dataPoints[i - 12]; // 12 months ago
        
        if (!yearAgo) continue;

        const inflationRate = this.calculateInflationRate(current.actualValue, yearAgo.actualValue);
        if (!inflationRate) continue;

        // Get recent inflation rates for trend analysis
        const recentRates: number[] = [];
        for (let j = Math.max(0, i - 6); j <= i; j++) {
          if (dataPoints[j - 12]) {
            const rate = this.calculateInflationRate(dataPoints[j].actualValue, dataPoints[j - 12].actualValue);
            if (rate) recentRates.push(rate);
          }
        }

        // Perform comprehensive inflation analysis
        const regime = this.classifyInflationRegime(inflationRate);
        const trend = this.determineInflationTrend(recentRates);
        const fedDeviation = inflationRate - this.FED_INFLATION_TARGET;
        const marketImplications = this.analyzeMarketImplications(inflationRate, trend, regime, fedDeviation);
        
        // Calculate real rates
        const realRates = await this.calculateRealRates(inflationRate);

        // Determine investment signal based on inflation context
        let investmentSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        let signalStrength = 0.5;

        if (regime === 'MODERATE' && Math.abs(fedDeviation) < 0.5) {
          investmentSignal = 'BULLISH'; // Goldilocks inflation
          signalStrength = 0.8;
        } else if (regime === 'HIGH' || trend === 'ACCELERATING') {
          investmentSignal = 'BEARISH'; // Problematic inflation
          signalStrength = 0.7;
        } else if (regime === 'DEFLATIONARY') {
          investmentSignal = 'BEARISH'; // Deflationary concerns
          signalStrength = 0.6;
        }

        // Create enhanced metrics entry
        const enhancedMetric: InsertEconDerivedMetrics = {
          seriesId,
          periodEnd: current.periodDate,
          baseTransformCode: 'INFLATION_ENHANCED',
          pipelineVersion: this.PIPELINE_VERSION,
          calculationEngine: 'v2.0-inflation',
          
          // Core inflation metrics
          yoyGrowth: inflationRate.toString(),
          realYoyGrowth: realRates.realFedFunds?.toString(),
          inflationImpact: fedDeviation.toString(),
          
          // Investment context
          investmentSignal,
          signalStrength: signalStrength.toString(),
          regimeClassification: regime,
          cyclePosition: trend,
          
          // Sector implications
          sectorImplication: marketImplications.sectorRotation.join(', '),
          assetClassImpact: `Bonds: ${marketImplications.bondYields}, Equities: ${marketImplications.equityImpact}`,
          
          // Real value calculations
          realValue: realRates.real10Y?.toString(),
          
          // Quality metrics
          calculationConfidence: '0.9', // High confidence for inflation calculations
          dataQualityScore: '0.95',
          misssingDataPoints: 0,
        };

        enhancedMetrics.push(enhancedMetric);
      }

      // Insert enhanced inflation metrics
      if (enhancedMetrics.length > 0) {
        await db.insert(econDerivedMetrics)
          .values(enhancedMetrics)
          .onConflictDoUpdate({
            target: [econDerivedMetrics.seriesId, econDerivedMetrics.periodEnd, econDerivedMetrics.baseTransformCode],
            set: {
              yoyGrowth: sql`excluded.yoy_growth`,
              investmentSignal: sql`excluded.investment_signal`,
              signalStrength: sql`excluded.signal_strength`,
              regimeClassification: sql`excluded.regime_classification`,
              sectorImplication: sql`excluded.sector_implication`,
              assetClassImpact: sql`excluded.asset_class_impact`,
              realValue: sql`excluded.real_value`,
              realYoyGrowth: sql`excluded.real_yoy_growth`,
              inflationImpact: sql`excluded.inflation_impact`,
              updatedAt: sql`NOW()`,
            },
          });

        logger.info(`✅ Enhanced ${enhancedMetrics.length} inflation metrics for ${seriesId}`);
      }

    } catch (error) {
      logger.error(`❌ Failed to enhance inflation metrics for ${seriesId}:`, error);
      throw error;
    }
  }

  /**
   * Process all inflation series for enhanced metrics
   */
  async enhanceAllInflationSeries(): Promise<void> {
    try {
      logger.info('🔥 Starting comprehensive inflation metrics enhancement');

      const inflationSeriesIds = Object.keys(this.INFLATION_SERIES);
      logger.info(`📊 Found ${inflationSeriesIds.length} inflation series to enhance`);

      // Process series sequentially to avoid database overload
      for (const seriesId of inflationSeriesIds) {
        await this.enhanceInflationMetrics(seriesId);
        
        // Small delay between series
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      logger.info('🎉 Completed comprehensive inflation metrics enhancement');

    } catch (error) {
      logger.error('❌ Failed to enhance all inflation series:', error);
      throw error;
    }
  }

  /**
   * Calculate cross-metric inflation adjustments for real values
   */
  async calculateRealValueAdjustments(): Promise<void> {
    try {
      logger.info('🔄 Calculating real value adjustments for all non-inflation metrics');

      // Get latest CPI data for inflation adjustment
      const latestCPI = await db
        .select({ 
          actualValue: economicCalendar.actualValue,
          periodDate: economicCalendar.periodDate
        })
        .from(economicCalendar)
        .where(eq(economicCalendar.seriesId, 'CPIAUCSL'))
        .orderBy(desc(economicCalendar.periodDate))
        .limit(24); // Last 2 years

      if (latestCPI.length < 12) {
        logger.warn('⚠️ Insufficient CPI data for real value adjustments');
        return;
      }

      // Calculate current inflation rate
      const currentCPI = parseFloat(latestCPI[0].actualValue);
      const yearAgoCPI = parseFloat(latestCPI[11].actualValue);
      const currentInflationRate = this.calculateInflationRate(currentCPI, yearAgoCPI);

      if (!currentInflationRate) {
        logger.warn('⚠️ Could not calculate current inflation rate');
        return;
      }

      logger.info(`📈 Using inflation rate of ${currentInflationRate.toFixed(2)}% for real value adjustments`);

      // Get all non-inflation series that represent dollar amounts
      const dollarSeries = await db
        .selectDistinct({ 
          seriesId: economicCalendar.seriesId,
          unit: economicCalendar.unit
        })
        .from(economicCalendar)
        .where(
          and(
            sql`unit LIKE '%Dollar%' OR unit LIKE '%Billions%' OR unit LIKE '%Millions%'`,
            sql`series_id NOT IN ('CPIAUCSL', 'PCEPI', 'PPIFIS')` // Exclude inflation series
          )
        );

      logger.info(`💰 Found ${dollarSeries.length} dollar-denominated series for real value calculation`);

      // Process each series to add real value metrics
      for (const series of dollarSeries) {
        await this.addRealValueMetrics(series.seriesId, currentInflationRate);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      }

      logger.info('✅ Completed real value adjustments for all applicable series');

    } catch (error) {
      logger.error('❌ Failed to calculate real value adjustments:', error);
      throw error;
    }
  }

  /**
   * Add real value metrics to a specific series
   */
  private async addRealValueMetrics(seriesId: string, inflationRate: number): Promise<void> {
    try {
      // Get latest data point for this series
      const latestData = await db
        .select({
          actualValue: economicCalendar.actualValue,
          periodDate: economicCalendar.periodDate,
        })
        .from(economicCalendar)
        .where(eq(economicCalendar.seriesId, seriesId))
        .orderBy(desc(economicCalendar.periodDate))
        .limit(1);

      if (latestData.length === 0) return;

      const nominalValue = parseFloat(latestData[0].actualValue);
      const realValue = nominalValue / (1 + inflationRate / 100); // Inflation-adjusted

      // Update or insert real value metric
      const realValueMetric: InsertEconDerivedMetrics = {
        seriesId,
        periodEnd: latestData[0].periodDate,
        baseTransformCode: 'REAL_ADJUSTED',
        pipelineVersion: this.PIPELINE_VERSION,
        calculationEngine: 'v2.0-inflation',
        
        realValue: realValue.toString(),
        inflationImpact: ((nominalValue - realValue) / nominalValue * 100).toString(),
        
        calculationConfidence: '0.85',
        dataQualityScore: '0.9',
        misssingDataPoints: 0,
      };

      await db.insert(econDerivedMetrics)
        .values([realValueMetric])
        .onConflictDoUpdate({
          target: [econDerivedMetrics.seriesId, econDerivedMetrics.periodEnd, econDerivedMetrics.baseTransformCode],
          set: {
            realValue: sql`excluded.real_value`,
            inflationImpact: sql`excluded.inflation_impact`,
            updatedAt: sql`NOW()`,
          },
        });

    } catch (error) {
      logger.error(`Failed to add real value metrics for ${seriesId}:`, error);
    }
  }
}

export const inflationMetricsEnhancer = new InflationMetricsEnhancer();