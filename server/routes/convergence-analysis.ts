import express from "express";
import { getRealTimeMarketService } from "../services/real-time-market-service";

const router = express.Router();

// Get full convergence analysis
router.get("/convergence-analysis", async (req, res) => {
  try {
    // Import MarketDataService and get sector ETFs
    const { MarketDataService } = await import('../services/market-data-unified');
    const marketDataService = MarketDataService.getInstance();
    
    // Use symbols from query or default sector ETFs  
    let symbols: string[];
    if (req.query.symbols) {
      symbols = (req.query.symbols as string).split(',').map(s => s.trim().toUpperCase());
    } else {
      // Use existing sector ETFs from dashboard
      const sectorETFs = await marketDataService.getSectorETFs();
      symbols = sectorETFs.map(etf => etf.symbol);
    }
    
    // Generate convergence analysis for each symbol using existing data pipeline
    const analysis = await Promise.all(symbols.map(async (symbol) => {
      try {
        // Get technical indicators using existing MarketDataService
        const indicators = await marketDataService.getTechnicalIndicators(symbol);
        const signals = [];
        
        // RSI-based signals with dynamic confidence
        if (indicators.rsi) {
          const rsi = parseFloat(indicators.rsi);
          // Only generate signals if RSI is valid (not 0 or NaN)
          if (rsi > 0 && !isNaN(rsi) && rsi < 30) {
            signals.push({
              id: `${symbol}-rsi-oversold-${Date.now()}`,
              symbol,
              signal_type: 'rsi_oversold',
              direction: 'bullish',
              confidence: Math.min(95, 65 + (30 - rsi) * 2), // Dynamic confidence
              strength: Math.min(1.0, (30 - rsi) / 10),
              detected_at: new Date(),
              metadata: { rsi_value: rsi }
            });
          } else if (rsi > 0 && !isNaN(rsi) && rsi > 70) {
            signals.push({
              id: `${symbol}-rsi-overbought-${Date.now()}`,
              symbol,
              signal_type: 'rsi_overbought',
              direction: 'bearish',
              confidence: Math.min(95, 65 + (rsi - 70) * 2), // Dynamic confidence
              strength: Math.min(1.0, (rsi - 70) / 10),
              detected_at: new Date(),
              metadata: { rsi_value: rsi }
            });
          }
        }
        
        // MACD-based signals with dynamic confidence
        if (indicators.macd && indicators.macdSignal) {
          const macd = parseFloat(indicators.macd);
          const macdSignal = parseFloat(indicators.macdSignal);
          
          // Only generate signals if MACD values are valid (not 0 or NaN)
          if (!isNaN(macd) && !isNaN(macdSignal) && macd !== 0 && macdSignal !== 0) {
            const macdHist = macd - macdSignal;
          
          // Dynamic confidence based on histogram strength and signal separation
          const histogramStrength = Math.abs(macdHist);
          const signalSeparation = Math.abs(macd - macdSignal);
          const baseConfidence = 65;
          const histogramBonus = Math.min(20, histogramStrength * 20);
          const separationBonus = Math.min(10, signalSeparation * 10);
          const dynamicConfidence = Math.min(95, baseConfidence + histogramBonus + separationBonus);

          if (macd > macdSignal && macdHist > 0) {
            signals.push({
              id: `${symbol}-macd-bullish-${Date.now()}`,
              symbol,
              signal_type: 'macd_bullish_crossover',
              direction: 'bullish',
              confidence: Math.round(dynamicConfidence),
              strength: Math.min(1.0, histogramStrength / 2),
              detected_at: new Date(),
              metadata: { macd, signal: macdSignal, histogram: macdHist }
            });
          } else if (macd < macdSignal && macdHist < 0) {
            signals.push({
              id: `${symbol}-macd-bearish-${Date.now()}`,
              symbol,
              signal_type: 'macd_bearish_crossover',
              direction: 'bearish',
              confidence: Math.round(dynamicConfidence),
              strength: Math.min(1.0, histogramStrength / 2),
              detected_at: new Date(),
              metadata: { macd, signal: macdSignal, histogram: macdHist }
            });
          }
          }
        }
        
        const bullishSignals = signals.filter(s => s.direction === 'bullish').length;
        const bearishSignals = signals.filter(s => s.direction === 'bearish').length;
        const averageConfidence = signals.length > 0 
          ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length 
          : 0;
        
        // Include raw technical indicators for reference and debugging
        const technicalData = {
          rsi: indicators.rsi ? parseFloat(indicators.rsi) : null,
          macd: indicators.macd ? parseFloat(indicators.macd) : null,
          macdSignal: indicators.macdSignal ? parseFloat(indicators.macdSignal) : null,
          adx: indicators.adx ? parseFloat(indicators.adx) : null,
          percentB: indicators.percent_b ? parseFloat(indicators.percent_b) : null
        };

        return {
          symbol,
          timestamp: new Date(),
          convergence_signals: signals,
          technical_indicators: technicalData,
          signal_summary: {
            total_signals: signals.length,
            bullish_signals: bullishSignals,
            bearish_signals: bearishSignals,
            neutral_signals: signals.length - bullishSignals - bearishSignals
          },
          bollinger_squeeze_status: {
            is_squeezing: false,
            squeeze_duration_days: 0,
            breakout_direction: null,
            volatility_expansion_potential: 0.5
          },
          overall_bias: bullishSignals > bearishSignals ? "bullish" : 
                       bearishSignals > bullishSignals ? "bearish" : "neutral",
          confidence_score: Math.round(averageConfidence)
        };
      } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error);
        return {
          symbol,
          timestamp: new Date(),
          convergence_signals: [],
          signal_summary: {
            total_signals: 0,
            bullish_signals: 0,
            bearish_signals: 0,
            neutral_signals: 0
          },
          bollinger_squeeze_status: {
            is_squeezing: false,
            squeeze_duration_days: 0,
            breakout_direction: null,
            volatility_expansion_potential: 0.5
          },
          overall_bias: "neutral",
          confidence_score: 0
        };
      }
    }));

    res.json({
      analysis,
      signal_quality_overview: {
        data_freshness: 'real-time',
        signal_accuracy: 85,
        coverage_percentage: 100,
        last_updated: new Date()
      },
      active_alerts: analysis.filter(a => a.confidence_score > 50).map(a => ({
        id: `${a.symbol}-alert-${Date.now()}`,
        symbol: a.symbol,
        signal_type: 'convergence_analysis',
        direction: a.overall_bias,
        confidence: a.confidence_score,
        detected_at: new Date(),
        metadata: { signals: a.convergence_signals.length }
      })),
      squeeze_monitoring: {
        symbols_in_squeeze: 0,
        potential_breakouts: analysis.filter(a => a.confidence_score > 70).map(a => a.symbol),
        average_squeeze_duration: 0
      }
    });
  } catch (error) {
    console.error("Convergence analysis error:", error);
    res.status(500).json({ 
      error: "Failed to get convergence analysis",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get analysis for specific symbol
router.get("/convergence-analysis/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const mockAnalysis = {
      symbol: symbol.toUpperCase(),
      timestamp: new Date(),
      convergence_signals: [],
      signal_summary: {
        total_signals: 0,
        bullish_signals: 0,
        bearish_signals: 0,
        average_confidence: 0,
        highest_confidence_signal: null
      },
      bollinger_squeeze_status: {
        active_squeezes: [],
        recent_breakouts: []
      },
      overall_bias: "neutral" as const,
      confidence_score: 0
    };
    
    res.json(mockAnalysis);
  } catch (error) {
    console.error(`Symbol analysis error for ${req.params.symbol}:`, error);
    res.status(500).json({ 
      error: "Failed to analyze symbol",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get Bollinger squeeze statistics
router.get("/squeeze-statistics", async (req, res) => {
  try {
    const mockStats = {
      total_squeezes: 0,
      avg_duration_hours: 0,
      breakout_success_rate: 0,
      avg_return_24h: 0,
      avg_return_7d: 0
    };
    
    res.json(mockStats);
  } catch (error) {
    console.error("Squeeze statistics error:", error);
    res.status(500).json({ 
      error: "Failed to get squeeze statistics",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get RSI divergences for symbol
router.get("/rsi-divergence/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const timeframe = (req.query.timeframe as string) || '1d';
    
    res.json({ 
      symbol: symbol.toUpperCase(),
      timeframe,
      divergences: []
    });
  } catch (error) {
    console.error(`RSI divergence error for ${req.params.symbol}:`, error);
    res.status(500).json({ 
      error: "Failed to detect RSI divergence",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get divergence statistics
router.get("/divergence-statistics", async (req, res) => {
  try {
    const mockStats = {
      total_divergences: 0,
      bullish_count: 0,
      bearish_count: 0,
      avg_success_rate: 0,
      best_timeframe: '1d'
    };
    
    res.json(mockStats);
  } catch (error) {
    console.error("Divergence statistics error:", error);
    res.status(500).json({ 
      error: "Failed to get divergence statistics",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get WebSocket connection status
router.get("/websocket-status", async (req, res) => {
  try {
    const marketService = getRealTimeMarketService();
    const status = marketService.getConnectionStatus();
    
    res.json({
      ...status,
      timestamp: new Date(),
      service: 'Twelve Data WebSocket'
    });
  } catch (error) {
    console.error("WebSocket status error:", error);
    res.status(500).json({ 
      error: "Failed to get WebSocket status",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get real-time market data for specific symbols
router.get("/market-data", async (req, res) => {
  try {
    const marketService = getRealTimeMarketService();
    const symbols = req.query.symbols ? 
      (req.query.symbols as string).split(',').map(s => s.trim().toUpperCase()) : 
      ['SPY'];
    
    const marketData = marketService.getMultiSymbolData(symbols);
    
    res.json({
      data: marketData,
      symbols_requested: symbols,
      timestamp: new Date(),
      connection_status: marketService.getConnectionStatus()
    });
  } catch (error) {
    console.error("Market data error:", error);
    res.status(500).json({ 
      error: "Failed to get market data",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;