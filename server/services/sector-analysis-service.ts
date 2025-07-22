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
      throw new Error(`Sector analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      console.log(`📊 Cyclical ${sector.symbol}: ${sectorHistory.length} historical records, ${sector.changePercent}% change`);
      
      // Analyze cyclical patterns using current sector performance and trends
      const dailyReturn = sector.changePercent || 0;
      const fiveDayReturn = sector.fiveDayChange || 0;
      const oneMonthReturn = sector.oneMonthChange || 0;

      // Determine market cycle phase based on performance patterns
      let phase: CyclicalPattern['phase'] = 'mid-cycle';
      let strength = Math.abs(dailyReturn) + Math.abs(fiveDayReturn) / 5;
      let duration = 30; // Estimated duration in days
      let confidence = 75; // Base confidence
      
      // Classify cycle phase based on performance characteristics
      if (oneMonthReturn > 10 && fiveDayReturn > 5) {
        phase = 'early-cycle';
        confidence = 85;
      } else if (oneMonthReturn < -5 || (dailyReturn < -1 && fiveDayReturn < -3)) {
        phase = 'late-cycle';
        confidence = 80;
      } else if (Math.abs(dailyReturn) < 0.5 && Math.abs(fiveDayReturn) < 2) {
        phase = 'defensive';
        confidence = 70;
      }
      
      // Only include sectors with significant cyclical patterns
      if (strength > 1.0) {
        patterns.push({
          sector: sector.symbol,
          phase,
          strength: parseFloat(Math.min(strength, 10).toFixed(2)),
          duration,
          confidence
        });
      }
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
    console.log(`📊 Risk Analysis: Processing ${sectors.length} sectors with ${historicalData.length} historical records`);
    
    for (const sector of sectors) {
      const sectorHistory = historicalData.filter(h => h.symbol === sector.symbol);
      console.log(`📊 Sector ${sector.symbol}: ${sectorHistory.length} historical records`);
      
      // Use current sector data even with limited historical data
      const avgReturn = sector.changePercent || 0;
      const fiveDayReturn = sector.fiveDayChange || 0;
      const monthReturn = sector.oneMonthChange || 0;
      
      // Calculate volatility estimate from available performance data
      const volatility = sectorHistory.length > 5 
        ? this.calculateVolatility(sectorHistory)
        : Math.abs(avgReturn) * 1.5; // Estimate based on daily return
      
      // Calculate Sharpe ratio (simplified)
      const riskFreeRate = 4.5; // 4.5% annual risk-free rate
      const annualizedReturn = monthReturn * 12;
      const sharpeRatio = volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0;
      
      // Estimate beta relative to SPY (simplified)
      const spyData = historicalData.filter(h => h.symbol === 'SPY');
      const beta = sectorHistory.length > 5 && spyData.length > 5
        ? this.calculateBeta(sectorHistory, spyData)
        : this.estimateBeta(sector.symbol);
      
      // Calculate max drawdown estimate
      const maxDrawdown = sectorHistory.length > 5 
        ? this.calculateMaxDrawdown(sectorHistory)
        : Math.abs(Math.min(avgReturn, fiveDayReturn, monthReturn));
      
      metrics.push({
        sector: sector.symbol,
        volatility: Number(Math.max(volatility, 0.1).toFixed(2)),
        sharpeRatio: Number(sharpeRatio.toFixed(2)),
        maxDrawdown: Number(maxDrawdown.toFixed(2)),
        beta: Number(beta.toFixed(2)),
        riskAdjustedReturn: Number((avgReturn / Math.max(volatility, 0.1)).toFixed(2))
      });
    }

    return metrics.sort((a, b) => b.sharpeRatio - a.sharpeRatio);
  }

  /**
   * Develop momentum strategies using moving averages and relative strength data
   */
  private async developMomentumStrategies(
    sectors: SectorETF[],
    historicalData: HistoricalData[]
  ): Promise<MomentumSignal[]> {
    const signals: MomentumSignal[] = [];
    console.log(`📊 Momentum Analysis: Processing ${sectors.length} sectors with ${historicalData.length} historical records`);
    
    for (const sector of sectors) {
      const sectorHistory = historicalData.filter(h => h.symbol === sector.symbol);
      console.log(`📊 Momentum ${sector.symbol}: ${sectorHistory.length} historical records, price: ${sector.price}`);
      const currentPrice = sector.price;
      
      // Calculate or estimate moving averages
      const ma20 = sectorHistory.length >= 20 
        ? this.calculateMovingAverage(sectorHistory, 20)
        : currentPrice * (1 - (sector.fiveDayChange || 0) / 100 * 4); // Estimate
      
      const ma50 = sectorHistory.length >= 50 
        ? this.calculateMovingAverage(sectorHistory, 50)
        : currentPrice * (1 - (sector.oneMonthChange || 0) / 100 * 1.6); // Estimate
      
      let momentum: MomentumSignal['momentum'];
      let strength: number;
      let signal: string;
      
      const dailyReturn = sector.changePercent || 0;
      const fiveDayReturn = sector.fiveDayChange || 0;
      
      if (currentPrice > ma20 && ma20 > ma50 && dailyReturn > 0) {
        momentum = 'bullish';
        strength = Math.abs(dailyReturn) + Math.abs(fiveDayReturn) / 5;
        signal = 'Price above both 20-day and 50-day MAs - strong uptrend';
      } else if (currentPrice < ma20 && ma20 < ma50 && dailyReturn < 0) {
        momentum = 'bearish';
        strength = Math.abs(dailyReturn) + Math.abs(fiveDayReturn) / 5;
        signal = 'Price below both 20-day and 50-day MAs - strong downtrend';
      } else {
        momentum = 'neutral';
        strength = Math.abs(dailyReturn);
        signal = 'Mixed signals - consolidation phase';
      }

      signals.push({
        sector: sector.symbol,
        momentum,
        strength: Number(Math.min(Math.max(strength, 0.1), 10).toFixed(2)),
        timeframe: '20d',
        signal
      });
    }

    return signals.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Create diversified allocations based on correlation analysis
   */
  private async analyzeCorrelations(
    sectors: SectorETF[],
    historicalData: HistoricalData[]
  ): Promise<CorrelationData[]> {
    const correlations: CorrelationData[] = [];
    console.log(`📊 Correlation Analysis: Processing ${sectors.length} sectors with ${historicalData.length} historical records`);
    
    const spyData = historicalData.filter(h => h.symbol === 'SPY');
    
    for (const sector of sectors) {
      if (sector.symbol === 'SPY') continue;
      
      // Calculate correlation even with limited historical data
      const spyReturn = (sectors.find(s => s.symbol === 'SPY')?.changePercent || 0);
      const sectorReturn = sector.changePercent || 0;
      
      // Estimate correlation based on recent performance relative to SPY
      let correlation = 0.5; // Default moderate correlation
      if (spyReturn !== 0) {
        correlation = Math.min(Math.max(sectorReturn / spyReturn * 0.8, -1), 1);
      }
      
      const diversificationValue = 1 - Math.abs(correlation);
      
      correlations.push({
        sector: sector.symbol,
        spyCorrelation: parseFloat(correlation.toFixed(3)),
        correlationTrend: 'stable',
        diversificationValue: parseFloat(diversificationValue.toFixed(3))
      });
      
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
    console.log(`📊 Moving Averages: Processing ${sectors.length} sectors with ${historicalData.length} historical records`);
    
    for (const sector of sectors) {
      const sectorHistory = historicalData.filter(h => h.symbol === sector.symbol);
      const currentPrice = sector.price;
      
      // Calculate or estimate moving averages
      const ma20 = sectorHistory.length >= 20 
        ? this.calculateMovingAverage(sectorHistory, 20)
        : currentPrice * (1 - (sector.fiveDayChange || 0) / 100 * 4); // Estimate
      
      const ma50 = sectorHistory.length >= 50 
        ? this.calculateMovingAverage(sectorHistory, 50)
        : currentPrice * (1 - (sector.oneMonthChange || 0) / 100 * 1.6); // Estimate

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
    console.log(`📊 Technical Indicators: Processing ${sectors.length} sectors with ${historicalData.length} historical records`);
    
    for (const sector of sectors) {
      const sectorHistory = historicalData.filter(h => h.symbol === sector.symbol);
      
      // Calculate z-score and technical ratings using current performance
      const dailyReturn = sector.changePercent || 0;
      const fiveDayReturn = sector.fiveDayChange || 0;
      const oneMonthReturn = sector.oneMonthChange || 0;
      
      // Estimate z-score based on recent performance (simplified)
      const avgReturn = (dailyReturn + fiveDayReturn / 5 + oneMonthReturn / 22) / 3;
      const volatility = Math.abs(dailyReturn) * 1.5; // Volatility estimate
      const zScore = volatility > 0 ? avgReturn / volatility : 0;
      
      // Determine technical rating
      let technicalRating: 'overbought' | 'oversold' | 'neutral' = 'neutral';
      if (zScore > 1.5) technicalRating = 'overbought';
      else if (zScore < -1.5) technicalRating = 'oversold';
      
      // Generate signals based on performance
      const signals: string[] = [];
      if (dailyReturn > 1) signals.push('Strong daily momentum');
      if (fiveDayReturn > 3) signals.push('5-day uptrend confirmed');
      if (oneMonthReturn > 5) signals.push('Monthly breakout pattern');
      if (Math.abs(zScore) > 2) signals.push(`Extreme ${zScore > 0 ? 'overbought' : 'oversold'} condition`);
      
      if (signals.length === 0) {
        signals.push('Consolidation pattern - watching for breakout');
      }
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

  /**
   * Helper method to estimate beta for sectors without historical data
   */
  private estimateBeta(symbol: string): number {
    const betaEstimates: { [key: string]: number } = {
      'SPY': 1.0,  // Market beta
      'XLK': 1.3,  // Technology - high beta
      'XLV': 0.8,  // Healthcare - lower beta
      'XLF': 1.2,  // Financials - higher beta
      'XLY': 1.1,  // Consumer Discretionary - moderate high beta
      'XLI': 1.0,  // Industrials - market beta
      'XLC': 1.0,  // Communication - market beta
      'XLP': 0.6,  // Consumer Staples - low beta
      'XLE': 1.4,  // Energy - high beta
      'XLU': 0.7,  // Utilities - low beta
      'XLB': 1.2,  // Materials - higher beta
      'XLRE': 0.9  // Real Estate - moderate beta
    };
    return betaEstimates[symbol] || 1.0;
  }

  /**
   * Helper method to get readable sector name from symbol
   */
  private getSectorName(symbol: string): string {
    const sectorNames: { [key: string]: string } = {
      'SPY': 'S&P 500',
      'XLK': 'Technology',
      'XLV': 'Healthcare',
      'XLF': 'Financials',
      'XLY': 'Consumer Discretionary',
      'XLI': 'Industrials',
      'XLC': 'Communication Services',
      'XLP': 'Consumer Staples',
      'XLE': 'Energy',
      'XLU': 'Utilities',
      'XLB': 'Materials',
      'XLRE': 'Real Estate'
    };
    return sectorNames[symbol] || symbol;
  }
}

export const sectorAnalysisService = new SectorAnalysisService();