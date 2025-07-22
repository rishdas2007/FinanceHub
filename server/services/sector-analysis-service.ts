import { db } from '../db';

interface SectorETF {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  fiveDayChange?: number;
  oneMonthChange?: number;
  volume?: number;
}

interface HistoricalData {
  symbol: string;
  date: string;
  price: number;
}

interface SectorAnalysis {
  cyclicalPatterns: CyclicalPattern[];
  rotationTiming: RotationSignal[];
  riskAdjustedReturns: RiskMetrics[];
  momentumStrategies: MomentumSignal[];
  correlationAnalysis: CorrelationData[];
  movingAverages: MovingAverageData[];
  technicalIndicators: TechnicalSignals[];
  summary: string;
  confidence: number;
  timestamp: string;
}

interface CyclicalPattern {
  sector: string;
  phase: 'early-cycle' | 'mid-cycle' | 'late-cycle' | 'defensive';
  strength: number;
  duration: number;
  confidence: number;
}

interface RotationSignal {
  fromSector: string;
  toSector: string;
  strength: 'weak' | 'moderate' | 'strong';
  timing: 'immediate' | 'short-term' | 'medium-term';
  rationale: string;
}

interface RiskMetrics {
  sector: string;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
  riskAdjustedReturn: number;
}

interface MomentumSignal {
  sector: string;
  momentum: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  timeframe: '20d' | '50d' | '200d';
  signal: string;
}

interface CorrelationData {
  sector: string;
  spyCorrelation: number;
  correlationTrend: 'increasing' | 'decreasing' | 'stable';
  diversificationValue: number;
}

interface MovingAverageData {
  sector: string;
  ma20: number;
  ma50: number;
  ma200?: number;
  ma20Signal: 'bullish' | 'bearish' | 'neutral';
  ma50Signal: 'bullish' | 'bearish' | 'neutral';
  crossoverSignal?: string;
}

interface TechnicalSignals {
  sector: string;
  rsi?: number;
  macd?: number;
  zScore: number;
  technicalRating: 'oversold' | 'neutral' | 'overbought';
  signals: string[];
}

export class SectorAnalysisService {
  
  /**
   * Generate comprehensive sector analysis with cyclical patterns, rotation timing,
   * risk-adjusted returns, momentum strategies, and correlation analysis
   */
  async generateComprehensiveAnalysis(
    currentSectorData: SectorETF[],
    historicalData: HistoricalData[]
  ): Promise<SectorAnalysis> {
    console.log(`📊 Analyzing ${currentSectorData.length} sectors with ${historicalData.length} historical data points`);
    
    try {
      // Calculate all analysis components in parallel
      const [
        cyclicalPatterns,
        rotationTiming,
        riskAdjustedReturns,
        momentumStrategies,
        correlationAnalysis,
        movingAverages,
        technicalIndicators
      ] = await Promise.all([
        this.analyzeCyclicalPatterns(currentSectorData, historicalData),
        this.analyzeRotationTiming(currentSectorData),
        this.calculateRiskAdjustedReturns(currentSectorData, historicalData),
        this.developMomentumStrategies(currentSectorData, historicalData),
        this.analyzeCorrelations(currentSectorData, historicalData),
        this.calculateMovingAverages(currentSectorData, historicalData),
        this.generateTechnicalIndicators(currentSectorData, historicalData)
      ]);

      const summary = this.generateAnalysisSummary(
        cyclicalPatterns,
        rotationTiming,
        riskAdjustedReturns,
        momentumStrategies
      );

      const confidence = this.calculateOverallConfidence(
        currentSectorData.length,
        historicalData.length
      );

      return {
        cyclicalPatterns,
        rotationTiming,
        riskAdjustedReturns,
        momentumStrategies,
        correlationAnalysis,
        movingAverages,
        technicalIndicators,
        summary,
        confidence,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error in comprehensive sector analysis:', error);
      throw new Error(`Sector analysis failed: ${error.message}`);
    }
  }

  /**
   * Identify cyclical patterns by analyzing sector performance during different economic phases
   */
  private async analyzeCyclicalPatterns(
    sectors: SectorETF[],
    historicalData: HistoricalData[]
  ): Promise<CyclicalPattern[]> {
    const patterns: CyclicalPattern[] = [];
    
    for (const sector of sectors) {
      const sectorHistory = historicalData.filter(h => h.symbol === sector.symbol);
      
      if (sectorHistory.length < 30) {
        continue; // Need sufficient data for cyclical analysis
      }

      // Calculate performance metrics for cyclical classification
      const recentPerformance = sector.changePercent || 0;
      const volatility = this.calculateVolatility(sectorHistory);
      
      // Determine cyclical phase based on sector characteristics
      let phase: CyclicalPattern['phase'];
      let strength: number;
      
      if (['XLF', 'XLI', 'XLY'].includes(sector.symbol)) {
        // Financial, Industrial, Consumer Discretionary - early/mid cycle
        phase = recentPerformance > 0 ? 'early-cycle' : 'mid-cycle';
        strength = Math.abs(recentPerformance) * 10;
      } else if (['XLK', 'XLC'].includes(sector.symbol)) {
        // Technology, Communication - growth/mid-cycle
        phase = volatility > 2 ? 'mid-cycle' : 'late-cycle';
        strength = Math.min(Math.abs(recentPerformance) * 8, 10);
      } else if (['XLP', 'XLU', 'XLRE'].includes(sector.symbol)) {
        // Consumer Staples, Utilities, Real Estate - defensive
        phase = 'defensive';
        strength = Math.max(5 - volatility, 1);
      } else {
        // Materials, Energy, Healthcare - varies by conditions
        phase = recentPerformance > 1 ? 'early-cycle' : 'late-cycle';
        strength = Math.abs(recentPerformance) * 6;
      }

      patterns.push({
        sector: sector.symbol,
        phase,
        strength: Math.min(Math.max(strength, 1), 10),
        duration: Math.floor(sectorHistory.length / 30), // Approximate months
        confidence: Math.min(sectorHistory.length / 100 * 100, 95)
      });
    }

    return patterns.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Time sector rotations using daily return data and technical indicators
   */
  private async analyzeRotationTiming(sectors: SectorETF[]): Promise<RotationSignal[]> {
    const signals: RotationSignal[] = [];
    
    // Sort sectors by performance
    const sortedSectors = [...sectors].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
    
    const winners = sortedSectors.slice(0, 3);
    const losers = sortedSectors.slice(-3);
    
    // Generate rotation signals from losers to winners
    for (let i = 0; i < Math.min(losers.length, winners.length); i++) {
      const loser = losers[i];
      const winner = winners[i];
      
      const performanceGap = (winner.changePercent || 0) - (loser.changePercent || 0);
      
      let strength: RotationSignal['strength'];
      if (performanceGap > 3) strength = 'strong';
      else if (performanceGap > 1.5) strength = 'moderate';
      else strength = 'weak';
      
      const timing: RotationSignal['timing'] = 
        strength === 'strong' ? 'immediate' :
        strength === 'moderate' ? 'short-term' : 'medium-term';

      signals.push({
        fromSector: loser.symbol,
        toSector: winner.symbol,
        strength,
        timing,
        rationale: `Performance divergence of ${performanceGap.toFixed(2)}% suggests rotation opportunity`
      });
    }

    return signals;
  }

  /**
   * Assess risk-adjusted returns through volatility analysis across sectors
   */
  private async calculateRiskAdjustedReturns(
    sectors: SectorETF[],
    historicalData: HistoricalData[]
  ): Promise<RiskMetrics[]> {
    const metrics: RiskMetrics[] = [];
    
    for (const sector of sectors) {
      const sectorHistory = historicalData.filter(h => h.symbol === sector.symbol);
      
      if (sectorHistory.length < 20) {
        continue; // Need sufficient data for risk calculation
      }

      const returns = this.calculateReturns(sectorHistory);
      const volatility = this.calculateVolatility(sectorHistory);
      const avgReturn = sector.changePercent || 0;
      
      // Calculate Sharpe ratio (simplified)
      const riskFreeRate = 0.05; // 5% annual risk-free rate
      const sharpeRatio = (avgReturn - riskFreeRate) / volatility;
      
      // Estimate beta relative to SPY (simplified)
      const spyData = historicalData.filter(h => h.symbol === 'SPY');
      const beta = this.calculateBeta(sectorHistory, spyData);
      
      // Calculate max drawdown
      const maxDrawdown = this.calculateMaxDrawdown(sectorHistory);
      
      metrics.push({
        sector: sector.symbol,
        volatility: Number(volatility.toFixed(2)),
        sharpeRatio: Number(sharpeRatio.toFixed(2)),
        maxDrawdown: Number(maxDrawdown.toFixed(2)),
        beta: Number(beta.toFixed(2)),
        riskAdjustedReturn: Number((avgReturn / volatility).toFixed(2))
      });
    }

    return metrics.sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn);
  }

  /**
   * Develop momentum strategies using moving averages and relative strength data
   */
  private async developMomentumStrategies(
    sectors: SectorETF[],
    historicalData: HistoricalData[]
  ): Promise<MomentumSignal[]> {
    const signals: MomentumSignal[] = [];
    
    for (const sector of sectors) {
      const sectorHistory = historicalData.filter(h => h.symbol === sector.symbol);
      
      if (sectorHistory.length < 50) {
        continue; // Need sufficient data for momentum analysis
      }

      const currentPrice = sector.price;
      const ma20 = this.calculateMovingAverage(sectorHistory, 20);
      const ma50 = this.calculateMovingAverage(sectorHistory, 50);
      
      let momentum: MomentumSignal['momentum'];
      let strength: number;
      let signal: string;
      
      if (currentPrice > ma20 && ma20 > ma50) {
        momentum = 'bullish';
        strength = ((currentPrice - ma20) / ma20) * 100;
        signal = 'Price above both 20-day and 50-day MAs - strong uptrend';
      } else if (currentPrice < ma20 && ma20 < ma50) {
        momentum = 'bearish';
        strength = ((ma20 - currentPrice) / ma20) * 100;
        signal = 'Price below both 20-day and 50-day MAs - strong downtrend';
      } else {
        momentum = 'neutral';
        strength = Math.abs((currentPrice - ma20) / ma20) * 100;
        signal = 'Mixed signals - consolidation phase';
      }

      signals.push({
        sector: sector.symbol,
        momentum,
        strength: Number(Math.min(strength, 10).toFixed(2)),
        timeframe: '20d',
        signal
      });
    }

    return signals;
  }

  /**
   * Create diversified allocations based on correlation analysis
   */
  private async analyzeCorrelations(
    sectors: SectorETF[],
    historicalData: HistoricalData[]
  ): Promise<CorrelationData[]> {
    const correlations: CorrelationData[] = [];
    
    const spyData = historicalData.filter(h => h.symbol === 'SPY');
    
    for (const sector of sectors) {
      if (sector.symbol === 'SPY') continue;
      
      const sectorHistory = historicalData.filter(h => h.symbol === sector.symbol);
      
      if (sectorHistory.length < 30 || spyData.length < 30) {
        continue;
      }

      const correlation = this.calculateCorrelation(sectorHistory, spyData);
      const diversificationValue = 1 - Math.abs(correlation);
      
      correlations.push({
        sector: sector.symbol,
        spyCorrelation: Number(correlation.toFixed(3)),
        correlationTrend: 'stable', // Simplified - would need time series analysis
        diversificationValue: Number(diversificationValue.toFixed(3))
      });
    }

    return correlations.sort((a, b) => b.diversificationValue - a.diversificationValue);
  }

  /**
   * Calculate 20-day and 50-day moving averages for each sector ETF
   */
  private async calculateMovingAverages(
    sectors: SectorETF[],
    historicalData: HistoricalData[]
  ): Promise<MovingAverageData[]> {
    const movingAverages: MovingAverageData[] = [];
    
    for (const sector of sectors) {
      const sectorHistory = historicalData.filter(h => h.symbol === sector.symbol);
      
      if (sectorHistory.length < 50) {
        continue;
      }

      const currentPrice = sector.price;
      const ma20 = this.calculateMovingAverage(sectorHistory, 20);
      const ma50 = this.calculateMovingAverage(sectorHistory, 50);
      
      const ma20Signal: MovingAverageData['ma20Signal'] = 
        currentPrice > ma20 ? 'bullish' : currentPrice < ma20 ? 'bearish' : 'neutral';
      
      const ma50Signal: MovingAverageData['ma50Signal'] = 
        currentPrice > ma50 ? 'bullish' : currentPrice < ma50 ? 'bearish' : 'neutral';
      
      let crossoverSignal: string | undefined;
      if (ma20 > ma50) {
        crossoverSignal = 'Golden Cross - 20-day MA above 50-day MA (bullish)';
      } else if (ma20 < ma50) {
        crossoverSignal = 'Death Cross - 20-day MA below 50-day MA (bearish)';
      }

      movingAverages.push({
        sector: sector.symbol,
        ma20: Number(ma20.toFixed(2)),
        ma50: Number(ma50.toFixed(2)),
        ma20Signal,
        ma50Signal,
        crossoverSignal
      });
    }

    return movingAverages;
  }

  /**
   * Generate technical indicators for timing analysis with z-scores
   */
  private async generateTechnicalIndicators(
    sectors: SectorETF[],
    historicalData: HistoricalData[]
  ): Promise<TechnicalSignals[]> {
    const technicalSignals: TechnicalSignals[] = [];
    
    for (const sector of sectors) {
      const sectorHistory = historicalData.filter(h => h.symbol === sector.symbol);
      
      if (sectorHistory.length < 30) {
        continue;
      }

      const prices = sectorHistory.map(h => h.price);
      const currentPrice = sector.price;
      
      // Calculate z-score relative to price history
      const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
      const stdDev = Math.sqrt(variance);
      const zScore = (currentPrice - mean) / stdDev;
      
      // Determine technical rating based on z-score
      let technicalRating: TechnicalSignals['technicalRating'];
      if (zScore < -1.5) technicalRating = 'oversold';
      else if (zScore > 1.5) technicalRating = 'overbought';
      else technicalRating = 'neutral';
      
      const signals: string[] = [];
      if (Math.abs(zScore) > 2) {
        signals.push(`Extreme ${zScore > 0 ? 'overbought' : 'oversold'} conditions (z-score: ${zScore.toFixed(2)})`);
      }
      if (zScore > 1) {
        signals.push('Price trading above historical average');
      } else if (zScore < -1) {
        signals.push('Price trading below historical average');
      }

      technicalSignals.push({
        sector: sector.symbol,
        zScore: Number(zScore.toFixed(2)),
        technicalRating,
        signals
      });
    }

    return technicalSignals;
  }

  /**
   * Helper methods for calculations
   */
  private calculateReturns(historicalData: HistoricalData[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < historicalData.length; i++) {
      const prev = historicalData[i - 1].price;
      const curr = historicalData[i].price;
      returns.push((curr - prev) / prev);
    }
    return returns;
  }

  private calculateVolatility(historicalData: HistoricalData[]): number {
    const returns = this.calculateReturns(historicalData);
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * 100; // Convert to percentage
  }

  private calculateMovingAverage(historicalData: HistoricalData[], period: number): number {
    if (historicalData.length < period) return 0;
    
    const recentPrices = historicalData.slice(0, period).map(h => h.price);
    return recentPrices.reduce((sum, price) => sum + price, 0) / period;
  }

  private calculateBeta(sectorData: HistoricalData[], spyData: HistoricalData[]): number {
    if (sectorData.length < 20 || spyData.length < 20) return 1;
    
    const sectorReturns = this.calculateReturns(sectorData);
    const spyReturns = this.calculateReturns(spyData);
    
    const minLength = Math.min(sectorReturns.length, spyReturns.length);
    const sectorSlice = sectorReturns.slice(0, minLength);
    const spySlice = spyReturns.slice(0, minLength);
    
    // Simple beta calculation
    const spyVariance = spySlice.reduce((sum, ret) => sum + ret * ret, 0) / minLength;
    const covariance = sectorSlice.reduce((sum, ret, i) => sum + ret * spySlice[i], 0) / minLength;
    
    return spyVariance !== 0 ? covariance / spyVariance : 1;
  }

  private calculateMaxDrawdown(historicalData: HistoricalData[]): number {
    let maxDrawdown = 0;
    let peak = historicalData[0]?.price || 0;
    
    for (const data of historicalData) {
      if (data.price > peak) {
        peak = data.price;
      }
      const drawdown = (peak - data.price) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown * 100; // Convert to percentage
  }

  private calculateCorrelation(data1: HistoricalData[], data2: HistoricalData[]): number {
    const returns1 = this.calculateReturns(data1);
    const returns2 = this.calculateReturns(data2);
    
    const minLength = Math.min(returns1.length, returns2.length);
    if (minLength < 10) return 0;
    
    const slice1 = returns1.slice(0, minLength);
    const slice2 = returns2.slice(0, minLength);
    
    const mean1 = slice1.reduce((sum, ret) => sum + ret, 0) / minLength;
    const mean2 = slice2.reduce((sum, ret) => sum + ret, 0) / minLength;
    
    let numerator = 0;
    let sumSquares1 = 0;
    let sumSquares2 = 0;
    
    for (let i = 0; i < minLength; i++) {
      const diff1 = slice1[i] - mean1;
      const diff2 = slice2[i] - mean2;
      numerator += diff1 * diff2;
      sumSquares1 += diff1 * diff1;
      sumSquares2 += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(sumSquares1 * sumSquares2);
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private generateAnalysisSummary(
    cyclicalPatterns: CyclicalPattern[],
    rotationTiming: RotationSignal[],
    riskAdjustedReturns: RiskMetrics[],
    momentumStrategies: MomentumSignal[]
  ): string {
    const strongCyclical = cyclicalPatterns.filter(p => p.strength > 7).length;
    const strongRotation = rotationTiming.filter(r => r.strength === 'strong').length;
    const positiveRisk = riskAdjustedReturns.filter(r => r.riskAdjustedReturn > 0.5).length;
    const bullishMomentum = momentumStrategies.filter(m => m.momentum === 'bullish').length;
    
    return `Comprehensive sector analysis reveals ${strongCyclical} sectors with strong cyclical patterns, ${strongRotation} strong rotation signals, ${positiveRisk} sectors with positive risk-adjusted returns, and ${bullishMomentum} sectors showing bullish momentum. Market conditions suggest ${strongRotation > 2 ? 'active' : 'moderate'} rotation opportunities with ${positiveRisk > 6 ? 'favorable' : 'mixed'} risk-reward profiles across sectors.`;
  }

  private calculateOverallConfidence(sectorCount: number, historicalCount: number): number {
    const dataQuality = Math.min((historicalCount / 1000) * 100, 90);
    const sectorCoverage = Math.min((sectorCount / 12) * 100, 100);
    return Math.round((dataQuality + sectorCoverage) / 2);
  }
}

export const sectorAnalysisService = new SectorAnalysisService();