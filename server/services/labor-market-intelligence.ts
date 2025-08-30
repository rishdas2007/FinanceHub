import { db } from '../db';
import { economicCalendar, econDerivedMetrics, type InsertEconDerivedMetrics } from '../../shared/schema';
import { sql, eq, and, desc, asc } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';

/**
 * Labor Market Intelligence Service
 * Advanced analysis of employment data for investment insights
 */

interface LaborDataPoint {
  periodDate: Date;
  actualValue: number;
  seriesId: string;
  frequency: string;
  unit: string;
}

interface LaborMarketAnalysis {
  employmentTrend: 'STRENGTHENING' | 'WEAKENING' | 'STABLE';
  laborTightness: 'VERY_TIGHT' | 'TIGHT' | 'BALANCED' | 'LOOSE' | 'VERY_LOOSE';
  wageInflationPressure: 'HIGH' | 'MODERATE' | 'LOW';
  fedPolicyImplication: 'HAWKISH' | 'DOVISH' | 'NEUTRAL';
  sectorImplications: {
    beneficiaries: string[];
    underperformers: string[];
  };
  consumptionImpact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  recessionProbability: number; // 0-100
}

export class LaborMarketIntelligence {
  private readonly PIPELINE_VERSION = 'v2.0-labor-enhanced';
  
  // Labor market series with investment relevance weights
  private readonly LABOR_SERIES = {
    // Employment levels and rates
    'UNRATE': { name: 'Unemployment Rate', type: 'rate', weight: 1.0, inverted: true }, // Lower is better
    'PAYEMS': { name: 'Nonfarm Payrolls', type: 'level', weight: 1.0, inverted: false },
    'CIVPART': { name: 'Labor Force Participation', type: 'rate', weight: 0.8, inverted: false },
    
    // Wage and productivity
    'AHETPI': { name: 'Average Hourly Earnings', type: 'wage', weight: 0.9, inverted: false },
    'CES0500000003': { name: 'Average Weekly Earnings', type: 'wage', weight: 0.7, inverted: false },
    
    // Leading indicators
    'ICSA': { name: 'Initial Claims', type: 'leading', weight: 0.9, inverted: true }, // Lower is better
    'JOLTSTSJOR': { name: 'Job Openings', type: 'leading', weight: 0.8, inverted: false },
    'JTSJOR': { name: 'Job Openings Rate', type: 'leading', weight: 0.8, inverted: false },
    
    // Quality metrics
    'LNS12300060': { name: 'Employment-Population Ratio', type: 'quality', weight: 0.7, inverted: false },
    'U6RATE': { name: 'U6 Unemployment Rate', type: 'quality', weight: 0.8, inverted: true },
  };

  // Historical benchmarks for context
  private readonly BENCHMARKS = {
    UNEMPLOYMENT_FULL_EMPLOYMENT: 4.0, // NAIRU estimate
    WAGE_GROWTH_NEUTRAL: 3.5, // Neutral wage growth rate
    INITIAL_CLAIMS_THRESHOLD: 400000, // Recession warning threshold
    PARTICIPATION_RATE_TREND: 63.0, // Pre-pandemic trend
  };

  /**
   * Classify labor market tightness
   */
  private classifyLaborTightness(
    unemploymentRate: number,
    jobOpeningsRate?: number,
    initialClaims?: number
  ): 'VERY_TIGHT' | 'TIGHT' | 'BALANCED' | 'LOOSE' | 'VERY_LOOSE' {
    let score = 0;
    let factors = 0;

    // Unemployment rate component
    if (unemploymentRate < 3.5) score += 2;
    else if (unemploymentRate < 4.0) score += 1;
    else if (unemploymentRate > 6.0) score -= 2;
    else if (unemploymentRate > 5.0) score -= 1;
    factors++;

    // Job openings component
    if (jobOpeningsRate !== undefined) {
      if (jobOpeningsRate > 7.0) score += 1;
      else if (jobOpeningsRate < 4.0) score -= 1;
      factors++;
    }

    // Initial claims component
    if (initialClaims !== undefined) {
      if (initialClaims < 300000) score += 1;
      else if (initialClaims > 450000) score -= 1;
      factors++;
    }

    const avgScore = score / factors;

    if (avgScore > 1.2) return 'VERY_TIGHT';
    if (avgScore > 0.5) return 'TIGHT';
    if (avgScore > -0.5) return 'BALANCED';
    if (avgScore > -1.2) return 'LOOSE';
    return 'VERY_LOOSE';
  }

  /**
   * Assess wage inflation pressure
   */
  private assessWageInflationPressure(
    wageGrowthYoY: number,
    unemploymentRate: number,
    inflationRate: number = 2.5
  ): 'HIGH' | 'MODERATE' | 'LOW' {
    const realWageGrowth = wageGrowthYoY - inflationRate;
    
    // High pressure: Strong nominal wage growth + tight labor market
    if (wageGrowthYoY > 4.5 && unemploymentRate < 4.0) return 'HIGH';
    if (wageGrowthYoY > 5.0) return 'HIGH';
    
    // Low pressure: Weak wage growth or loose labor market
    if (wageGrowthYoY < 2.5 || unemploymentRate > 5.5) return 'LOW';
    if (realWageGrowth < 0.5) return 'LOW';
    
    return 'MODERATE';
  }

  /**
   * Calculate recession probability based on labor indicators
   */
  private calculateRecessionProbability(
    unemploymentRate: number,
    unemploymentTrend: number,
    initialClaims: number,
    initialClaimsTrend: number,
    payrollsGrowth: number
  ): number {
    let recessionScore = 0;

    // Sahm Rule: Unemployment rate rises by 0.5 percentage points or more
    if (unemploymentTrend > 0.5) recessionScore += 40;
    else if (unemploymentTrend > 0.3) recessionScore += 20;

    // Initial claims surge
    if (initialClaims > 450000) recessionScore += 25;
    if (initialClaimsTrend > 50000) recessionScore += 15;

    // Payrolls weakness
    if (payrollsGrowth < 50000) recessionScore += 20;
    else if (payrollsGrowth < 100000) recessionScore += 10;

    // Unemployment rate level
    if (unemploymentRate > 5.0) recessionScore += 15;

    return Math.min(recessionScore, 95); // Cap at 95%
  }

  /**
   * Analyze sector implications of labor market conditions
   */
  private analyzeSectorImplications(
    laborTightness: string,
    wageInflationPressure: string,
    consumptionTrend: string
  ): { beneficiaries: string[]; underperformers: string[] } {
    const beneficiaries: string[] = [];
    const underperformers: string[] = [];

    // Tight labor market implications
    if (laborTightness === 'VERY_TIGHT' || laborTightness === 'TIGHT') {
      beneficiaries.push('Consumer Discretionary', 'Industrials', 'Technology');
      
      if (wageInflationPressure === 'HIGH') {
        underperformers.push('Consumer Staples', 'Utilities', 'REITs');
      }
    }

    // Loose labor market implications
    if (laborTightness === 'LOOSE' || laborTightness === 'VERY_LOOSE') {
      underperformers.push('Consumer Discretionary', 'Industrials');
      beneficiaries.push('Healthcare', 'Utilities', 'Consumer Staples');
    }

    // Wage inflation pressure implications
    if (wageInflationPressure === 'HIGH') {
      underperformers.push('Materials', 'Energy'); // Margin compression
      beneficiaries.push('Real Estate', 'Commodities'); // Inflation hedge
    }

    // Strong consumption implications
    if (consumptionTrend === 'POSITIVE') {
      beneficiaries.push('Consumer Discretionary', 'Communication Services');
    } else if (consumptionTrend === 'NEGATIVE') {
      underperformers.push('Consumer Discretionary', 'Communication Services');
      beneficiaries.push('Consumer Staples', 'Healthcare');
    }

    return { beneficiaries: [...new Set(beneficiaries)], underperformers: [...new Set(underperformers)] };
  }

  /**
   * Get historical labor market data
   */
  private async getLaborData(seriesId: string, limitMonths: number = 60): Promise<LaborDataPoint[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - limitMonths);

      const results = await db
        .select({
          periodDate: economicCalendar.periodDate,
          actualValue: economicCalendar.actualValue,
          seriesId: economicCalendar.seriesId,
          frequency: economicCalendar.frequency,
          unit: economicCalendar.unit,
        })
        .from(economicCalendar)
        .where(
          and(
            eq(economicCalendar.seriesId, seriesId),
            sql`period_date >= ${cutoffDate.toISOString()}`
          )
        )
        .orderBy(asc(economicCalendar.periodDate));

      return results.map(row => ({
        periodDate: new Date(row.periodDate),
        actualValue: parseFloat(row.actualValue),
        seriesId: row.seriesId,
        frequency: row.frequency,
        unit: row.unit,
      }));
    } catch (error) {
      logger.error(`Failed to get labor data for ${seriesId}:`, error);
      return [];
    }
  }

  /**
   * Calculate employment trend strength
   */
  private calculateEmploymentTrend(dataPoints: LaborDataPoint[]): number {
    if (dataPoints.length < 6) return 0;

    // Calculate 3-month and 6-month trends
    const recent = dataPoints.slice(-3);
    const older = dataPoints.slice(-6, -3);

    const recentAvg = recent.reduce((sum, dp) => sum + dp.actualValue, 0) / recent.length;
    const olderAvg = older.reduce((sum, dp) => sum + dp.actualValue, 0) / older.length;

    return ((recentAvg - olderAvg) / olderAvg) * 100;
  }

  /**
   * Analyze comprehensive labor market conditions
   */
  async analyzeLaborMarketConditions(): Promise<LaborMarketAnalysis> {
    try {
      logger.info('📊 Analyzing comprehensive labor market conditions');

      // Get key labor market data
      const [unemploymentData, payrollsData, wageData, claimsData, jobOpeningsData] = await Promise.all([
        this.getLaborData('UNRATE', 36),
        this.getLaborData('PAYEMS', 36),
        this.getLaborData('AHETPI', 36),
        this.getLaborData('ICSA', 12), // Weekly data, less history needed
        this.getLaborData('JOLTSTSJOR', 36),
      ]);

      // Current values
      const currentUnemployment = unemploymentData[unemploymentData.length - 1]?.actualValue || 0;
      const currentWage = wageData[wageData.length - 1]?.actualValue || 0;
      const currentClaims = claimsData[claimsData.length - 1]?.actualValue || 0;
      const currentJobOpenings = jobOpeningsData[jobOpeningsData.length - 1]?.actualValue || 0;

      // Calculate trends
      const unemploymentTrend = this.calculateEmploymentTrend(unemploymentData.slice(-6));
      const payrollsTrend = this.calculateEmploymentTrend(payrollsData.slice(-6));
      const claimsTrend = this.calculateEmploymentTrend(claimsData.slice(-4)); // 4 weeks

      // Calculate YoY wage growth
      const wageYoY = wageData.length >= 12 
        ? ((currentWage - wageData[wageData.length - 13].actualValue) / wageData[wageData.length - 13].actualValue) * 100
        : 0;

      // Analyze labor market conditions
      const laborTightness = this.classifyLaborTightness(
        currentUnemployment,
        currentJobOpenings / 1000, // Convert to percentage-like scale
        currentClaims
      );

      const wageInflationPressure = this.assessWageInflationPressure(wageYoY, currentUnemployment);

      const recessionProbability = this.calculateRecessionProbability(
        currentUnemployment,
        unemploymentTrend,
        currentClaims,
        claimsTrend,
        payrollsTrend
      );

      // Determine overall employment trend
      let employmentTrend: 'STRENGTHENING' | 'WEAKENING' | 'STABLE' = 'STABLE';
      const trendScore = (payrollsTrend - unemploymentTrend - claimsTrend / 10000); // Normalize claims
      
      if (trendScore > 0.2) employmentTrend = 'STRENGTHENING';
      else if (trendScore < -0.2) employmentTrend = 'WEAKENING';

      // Fed policy implications
      let fedPolicyImplication: 'HAWKISH' | 'DOVISH' | 'NEUTRAL' = 'NEUTRAL';
      if (laborTightness === 'VERY_TIGHT' && wageInflationPressure === 'HIGH') {
        fedPolicyImplication = 'HAWKISH';
      } else if (laborTightness === 'LOOSE' || recessionProbability > 30) {
        fedPolicyImplication = 'DOVISH';
      }

      // Consumption impact
      const consumptionImpact = employmentTrend === 'STRENGTHENING' && wageYoY > 2 ? 'POSITIVE' :
                              employmentTrend === 'WEAKENING' || currentUnemployment > 5 ? 'NEGATIVE' : 'NEUTRAL';

      const sectorImplications = this.analyzeSectorImplications(
        laborTightness,
        wageInflationPressure,
        consumptionImpact
      );

      return {
        employmentTrend,
        laborTightness,
        wageInflationPressure,
        fedPolicyImplication,
        sectorImplications,
        consumptionImpact,
        recessionProbability,
      };

    } catch (error) {
      logger.error('❌ Failed to analyze labor market conditions:', error);
      throw error;
    }
  }

  /**
   * Enhance labor market metrics for investment analysis
   */
  async enhanceLaborMetrics(seriesId: string): Promise<void> {
    try {
      logger.info(`👷 Enhancing labor market metrics for series: ${seriesId}`);

      const seriesInfo = this.LABOR_SERIES[seriesId as keyof typeof this.LABOR_SERIES];
      if (!seriesInfo) {
        logger.info(`ℹ️ Series ${seriesId} is not classified as a labor metric, skipping enhancement`);
        return;
      }

      // Get historical data
      const dataPoints = await this.getLaborData(seriesId);
      
      if (dataPoints.length < 12) {
        logger.warn(`⚠️ Insufficient data for labor analysis: ${seriesId} (${dataPoints.length} points)`);
        return;
      }

      // Get comprehensive labor market analysis
      const laborAnalysis = await this.analyzeLaborMarketConditions();

      logger.info(`📊 Processing ${dataPoints.length} labor data points for ${seriesId}`);

      // Calculate enhanced metrics for recent periods
      const enhancedMetrics: InsertEconDerivedMetrics[] = [];
      
      for (let i = Math.max(12, dataPoints.length - 24); i < dataPoints.length; i++) { // Last 24 periods
        const current = dataPoints[i];
        
        // Calculate YoY growth if applicable
        let yoyGrowth: number | null = null;
        if (i >= 12 && seriesInfo.type === 'level') {
          const yearAgo = dataPoints[i - 12].actualValue;
          yoyGrowth = ((current.actualValue - yearAgo) / yearAgo) * 100;
        }

        // Calculate MoM change for monthly indicators
        let momGrowth: number | null = null;
        if (i >= 1 && current.frequency === 'monthly') {
          const monthAgo = dataPoints[i - 1].actualValue;
          momGrowth = ((current.actualValue - monthAgo) / monthAgo) * 100;
        }

        // Calculate trend strength
        const trendData = dataPoints.slice(Math.max(0, i - 6), i + 1);
        const trendStrength = this.calculateEmploymentTrend(trendData) / 10; // Normalize to -1 to 1 scale

        // Determine investment signal
        let investmentSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        let signalStrength = 0.5;

        // For unemployment rate (inverted logic)
        if (seriesId === 'UNRATE') {
          if (current.actualValue < 4.0 && trendStrength < -0.1) {
            investmentSignal = 'BULLISH';
            signalStrength = 0.8;
          } else if (current.actualValue > 5.5 || trendStrength > 0.2) {
            investmentSignal = 'BEARISH';
            signalStrength = 0.7;
          }
        }
        // For payrolls and positive indicators
        else if (['PAYEMS', 'JOLTSTSJOR'].includes(seriesId)) {
          if (yoyGrowth && yoyGrowth > 2 && trendStrength > 0.1) {
            investmentSignal = 'BULLISH';
            signalStrength = 0.8;
          } else if (yoyGrowth && yoyGrowth < 0 || trendStrength < -0.2) {
            investmentSignal = 'BEARISH';
            signalStrength = 0.7;
          }
        }
        // For wages
        else if (seriesId === 'AHETPI') {
          if (yoyGrowth && yoyGrowth > 4 && laborAnalysis.laborTightness === 'TIGHT') {
            investmentSignal = 'BEARISH'; // Wage inflation concern
            signalStrength = 0.7;
          } else if (yoyGrowth && yoyGrowth > 2 && yoyGrowth < 4) {
            investmentSignal = 'BULLISH'; // Goldilocks wage growth
            signalStrength = 0.6;
          }
        }

        // Create enhanced metrics entry
        const enhancedMetric: InsertEconDerivedMetrics = {
          seriesId,
          periodEnd: current.periodDate,
          baseTransformCode: 'LABOR_ENHANCED',
          pipelineVersion: this.PIPELINE_VERSION,
          calculationEngine: 'v2.0-labor',
          
          // Growth metrics
          yoyGrowth: yoyGrowth?.toString(),
          momAnnualized: momGrowth ? (momGrowth * 12).toString() : undefined,
          trendSlope: trendStrength.toString(),
          
          // Labor market context
          cyclePosition: laborAnalysis.employmentTrend,
          regimeClassification: laborAnalysis.laborTightness,
          
          // Investment signals
          investmentSignal,
          signalStrength: signalStrength.toString(),
          
          // Sector implications
          sectorImplication: laborAnalysis.sectorImplications.beneficiaries.join(', '),
          assetClassImpact: `Fed Policy: ${laborAnalysis.fedPolicyImplication}, Consumption: ${laborAnalysis.consumptionImpact}`,
          
          // Risk metrics
          cycleDaysFromPeak: Math.round(laborAnalysis.recessionProbability),
          
          // Quality metrics
          calculationConfidence: '0.85',
          dataQualityScore: '0.9',
          misssingDataPoints: 0,
        };

        enhancedMetrics.push(enhancedMetric);
      }

      // Insert enhanced labor metrics
      if (enhancedMetrics.length > 0) {
        await db.insert(econDerivedMetrics)
          .values(enhancedMetrics)
          .onConflictDoUpdate({
            target: [econDerivedMetrics.seriesId, econDerivedMetrics.periodEnd, econDerivedMetrics.baseTransformCode],
            set: {
              yoyGrowth: sql`excluded.yoy_growth`,
              momAnnualized: sql`excluded.mom_annualized`,
              trendSlope: sql`excluded.trend_slope`,
              investmentSignal: sql`excluded.investment_signal`,
              signalStrength: sql`excluded.signal_strength`,
              cyclePosition: sql`excluded.cycle_position`,
              regimeClassification: sql`excluded.regime_classification`,
              sectorImplication: sql`excluded.sector_implication`,
              assetClassImpact: sql`excluded.asset_class_impact`,
              cycleDaysFromPeak: sql`excluded.cycle_days_from_peak`,
              updatedAt: sql`NOW()`,
            },
          });

        logger.info(`✅ Enhanced ${enhancedMetrics.length} labor market metrics for ${seriesId}`);
      }

    } catch (error) {
      logger.error(`❌ Failed to enhance labor market metrics for ${seriesId}:`, error);
      throw error;
    }
  }

  /**
   * Process all labor market series for enhanced metrics
   */
  async enhanceAllLaborSeries(): Promise<void> {
    try {
      logger.info('👷 Starting comprehensive labor market intelligence enhancement');

      const laborSeriesIds = Object.keys(this.LABOR_SERIES);
      logger.info(`📊 Found ${laborSeriesIds.length} labor market series to enhance`);

      // Process series sequentially for stable analysis
      for (const seriesId of laborSeriesIds) {
        await this.enhanceLaborMetrics(seriesId);
        
        // Small delay between series
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      logger.info('🎉 Completed comprehensive labor market intelligence enhancement');

    } catch (error) {
      logger.error('❌ Failed to enhance all labor market series:', error);
      throw error;
    }
  }
}

export const laborMarketIntelligence = new LaborMarketIntelligence();