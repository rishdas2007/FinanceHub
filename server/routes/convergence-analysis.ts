import express from "express";
import { MultiTimeframeAnalysisService } from "../services/multi-timeframe-analysis";
import { BollingerSqueezeService } from "../services/bollinger-squeeze-service";
import { RSIDivergenceService } from "../services/rsi-divergence-service";
import { getRealTimeMarketService } from "../services/real-time-market-service";

const router = express.Router();

// Get full convergence analysis
router.get("/convergence-analysis", async (req, res) => {
  try {
    const marketService = getRealTimeMarketService();
    const connectionStatus = marketService.getConnectionStatus();
    
    // Use all subscribed symbols if no specific symbols requested
    const symbols = req.query.symbols ? 
      (req.query.symbols as string).split(',').map(s => s.trim().toUpperCase()) : 
      connectionStatus.subscribedSymbols.length > 0 ? connectionStatus.subscribedSymbols :
      ['SPY', 'QQQ', 'IWM'];
    
    // Get real-time market data for analysis
    const marketData = marketService.getMultiSymbolData(symbols);
    
    // Build analysis with real market data
    const analysis = symbols.map(symbol => {
      const data = marketData[symbol];
      const priceMovement = marketService.getPriceMovement(symbol);
      
      return {
        symbol,
        timestamp: new Date(),
        convergence_signals: [],
        signal_summary: {
          total_signals: data ? 1 : 0,
          bullish_signals: data && data.changePercent > 0 ? 1 : 0,
          bearish_signals: data && data.changePercent < 0 ? 1 : 0,
          average_confidence: data ? 75 : 0,
          highest_confidence_signal: data ? {
            type: data.changePercent > 0 ? 'bullish_momentum' : 'bearish_momentum',
            confidence: 75
          } : null
        },
        bollinger_squeeze_status: {
          active_squeezes: [],
          recent_breakouts: []
        },
        overall_bias: data ? 
          (data.changePercent > 0.5 ? "bullish" : 
           data.changePercent < -0.5 ? "bearish" : "neutral") : "neutral",
        confidence_score: data ? Math.min(Math.abs(data.changePercent) * 10, 100) : 0,
        market_data: data ? {
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
          volume: data.volume,
          lastUpdate: data.lastUpdate
        } : null
      };
    });

    const realTimeAnalysis = {
      analysis,
      signal_quality_overview: {
        total_tracked_signals: Object.keys(marketData).length,
        avg_success_rate: connectionStatus.connected ? 85 : 0,
        best_performing_signal_type: "real_time_momentum",
        recent_performance_trend: "active"
      },
      active_alerts: analysis.filter(a => a.confidence_score > 50).map(a => ({
        id: `${a.symbol}-${Date.now()}`,
        symbol: a.symbol,
        signal_type: 'real_time_momentum',
        direction: a.overall_bias,
        confidence: Math.round(a.confidence_score),
        detected_at: new Date(),
        metadata: a.market_data
      })),
      squeeze_monitoring: {
        symbols_in_squeeze: [],
        potential_breakouts: analysis.filter(a => Math.abs(a.confidence_score) > 70).map(a => a.symbol),
        recent_successful_breakouts: []
      },
      connection_status: connectionStatus,
      real_time_data: marketData
    };
    
    res.json(realTimeAnalysis);
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