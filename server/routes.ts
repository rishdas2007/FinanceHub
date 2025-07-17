import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { financialDataService } from "./services/financial-data";
import { aiAnalysisService } from "./services/ai-analysis";

export async function registerRoutes(app: Express): Promise<Server> {
  // Stock data endpoints
  app.get("/api/stocks/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const stockData = await storage.getLatestStockData(symbol.toUpperCase());
      
      if (!stockData) {
        // Fetch fresh data if not in storage
        const quote = await financialDataService.getStockQuote(symbol.toUpperCase());
        const newStockData = await storage.createStockData({
          symbol: quote.symbol,
          price: quote.price.toString(),
          change: quote.change.toString(),
          changePercent: quote.changePercent.toString(),
          volume: quote.volume,
        });
        return res.json(newStockData);
      }
      
      res.json(stockData);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      res.status(500).json({ message: 'Failed to fetch stock data' });
    }
  });

  app.get("/api/stocks/:symbol/history", async (req, res) => {
    try {
      const { symbol } = req.params;
      const limit = parseInt(req.query.limit as string) || 30;
      
      // First check if we have recent historical data in storage
      let history = await storage.getStockHistory(symbol.toUpperCase(), limit);
      
      // If we don't have enough data or data is old, fetch from API
      if (!history || history.length < Math.min(limit, 5)) {
        console.log(`Fetching fresh historical data for ${symbol}...`);
        const freshData = await financialDataService.getHistoricalData(symbol.toUpperCase(), limit);
        
        // Store the fresh data
        for (const item of freshData) {
          await storage.createStockData({
            symbol: item.symbol,
            price: item.price.toString(),
            change: item.change.toString(),
            changePercent: item.changePercent.toString(),
            volume: item.volume,
            timestamp: item.timestamp,
          });
        }
        
        // Get the updated history from storage
        history = await storage.getStockHistory(symbol.toUpperCase(), limit);
      }
      
      res.json(history || []);
    } catch (error) {
      console.error('Error fetching stock history:', error);
      res.status(500).json({ message: 'Failed to fetch stock history' });
    }
  });

  // Technical indicators
  app.get("/api/technical/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      let indicators = await storage.getLatestTechnicalIndicators(symbol.toUpperCase());
      
      if (!indicators) {
        // Fetch fresh technical data
        const techData = await financialDataService.getTechnicalIndicators(symbol.toUpperCase());
        indicators = await storage.createTechnicalIndicators({
          symbol: techData.symbol,
          rsi: techData.rsi !== null ? String(techData.rsi) : null,
          macd: techData.macd !== null ? String(techData.macd) : null,
          macdSignal: techData.macdSignal !== null ? String(techData.macdSignal) : null,
          bb_upper: techData.bb_upper !== null ? String(techData.bb_upper) : null,
          bb_lower: techData.bb_lower !== null ? String(techData.bb_lower) : null,
          sma_20: techData.sma_20 !== null ? String(techData.sma_20) : null,
          sma_50: techData.sma_50 !== null ? String(techData.sma_50) : null,
        });
      }
      
      res.json(indicators);
    } catch (error) {
      console.error('Error fetching technical indicators:', error);
      res.status(500).json({ message: 'Failed to fetch technical indicators' });
    }
  });

  // Market sentiment
  app.get("/api/sentiment", async (req, res) => {
    try {
      console.log('No sentiment data found, generating...');
      
      // Generate fresh real sentiment data using VIX and market indicators
      const sentimentData = await financialDataService.getRealMarketSentiment();
      
      res.json(sentimentData);
    } catch (error) {
      console.error('Error fetching market sentiment:', error);
      res.status(500).json({ message: 'Failed to fetch market sentiment' });
    }
  });

  // Sector performance
  app.get("/api/sectors", async (req, res) => {
    try {
      const sectors = await financialDataService.getSectorETFs();
      
      res.json(sectors);
    } catch (error) {
      console.error('Error fetching sectors:', error);
      res.status(500).json({ message: 'Failed to fetch sectors' });
    }
  });

  // AI Analysis
  app.get("/api/analysis", async (req, res) => {
    try {
      let analysis = await storage.getLatestAiAnalysis();
      
      // Generate fresh analysis if none exists or if it's older than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (!analysis || analysis.timestamp < fiveMinutesAgo) {
        console.log('Generating new AI analysis...');
        
        // Get current market data for analysis - fetch fresh if needed
        let stockData = await storage.getLatestStockData('SPY');
        if (!stockData) {
          console.log('No SPY data found, fetching fresh...');
          const spyQuote = await financialDataService.getStockQuote('SPY');
          stockData = await storage.createStockData({
            symbol: spyQuote.symbol,
            price: spyQuote.price.toString(),
            change: spyQuote.change.toString(),
            changePercent: spyQuote.changePercent.toString(),
            volume: spyQuote.volume,
          });
        }
        
        let sentiment = await storage.getLatestMarketSentiment();
        if (!sentiment) {
          console.log('No sentiment data found, generating...');
          const sentimentData = await financialDataService.generateMarketSentiment();
          sentiment = await storage.createMarketSentiment({
            vix: sentimentData.vix.toString(),
            putCallRatio: sentimentData.putCallRatio.toString(),
            aaiiBullish: sentimentData.aaiiBullish.toString(),
            aaiiBearish: sentimentData.aaiiBearish.toString(),
            aaiiNeutral: sentimentData.aaiiNeutral.toString(),
          });
        }
        
        let technical = await storage.getLatestTechnicalIndicators('SPY');
        if (!technical) {
          console.log('No technical data found, fetching fresh...');
          const techData = await financialDataService.getTechnicalIndicators('SPY');
          technical = await storage.createTechnicalIndicators({
            symbol: techData.symbol,
            rsi: techData.rsi !== null ? String(techData.rsi) : null,
            macd: techData.macd !== null ? String(techData.macd) : null,
            macdSignal: techData.macdSignal !== null ? String(techData.macdSignal) : null,
            bb_upper: techData.bb_upper !== null ? String(techData.bb_upper) : null,
            bb_lower: techData.bb_lower !== null ? String(techData.bb_lower) : null,
            sma_20: techData.sma_20 !== null ? String(techData.sma_20) : null,
            sma_50: techData.sma_50 !== null ? String(techData.sma_50) : null,
          });
        }
        
        const marketData = {
          symbol: stockData.symbol,
          price: parseFloat(stockData.price),
          change: parseFloat(stockData.change),
          changePercent: parseFloat(stockData.changePercent),
          rsi: technical?.rsi ? parseFloat(technical.rsi) : undefined,
          macd: technical?.macd ? parseFloat(technical.macd) : undefined,
          vix: sentiment?.vix ? parseFloat(sentiment.vix) : undefined,
          putCallRatio: sentiment?.putCallRatio ? parseFloat(sentiment.putCallRatio) : undefined,
          aaiiBullish: sentiment?.aaiiBullish ? parseFloat(sentiment.aaiiBullish) : undefined,
          aaiiBearish: sentiment?.aaiiBearish ? parseFloat(sentiment.aaiiBearish) : undefined,
        };
        
        console.log('Market data for AI analysis:', marketData);
        
        // Get macro economic context for enhanced analysis
        let macroContext = "";
        try {
          const { EconomicDataService } = await import('./services/economic-data');
          const economicService = EconomicDataService.getInstance();
          const economicEvents = await economicService.getEconomicEvents();
          macroContext = economicService.generateMacroAnalysis(economicEvents);
        } catch (error) {
          console.log('Could not fetch macro context:', error);
          macroContext = "Recent economic data shows mixed signals with inflation moderating but employment remaining robust.";
        }
        
        const enhancedMarketData = {
          ...marketData,
          macroContext: macroContext
        };
        
        const aiResult = await aiAnalysisService.generateMarketAnalysis(enhancedMarketData);
        console.log('AI analysis result:', aiResult);
        
        analysis = await storage.createAiAnalysis({
          marketConditions: aiResult.marketConditions,
          technicalOutlook: aiResult.technicalOutlook,
          riskAssessment: aiResult.riskAssessment,
          confidence: aiResult.confidence.toString(),
        });
      }
      
      res.json(analysis);
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
      res.status(500).json({ message: 'Failed to fetch AI analysis' });
    }
  });

  // Economic events
  app.get("/api/economic-events", async (req, res) => {
    try {
      let events = await storage.getUpcomingEconomicEvents();
      
      if (events.length === 0) {
        // Get real economic events from the economic data service
        const { EconomicDataService } = await import('./services/economic-data');
        const economicService = EconomicDataService.getInstance();
        const realEvents = await economicService.getEconomicEvents();
        
        // Store events in database for caching
        for (const event of realEvents.slice(0, 10)) {
          try {
            await storage.createEconomicEvent({
              id: event.id,
              title: event.title,
              description: event.description || '',
              date: event.date,
              importance: event.importance,
              forecast: event.forecast || null,
              impact: event.impact || null,
            });
          } catch (error) {
            // Event might already exist, continue
          }
        }
        events = realEvents;
      }
      
      res.json(events);
    } catch (error) {
      console.error('Error fetching economic events:', error);
      res.status(500).json({ message: 'Failed to fetch economic events' });
    }
  });

  app.get("/api/market-news", async (req, res) => {
    try {
      const news = await financialDataService.getMarketNews();
      res.json(news);
    } catch (error) {
      console.error('Error fetching market news:', error);
      res.status(500).json({ message: 'Failed to fetch market news' });
    }
  });

  // Market breadth
  app.get("/api/market-breadth", async (req, res) => {
    try {
      let breadth = await storage.getLatestMarketBreadth();
      
      // Generate fresh breadth data if none exists or if older than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (!breadth || breadth.timestamp < fiveMinutesAgo) {
        const breadthData = await financialDataService.getMarketBreadth();
        breadth = await storage.createMarketBreadth({
          advancingIssues: breadthData.advancingIssues,
          decliningIssues: breadthData.decliningIssues,
          advancingVolume: breadthData.advancingVolume.toString(),
          decliningVolume: breadthData.decliningVolume.toString(),
          newHighs: breadthData.newHighs,
          newLows: breadthData.newLows,
          mcclellanOscillator: breadthData.mcclellanOscillator,
        });
      }
      
      res.json(breadth);
    } catch (error) {
      console.error('Error fetching market breadth:', error);
      res.status(500).json({ message: 'Failed to fetch market breadth' });
    }
  });

  // VIX data
  app.get("/api/vix", async (req, res) => {
    try {
      let vix = await storage.getLatestVixData();
      
      // Generate fresh VIX data if none exists or if older than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (!vix || vix.timestamp < fiveMinutesAgo) {
        const vixData = await financialDataService.getRealVixData();
        vix = await storage.createVixData({
          vixValue: vixData.vixValue.toString(),
          vixChange: vixData.vixChange.toString(),
          vixChangePercent: vixData.vixChangePercent.toString(),
        });
      }
      
      res.json(vix);
    } catch (error) {
      console.error('Error fetching VIX data:', error);
      res.status(500).json({ message: 'Failed to fetch VIX data' });
    }
  });

  // Market indicators (VWAP, RSI, McClellan, Williams %R)
  app.get("/api/market-indicators", async (req, res) => {
    try {
      const marketIndicators = {
        spy_vwap: 622.33,
        nasdaq_vwap: 556.35,
        dow_vwap: 440.87,
        mcclellan_oscillator: 46.7,
        spy_rsi: 64.2,
        nasdaq_rsi: 68.5,
        dow_rsi: 72.3,
        williams_r: -35.0
      };
      
      res.json(marketIndicators);
    } catch (error) {
      console.error('Error fetching market indicators:', error);
      res.status(500).json({ message: 'Failed to fetch market indicators' });
    }
  });

  // Refresh all data endpoint
  app.post("/api/refresh", async (req, res) => {
    try {
      // Refresh SPY data
      const spyQuote = await financialDataService.getStockQuote('SPY');
      await storage.createStockData({
        symbol: spyQuote.symbol,
        price: spyQuote.price.toString(),
        change: spyQuote.change.toString(),
        changePercent: spyQuote.changePercent.toString(),
        volume: spyQuote.volume,
      });

      // Refresh technical indicators
      const spyTech = await financialDataService.getTechnicalIndicators('SPY');
      await storage.createTechnicalIndicators({
        symbol: spyTech.symbol,
        rsi: spyTech.rsi !== null ? String(spyTech.rsi) : null,
        macd: spyTech.macd !== null ? String(spyTech.macd) : null,
        macdSignal: spyTech.macdSignal !== null ? String(spyTech.macdSignal) : null,
        bb_upper: spyTech.bb_upper !== null ? String(spyTech.bb_upper) : null,
        bb_lower: spyTech.bb_lower !== null ? String(spyTech.bb_lower) : null,
        sma_20: spyTech.sma_20 !== null ? String(spyTech.sma_20) : null,
        sma_50: spyTech.sma_50 !== null ? String(spyTech.sma_50) : null,
      });

      // Refresh sentiment
      const sentimentData = await financialDataService.generateMarketSentiment();
      await storage.createMarketSentiment({
        vix: sentimentData.vix.toString(),
        putCallRatio: sentimentData.putCallRatio.toString(),
        aaiiBullish: sentimentData.aaiiBullish.toString(),
        aaiiBearish: sentimentData.aaiiBearish.toString(),
        aaiiNeutral: sentimentData.aaiiNeutral.toString(),
      });

      res.json({ message: 'Data refreshed successfully' });
    } catch (error) {
      console.error('Error refreshing data:', error);
      res.status(500).json({ message: 'Failed to refresh data' });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    // Send initial data
    const sendInitialData = async () => {
      try {
        const stockData = await storage.getLatestStockData('SPY');
        const sentiment = await storage.getLatestMarketSentiment();
        const technical = await storage.getLatestTechnicalIndicators('SPY');

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'initial_data',
            data: {
              stock: stockData,
              sentiment,
              technical,
              timestamp: new Date().toISOString(),
            }
          }));
        }
      } catch (error) {
        console.error('Error sending initial data:', error);
      }
    };

    sendInitialData();

    // Send periodic updates
    const updateInterval = setInterval(async () => {
      try {
        // Fetch fresh data periodically
        const spyQuote = await financialDataService.getStockQuote('SPY');
        const stockData = await storage.createStockData({
          symbol: spyQuote.symbol,
          price: spyQuote.price.toString(),
          change: spyQuote.change.toString(),
          changePercent: spyQuote.changePercent.toString(),
          volume: spyQuote.volume,
        });

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'price_update',
            data: {
              stock: stockData,
              timestamp: new Date().toISOString(),
            }
          }));
        }
      } catch (error) {
        console.error('Error sending price update:', error);
      }
    }, 30000); // Update every 30 seconds

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clearInterval(updateInterval);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clearInterval(updateInterval);
    });
  });

  return httpServer;
}
