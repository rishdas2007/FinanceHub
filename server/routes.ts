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
      const history = await storage.getStockHistory(symbol.toUpperCase(), limit);
      res.json(history);
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
          rsi: typeof techData.rsi === 'number' ? techData.rsi.toString() : null,
          macd: typeof techData.macd === 'number' ? techData.macd.toString() : null,
          macdSignal: typeof techData.macdSignal === 'number' ? techData.macdSignal.toString() : null,
          bb_upper: typeof techData.bb_upper === 'number' ? techData.bb_upper.toString() : null,
          bb_lower: typeof techData.bb_lower === 'number' ? techData.bb_lower.toString() : null,
          sma_20: typeof techData.sma_20 === 'number' ? techData.sma_20.toString() : null,
          sma_50: typeof techData.sma_50 === 'number' ? techData.sma_50.toString() : null,
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
      let sentiment = await storage.getLatestMarketSentiment();
      
      if (!sentiment) {
        // Generate fresh sentiment data
        const sentimentData = financialDataService.generateMarketSentiment();
        sentiment = await storage.createMarketSentiment({
          vix: sentimentData.vix.toString(),
          putCallRatio: sentimentData.putCallRatio.toString(),
          aaiiBullish: sentimentData.aaiiBullish.toString(),
          aaiiBearish: sentimentData.aaiiBearish.toString(),
          aaiiNeutral: sentimentData.aaiiNeutral.toString(),
        });
      }
      
      res.json(sentiment);
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
      console.error('Error fetching sector data:', error);
      res.status(500).json({ message: 'Failed to fetch sector data' });
    }
  });

  // AI Analysis
  app.get("/api/analysis", async (req, res) => {
    try {
      let analysis = await storage.getLatestAiAnalysis();
      
      // Generate fresh analysis if none exists or if it's older than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (!analysis || analysis.timestamp < fiveMinutesAgo) {
        // Get current market data for analysis
        const stockData = await storage.getLatestStockData('SPY');
        const sentiment = await storage.getLatestMarketSentiment();
        const technical = await storage.getLatestTechnicalIndicators('SPY');
        
        if (stockData) {
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
          
          const aiResult = await aiAnalysisService.generateMarketAnalysis(marketData);
          analysis = await storage.createAiAnalysis({
            marketConditions: aiResult.marketConditions,
            technicalOutlook: aiResult.technicalOutlook,
            riskAssessment: aiResult.riskAssessment,
            confidence: aiResult.confidence.toString(),
          });
        }
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
        // Generate sample events if none exist
        const eventData = financialDataService.generateEconomicEvents();
        for (const event of eventData) {
          await storage.createEconomicEvent(event);
        }
        events = await storage.getUpcomingEconomicEvents();
      }
      
      res.json(events);
    } catch (error) {
      console.error('Error fetching economic events:', error);
      res.status(500).json({ message: 'Failed to fetch economic events' });
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
        rsi: typeof spyTech.rsi === 'number' ? spyTech.rsi.toString() : null,
        macd: typeof spyTech.macd === 'number' ? spyTech.macd.toString() : null,
        macdSignal: typeof spyTech.macdSignal === 'number' ? spyTech.macdSignal.toString() : null,
        bb_upper: typeof spyTech.bb_upper === 'number' ? spyTech.bb_upper.toString() : null,
        bb_lower: typeof spyTech.bb_lower === 'number' ? spyTech.bb_lower.toString() : null,
        sma_20: typeof spyTech.sma_20 === 'number' ? spyTech.sma_20.toString() : null,
        sma_50: typeof spyTech.sma_50 === 'number' ? spyTech.sma_50.toString() : null,
      });

      // Refresh sentiment
      const sentimentData = financialDataService.generateMarketSentiment();
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
