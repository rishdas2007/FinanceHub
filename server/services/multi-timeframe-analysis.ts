import { inject, injectable } from "inversify";
import { DatabaseService } from "./database-service";
import { CacheService } from "./cache-service";
import { Logger } from "./logger-service";
import type { 
  MultiTimeframeAnalysis, 
  ConvergenceSignal, 
  Timeframe, 
  BollingerSqueezeEvent,
  TechnicalIndicatorMultiTimeframe,
  SignalQualityScore,
  ConvergenceAnalysisResponse
} from "../../shared/convergence-types";

@injectable()
export class MultiTimeframeAnalysisService {
  constructor(
    @inject("DatabaseService") private db: DatabaseService,
    @inject("CacheService") private cache: CacheService,
    @inject("Logger") private logger: Logger
  ) {}

  async analyzeSymbol(symbol: string): Promise<MultiTimeframeAnalysis> {
    try {
      const cacheKey = `multi-timeframe-${symbol}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as MultiTimeframeAnalysis;
      }

      // First, generate fresh convergence signals from current market data
      await this.generateConvergenceSignals(symbol);

      // Get current convergence signals
      const convergenceSignals = await this.getActiveConvergenceSignals(symbol);
      
      // Get current squeeze status
      const bollingerSqueezeStatus = await this.getBollingerSqueezeStatus(symbol);
      
      // Calculate signal summary
      const signalSummary = this.calculateSignalSummary(convergenceSignals);
      
      // Determine overall bias and confidence
      const { overallBias, confidenceScore } = this.calculateOverallBias(convergenceSignals);

      const analysis: MultiTimeframeAnalysis = {
        symbol,
        timestamp: new Date(),
        convergence_signals: convergenceSignals,
        signal_summary: signalSummary,
        bollinger_squeeze_status: bollingerSqueezeStatus,
        overall_bias: overallBias,
        confidence_score: confidenceScore
      };

      // Cache for 5 minutes
      await this.cache.set(cacheKey, analysis, 300);
      
      return analysis;
    } catch (error) {
      this.logger.error(`Multi-timeframe analysis failed for ${symbol}:`, error);
      throw error;
    }
  }

  async getFullConvergenceAnalysis(symbols: string[] = ['SPY', 'QQQ', 'IWM']): Promise<ConvergenceAnalysisResponse> {
    try {
      const cacheKey = 'full-convergence-analysis';
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as ConvergenceAnalysisResponse;
      }

      // Analyze each symbol
      const analyses = await Promise.all(
        symbols.map(symbol => this.analyzeSymbol(symbol))
      );

      // Get signal quality overview
      const signalQualityOverview = await this.getSignalQualityOverview();
      
      // Get active alerts across all symbols
      const activeAlerts = await this.getAllActiveAlerts();
      
      // Get squeeze monitoring data
      const squeezeMonitoring = await this.getSqueezeMonitoring();

      const response: ConvergenceAnalysisResponse = {
        analysis: analyses,
        signal_quality_overview: signalQualityOverview,
        active_alerts: activeAlerts,
        squeeze_monitoring: squeezeMonitoring
      };

      // Cache for 2 minutes
      await this.cache.set(cacheKey, response, 120);
      
      return response;
    } catch (error) {
      this.logger.error('Full convergence analysis failed:', error);
      throw error;
    }
  }

  private async generateConvergenceSignals(symbol: string): Promise<void> {
    try {
      // Fetch current technical indicators from the API
      const response = await fetch(`http://localhost:5000/api/technical/${symbol}`);
      if (!response.ok) {
        this.logger.warn(`Failed to fetch technical indicators for ${symbol}`);
        return;
      }

      const indicators = await response.json();
      
      if (!indicators || !indicators.rsi || !indicators.macd) {
        this.logger.warn(`Insufficient technical data for ${symbol}`);
        return;
      }

      // Generate signals based on technical analysis
      const signals = [];

      // RSI Convergence Signal
      if (indicators.rsi) {
        const rsi = parseFloat(indicators.rsi);
        if (rsi < 30) {
          signals.push({
            signal_type: 'rsi_oversold',
            strength: Math.min(1.0, (30 - rsi) / 10),
            confidence: Math.min(95, 60 + (30 - rsi) * 2),
            direction: 'bullish' as const,
            timeframes: ['1d'],
            metadata: { rsi_value: rsi }
          });
        } else if (rsi > 70) {
          signals.push({
            signal_type: 'rsi_overbought',
            strength: Math.min(1.0, (rsi - 70) / 10),
            confidence: Math.min(95, 60 + (rsi - 70) * 2),
            direction: 'bearish' as const,
            timeframes: ['1d'],
            metadata: { rsi_value: rsi }
          });
        }
      }

      // MACD Convergence Signal
      if (indicators.macd && indicators.macd_signal) {
        const macd = parseFloat(indicators.macd);
        const macdSignal = parseFloat(indicators.macd_signal);
        const macdHist = macd - macdSignal;

        if (macd > macdSignal && macdHist > 0) {
          signals.push({
            signal_type: 'macd_bullish_crossover',
            strength: Math.min(1.0, Math.abs(macdHist) / 2),
            confidence: 75,
            direction: 'bullish' as const,
            timeframes: ['1d'],
            metadata: { macd: macd, signal: macdSignal, histogram: macdHist }
          });
        } else if (macd < macdSignal && macdHist < 0) {
          signals.push({
            signal_type: 'macd_bearish_crossover',
            strength: Math.min(1.0, Math.abs(macdHist) / 2),
            confidence: 75,
            direction: 'bearish' as const,
            timeframes: ['1d'],
            metadata: { macd: macd, signal: macdSignal, histogram: macdHist }
          });
        }
      }

      // Store signals in database
      for (const signal of signals) {
        await this.storeConvergenceSignal(symbol, signal);
      }

      this.logger.info(`Generated ${signals.length} convergence signals for ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to generate convergence signals for ${symbol}:`, error);
    }
  }

  private async storeConvergenceSignal(symbol: string, signal: any): Promise<void> {
    try {
      // Check if similar signal already exists (avoid duplicates)
      const existingResult = await this.db.query(`
        SELECT id FROM convergence_signals 
        WHERE symbol = $1 
        AND signal_type = $2 
        AND is_active = true 
        AND expires_at > NOW()
      `, [symbol, signal.signal_type]);

      if (existingResult.rows.length > 0) {
        return; // Signal already exists
      }

      // Insert new signal
      await this.db.query(`
        INSERT INTO convergence_signals (
          symbol, signal_type, timeframes, strength, confidence, 
          direction, detected_at, expires_at, metadata, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '4 hours', $7, true)
      `, [
        symbol,
        signal.signal_type,
        signal.timeframes,
        signal.strength,
        signal.confidence,
        signal.direction,
        JSON.stringify(signal.metadata)
      ]);

      this.logger.debug(`Stored convergence signal: ${signal.signal_type} for ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to store convergence signal for ${symbol}:`, error);
    }
  }

  private async getActiveConvergenceSignals(symbol: string): Promise<ConvergenceSignal[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM convergence_signals 
        WHERE symbol = $1 
        AND is_active = true 
        AND expires_at > NOW()
        ORDER BY detected_at DESC
        LIMIT 20
      `, [symbol]);

      return result.rows.map(row => ({
        id: row.id.toString(),
        symbol: row.symbol,
        signal_type: row.signal_type,
        timeframes: row.timeframes,
        strength: row.strength,
        confidence: row.confidence,
        direction: row.direction,
        detected_at: row.detected_at,
        expires_at: row.expires_at,
        metadata: row.metadata,
        is_active: row.is_active,
        created_at: row.created_at
      }));
    } catch (error) {
      this.logger.error(`Failed to get convergence signals for ${symbol}:`, error);
      return [];
    }
  }

  private async getBollingerSqueezeStatus(symbol: string): Promise<{
    active_squeezes: BollingerSqueezeEvent[];
    recent_breakouts: BollingerSqueezeEvent[];
  }> {
    try {
      const [activeSqueezes, recentBreakouts] = await Promise.all([
        // Active squeezes
        this.db.query(`
          SELECT * FROM bollinger_squeeze_events 
          WHERE symbol = $1 
          AND is_active = true 
          AND squeeze_end IS NULL
          ORDER BY squeeze_start DESC
        `, [symbol]),
        
        // Recent breakouts (last 7 days)
        this.db.query(`
          SELECT * FROM bollinger_squeeze_events 
          WHERE symbol = $1 
          AND squeeze_end IS NOT NULL 
          AND squeeze_end > NOW() - INTERVAL '7 days'
          ORDER BY squeeze_end DESC
          LIMIT 10
        `, [symbol])
      ]);

      return {
        active_squeezes: activeSqueezes.rows.map(this.mapBollingerSqueezeEvent),
        recent_breakouts: recentBreakouts.rows.map(this.mapBollingerSqueezeEvent)
      };
    } catch (error) {
      this.logger.error(`Failed to get squeeze status for ${symbol}:`, error);
      return { active_squeezes: [], recent_breakouts: [] };
    }
  }

  private mapBollingerSqueezeEvent = (row: any): BollingerSqueezeEvent => ({
    id: row.id.toString(),
    symbol: row.symbol,
    timeframe: row.timeframe,
    squeeze_start: row.squeeze_start,
    squeeze_end: row.squeeze_end,
    squeeze_duration_hours: row.squeeze_duration_hours,
    breakout_direction: row.breakout_direction,
    breakout_strength: row.breakout_strength ? parseFloat(row.breakout_strength) : null,
    price_at_squeeze: parseFloat(row.price_at_squeeze),
    price_at_breakout: row.price_at_breakout ? parseFloat(row.price_at_breakout) : null,
    volume_at_squeeze: parseFloat(row.volume_at_squeeze),
    volume_at_breakout: row.volume_at_breakout ? parseFloat(row.volume_at_breakout) : null,
    return_24h: row.return_24h ? parseFloat(row.return_24h) : null,
    return_7d: row.return_7d ? parseFloat(row.return_7d) : null,
    is_active: row.is_active,
    created_at: row.created_at
  });

  private calculateSignalSummary(signals: ConvergenceSignal[]) {
    const totalSignals = signals.length;
    const bullishSignals = signals.filter(s => s.direction === 'bullish').length;
    const bearishSignals = signals.filter(s => s.direction === 'bearish').length;
    const averageConfidence = totalSignals > 0 
      ? signals.reduce((sum, s) => sum + s.confidence, 0) / totalSignals 
      : 0;
    
    const highestConfidenceSignal = signals.length > 0 
      ? signals.reduce((max, signal) => signal.confidence > max.confidence ? signal : max, signals[0])
      : null;

    return {
      total_signals: totalSignals,
      bullish_signals: bullishSignals,
      bearish_signals: bearishSignals,
      average_confidence: Math.round(averageConfidence),
      highest_confidence_signal: highestConfidenceSignal
    };
  }

  private calculateOverallBias(signals: ConvergenceSignal[]): { 
    overallBias: 'bullish' | 'bearish' | 'neutral';
    confidenceScore: number;
  } {
    if (signals.length === 0) {
      return { overallBias: 'neutral', confidenceScore: 0 };
    }

    const weightedBullishScore = signals
      .filter(s => s.direction === 'bullish')
      .reduce((sum, s) => sum + (s.confidence * s.strength), 0);
    
    const weightedBearishScore = signals
      .filter(s => s.direction === 'bearish')
      .reduce((sum, s) => sum + (s.confidence * s.strength), 0);

    const totalWeight = signals.reduce((sum, s) => sum + (s.confidence * s.strength), 0);
    
    if (totalWeight === 0) {
      return { overallBias: 'neutral', confidenceScore: 0 };
    }

    const netBias = (weightedBullishScore - weightedBearishScore) / totalWeight;
    
    let overallBias: 'bullish' | 'bearish' | 'neutral';
    if (netBias > 0.1) {
      overallBias = 'bullish';
    } else if (netBias < -0.1) {
      overallBias = 'bearish';
    } else {
      overallBias = 'neutral';
    }

    const confidenceScore = Math.min(100, Math.abs(netBias) * 100);

    return { overallBias, confidenceScore: Math.round(confidenceScore) };
  }

  private async getSignalQualityOverview() {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_tracked_signals,
          AVG(success_rate) as avg_success_rate,
          signal_type as best_performing_signal_type
        FROM signal_quality_scores 
        WHERE total_occurrences >= 10
        ORDER BY success_rate DESC
        LIMIT 1
      `);

      const row = result.rows[0];
      
      return {
        total_tracked_signals: parseInt(row?.total_tracked_signals || '0'),
        avg_success_rate: parseFloat(row?.avg_success_rate || '0'),
        best_performing_signal_type: row?.best_performing_signal_type || 'none',
        recent_performance_trend: 'stable' as const // TODO: Implement trend calculation
      };
    } catch (error) {
      this.logger.error('Failed to get signal quality overview:', error);
      return {
        total_tracked_signals: 0,
        avg_success_rate: 0,
        best_performing_signal_type: 'none',
        recent_performance_trend: 'stable' as const
      };
    }
  }

  private async getAllActiveAlerts(): Promise<ConvergenceSignal[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM convergence_signals 
        WHERE is_active = true 
        AND expires_at > NOW()
        AND confidence >= 70
        ORDER BY confidence DESC, detected_at DESC
        LIMIT 10
      `);

      return result.rows.map(row => ({
        id: row.id.toString(),
        symbol: row.symbol,
        signal_type: row.signal_type,
        timeframes: row.timeframes,
        strength: row.strength,
        confidence: row.confidence,
        direction: row.direction,
        detected_at: row.detected_at,
        expires_at: row.expires_at,
        metadata: row.metadata,
        is_active: row.is_active,
        created_at: row.created_at
      }));
    } catch (error) {
      this.logger.error('Failed to get active alerts:', error);
      return [];
    }
  }

  private async getSqueezeMonitoring() {
    try {
      const [symbolsInSqueeze, potentialBreakouts, recentSuccessful] = await Promise.all([
        // Symbols currently in squeeze
        this.db.query(`
          SELECT DISTINCT symbol FROM bollinger_squeeze_events 
          WHERE is_active = true AND squeeze_end IS NULL
        `),
        
        // Potential breakouts (squeezes lasting > 5 days)
        this.db.query(`
          SELECT * FROM bollinger_squeeze_events 
          WHERE is_active = true 
          AND squeeze_end IS NULL 
          AND squeeze_start < NOW() - INTERVAL '5 days'
          ORDER BY squeeze_start ASC
          LIMIT 5
        `),
        
        // Recent successful breakouts (last 30 days with positive returns)
        this.db.query(`
          SELECT * FROM bollinger_squeeze_events 
          WHERE squeeze_end IS NOT NULL 
          AND squeeze_end > NOW() - INTERVAL '30 days'
          AND (return_24h > 0.02 OR return_7d > 0.05)
          ORDER BY return_7d DESC
          LIMIT 5
        `)
      ]);

      return {
        symbols_in_squeeze: symbolsInSqueeze.rows.map(row => row.symbol),
        potential_breakouts: potentialBreakouts.rows.map(this.mapBollingerSqueezeEvent),
        recent_successful_breakouts: recentSuccessful.rows.map(this.mapBollingerSqueezeEvent)
      };
    } catch (error) {
      this.logger.error('Failed to get squeeze monitoring data:', error);
      return {
        symbols_in_squeeze: [],
        potential_breakouts: [],
        recent_successful_breakouts: []
      };
    }
  }
}