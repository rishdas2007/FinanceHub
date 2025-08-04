// Interface for the economic indicator data structure used in the frontend
interface EconomicIndicatorWithScores {
  metric: string;
  zScore?: number;
  deltaZScore?: number;
  category: string;
  currentReading: string;
  priorReading: string;
  varianceVsPrior: string;
  frequency: string;
  period_date?: string;
  releaseDate?: string;
}

export interface EconomicInsightClassification {
  overallSignal: 'positive' | 'negative' | 'mixed' | 'neutral';
  levelSignal: 'positive' | 'negative' | 'neutral';
  trendSignal: 'positive' | 'negative' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  alertLevel: 'critical' | 'warning' | 'watch' | 'normal';
  displayColor: string;
  displayIcon: string;
}

export class EconomicInsightClassifier {
  
  classifyIndicator(indicator: EconomicIndicatorWithScores): EconomicInsightClassification {
    const zScore = indicator.zScore || 0;
    const deltaZScore = indicator.deltaZScore || 0;
    const metricName = indicator.metric.toLowerCase();

    // Get economic directionality
    const directionality = this.getDirectionality(metricName);

    // Classify level signal (current vs history)
    const levelSignal = this.classifyLevel(zScore, directionality);

    // Classify trend signal (recent changes)
    const trendSignal = this.classifyTrend(deltaZScore, directionality);

    // Determine overall signal with sophisticated logic
    const overallSignal = this.determineOverallSignal(
      levelSignal,
      trendSignal,
      zScore,
      deltaZScore,
      metricName
    );

    // Calculate confidence and reasoning
    const confidence = this.calculateConfidence(zScore, deltaZScore);
    const reasoning = this.generateReasoning(levelSignal, trendSignal, zScore, deltaZScore, metricName);

    return {
      overallSignal,
      levelSignal,
      trendSignal,
      confidence,
      reasoning,
      alertLevel: this.determineAlertLevel(overallSignal, zScore, deltaZScore),
      displayColor: this.getDisplayColor(overallSignal),
      displayIcon: this.getDisplayIcon(overallSignal, trendSignal)
    };
  }

  private getDirectionality(metricName: string): 'inverse' | 'direct' {
    // Inverse metrics: higher values are economically negative
    if (metricName.includes('unemployment') || 
        metricName.includes('inflation') || 
        metricName.includes('cpi') || 
        metricName.includes('pce') || 
        metricName.includes('ppi') ||
        metricName.includes('yield') ||
        metricName.includes('rate')) {
      return 'inverse';
    }
    return 'direct';
  }

  private classifyLevel(zScore: number, directionality: 'inverse' | 'direct'): 'positive' | 'negative' | 'neutral' {
    const threshold = 0.5;
    
    if (Math.abs(zScore) < threshold) return 'neutral';
    
    if (directionality === 'direct') {
      return zScore > 0 ? 'positive' : 'negative';
    } else {
      // For inverse metrics, positive z-scores mean economically positive (lower than historical avg)
      return zScore > 0 ? 'positive' : 'negative';
    }
  }

  private classifyTrend(deltaZScore: number, directionality: 'inverse' | 'direct'): 'positive' | 'negative' | 'neutral' {
    const threshold = 0.5;
    
    if (Math.abs(deltaZScore) < threshold) return 'neutral';
    
    if (directionality === 'direct') {
      return deltaZScore > 0 ? 'positive' : 'negative';
    } else {
      // For inverse metrics, positive delta z-scores mean worsening trend
      return deltaZScore > 0 ? 'negative' : 'positive';
    }
  }

  private determineOverallSignal(
    levelSignal: string,
    trendSignal: string,
    zScore: number,
    deltaZScore: number,
    metricName: string
  ): 'positive' | 'negative' | 'mixed' | 'neutral' {

    // Special handling for inflation
    if (metricName.includes('inflation') || metricName.includes('cpi') || metricName.includes('pce') || metricName.includes('ppi')) {
      return this.classifyInflation(levelSignal, trendSignal, zScore, deltaZScore);
    }

    // Special handling for unemployment
    if (metricName.includes('unemployment')) {
      return this.classifyUnemployment(levelSignal, trendSignal, zScore, deltaZScore);
    }

    // Special handling for interest rates
    if (metricName.includes('rate') || metricName.includes('yield')) {
      return this.classifyRates(levelSignal, trendSignal, zScore, deltaZScore);
    }

    // General classification logic
    return this.classifyGeneral(levelSignal, trendSignal, zScore, deltaZScore);
  }

  private classifyInflation(levelSignal: string, trendSignal: string, zScore: number, deltaZScore: number): 'positive' | 'negative' | 'mixed' | 'neutral' {
    const absZScore = Math.abs(zScore);
    const absDeltaZScore = Math.abs(deltaZScore);

    // Critical: Rapidly rising inflation (even if low level)
    if (deltaZScore > 1.5 && zScore > -1) {
      return 'negative'; // Rising trend overrides low level
    }

    // Positive: Low and stable/falling inflation
    if (zScore > 0.5 && deltaZScore <= 0.5) {
      return 'positive'; // Good level + stable/falling trend
    }

    // Mixed: Conflicting signals
    if ((levelSignal === 'positive' && trendSignal === 'negative') ||
        (levelSignal === 'negative' && trendSignal === 'positive')) {

      // Trend takes precedence for inflation if significant
      if (absDeltaZScore > absZScore && absDeltaZScore > 1.0) {
        return trendSignal === 'positive' ? 'positive' : 'negative';
      }

      return 'mixed';
    }

    // Default: Level-based for stable periods
    return levelSignal as any;
  }

  private classifyUnemployment(levelSignal: string, trendSignal: string, zScore: number, deltaZScore: number): 'positive' | 'negative' | 'mixed' | 'neutral' {
    // Low unemployment rising rapidly = concerning
    if (zScore > 1 && deltaZScore > 1.5) {
      return 'mixed'; // Good level but concerning trend
    }

    // High unemployment falling rapidly = positive trend
    if (zScore < -1 && deltaZScore < -1) {
      return 'mixed'; // Bad level but good trend
    }

    // Use standard logic for other cases
    return this.classifyGeneral(levelSignal, trendSignal, zScore, deltaZScore);
  }

  private classifyRates(levelSignal: string, trendSignal: string, zScore: number, deltaZScore: number): 'positive' | 'negative' | 'mixed' | 'neutral' {
    // Extreme rate movements are concerning regardless of direction
    if (Math.abs(zScore) > 2 || Math.abs(deltaZScore) > 2) {
      return 'negative';
    }

    // Moderate rates with stable trends are positive
    if (Math.abs(zScore) < 1 && Math.abs(deltaZScore) < 1) {
      return 'positive';
    }

    return this.classifyGeneral(levelSignal, trendSignal, zScore, deltaZScore);
  }

  private classifyGeneral(levelSignal: string, trendSignal: string, zScore: number, deltaZScore: number): 'positive' | 'negative' | 'mixed' | 'neutral' {
    // Both signals agree
    if (levelSignal === trendSignal) {
      return levelSignal as any;
    }

    // Conflicting signals - determine which is stronger
    const absZScore = Math.abs(zScore);
    const absDeltaZScore = Math.abs(deltaZScore);

    // If one signal is much stronger, use it
    if (absDeltaZScore > absZScore * 1.5 && absDeltaZScore > 1) {
      return trendSignal as any;
    }
    
    if (absZScore > absDeltaZScore * 1.5 && absZScore > 1) {
      return levelSignal as any;
    }

    // Otherwise it's mixed
    return 'mixed';
  }

  private calculateConfidence(zScore: number, deltaZScore: number): 'high' | 'medium' | 'low' {
    const absZScore = Math.abs(zScore);
    const absDeltaZScore = Math.abs(deltaZScore);
    const maxScore = Math.max(absZScore, absDeltaZScore);

    if (maxScore > 2) return 'high';
    if (maxScore > 1) return 'medium';
    return 'low';
  }

  private generateReasoning(levelSignal: string, trendSignal: string, zScore: number, deltaZScore: number, metricName: string): string {
    const absZScore = Math.abs(zScore);
    const absDeltaZScore = Math.abs(deltaZScore);
    
    let levelDescription = '';
    let trendDescription = '';

    // Level description
    if (absZScore > 2) {
      levelDescription = zScore > 0 ? 'well above historical average' : 'well below historical average';
    } else if (absZScore > 1) {
      levelDescription = zScore > 0 ? 'above historical average' : 'below historical average';
    } else {
      levelDescription = 'near historical average';
    }

    // Trend description
    if (absDeltaZScore > 2) {
      trendDescription = deltaZScore > 0 ? 'rising rapidly' : 'falling rapidly';
    } else if (absDeltaZScore > 1) {
      trendDescription = deltaZScore > 0 ? 'rising' : 'falling';
    } else {
      trendDescription = 'stable';
    }

    // Special reasoning for different metric types
    if (metricName.includes('inflation') || metricName.includes('cpi')) {
      if (levelSignal === 'positive' && trendSignal === 'negative') {
        return `Inflation ${levelDescription} but ${trendDescription} - monitor for acceleration`;
      } else if (levelSignal === 'negative' && trendSignal === 'positive') {
        return `Inflation ${levelDescription} and ${trendDescription} - concerning trend`;
      }
    }

    return `Level: ${levelDescription}, Trend: ${trendDescription}`;
  }

  private determineAlertLevel(overallSignal: string, zScore: number, deltaZScore: number): 'critical' | 'warning' | 'watch' | 'normal' {
    const absZScore = Math.abs(zScore);
    const absDeltaZScore = Math.abs(deltaZScore);
    const maxScore = Math.max(absZScore, absDeltaZScore);

    if (overallSignal === 'negative' && maxScore > 2) return 'critical';
    if (overallSignal === 'negative' && maxScore > 1.5) return 'warning';
    if (overallSignal === 'mixed' && maxScore > 1.5) return 'watch';
    return 'normal';
  }

  private getDisplayColor(overallSignal: string): string {
    switch (overallSignal) {
      case 'positive': return 'border-green-400';
      case 'negative': return 'border-red-400';
      case 'mixed': return 'border-yellow-400';
      default: return 'border-gray-400';
    }
  }

  private getDisplayIcon(overallSignal: string, trendSignal: string): string {
    if (overallSignal === 'mixed') {
      return trendSignal === 'positive' ? '↗️' : trendSignal === 'negative' ? '↘️' : '↔️';
    }

    switch (overallSignal) {
      case 'positive': return '✅';
      case 'negative': return '🔴';
      case 'mixed': return '⚠️';
      default: return '⚪';
    }
  }
}