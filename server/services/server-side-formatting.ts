import { logger } from '../utils/logger';

/**
 * WEEK 2: SERVER-SIDE FORMATTING SERVICE
 * Pre-format data on server to reduce client-side processing
 */

export interface FormattedMarketData {
  symbol: string;
  price: string; // Pre-formatted: "$423.45"
  change: string; // Pre-formatted: "+$2.15"
  changePercent: string; // Pre-formatted: "+0.51%"
  volume: string; // Pre-formatted: "2.4M"
  marketCap: string; // Pre-formatted: "$1.2B"
  timestamp: string; // Pre-formatted: "9:45 AM EST"
  trend: 'up' | 'down' | 'neutral';
  color: string; // CSS class: "text-green-400"
}

export interface FormattedEconomicIndicator {
  metric: string;
  current: string; // Pre-formatted with units
  prior: string; // Pre-formatted with units  
  variance: string; // Pre-formatted: "+0.2% vs prior"
  zScore: string; // Pre-formatted: "1.2σ"
  impact: string; // Pre-formatted: "Bullish"
  color: string; // CSS class
  confidence: number;
  lastUpdated: string; // Pre-formatted timestamp
}

export interface FormattedTechnicalIndicator {
  symbol: string;
  rsi: string; // Pre-formatted: "68.2 (Overbought)"
  macd: string; // Pre-formatted: "8.1 (↑ Bullish)"
  sma20: string; // Pre-formatted: "$420.15"
  bollinger: string; // Pre-formatted: "Mid-band (Neutral)"
  signal: string; // Pre-formatted: "🟢 BUY"
  signalColor: string; // CSS class
  strength: number; // 0-100
}

export class ServerSideFormattingService {

  /**
   * Format market data with proper currency, percentages, and indicators
   */
  formatMarketData(rawData: any): FormattedMarketData {
    const price = parseFloat(rawData.price || '0');
    const change = parseFloat(rawData.change || '0');
    const changePercent = parseFloat(rawData.changePercent || '0');
    const volume = parseInt(rawData.volume || '0');

    // Determine trend and color
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    let color = 'text-gray-400';
    
    if (change > 0) {
      trend = 'up';
      color = 'text-green-400';
    } else if (change < 0) {
      trend = 'down';
      color = 'text-red-400';
    }

    return {
      symbol: rawData.symbol || 'N/A',
      price: this.formatCurrency(price),
      change: this.formatChange(change),
      changePercent: this.formatPercentage(changePercent, true),
      volume: this.formatVolume(volume),
      marketCap: this.formatMarketCap(rawData.marketCap),
      timestamp: this.formatTimestamp(rawData.timestamp),
      trend,
      color
    };
  }

  /**
   * Format economic indicators with proper units and signals
   */
  formatEconomicIndicator(rawData: any): FormattedEconomicIndicator {
    const current = parseFloat(rawData.currentReading || '0');
    const prior = parseFloat(rawData.priorReading || '0');
    const zScore = parseFloat(rawData.zScore || '0');
    const variance = current - prior;

    // Determine impact and color based on z-score
    let impact = 'Neutral';
    let color = 'text-gray-400';
    let confidence = 50;

    if (Math.abs(zScore) >= 2.0) {
      confidence = 95;
      impact = zScore > 0 ? 'Strongly Bullish' : 'Strongly Bearish';
      color = zScore > 0 ? 'text-green-500' : 'text-red-500';
    } else if (Math.abs(zScore) >= 1.0) {
      confidence = 75;
      impact = zScore > 0 ? 'Bullish' : 'Bearish';
      color = zScore > 0 ? 'text-green-400' : 'text-red-400';
    } else if (Math.abs(zScore) >= 0.5) {
      confidence = 60;
      impact = zScore > 0 ? 'Slightly Bullish' : 'Slightly Bearish';
      color = zScore > 0 ? 'text-green-300' : 'text-red-300';
    }

    return {
      metric: rawData.metric || 'Unknown',
      current: this.formatEconomicValue(current, rawData.unit),
      prior: this.formatEconomicValue(prior, rawData.unit),
      variance: this.formatVariance(variance, rawData.unit),
      zScore: this.formatZScore(zScore),
      impact,
      color,
      confidence,
      lastUpdated: this.formatTimestamp(rawData.releaseDate)
    };
  }

  /**
   * Format technical indicators with signals and interpretations
   */
  formatTechnicalIndicator(rawData: any): FormattedTechnicalIndicator {
    const rsi = parseFloat(rawData.rsi || '50');
    const macd = parseFloat(rawData.macd || '0');
    const macdSignal = parseFloat(rawData.macdSignal || '0');
    const sma20 = parseFloat(rawData.sma20 || '0');

    // RSI interpretation
    let rsiInterpretation = 'Neutral';
    if (rsi > 70) rsiInterpretation = 'Overbought';
    else if (rsi < 30) rsiInterpretation = 'Oversold';
    else if (rsi > 60) rsiInterpretation = 'Strong';
    else if (rsi < 40) rsiInterpretation = 'Weak';

    // MACD interpretation
    const macdDiff = macd - macdSignal;
    let macdInterpretation = 'Neutral';
    let macdTrend = '';
    
    if (macdDiff > 0.5) {
      macdInterpretation = 'Bullish';
      macdTrend = '↑';
    } else if (macdDiff < -0.5) {
      macdInterpretation = 'Bearish';
      macdTrend = '↓';
    }

    // Overall signal calculation
    let signal = '🟡 HOLD';
    let signalColor = 'text-yellow-400';
    let strength = 50;

    // Combine signals for overall assessment
    const bullishSignals = [
      rsi > 50 && rsi < 70, // Healthy momentum
      macdDiff > 0, // MACD bullish
      rawData.price > sma20 // Above SMA20
    ].filter(Boolean).length;

    const bearishSignals = [
      rsi < 50 && rsi > 30, // Weak but not oversold
      macdDiff < 0, // MACD bearish
      rawData.price < sma20 // Below SMA20
    ].filter(Boolean).length;

    if (bullishSignals >= 2) {
      signal = '🟢 BUY';
      signalColor = 'text-green-400';
      strength = 60 + (bullishSignals * 10);
    } else if (bearishSignals >= 2) {
      signal = '🔴 SELL';
      signalColor = 'text-red-400';
      strength = 40 - (bearishSignals * 10);
    }

    // Extreme conditions override
    if (rsi > 80) {
      signal = '⚠️ OVERBOUGHT';
      signalColor = 'text-orange-400';
    } else if (rsi < 20) {
      signal = '💰 OVERSOLD';
      signalColor = 'text-blue-400';
    }

    return {
      symbol: rawData.symbol || 'N/A',
      rsi: `${rsi.toFixed(1)} (${rsiInterpretation})`,
      macd: `${macd.toFixed(2)} (${macdTrend} ${macdInterpretation})`,
      sma20: this.formatCurrency(sma20),
      bollinger: this.formatBollingerPosition(rawData.bollingerPercent || 0.5),
      signal,
      signalColor,
      strength: Math.max(0, Math.min(100, strength))
    };
  }

  // Utility formatting methods
  private formatCurrency(value: number): string {
    if (isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  private formatChange(value: number): string {
    if (isNaN(value)) return 'N/A';
    const sign = value >= 0 ? '+' : ';
    return `${sign}${this.formatCurrency(value)}`;
  }

  private formatPercentage(value: number, includeSign: boolean = false): string {
    if (isNaN(value)) return 'N/A';
    const sign = includeSign && value >= 0 ? '+' : ';
    return `${sign}${value.toFixed(2)}%`;
  }

  private formatVolume(volume: number): string {
    if (isNaN(volume) || volume === 0) return 'N/A';
    
    if (volume >= 1000000000) {
      return `${(volume / 1000000000).toFixed(1)}B`;
    } else if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  }

  private formatMarketCap(marketCap: any): string {
    if (!marketCap) return 'N/A';
    const value = parseFloat(marketCap);
    if (isNaN(value)) return marketCap.toString();
    
    if (value >= 1000000000000) {
      return `$${(value / 1000000000000).toFixed(1)}T`;
    } else if (value >= 1000000000) {
      return `$${(value / 1000000000).toFixed(1)}B`;
    } else if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return this.formatCurrency(value);
  }

  private formatTimestamp(timestamp: any): string {
    if (!timestamp) return 'N/A';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
        hour12: true
      });
    } catch (error) {
      return 'N/A';
    }
  }

  private formatEconomicValue(value: number, unit?: string): string {
    if (isNaN(value)) return 'N/A';
    
    if (!unit || unit === 'N/A') {
      return value.toFixed(2);
    }

    switch (unit.toLowerCase()) {
      case '%':
        return `${value.toFixed(1)}%`;
      case 'k':
        return `${value.toFixed(0)}K`;
      case 'm':
        return `${value.toFixed(1)}M`;
      case 'b':
        return `${value.toFixed(1)}B`;
      case 'index':
        return value.toFixed(1);
      default:
        return `${value.toFixed(2)} ${unit}`;
    }
  }

  private formatVariance(variance: number, unit?: string): string {
    if (isNaN(variance)) return 'N/A';
    
    const sign = variance >= 0 ? '+' : ';
    const formattedValue = this.formatEconomicValue(Math.abs(variance), unit);
    
    return `${sign}${formattedValue} vs prior`;
  }

  private formatZScore(zScore: number): string {
    if (isNaN(zScore)) return 'N/A';
    
    const sign = zScore >= 0 ? '+' : ';
    return `${sign}${zScore.toFixed(1)}σ`;
  }

  private formatBollingerPosition(percent: number): string {
    if (percent >= 0.8) return 'Upper Band (Overbought)';
    if (percent <= 0.2) return 'Lower Band (Oversold)';
    if (percent >= 0.4 && percent <= 0.6) return 'Mid-band (Neutral)';
    if (percent > 0.6) return 'Above Mid-band (Bullish)';
    return 'Below Mid-band (Bearish)';
  }

  /**
   * Batch format multiple data types efficiently
   */
  batchFormat(data: {
    market?: any[];
    economic?: any[];
    technical?: any[];
  }): {
    market: FormattedMarketData[];
    economic: FormattedEconomicIndicator[];
    technical: FormattedTechnicalIndicator[];
  } {
    const startTime = Date.now();

    const result = {
      market: data.market?.map(item => this.formatMarketData(item)) || [],
      economic: data.economic?.map(item => this.formatEconomicIndicator(item)) || [],
      technical: data.technical?.map(item => this.formatTechnicalIndicator(item)) || []
    };

    const processingTime = Date.now() - startTime;
    logger.debug(`Batch formatting completed in ${processingTime}ms`);

    return result;
  }
}

export const serverSideFormattingService = new ServerSideFormattingService();