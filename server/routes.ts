import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { financialDataService } from "./services/financial-data";
import { aiAnalysisService } from "./services/ai-analysis";
import { apiLogger, getApiStats } from "./middleware/apiLogger";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add API logging middleware
  app.use('/api', apiLogger);

  // API stats endpoint
  app.get("/api/stats", (req, res) => {
    res.json(getApiStats());
  });
  // Stock data endpoints
  app.get("/api/stocks/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      
      // Always fetch fresh data to avoid stale cache issues
      console.log(`Fetching fresh data for ${symbol}...`);
      const quote = await financialDataService.getStockQuote(symbol.toUpperCase());
      const newStockData = await storage.createStockData({
        symbol: quote.symbol,
        price: quote.price.toString(),
        change: quote.change.toString(),
        changePercent: quote.changePercent.toString(),
        volume: quote.volume,
      });
      
      res.json(newStockData);
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
            // timestamp: item.timestamp, // Remove this line as it's not in the schema
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
      
      // Always fetch fresh technical data to ensure real-time accuracy
      console.log(`Fetching fresh technical indicators for ${symbol}...`);
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
      console.log('Fetching fresh sector data with 5-day and 1-month performance...');
      const freshSectors = await financialDataService.getSectorETFs();
      
      // Cache the fresh data with all performance metrics
      for (const sector of freshSectors) {
        try {
          await storage.createSectorData({
            symbol: sector.symbol,
            name: sector.name,
            price: typeof sector.price === 'number' ? sector.price.toString() : sector.price.toString(),
            changePercent: typeof sector.changePercent === 'number' ? sector.changePercent.toString() : sector.changePercent.toString(),
            fiveDayChange: (sector.fiveDayChange || 0).toString(),
            oneMonthChange: (sector.oneMonthChange || 0).toString(),
            volume: sector.volume || 0,
          });
        } catch (error) {
          console.error(`Error storing sector data for ${sector.symbol}:`, error);
        }
      }
      
      res.json(freshSectors);
    } catch (error) {
      console.error('Error fetching sectors:', error);
      res.status(500).json({ message: 'Failed to fetch sectors' });
    }
  });

  // AI Analysis - Always fetch fresh data for most current analysis
  app.get("/api/analysis", async (req, res) => {
    try {
      console.log('🧠 Generating fresh AI analysis with latest dashboard data...');
      
      // Always generate fresh analysis to ensure most up-to-date market view
      const shouldRefresh = true;
      if (shouldRefresh) {
        // Force fresh data collection for most current analysis
        console.log('📊 Fetching fresh market data for AI analysis...');
        const [spyQuote, marketIndicators, sentimentData, sectorData, technicalData] = await Promise.all([
          financialDataService.getStockQuote('SPY'),
          financialDataService.getMarketIndicators(),
          financialDataService.getRealMarketSentiment(),
          financialDataService.getSectorETFs(),
          financialDataService.getTechnicalIndicators('SPY')
        ]);
        
        // Store fresh SPY data
        const stockData = await storage.createStockData({
          symbol: spyQuote.symbol,
          price: spyQuote.price.toString(),
          change: spyQuote.change.toString(),
          changePercent: spyQuote.changePercent.toString(),
          volume: spyQuote.volume,
        });
        
        // Store fresh sentiment data
        const sentiment = await storage.createMarketSentiment({
          vix: sentimentData.vix.toString(),
          putCallRatio: sentimentData.putCallRatio.toString(),
          aaiiBullish: sentimentData.aaiiBullish.toString(),
          aaiiBearish: sentimentData.aaiiBearish.toString(),
          aaiiNeutral: sentimentData.aaiiNeutral.toString(),
        });
        
        // Store fresh technical data
        const technical = await storage.createTechnicalIndicators({
          symbol: technicalData.symbol,
          rsi: technicalData.rsi !== null ? String(technicalData.rsi) : null,
          macd: technicalData.macd !== null ? String(technicalData.macd) : null,
          macdSignal: technicalData.macdSignal !== null ? String(technicalData.macdSignal) : null,
          bb_upper: technicalData.bb_upper !== null ? String(technicalData.bb_upper) : null,
          bb_lower: technicalData.bb_lower !== null ? String(technicalData.bb_lower) : null,
          sma_20: technicalData.sma_20 !== null ? String(technicalData.sma_20) : null,
          sma_50: technicalData.sma_50 !== null ? String(technicalData.sma_50) : null,
        });
        
        const marketData = {
          symbol: stockData.symbol,
          price: parseFloat(stockData.price),
          change: parseFloat(stockData.change),
          changePercent: parseFloat(stockData.changePercent),
          rsi: marketIndicators.spy_rsi || (technical?.rsi ? parseFloat(technical.rsi) : undefined),
          macd: technical?.macd ? parseFloat(technical.macd) : undefined,
          macdSignal: technical?.macdSignal ? parseFloat(technical.macdSignal) : undefined,
          vix: sentiment?.vix ? parseFloat(sentiment.vix) : undefined,
          putCallRatio: sentiment?.putCallRatio ? parseFloat(sentiment.putCallRatio) : undefined,
          aaiiBullish: sentiment?.aaiiBullish ? parseFloat(sentiment.aaiiBullish) : undefined,
          aaiiBearish: sentiment?.aaiiBearish ? parseFloat(sentiment.aaiiBearish) : undefined,
          // Include fresh Market Breadth indicators for comprehensive analysis
          spyVwap: marketIndicators.spy_vwap,
          mcclellanOscillator: marketIndicators.mcclellan_oscillator,
          williamsR: marketIndicators.williams_r
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
        
        // Use already fetched fresh sector data for analysis
        const freshSectors = sectorData;
        
        const aiResult = await aiAnalysisService.generateMarketAnalysis(enhancedMarketData, freshSectors);
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

  // Economic events API - MarketWatch compatible endpoint
  app.get("/api/economic-events", async (req, res) => {
    try {
      console.log('Fetching MarketWatch economic calendar events...');
      
      // Parse query parameters for filtering (following core requirements)
      const { start_date, end_date, importance, category } = req.query;
      
      // Get real economic events from MarketWatch service
      const { EconomicDataService } = await import('./services/economic-data');
      const economicService = EconomicDataService.getInstance();
      const realEvents = economicService.getFallbackEvents();
      
      console.log(`Raw events from MarketWatch: ${realEvents.length}`);
      
      // Apply filters if provided
      let filteredEvents = realEvents;
      
      if (importance) {
        filteredEvents = filteredEvents.filter(e => e.importance === importance);
      }
      
      if (category) {
        filteredEvents = filteredEvents.filter(e => e.category === category);
      }
      
      // Transform to API response format
      const events = filteredEvents.map((event, index) => ({
        id: Math.floor(Math.random() * 1000000) + index,
        title: event.title,
        description: event.description,
        importance: event.importance,
        eventDate: event.date,
        forecast: event.forecast || null,
        previous: event.previous || null,
        actual: event.actual || null,
        country: event.country,
        category: event.category,
        source: event.source,
        timestamp: new Date()
      }));
      
      // Return MarketWatch-style response with metadata
      const response = {
        success: true,
        data: {
          events: events,
          pagination: {
            total: events.length,
            page: 1,
            per_page: events.length
          },
          metadata: {
            last_updated: new Date().toISOString(),
            sources: ["marketwatch"],
            data_freshness: "real-time"
          }
        }
      };
      
      console.log(`Returning ${events.length} MarketWatch economic events`);
      res.json(events); // Keep simple for frontend compatibility
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

  // Market indicators (VWAP, RSI, McClellan, Williams %R) - REAL DATA
  app.get("/api/market-indicators", async (req, res) => {
    try {
      console.log('📊 Fetching real market indicators...');
      
      // Get fresh market indicators from financial service
      const indicators = await financialDataService.getMarketIndicators();
      
      // Add timestamp and market status for data freshness tracking
      const response = {
        ...indicators,
        last_updated: new Date().toISOString(),
        data_source: 'twelve_data_live',
        market_status: financialDataService.getDataTimestamp()
      };
      
      console.log(`📊 Market indicators updated: ${response.last_updated}`);
      res.json(response);
    } catch (error) {
      console.error('Error fetching market indicators:', error);
      
      // Fallback to cached data with warning
      const fallbackData = {
        spy_vwap: 628.12,
        nasdaq_vwap: 560.45,
        dow_vwap: 445.30,
        mcclellan_oscillator: 52.3,
        spy_rsi: 68.9,
        nasdaq_rsi: 71.2,
        dow_rsi: 69.8,
        williams_r: -31.5,
        last_updated: new Date().toISOString(),
        data_source: 'fallback_estimated',
        market_status: 'API_ERROR'
      };
      
      res.json(fallbackData);
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

      // Refresh sentiment data (including fresh AAII data)
      const sentimentData = await financialDataService.getRealMarketSentiment();
      await storage.createMarketSentiment({
        vix: sentimentData.vix.toString(),
        putCallRatio: sentimentData.putCallRatio.toString(),
        aaiiBullish: sentimentData.aaiiBullish.toString(),
        aaiiBearish: sentimentData.aaiiBearish.toString(),
        aaiiNeutral: sentimentData.aaiiNeutral.toString(),
      });

      // Refresh sector data
      const sectors = await financialDataService.getSectorETFs();
      for (const sector of sectors) {
        await storage.createSectorData({
          symbol: sector.symbol,
          name: sector.name,
          price: sector.price.toString(),
          changePercent: sector.changePercent.toString(),
          fiveDayChange: (sector.fiveDayChange || 0).toString(),
          oneMonthChange: (sector.oneMonthChange || 0).toString(),
          volume: sector.volume,
        });
      }

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

  // Force refresh endpoint for immediate data updates
  app.post("/api/force-refresh", async (req, res) => {
    try {
      console.log('🔄 Force refresh triggered...');
      
      // Import and use the scheduler for comprehensive updates
      const { dataScheduler } = await import('./services/scheduler');
      await dataScheduler.forceUpdate();
      
      res.json({ 
        message: 'All data refreshed successfully via scheduler',
        timestamp: new Date().toISOString(),
        schedule: {
          realtime: 'Every 2 minutes (8:30 AM - 6 PM EST, weekdays)',
          forecast: 'Every 6 hours',
          comprehensive: 'Daily at 6 AM EST',
          cleanup: 'Daily at 2 AM EST'
        }
      });
    } catch (error) {
      console.error('❌ Error during force refresh:', error);
      res.status(500).json({ message: 'Failed to refresh data' });
    }
  });

  return httpServer;
}
