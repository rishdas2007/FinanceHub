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
  priceVsMa20: number;
  priceVsMa50: number;
  signal: 'bullish' | 'bearish' | 'neutral';
}

interface TechnicalSignals {
  sector: string;
  zScore: number;
  technicalRating: 'overbought' | 'oversold' | 'neutral';
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

      console.log(`📊 Analysis counts: Cyclical: ${cyclicalPatterns.length}, Rotation: ${rotationTiming.length}, Risk: ${riskAdjustedReturns.length}, Momentum: ${momentumStrategies.length}`);

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
    console.log(`📊 Cyclical Analysis: Processing ${sectors.length} sectors with ${historicalData.length} historical records`);
    
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

    console.log(`📊 Cyclical Analysis generated ${patterns.length} patterns`);
    return patterns;
  }

  /**
   * Time sector rotations using daily return data and technical indicators
   */
  private async analyzeRotationTiming(
    sectors: SectorETF[]
  ): Promise<RotationSignal[]> {
    const signals: RotationSignal[] = [];
    
    // Sort by performance for rotation analysis
    const sortedSectors = sectors.sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
    
    for (let i = 0; i < sortedSectors.length - 1; i++) {
      const fromSector = sortedSectors[sortedSectors.length - 1 - i];
      const toSector = sortedSectors[i];
      
      const performanceDiff = Math.abs((toSector.changePercent || 0) - (fromSector.changePercent || 0));
      
      if (performanceDiff > 1.0) {
        let strength: RotationSignal['strength'] = 'weak';
        let timing: RotationSignal['timing'] = 'medium-term';
        
        if (performanceDiff > 2.0) {
          strength = 'strong';
          timing = 'immediate';
        } else if (performanceDiff > 1.5) {
          strength = 'moderate';
          timing = 'short-term';
        }
        
        signals.push({
          fromSector: fromSector.symbol,
          toSector: toSector.symbol,
          strength,
          timing,
          rationale: `Performance divergence of ${performanceDiff.toFixed(2)}% suggests rotation opportunity`
        });
      }
    }
    
    return signals.slice(0, 5); // Top 5 rotation signals
  }

  /**
   * Calculate Sharpe ratios, volatility, and risk-adjusted returns for each sector
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

      // Calculate volatility from available performance data
      const returns = [avgReturn, fiveDayReturn / 5, monthReturn / 22];
      const avgReturnValue = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturnValue, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized

      // Calculate other risk metrics
      const sharpeRatio = volatility > 0 ? (avgReturnValue * 252) / volatility : 0;
      const maxDrawdown = Math.max(...returns.map(r => Math.abs(Math.min(r, 0)))) / 100;
      const beta = this.calculateBeta(sector, sectors.find(s => s.symbol === 'SPY'));
      const riskAdjustedReturn = avgReturnValue / 100;

      metrics.push({
        sector: sector.symbol,
        volatility: parseFloat(volatility.toFixed(2)),
        sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
        beta: parseFloat(beta.toFixed(1)),
        riskAdjustedReturn: parseFloat(riskAdjustedReturn.toFixed(2))
      });
    }

    console.log(`📊 Risk Analysis generated ${metrics.length} risk metrics`);
    return metrics.sort((a, b) => b.sharpeRatio - a.sharpeRatio);
  }

  /**
   * Develop momentum-based trading strategies using moving averages and price trends
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

      // Calculate momentum signals based on available data
      const dailyReturn = sector.changePercent || 0;
      const fiveDayReturn = sector.fiveDayChange || 0;
      
      // Estimate moving averages
      const ma20 = sectorHistory.length >= 20 
        ? this.calculateSimpleMA(sectorHistory.slice(0, 20))
        : currentPrice * (1 - fiveDayReturn / 100 * 4);
      
      const ma50 = sectorHistory.length >= 50 
        ? this.calculateSimpleMA(sectorHistory.slice(0, 50))
        : currentPrice * (1 - (sector.oneMonthChange || 0) / 100 * 1.6);

      // Determine momentum
      let momentum: MomentumSignal['momentum'] = 'neutral';
      let signal = 'Mixed signals - consolidation phase';
      
      if (currentPrice > ma20 && currentPrice > ma50 && dailyReturn > 0) {
        momentum = 'bullish';
        signal = 'Price above both 20-day and 50-day MAs - strong uptrend';
      } else if (currentPrice < ma20 && currentPrice < ma50 && dailyReturn < 0) {
        momentum = 'bearish';
        signal = 'Price below both MAs - downtrend confirmed';
      }

      const strength = Math.abs(dailyReturn) + Math.abs(fiveDayReturn) / 5;

      signals.push({
        sector: sector.symbol,
        momentum,
        strength: parseFloat(strength.toFixed(2)),
        timeframe: '20d',
        signal
      });
    }

    console.log(`📊 Momentum Analysis generated ${signals.length} signals`);
    return signals.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Analyze correlations between sectors and SPY for diversification insights
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
    }

    console.log(`📊 Correlation Analysis generated ${correlations.length} correlations`);
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
        ? this.calculateSimpleMA(sectorHistory.slice(0, 20))
        : currentPrice * (1 - (sector.fiveDayChange || 0) / 100 * 4); // Estimate
      
      const ma50 = sectorHistory.length >= 50 
        ? this.calculateSimpleMA(sectorHistory.slice(0, 50))
        : currentPrice * (1 - (sector.oneMonthChange || 0) / 100 * 1.6); // Estimate

      // Calculate price vs MA percentages
      const priceVsMa20 = ((currentPrice - ma20) / ma20) * 100;
      const priceVsMa50 = ((currentPrice - ma50) / ma50) * 100;
      
      // Determine signal
      let signal: MovingAverageData['signal'] = 'neutral';
      if (priceVsMa20 > 2 && priceVsMa50 > 2) {
        signal = 'bullish';
      } else if (priceVsMa20 < -2 && priceVsMa50 < -2) {
        signal = 'bearish';
      }

      movingAverages.push({
        sector: sector.symbol,
        ma20: parseFloat(ma20.toFixed(2)),
        ma50: parseFloat(ma50.toFixed(2)),
        priceVsMa20: parseFloat(priceVsMa20.toFixed(2)),
        priceVsMa50: parseFloat(priceVsMa50.toFixed(2)),
        signal
      });
    }

    console.log(`📊 Moving Averages generated ${movingAverages.length} calculations`);
    return movingAverages;
  }

  /**
   * Generate technical indicators including z-scores and technical ratings
   */
  private async generateTechnicalIndicators(
    sectors: SectorETF[],
    historicalData: HistoricalData[]
  ): Promise<TechnicalSignals[]> {
    const technicalSignals: TechnicalSignals[] = [];
    console.log(`📊 Technical Indicators: Processing ${sectors.length} sectors with ${historicalData.length} historical records`);
    
    for (const sector of sectors) {
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
      const signalArray: string[] = [];
      if (dailyReturn > 1) signalArray.push('Strong daily momentum');
      if (fiveDayReturn > 3) signalArray.push('5-day uptrend confirmed');
      if (oneMonthReturn > 5) signalArray.push('Monthly breakout pattern');
      if (Math.abs(zScore) > 2) signalArray.push(`Extreme ${zScore > 0 ? 'overbought' : 'oversold'} condition`);
      
      if (signalArray.length === 0) {
        signalArray.push('Consolidation pattern - watching for breakout');
      }

      technicalSignals.push({
        sector: sector.symbol,
        zScore: parseFloat(zScore.toFixed(2)),
        technicalRating,
        signals: signalArray
      });
    }

    console.log(`📊 Technical Indicators generated ${technicalSignals.length} signals`);
    return technicalSignals;
  }

  // Helper methods
  private calculateBeta(sector: SectorETF, spy: SectorETF | undefined): number {
    if (!spy) return 1.0;
    
    const sectorReturn = sector.changePercent || 0;
    const spyReturn = spy.changePercent || 0;
    
    // Simplified beta calculation
    if (spyReturn === 0) return 1.0;
    return Math.max(0.1, Math.min(2.0, sectorReturn / spyReturn));
  }

  private calculateSimpleMA(data: HistoricalData[]): number {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, d) => acc + d.price, 0);
    return sum / data.length;
  }

  private generateAnalysisSummary(
    cyclicalPatterns: CyclicalPattern[],
    rotationTiming: RotationSignal[],
    riskAdjustedReturns: RiskMetrics[],
    momentumStrategies: MomentumSignal[]
  ): string {
    const strongCyclical = cyclicalPatterns.filter(p => p.strength > 7).length;
    const strongRotation = rotationTiming.filter(r => r.strength === 'strong').length;
    const positiveReturns = riskAdjustedReturns.filter(r => r.riskAdjustedReturn > 0).length;
    const bullishMomentum = momentumStrategies.filter(m => m.momentum === 'bullish').length;

    return `Comprehensive sector analysis reveals ${strongCyclical} sectors with strong cyclical patterns, ${strongRotation} strong rotation signals, ${positiveReturns} sectors with positive risk-adjusted returns, and ${bullishMomentum} sectors showing bullish momentum. Market conditions suggest moderate rotation opportunities with favorable risk-reward profiles across sectors.`;
  }

  private calculateOverallConfidence(sectorCount: number, historicalDataCount: number): number {
    let confidence = 50; // Base confidence
    
    if (sectorCount >= 10) confidence += 20;
    if (historicalDataCount >= 100) confidence += 20;
    else if (historicalDataCount >= 50) confidence += 10;
    
    return Math.min(confidence, 95);
  }
}

export const sectorAnalysisService = new SectorAnalysisService();