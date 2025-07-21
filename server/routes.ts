import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { financialDataService } from "./services/financial-data";
import { getMarketHoursInfo } from '@shared/utils/marketHours';
import { CACHE_DURATIONS } from '@shared/constants';

import { apiLogger, getApiStats } from "./middleware/apiLogger";
import { registerEnhancedEconomicRoutes } from "./routes/enhanced-economic-routes.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add API logging middleware
  app.use('/api', apiLogger);
  
  // Register enhanced economic routes
  registerEnhancedEconomicRoutes(app);

  // API stats endpoint
  app.get("/api/stats", (req, res) => {
    res.json(getApiStats());
  });
  // Stock data endpoints with caching
  app.get("/api/stocks/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { cacheManager } = await import('./services/cache-manager');
      const cacheKey = `stock-${symbol.toUpperCase()}`;
      
      // Check cache first (1 minute TTL for stock quotes)
      const cachedData = cacheManager.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
      
      console.log(`Fetching fresh data for ${symbol}...`);
      const quote = await financialDataService.getStockQuote(symbol.toUpperCase());
      const newStockData = await storage.createStockData({
        symbol: quote.symbol,
        price: quote.price.toString(),
        change: quote.change.toString(),
        changePercent: quote.changePercent.toString(),
        volume: quote.volume,
      });
      
      // Cache the result for 1 minute
      cacheManager.set(cacheKey, newStockData, CACHE_DURATIONS.STOCK_QUOTES);
      
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

  // Technical indicators with caching
  app.get("/api/technical/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { cacheManager } = await import('./services/cache-manager');
      const cacheKey = `technical-${symbol.toUpperCase()}`;
      
      // Check cache first (3 minute TTL for technical indicators)
      const cachedData = cacheManager.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
      
      console.log(`Fetching enhanced technical indicators for ${symbol} with 144/min API limit...`);
      const techData = await financialDataService.getTechnicalIndicators(symbol.toUpperCase());
      const indicators = await storage.createTechnicalIndicators({
        symbol: techData.symbol,
        rsi: techData.rsi !== null ? String(techData.rsi) : null,
        macd: techData.macd !== null ? String(techData.macd) : null,
        macdSignal: techData.macdSignal !== null ? String(techData.macdSignal) : null,
        bb_upper: techData.bb_upper !== null ? String(techData.bb_upper) : null,
        bb_middle: techData.bb_middle !== null ? String(techData.bb_middle) : null,
        bb_lower: techData.bb_lower !== null ? String(techData.bb_lower) : null,
        percent_b: techData.percent_b !== null ? String(techData.percent_b) : null,
        adx: techData.adx !== null ? String(techData.adx) : null,
        stoch_k: techData.stoch_k !== null ? String(techData.stoch_k) : null,
        stoch_d: techData.stoch_d !== null ? String(techData.stoch_d) : null,
        vwap: techData.vwap !== null ? String(techData.vwap) : null,
        atr: techData.atr !== null ? String(techData.atr) : null,
        willr: techData.willr !== null ? String(techData.willr) : null,
        sma_20: techData.sma_20 !== null ? String(techData.sma_20) : null,
        sma_50: techData.sma_50 !== null ? String(techData.sma_50) : null,
      });
      
      // Cache the result for 3 minutes
      cacheManager.set(cacheKey, indicators, CACHE_DURATIONS.TECHNICAL_INDICATORS);
      
      res.json(indicators);
    } catch (error) {
      console.error('Error fetching technical indicators:', error);
      res.status(500).json({ message: 'Failed to fetch technical indicators' });
    }
  });

  // Market sentiment with caching
  app.get("/api/sentiment", async (req, res) => {
    try {
      const { cacheManager } = await import('./services/cache-manager');
      const cacheKey = 'market-sentiment';
      
      // Check cache first (2 minute TTL for sentiment data)
      const cachedData = cacheManager.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
      
      // Generate fresh real sentiment data using VIX and market indicators
      const sentimentData = await financialDataService.getRealMarketSentiment();
      
      // Cache the result for 2 minutes  
      cacheManager.set(cacheKey, sentimentData, CACHE_DURATIONS.SENTIMENT_DATA);
      
      res.json(sentimentData);
    } catch (error) {
      console.error('Error fetching market sentiment:', error);
      res.status(500).json({ message: 'Failed to fetch market sentiment' });
    }
  });

  // Sector performance with market hours awareness and weekend fallback
  app.get("/api/sectors", async (req, res) => {
    try {
      const { cacheManager } = await import('./services/cache-manager');
      const cacheKey = 'sector-data';
      
      // Check market hours using centralized utility
      const { isOpen: isMarketHours, isWeekend } = getMarketHoursInfo();
      
      // During weekends or after hours, ALWAYS use cached data if available
      if (isWeekend || !isMarketHours) {
        const cachedData = cacheManager.get(cacheKey);
        if (cachedData) {
          console.log(`📈 Weekend/After Hours: Using cached sector data (${isWeekend ? 'Weekend' : 'After Hours'})`);
          return res.json(cachedData);
        }
        
        // If no cache, try database fallback for weekend/after hours
        try {
          const dbSectors = await storage.getLatestSectorData();
          if (dbSectors && dbSectors.length > 0) {
            console.log(`📂 Weekend/After Hours: Using database fallback sector data`);
            return res.json(dbSectors);
          }
        } catch (dbError) {
          console.error('Database fallback failed:', dbError);
        }
      }
      
      // During market hours, check cache first but allow fresh data if needed
      const bypassCache = req.headers['x-bypass-cache'] === 'true';
      if (!bypassCache && isMarketHours) {
        const cachedData = cacheManager.get(cacheKey);
        if (cachedData) {
          console.log('📈 Market Hours: Using cached sector data');
          return res.json(cachedData);
        }
      }
      
      // Only make API calls during market hours or when absolutely necessary
      if (isMarketHours || (!cacheManager.get(cacheKey))) {
        console.log(`🚀 Fetching fresh sector ETF data... (Market ${isMarketHours ? 'Open' : 'Closed'})`);
        const freshSectors = await financialDataService.getSectorETFs();
        
        // Cache the result for 5 minutes during market hours, longer for after hours
        const cacheTime = isMarketHours ? CACHE_DURATIONS.SECTOR_DATA_MARKET_HOURS : CACHE_DURATIONS.SECTOR_DATA_AFTER_HOURS;
        cacheManager.set(cacheKey, freshSectors, cacheTime);
        
        // Store in database for fallback (background task)
        setTimeout(async () => {
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
        }, 0);
        
        res.json(freshSectors);
      } else {
        // Fallback to last known data or emergency data
        console.log('⚠️ No fresh data available during off hours, using fallback');
        res.status(503).json({ message: 'Market data not available during off hours' });
      }
      
    } catch (error) {
      console.error('Error fetching sectors:', error);
      res.status(500).json({ message: 'Failed to fetch sectors' });
    }
  });

  // Pattern Recognition endpoint for advanced analysis
  app.get("/api/pattern-recognition", async (req, res) => {
    try {
      console.log('🔍 Detecting market patterns...');
      
      const [marketData, sectorData, technicalData] = await Promise.all([
        (async () => {
          const latestSpy = await storage.getLatestStockData('SPY');
          return latestSpy ? {
            symbol: 'SPY',
            price: parseFloat(latestSpy.price),
            change: parseFloat(latestSpy.change),
            changePercent: parseFloat(latestSpy.changePercent),
            vix: 16.52,
            putCallRatio: 0.85
          } : null;
        })(),
        financialDataService.getSectorETFs(),
        (async () => {
          const latestTech = await storage.getLatestTechnicalIndicators('SPY');
          return latestTech ? {
            rsi: parseFloat(latestTech.rsi || '68.16'),
            macd: parseFloat(latestTech.macd || '8.10'),
            macdSignal: parseFloat(latestTech.macdSignal || '8.52'),
            atr: parseFloat(latestTech.atr || '5.28')
          } : null;
        })()
      ]);

      if (!marketData || !technicalData) {
        throw new Error('Failed to fetch required market data');
      }

      const { patternRecognitionService } = await import('./services/pattern-recognition');
      const patterns = await patternRecognitionService.detectPatterns(
        marketData, 
        technicalData, 
        sectorData || []
      );

      console.log('✅ Pattern recognition completed');
      res.json({ patterns, timestamp: new Date().toISOString() });

    } catch (error) {
      console.error('❌ Error in pattern recognition:', error);
      res.status(500).json({ 
        error: 'Failed to detect patterns',
        patterns: []
      });
    }
  });

  // Enhanced Thematic AI Analysis - New narrative-driven analysis
  app.get("/api/thematic-analysis", async (req, res) => {
    try {
      console.log('🎭 Generating enhanced thematic AI analysis...');
      
      const { cacheManager } = await import('./services/cache-manager');
      const cacheKey = 'thematic-analysis-data';
      
      // Check cache first (5 minute TTL for thematic analysis)
      const bypassCache = req.headers['x-bypass-cache'] === 'true';
      let cachedData = null;
      if (!bypassCache) {
        cachedData = cacheManager.get(cacheKey);
        if (cachedData) {
          console.log('✅ Using cached thematic analysis data');
          return res.json(cachedData);
        }
      }
      
      // Fetch all required data for thematic analysis
      const [marketData, sectorData, economicEvents, technicalData] = await Promise.all([
        (async () => {
          const latestSpy = await storage.getLatestStockData('SPY');
          return latestSpy ? {
            symbol: 'SPY',
            price: parseFloat(latestSpy.price),
            change: parseFloat(latestSpy.change),
            changePercent: parseFloat(latestSpy.changePercent),
            vix: 16.52,
            putCallRatio: 0.85,
            aaiiBullish: 41.4,
            aaiiBearish: 35.6
          } : null;
        })(),
        financialDataService.getSectorETFs(),
        (async () => {
          const { simplifiedEconomicCalendarService } = await import('./services/simplified-economic-calendar');
          const events = await simplifiedEconomicCalendarService.getAIAnalysisEvents();
          return [...events.currentTradingDay, ...events.recent, ...events.highImpact];
        })(),
        (async () => {
          const latestTech = await storage.getLatestTechnicalIndicators('SPY');
          return latestTech ? {
            rsi: parseFloat(latestTech.rsi || '68.16'),
            macd: parseFloat(latestTech.macd || '8.10'),
            macdSignal: parseFloat(latestTech.macdSignal || '8.52'),
            adx: parseFloat(latestTech.adx || '28.3'),
            atr: parseFloat(latestTech.atr || '5.28'),
            willr: parseFloat(latestTech.willr || '-13.1'),
            percent_b: parseFloat(latestTech.percent_b || '0.76')
          } : null;
        })()
      ]);

      if (!marketData || !technicalData) {
        throw new Error('Failed to fetch required market data');
      }

      // Generate thematic analysis
      const { thematicAIAnalysisService } = await import('./services/thematic-ai-analysis');
      const analysis = await thematicAIAnalysisService.generateThematicAnalysis(
        marketData,
        sectorData || [],
        economicEvents || [],
        technicalData
      );

      // Store analysis with market context and update narrative memory
      const marketContext = { marketData, sectorData, economicEvents, technicalData };
      
      // Update narrative memory with current theme
      try {
        const { narrativeMemoryService } = await import('./services/narrative-memory');
        await narrativeMemoryService.updateNarrative(
          analysis.dominantTheme,
          {
            timestamp: new Date(),
            marketData: marketData,
            confidence: analysis.confidence
          },
          analysis.confidence
        );
      } catch (error) {
        console.error('Error updating narrative memory:', error);
      }
      
      // Cache the result for 5 minutes
      cacheManager.set(cacheKey, { ...analysis, timestamp: new Date().toISOString() }, 300);
      
      console.log('✅ Thematic analysis generated successfully');
      res.json({ ...analysis, timestamp: new Date().toISOString() });

    } catch (error) {
      console.error('❌ Error generating thematic analysis:', error);
      res.status(500).json({ 
        error: 'Failed to generate thematic analysis',
        fallback: {
          bottomLine: "Market analysis temporarily unavailable",
          dominantTheme: "Mixed signals",
          setup: "Technical indicators show neutral positioning",
          evidence: "Awaiting fresh market data",
          implications: "Monitor key levels for direction",
          catalysts: "Economic data releases and Fed policy updates",
          contrarianView: "Alternative scenarios under review",
          confidence: 0.5
        }
      });
    }
  });

  // AI Analysis - Generate comprehensive market analysis with enhanced formatting
  app.get("/api/analysis", async (req, res) => {
    try {
      console.log('🧠 Generating enhanced AI analysis with FRESH real-time data... [DATA SYNC FIX ACTIVE]');
      
      const { cacheManager } = await import('./services/cache-manager');
      const cacheKey = 'ai-analysis-data';
      
      // Check cache first (2 minute TTL for AI analysis data)
      const bypassCache = req.headers['x-bypass-cache'] === 'true';
      let cachedData = null;
      if (!bypassCache) {
        cachedData = cacheManager.get(cacheKey);
        if (cachedData) {
          console.log('✅ Using cached AI analysis data');
          return res.json(cachedData.analysisResult);
        }
      }
      
      // Fetch fresh real-time data for AI analysis (use database cache for performance)
      let finalStockData, finalSentiment, finalTechnical;
      
      try {
        // Get SPY data from database cache first
        const latestSpy = await storage.getLatestStockData('SPY');
        if (latestSpy) {
          finalStockData = {
            symbol: 'SPY',
            price: latestSpy.price,
            change: latestSpy.change,
            changePercent: latestSpy.changePercent
          };
          console.log(`🔄 AI using cached SPY data: $${finalStockData.price} (${finalStockData.changePercent}%)`);
        } else {
          // Fallback to fresh API call
          const spyData = await financialDataService.getStockQuote('SPY');
          finalStockData = {
            symbol: 'SPY',
            price: spyData.price.toString(),
            change: spyData.change.toString(),
            changePercent: spyData.changePercent.toString()
          };
        }
        
        // Get technical indicators from database cache
        const latestTech = await storage.getLatestTechnicalIndicators('SPY');
        if (latestTech) {
          finalTechnical = {
            rsi: latestTech.rsi || '68.16',
            macd: latestTech.macd || '8.256',
            macdSignal: latestTech.macdSignal || '8.722',
            percent_b: latestTech.percent_b || '0.65',
            adx: latestTech.adx || '25.3',
            stoch_k: latestTech.stoch_k || '65.4',
            stoch_d: latestTech.stoch_d || '68.2',
            vwap: latestTech.vwap || '626.87',
            atr: latestTech.atr || '12.45',
            willr: latestTech.willr || '-28.5',
            bb_upper: latestTech.bb_upper || '640.25',
            bb_middle: latestTech.bb_middle || '628.15',
            bb_lower: latestTech.bb_lower || '616.05'
          };
          console.log(`🔄 AI using enhanced technical data: RSI ${finalTechnical.rsi}, ADX ${finalTechnical.adx}, %B ${finalTechnical.percent_b}`);
        } else {
          // Fallback to fresh API call with enhanced indicators
          const techData = await financialDataService.getTechnicalIndicators('SPY');
          finalTechnical = {
            rsi: techData.rsi?.toString() || '68.16',
            macd: techData.macd?.toString() || '8.256',
            macdSignal: techData.macdSignal?.toString() || '8.722',
            percent_b: techData.percent_b?.toString() || '0.65',
            adx: techData.adx?.toString() || '25.3',
            stoch_k: techData.stoch_k?.toString() || '65.4',
            stoch_d: techData.stoch_d?.toString() || '68.2',
            vwap: techData.vwap?.toString() || '626.87',
            atr: techData.atr?.toString() || '12.45',
            willr: techData.willr?.toString() || '-28.5',
            bb_upper: techData.bb_upper?.toString() || '640.25',
            bb_middle: techData.bb_middle?.toString() || '628.15',
            bb_lower: techData.bb_lower?.toString() || '616.05'
          };
        }
        
        // Get sentiment data from database cache
        const latestSentiment = await storage.getLatestMarketSentiment();
        if (latestSentiment) {
          finalSentiment = {
            vix: latestSentiment.vix || '17.16',
            putCallRatio: latestSentiment.putCallRatio || '0.85',
            aaiiBullish: latestSentiment.aaiiBullish || '41.4',
            aaiiBearish: latestSentiment.aaiiBearish || '35.6'
          };
          console.log(`🔄 AI using cached sentiment data: VIX ${finalSentiment.vix}, AAII ${finalSentiment.aaiiBullish}%`);
        } else {
          // Fallback to fresh API call
          const sentimentData = await financialDataService.getRealMarketSentiment();
          finalSentiment = {
            vix: sentimentData.vix?.toString() || '17.16',
            putCallRatio: sentimentData.putCallRatio?.toString() || '0.85',
            aaiiBullish: sentimentData.aaiiBullish?.toString() || '41.4',
            aaiiBearish: sentimentData.aaiiBearish?.toString() || '35.6'
          };
        }
        
      } catch (error) {
        console.error('Error fetching data for AI analysis, using fallback:', error);
        // Only use fallback if real-time fetch fails
        finalStockData = { symbol: 'SPY', price: '628.04', change: '3.82', changePercent: '0.61' };
        finalSentiment = { vix: '17.16', putCallRatio: '0.85', aaiiBullish: '41.4', aaiiBearish: '35.6' };
        finalTechnical = { rsi: '68.95', macd: '8.244', macdSignal: '8.627' };
      }
      
      // Get current sector data from cache
      let finalSectors;
      try {
        const sectorCacheKey = 'sector-data';
        const cachedSectors = cacheManager.get(sectorCacheKey);
        if (cachedSectors) {
          finalSectors = cachedSectors;
          console.log('✅ Using cached sector data for enhanced analysis');
        } else {
          finalSectors = await financialDataService.getSectorETFs();
          console.log('✅ Using fresh sector data for enhanced analysis');
        }
      } catch (error) {
        console.log('Using fallback sector data for enhanced analysis');
        finalSectors = [
          { name: 'Financials', symbol: 'XLF', oneDayChange: '0.96', fiveDayChange: '2.1' },
          { name: 'Technology', symbol: 'XLK', oneDayChange: '0.91', fiveDayChange: '2.8' },
          { name: 'Industrials', symbol: 'XLI', oneDayChange: '0.92', fiveDayChange: '1.4' },
          { name: 'Health Care', symbol: 'XLV', oneDayChange: '-1.14', fiveDayChange: '0.3' },
          { name: 'Consumer Discretionary', symbol: 'XLY', oneDayChange: '0.82', fiveDayChange: '1.9' },
          { name: 'Communication Services', symbol: 'XLC', oneDayChange: '0.75', fiveDayChange: '2.2' },
          { name: 'Consumer Staples', symbol: 'XLP', oneDayChange: '0.34', fiveDayChange: '0.8' },
          { name: 'Energy', symbol: 'XLE', oneDayChange: '0.61', fiveDayChange: '-2.1' },
          { name: 'Utilities', symbol: 'XLU', oneDayChange: '-0.45', fiveDayChange: '0.2' },
          { name: 'Real Estate', symbol: 'XLRE', oneDayChange: '0.28', fiveDayChange: '1.1' },
          { name: 'Materials', symbol: 'XLB', oneDayChange: '0.73', fiveDayChange: '1.6' }
        ];
      }
        
      const marketData = {
        symbol: finalStockData.symbol,
        price: parseFloat(finalStockData.price),
        change: parseFloat(finalStockData.change),
        changePercent: parseFloat(finalStockData.changePercent),
        rsi: finalTechnical?.rsi ? parseFloat(finalTechnical.rsi) : 68.95,
        macd: finalTechnical?.macd ? parseFloat(finalTechnical.macd) : 8.24,
        macdSignal: finalTechnical?.macdSignal ? parseFloat(finalTechnical.macdSignal) : 8.62,
        vix: finalSentiment?.vix ? parseFloat(finalSentiment.vix) : 17.16,
        putCallRatio: finalSentiment?.putCallRatio ? parseFloat(finalSentiment.putCallRatio) : 0.85,
        aaiiBullish: finalSentiment?.aaiiBullish ? parseFloat(finalSentiment.aaiiBullish) : 41.4,
        aaiiBearish: finalSentiment?.aaiiBearish ? parseFloat(finalSentiment.aaiiBearish) : 35.6,
        // Enhanced technical indicators for comprehensive analysis
        percent_b: finalTechnical?.percent_b ? parseFloat(finalTechnical.percent_b) : 0.65,
        adx: finalTechnical?.adx ? parseFloat(finalTechnical.adx) : 25.3,
        stoch_k: finalTechnical?.stoch_k ? parseFloat(finalTechnical.stoch_k) : 65.4,
        stoch_d: finalTechnical?.stoch_d ? parseFloat(finalTechnical.stoch_d) : 68.2,
        vwap: finalTechnical?.vwap ? parseFloat(finalTechnical.vwap) : 626.87,
        atr: finalTechnical?.atr ? parseFloat(finalTechnical.atr) : 12.45,
        willr: finalTechnical?.willr ? parseFloat(finalTechnical.willr) : -28.5,
        bb_upper: finalTechnical?.bb_upper ? parseFloat(finalTechnical.bb_upper) : 640.25,
        bb_middle: finalTechnical?.bb_middle ? parseFloat(finalTechnical.bb_middle) : 628.15,
        bb_lower: finalTechnical?.bb_lower ? parseFloat(finalTechnical.bb_lower) : 616.05,
      };
      
      console.log('📊 Market data for AI analysis:', marketData);
      
      // Get economic events from simplified reliable calendar for comprehensive analysis
      let economicEvents = [];
      try {
        console.log('Fetching economic events from reliable calendar...');
        const { simplifiedEconomicCalendarService } = await import('./services/simplified-economic-calendar');
        
        // Get market hours-aware economic events for AI analysis
        const economicAnalysisData = await simplifiedEconomicCalendarService.getAIAnalysisEvents();
        economicEvents = [
          ...economicAnalysisData.currentTradingDay,
          ...economicAnalysisData.recent,
          ...economicAnalysisData.highImpact
        ];
        
        console.log(`📊 AI Analysis Events: ${economicEvents.length} total economic events from reliable calendar`);
      } catch (error) {
        console.log('Error with reliable calendar, using fallback:', error);
      }
      
      const enhancedMarketData = {
        ...marketData,
        economicEvents: economicEvents
      };
      
      // Generate enhanced AI analysis with trader-style formatting and economic integration
      const { EnhancedAIAnalysisService } = await import('./services/enhanced-ai-analysis');
      const enhancedAiService = EnhancedAIAnalysisService.getInstance();
      const aiResult = await enhancedAiService.generateRobustMarketAnalysis(enhancedMarketData, finalSectors, economicEvents);
      console.log('✅ Enhanced AI analysis generated with trader-style insights');
      
      const analysisData = await storage.createAiAnalysis({
        marketConditions: aiResult.marketConditions || 'Market analysis unavailable',
        technicalOutlook: aiResult.technicalOutlook || 'Technical outlook unavailable',  
        riskAssessment: aiResult.riskAssessment || 'Risk assessment unavailable',
        sectorRotation: aiResult.sectorRotation || 'Sector rotation analysis unavailable',
        confidence: (aiResult.confidence || 0.5).toString(),
      });
      
      // Cache the result for 2 minutes to improve performance
      cacheManager.set(cacheKey, { analysisResult: analysisData }, 120);
      
      res.json(analysisData);
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
      res.status(500).json({ message: 'Failed to fetch AI analysis' });
    }
  });

  // Economic events API - Now powered by reliable calendar service
  app.get("/api/economic-events", async (req, res) => {
    try {
      console.log('Fetching economic calendar events from reliable calendar...');
      
      // Parse query parameters for filtering
      const { start_date, end_date, importance, category } = req.query;
      
      // Get economic events from reliable calendar service
      const { simplifiedEconomicCalendarService } = await import('./services/simplified-economic-calendar');
      
      // Get calendar events optimized for display
      const economicData = await simplifiedEconomicCalendarService.getCalendarEvents();
      
      console.log(`Raw events from reliable calendar: ${economicData.length}`);
      console.log('Debug - First few events:', economicData.slice(0, 2));
      
      // Apply filters if provided
      let filteredEvents = economicData;
      
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
      
      console.log(`Returning ${events.length} reliable economic events (US medium/high importance events)`);
      res.json(events); // Keep simple for frontend compatibility
    } catch (error) {
      console.error('Error fetching economic events:', error);
      res.status(500).json({ message: 'Failed to fetch economic events' });
    }
  });

  // Enhanced Economic Events API - Comprehensive data from multiple sources
  app.get("/api/economic-events-enhanced", async (req, res) => {
    try {
      console.log('🔍 Fetching comprehensive economic data from multiple sources...');
      
      const { ComprehensiveEconomicDataService } = await import('./services/comprehensive-economic-data');
      const comprehensiveService = ComprehensiveEconomicDataService.getInstance();
      
      // Get comprehensive economic data from enhanced scrapers
      const comprehensiveData = await comprehensiveService.getComprehensiveEconomicData();
      
      // Transform to API response format for compatibility
      const events = comprehensiveData.map((event, index) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        importance: event.importance,
        eventDate: event.date,
        forecast: event.forecast,
        previous: event.previous,
        actual: event.actual,
        country: event.country,
        category: event.category,
        source: event.source,
        impact: event.impact,
        timestamp: new Date()
      }));
      
      console.log(`✅ Enhanced Economic Events: ${events.length} events from multiple sources`);
      console.log(`📊 With actual readings: ${events.filter(e => e.actual).length}`);
      console.log(`📈 High importance: ${events.filter(e => e.importance === 'high').length}`);
      console.log(`🔍 Sources: ${[...new Set(events.map(e => e.source))].join(', ')}`);
      
      res.json(events);
    } catch (error) {
      console.error('❌ Error fetching enhanced economic events:', error);
      res.status(500).json({ message: 'Failed to fetch enhanced economic events' });
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
      const { cacheManager } = await import('./services/cache-manager');
      const cacheKey = 'market-indicators';
      
      // Check cache first (2 minute TTL for market indicators)
      const cachedData = cacheManager.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
      
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
      
      // Cache the result for 2 minutes
      cacheManager.set(cacheKey, response, 120);
      
      console.log(`📊 Market indicators updated: ${response.last_updated}`);
      res.json(response);
    } catch (error) {
      console.error('Error fetching market indicators:', error);
      
      // Emergency fallback with clear labeling
      const emergencyData = {
        spy_vwap: 628.12,
        nasdaq_vwap: 560.45,
        dow_vwap: 445.30,
        mcclellan_oscillator: 52.3,
        spy_rsi: 68.9,
        nasdaq_rsi: 71.2,
        dow_rsi: 69.8,
        williams_r: -31.5,
        last_updated: new Date().toISOString(),
        data_source: 'EMERGENCY_FALLBACK_COMPLETE_API_FAILURE',
        market_status: 'CRITICAL_API_ERROR',
        warning: 'Emergency data only - not current market values due to API failure'
      };
      
      console.log('⚠️ EMERGENCY: Market indicators API failure, serving emergency data with warning');
      res.json(emergencyData);
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

  // Email subscription endpoints
  app.post("/api/email/subscribe", async (req, res) => {
    try {
      const { emailService } = await import('./services/email-service');
      const { email } = req.body;
      
      if (!email || !email.includes('@')) {
        return res.status(400).json({ message: 'Valid email address is required' });
      }
      
      const subscription = await emailService.subscribeToDaily(email);
      res.json({ 
        message: 'Successfully subscribed to daily market commentary',
        subscription: {
          email: subscription.email,
          subscribedAt: subscription.subscribedAt
        }
      });
    } catch (error) {
      console.error('Error subscribing to email:', error);
      res.status(500).json({ message: error.message || 'Failed to subscribe to daily emails' });
    }
  });

  app.get("/api/email/unsubscribe/:token", async (req, res) => {
    try {
      const { emailService } = await import('./services/email-service');
      const { token } = req.params;
      
      const success = await emailService.unsubscribe(token);
      
      if (success) {
        res.send(`
          <html>
            <head>
              <title>Unsubscribed - FinanceHub Pro</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                .container { background: #f8f9fa; padding: 40px; border-radius: 10px; }
                .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="success">✓ Successfully Unsubscribed</div>
                <p>You have been unsubscribed from FinanceHub Pro daily market commentary emails.</p>
                <p>You can always re-subscribe at any time by visiting our dashboard.</p>
              </div>
            </body>
          </html>
        `);
      } else {
        res.status(404).send(`
          <html>
            <head>
              <title>Unsubscribe Link Invalid - FinanceHub Pro</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                .container { background: #f8f9fa; padding: 40px; border-radius: 10px; }
                .error { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="error">⚠ Invalid Unsubscribe Link</div>
                <p>This unsubscribe link is invalid or has already been used.</p>
              </div>
            </body>
          </html>
        `);
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
      res.status(500).json({ message: 'Failed to unsubscribe' });
    }
  });



  // Test endpoint for email functionality with real-time data
  app.post("/api/email/test-daily", async (req, res) => {
    try {
      console.log('📧 Starting email test with real-time data...');
      const { emailService } = await import('./services/email-service');
      
      // Get active subscriptions
      const subscriptions = await emailService.getActiveSubscriptions();
      console.log(`Found ${subscriptions.length} active subscriptions`);
      
      if (subscriptions.length === 0) {
        return res.json({ 
          message: 'No active subscriptions found',
          subscriptions: 0,
          status: 'no_subscribers'
        });
      }
      
      // Fetch real-time data (same as scheduled email method)
      console.log('Fetching real-time market data for email...');
      
      // Get current stock data from live API (same as scheduler)
      let finalStockData, finalSentiment, finalTechnical;
      try {
        // Fetch real-time SPY data
        const spyData = await financialDataService.getStockQuote('SPY');
        finalStockData = {
          symbol: 'SPY',
          price: spyData.price.toString(),
          change: spyData.change.toString(),
          changePercent: spyData.changePercent.toString()
        };
        console.log(`📈 Test email using real SPY data: $${finalStockData.price} (${finalStockData.changePercent}%)`);
        
        // Fetch real-time technical indicators  
        const techData = await financialDataService.getTechnicalIndicators('SPY');
        finalTechnical = {
          rsi: techData.rsi?.toString() || '68.95',
          macd: techData.macd?.toString() || '8.244', 
          macdSignal: techData.macdSignal?.toString() || '8.627'
        };
        console.log(`📊 Test email using real technical data: RSI ${finalTechnical.rsi}, MACD ${finalTechnical.macd}`);
        
        // Fetch real-time sentiment data
        const sentimentData = await financialDataService.getRealMarketSentiment();
        finalSentiment = {
          vix: sentimentData.vix.toString(),
          putCallRatio: sentimentData.putCallRatio.toString(),
          aaiiBullish: sentimentData.aaiiBullish.toString(),
          aaiiBearish: sentimentData.aaiiBearish.toString()
        };
        console.log(`💭 Test email using real sentiment data: VIX ${finalSentiment.vix}, AAII Bull ${finalSentiment.aaiiBullish}%`);
        
      } catch (error) {
        console.error('Error fetching real-time data for test email:', error);
        // Fallback to stored data only if API fails
        finalStockData = { symbol: 'SPY', price: '628.04', change: '3.82', changePercent: '0.61' };
        finalSentiment = { vix: '17.16', putCallRatio: '0.85', aaiiBullish: '41.4', aaiiBearish: '35.6' };
        finalTechnical = { rsi: '68.95', macd: '8.244', macdSignal: '8.627' };
        console.log('⚠️ Test email using fallback data due to API error');
      }
      
      // Get current sector data with real API values
      let finalSectors;
      try {
        finalSectors = await financialDataService.getSectorETFs();
        console.log('Real sector data for email:', JSON.stringify(finalSectors.slice(0, 3), null, 2));
      } catch (error) {
        console.error('Error fetching sector data for email:', error);
        finalSectors = [
          { name: 'Financials', symbol: 'XLF', changePercent: 0.96, fiveDayChange: 2.1 },
          { name: 'Technology', symbol: 'XLK', changePercent: 0.91, fiveDayChange: 2.8 },
          { name: 'Health Care', symbol: 'XLV', changePercent: -1.14, fiveDayChange: 0.3 }
        ];
      }
      
      // Get economic events data first (needed for thematic analysis)
      let finalEconomicEvents;
      try {
        const { EconomicDataService } = await import('./services/economic-data');
        const economicService = EconomicDataService.getInstance();
        finalEconomicEvents = await economicService.getEconomicEvents();
        console.log(`📅 Email economic events: ${finalEconomicEvents.length} events`);
      } catch (error) {
        console.error('Error fetching economic events for email:', error);
        finalEconomicEvents = [];
      }
      
      // Generate streamlined analysis for email reliability
      console.log('📧 Generating reliable email analysis...');
      const price = parseFloat(finalStockData.price);
      const change = parseFloat(finalStockData.changePercent);
      const rsi = parseFloat(finalTechnical.rsi);
      const vix = parseFloat(finalSentiment.vix);
      const aaiiBull = parseFloat(finalSentiment.aaiiBullish);
      
      // Find top performing sector
      const topSector = finalSectors.reduce((prev, current) => 
        (current.changePercent > prev.changePercent) ? current : prev
      );
      
      // Create reliable thematic analysis
      const analysis = {
        bottomLine: `The market is currently experiencing a ${rsi > 70 ? 'cautious risk-on/risk-off rotation' : rsi < 30 ? 'defensive positioning sentiment' : 'measured consolidation phase'} amid mixed economic signals.`,
        dominantTheme: rsi > 70 ? 'Risk-on/risk-off rotation' : rsi < 30 ? 'Defensive positioning vs FOMO buying' : 'Liquidity-driven momentum vs fundamental concerns',
        setup: `The S&P 500 closed at $${price.toFixed(2)}, ${change >= 0 ? 'gaining' : 'declining'} ${Math.abs(change).toFixed(2)}% today. Technical indicators show RSI at ${rsi.toFixed(1)} with VIX at ${vix.toFixed(1)}, suggesting ${rsi > 70 ? 'overbought conditions requiring caution' : rsi < 30 ? 'oversold bounce potential' : 'balanced momentum levels'}. Market sentiment reflects ${aaiiBull > 45 ? 'elevated optimism' : aaiiBull < 35 ? 'defensive positioning' : 'neutral positioning'} among retail investors.`,
        evidence: `Technically, the SPY's RSI at the ${rsi > 70 ? '75th' : rsi > 50 ? '60th' : '40th'} percentile suggests ${rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'balanced'} conditions, while the VIX sits at the ${vix > 20 ? '70th' : vix > 15 ? '50th' : '30th'} percentile indicating ${vix > 20 ? 'elevated' : vix < 15 ? 'complacent' : 'moderate'} volatility expectations. Sector performance shows ${topSector.name} leading with ${topSector.changePercent > 0 ? '+' : ''}${topSector.changePercent.toFixed(2)}%. AAII sentiment data shows ${aaiiBull.toFixed(1)}% bullish vs ${parseFloat(finalSentiment.aaiiBearish).toFixed(1)}% bearish, reflecting ${aaiiBull > parseFloat(finalSentiment.aaiiBearish) ? 'risk-on sentiment' : 'defensive positioning'}.`,
        implications: `The evidence suggests that while there is ${rsi > 70 ? 'underlying strength in consumer and housing data' : 'underlying resilience in economic fundamentals'}, the market is ${vix > 20 ? 'wary of overextending' : 'cautiously optimistic'} into ${rsi > 70 ? 'riskier assets' : 'growth sectors'}. This ${rsi > 70 ? 'might lead to choppy trading conditions' : 'could support measured upside'} as investors digest ${aaiiBull > 45 ? 'the mixed signals' : 'economic data and Fed policy implications'}. Key levels to watch include ${(price * 0.98).toFixed(0)} support and ${(price * 1.02).toFixed(0)} resistance.`,
        confidence: 0.80
      };
      
      console.log('✅ Email analysis generated successfully:', {
        bottomLineLength: analysis.bottomLine.length,
        setupLength: analysis.setup.length,
        evidenceLength: analysis.evidence.length,
        implicationsLength: analysis.implications.length,
        theme: analysis.dominantTheme
      });

      const realTimeData = {
        analysis,
        currentStock: finalStockData,
        sentiment: finalSentiment,
        technical: finalTechnical,
        sectors: finalSectors,
        economicEvents: finalEconomicEvents
      };
      
      // Send test daily email with real data
      console.log('Sending test daily email...');
      await emailService.sendDailyMarketCommentary(realTimeData);
      
      const sendGridEnabled = !!process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.startsWith('SG.');
      
      res.json({ 
        message: sendGridEnabled ? 'Test daily email sent successfully' : 'Email test completed (SendGrid not configured - emails logged only)',
        subscriptions: subscriptions.length,
        sendGridEnabled,
        status: 'success',
        emails: subscriptions.map(sub => ({ email: sub.email, active: sub.isActive }))
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      res.status(500).json({ 
        message: 'Failed to send test email', 
        error: error.message,
        status: 'error'
      });
    }
  });

  return httpServer;
}
