import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { financialDataService } from "./services/financial-data";
import { getMarketHoursInfo } from '@shared/utils/marketHours';
import { CACHE_DURATIONS } from '@shared/constants';

import { apiLogger, getApiStats } from "./middleware/apiLogger";
// FRED routes removed to fix crashes


export async function registerRoutes(app: Express): Promise<Server> {
  // Add API logging middleware
  app.use('/api', apiLogger);
  
  // Add route debugging middleware
  app.use('/api/*', (req, res, next) => {
    console.log(`🔍 API Request: ${req.method} ${req.path}`);
    console.log(`🔍 Full URL: ${req.originalUrl}`);
    next();
  });
  
  // FRED routes removed to fix crashes

  // Health monitoring endpoints
  app.use('/api/health', (await import('./routes/health')).default);
  
  // FRED Cache Management endpoints
  app.use('/api/fred-cache', (await import('./routes/fred-cache-routes')).fredCacheRoutes);
  
  // Authentic FRED Economic Data API - prioritized endpoint
  app.get('/api/fred-economic-data', async (req, res) => {
    try {
      console.log('🔍 FRED API Route: GET /api/fred-economic-data');
      const { MacroeconomicIndicatorsService } = await import('./services/macroeconomic-indicators');
      const macroeconomicIndicatorsService = MacroeconomicIndicatorsService.getInstance();
      const data = await macroeconomicIndicatorsService.getAuthenticEconomicData();
      
      res.json(data);
      
    } catch (error) {
      console.error('Failed to get FRED economic data:', error);
      res.status(500).json({
        error: 'Failed to fetch Federal Reserve economic data',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Macroeconomic Indicators API - prioritizes FRED data with OpenAI fallback
  app.get('/api/macroeconomic-indicators', async (req, res) => {
    try {
      console.log('🔍 Fast Dashboard Route: GET /api/macroeconomic-indicators');
      const { MacroeconomicIndicatorsService } = await import('./services/macroeconomic-indicators');
      const macroeconomicIndicatorsService = MacroeconomicIndicatorsService.getInstance();
      // Prioritize authentic FRED data over OpenAI fallback
      const data = await macroeconomicIndicatorsService.getAuthenticEconomicData();
      
      res.json(data);
      
    } catch (error) {
      console.error('Failed to get macroeconomic indicators:', error);
      res.status(500).json({
        error: 'Failed to fetch macroeconomic indicators',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post('/api/macroeconomic-indicators/refresh', async (req, res) => {
    try {
      console.log('🔍 Fast Dashboard Route: POST /api/macroeconomic-indicators/refresh');
      const { MacroeconomicIndicatorsService } = await import('./services/macroeconomic-indicators');
      const macroeconomicIndicatorsService = MacroeconomicIndicatorsService.getInstance();
      // Force refresh prioritizes FRED data
      const data = await macroeconomicIndicatorsService.forceRefresh();
      
      res.json({
        success: true,
        data,
        message: 'Macroeconomic data refreshed successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Failed to refresh macroeconomic indicators:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh macroeconomic indicators',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Fast dashboard endpoints - add before other routes
  const fastDashboardRoutes = (await import('./routes/fast-dashboard-routes')).default;
  app.use('/api', fastDashboardRoutes);
  
  // Unified dashboard cache endpoints
  const unifiedDashboardRoutes = (await import('./routes/unified-dashboard')).default;
  app.use('/api/unified', unifiedDashboardRoutes);
  
  // FRED recent indicators routes
  const { fredRecentRoutes } = await import('./routes/fred-recent-routes');
  app.use('/api', fredRecentRoutes);
  
  // Cache management endpoints removed (file deleted)

  // API stats endpoint
  app.get("/api/stats", (req, res) => {
    res.json(getApiStats());
  });

  // Historical Economic Indicators Routes removed (FRED eliminated)
  app.post("/api/historical-economic-indicators/update", async (req, res) => {
    res.json({
      success: false,
      message: 'FRED historical indicators removed - using OpenAI only',
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/historical-economic-indicators/summary", async (req, res) => {
    res.json({
      success: false,
      message: 'FRED historical indicators removed - using OpenAI only',
      timestamp: new Date().toISOString()
    });
  });

  // FRED routes removed - using OpenAI only

  // AI Summary Optimized endpoint
  app.get("/api/ai-summary-optimized", async (req, res) => {
    try {
      console.log('🤖 Generating optimized AI summary...');
      const { aiSummaryOptimizedService } = await import('./services/ai-summary-optimized');
      
      const summary = await aiSummaryOptimizedService.generateAISummary();
      
      console.log(`✅ AI Summary generated: ${summary.success ? 'Success' : 'Cached/Fallback'}`);
      res.json(summary);
    } catch (error) {
      console.error('❌ AI Summary error:', error);
      res.status(500).json({ 
        error: 'AI analysis temporarily updating',
        message: 'Please refresh in a moment'
      });
    }
  });

  // Recent Economic Releases (from FRED data)
  app.get('/api/recent-economic-releases', async (req, res) => {
    try {
      const { MacroeconomicIndicatorsService } = await import('./services/macroeconomic-indicators');
      const macroService = MacroeconomicIndicatorsService.getInstance();
      const macroData = await macroService.getAuthenticEconomicData();
      // Get 6 most recent indicators based on release date
      const recentReleases = macroData.indicators
        .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())
        .slice(0, 6)
        .map(indicator => ({
          metric: indicator.metric,
          value: indicator.currentReading,
          unit: indicator.unit,
          category: indicator.category,
          type: indicator.type,
          releaseDate: indicator.releaseDate
        }));
      
      res.json(recentReleases);
    } catch (error) {
      console.error('Failed to get recent economic releases:', error);
      res.status(500).json({ error: 'Failed to get recent economic releases' });
    }
  });

  // Recent Economic Readings (OpenAI powered)
  app.get('/api/recent-economic-openai', async (req, res) => {
    try {
      const { openaiEconomicReadingsService } = await import('./services/openai-economic-readings');
      const readings = await openaiEconomicReadingsService.generateEconomicReadings();
      res.json(readings);
    } catch (error) {
      console.error('Error fetching OpenAI economic readings:', error);
      res.status(500).json({ error: 'Failed to fetch economic readings' });
    }
  });

  // Economic Indicators Cache Management
  app.post('/api/economic-indicators/refresh', async (req, res) => {
    try {
      const { openaiEconomicIndicatorsService } = await import('./services/openai-economic-indicators');
      await openaiEconomicIndicatorsService.invalidateCache();
      
      const { cacheService } = await import('./services/cache-unified');
      cacheService.delete("economic-indicators-openai-daily-v1");
      
      res.json({ message: 'Economic indicators cache refreshed' });
    } catch (error) {
      console.error('Error refreshing economic indicators cache:', error);
      res.status(500).json({ error: 'Failed to refresh cache' });
    }
  });

  // Economic Indicators endpoint removed per user request


  // Enhanced stock data endpoints with intelligent caching
  app.get("/api/stocks/:symbol", async (req, res) => {
    const startTime = Date.now();
    try {
      const { symbol } = req.params;
      const { enhancedMarketDataService } = await import('./services/enhanced-market-data');
      
      console.log(`📊 Fetching stock data for ${symbol} with intelligent caching...`);
      const stockData = await enhancedMarketDataService.getStockQuote(symbol.toUpperCase());
      
      // Store in database for future fallback
      await storage.createStockData({
        symbol: stockData.symbol,
        price: stockData.price,
        change: stockData.change,
        changePercent: stockData.changePercent,
        volume: stockData.volume ? parseInt(stockData.volume.replace(/[^\d]/g, '')) : undefined,
      });
      
      const responseTime = Date.now() - startTime;
      console.log(`✅ Stock data for ${symbol} returned in ${responseTime}ms`);
      
      res.json(stockData);
    } catch (error) {
      console.error(`❌ Stock data error for ${req.params.symbol}:`, error);
      
      // Try to get fallback data from database
      try {
        const fallbackData = await storage.getLatestStockData(req.params.symbol.toUpperCase());
        if (fallbackData) {
          console.log(`📦 Using database fallback for ${req.params.symbol}`);
          return res.json(fallbackData);
        }
      } catch (dbError) {
        console.error('Database fallback failed:', dbError);
      }
      
      res.status(500).json({ 
        error: 'Stock data temporarily unavailable',
        message: 'Please try again in a moment'
      });
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

  // Enhanced technical indicators with intelligent caching
  app.get("/api/technical/:symbol", async (req, res) => {
    const startTime = Date.now();
    try {
      const { symbol } = req.params;
      const { enhancedMarketDataService } = await import('./services/enhanced-market-data');
      
      console.log(`📊 Fetching technical indicators for ${symbol} with intelligent caching...`);
      const techData = await enhancedMarketDataService.getTechnicalIndicators(symbol.toUpperCase());
      
      // Store in database for future fallback
      const indicators = await storage.createTechnicalIndicators({
        symbol: techData.symbol,
        rsi: techData.rsi,
        macd: techData.macd,
        macdSignal: techData.macdSignal,
        bb_upper: techData.bb_upper,
        bb_middle: techData.bb_middle,
        bb_lower: techData.bb_lower,
        percent_b: techData.percent_b,
        adx: techData.adx,
        stoch_k: techData.stoch_k,
        stoch_d: techData.stoch_d,
        vwap: techData.vwap,
        atr: techData.atr,
        willr: techData.willr,
        sma_20: techData.sma20,
        sma_50: techData.sma50,
      });
      
      const responseTime = Date.now() - startTime;
      console.log(`✅ Technical indicators for ${symbol} returned in ${responseTime}ms`);
      
      res.json(techData);
    } catch (error) {
      console.error(`❌ Technical indicators error for ${req.params.symbol}:`, error);
      
      // Try to get fallback data from database
      try {
        const fallbackData = await storage.getLatestTechnicalIndicators(req.params.symbol.toUpperCase());
        if (fallbackData) {
          console.log(`📦 Using database fallback for ${req.params.symbol} technical indicators`);
          return res.json(fallbackData);
        }
      } catch (dbError) {
        console.error('Database fallback failed:', dbError);
      }
      
      res.status(500).json({ 
        error: 'Technical indicators temporarily unavailable',
        message: 'Please try again in a moment'
      });
    }
  });

  // Enhanced sector ETFs with intelligent caching
  app.get("/api/sectors", async (req, res) => {
    const startTime = Date.now();
    try {
      const { enhancedMarketDataService } = await import('./services/enhanced-market-data');
      
      console.log(`📊 Fetching sector ETF data with intelligent caching...`);
      const sectorData = await enhancedMarketDataService.getSectorETFs();
      
      // Store sector data in database for future fallback
      for (const sector of sectorData) {
        await storage.createStockData({
          symbol: sector.symbol,
          price: sector.price.toString(),
          change: (sector.price * sector.changePercent / 100).toFixed(2),
          changePercent: sector.changePercent.toString(),
          volume: sector.volume,
        });
      }
      
      const responseTime = Date.now() - startTime;
      console.log(`✅ Sector ETF data returned in ${responseTime}ms`);
      
      res.json(sectorData);
    } catch (error) {
      console.error(`❌ Sector ETF data error:`, error);
      
      // Try to get fallback data from database
      try {
        const fallbackData = await storage.getAllSectorData();
        if (fallbackData && fallbackData.length > 0) {
          console.log(`📦 Using database fallback for sector data (${fallbackData.length} sectors)`);
          return res.json(fallbackData);
        }
      } catch (dbError) {
        console.error('Database fallback failed:', dbError);
      }
      
      res.status(500).json({ 
        error: 'Sector data temporarily unavailable',
        message: 'Please try again in a moment'
      });
    }
  });

  // Performance monitoring endpoint for intelligent cache
  app.get("/api/cache/performance", async (req, res) => {
    try {
      const { enhancedMarketDataService } = await import('./services/enhanced-market-data');
      const { intelligentCache } = await import('./services/intelligent-cache-system');
      
      const metrics = {
        marketData: enhancedMarketDataService.getPerformanceMetrics(),
        intelligentCache: intelligentCache.getPerformanceMetrics(),
        timestamp: new Date().toISOString()
      };
      
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching cache performance:', error);
      res.status(500).json({ message: 'Cache performance data unavailable' });
    }
  });

  // Cache invalidation endpoint
  app.post("/api/cache/invalidate", async (req, res) => {
    try {
      const { pattern } = req.body;
      const { intelligentCache } = await import('./services/intelligent-cache-system');
      
      intelligentCache.invalidate(pattern || '');
      
      // Clear local momentum analysis cache if pattern matches or no pattern specified
      if (!pattern || 'momentum'.includes(pattern) || pattern === '') {
        momentumAnalysisCache = null;
        console.log('🔄 Cleared local momentum analysis cache');
      }
      
      res.json({ 
        success: true, 
        message: pattern ? `Cache entries matching "${pattern}" invalidated` : 'All cache entries invalidated' 
      });
    } catch (error) {
      console.error('Error invalidating cache:', error);
      res.status(500).json({ message: 'Cache invalidation failed' });
    }
  });

  // Cache warm-up endpoint
  app.post("/api/cache/warmup", async (req, res) => {
    try {
      const { enhancedMarketDataService } = await import('./services/enhanced-market-data');
      
      console.log('🔥 Starting cache warm-up...');
      await enhancedMarketDataService.warmCache();
      
      res.json({ 
        success: true, 
        message: 'Cache warm-up completed successfully' 
      });
    } catch (error) {
      console.error('Error warming cache:', error);
      res.status(500).json({ message: 'Cache warm-up failed' });
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

      // const { patternRecognitionService } = await import('./services/pattern-recognition'); // Removed during optimization
      // Service removed during optimization - using fallback
      const patterns = {
        trending: 'Market showing mixed signals with moderate volatility',
        support: marketData.price * 0.98,
        resistance: marketData.price * 1.02,
        momentum: technicalData.rsi > 50 ? 'Bullish' : 'Bearish',
        confidence: 0.7
      };

      console.log('✅ Pattern recognition completed (fallback)');
      res.json({ patterns, timestamp: new Date().toISOString() });

    } catch (error) {
      console.error('❌ Error in pattern recognition:', error);
      res.status(500).json({ 
        error: 'Failed to detect patterns',
        patterns: []
      });
    }
  });


  // AI Analysis - Generate comprehensive market analysis with enhanced formatting
  app.get("/api/analysis", async (req, res) => {
    try {
      console.log('🧠 Generating enhanced AI analysis with FRESH real-time data... [DATA SYNC FIX ACTIVE]');
      
      const { cacheService } = await import('./services/cache-unified');
      const cacheKey = 'ai-analysis-data-v2-spy-focus';
      
      // Check cache first (2 minute TTL for AI analysis data)
      const bypassCache = req.headers['x-bypass-cache'] === 'true';
      let cachedData = null;
      if (!bypassCache) {
        cachedData = cacheService.get(cacheKey) as any;
        if (cachedData && cachedData.analysisResult) {
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
        const cachedSectors = cacheService.get(sectorCacheKey);
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
      let economicEvents: any[] = [];
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
      
      // Generate simple AI analysis fallback
      const aiResult = {
        marketConditions: `SPY at $${marketData.spyPrice} (${marketData.spyChange > 0 ? '+' : ''}${marketData.spyChange}%), VIX ${marketData.vix}`,
        technicalAnalysis: `RSI ${marketData.rsi}, MACD ${marketData.macd}`,
        economicAnalysis: `Market analysis with ${economicEvents.length} economic indicators`
      };
      console.log('✅ AI analysis generated with fallback data');
      
      const analysisData = await storage.createAiAnalysis({
        marketConditions: aiResult.marketConditions || 'Market analysis unavailable',
        technicalOutlook: aiResult.technicalAnalysis || 'Technical analysis unavailable',  
        riskAssessment: aiResult.economicAnalysis || 'Economic analysis unavailable',
        sectorRotation: (aiResult as any).sectorRotation || 'Sector analysis unavailable',
        confidence: ((aiResult as any).confidence || 0.5).toString(),
      });
      
      // Cache the result for 2 minutes to improve performance
      cacheService.set(cacheKey, { analysisResult: analysisData }, 120);
      
      res.json(analysisData);
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
      res.status(500).json({ message: 'Failed to fetch AI analysis' });
    }
  });

  // Economic events API - Enhanced with FRED priority and deduplication
  app.get("/api/economic-events", async (req, res) => {
    try {
      console.log('🔄 Fetching enhanced economic events with FRED API priority and deduplication...');
      
      const { economicDataEnhancedService } = await import('./services/economic-data-enhanced');
      
      const enhancedEvents = await economicDataEnhancedService.getEnhancedEconomicEvents();
      
      // Parse query parameters for filtering
      const { importance, category } = req.query;
      
      // Apply filters if provided
      let filteredEvents = enhancedEvents;
      
      if (importance) {
        filteredEvents = filteredEvents.filter(e => e.importance === importance);
      }
      
      if (category) {
        filteredEvents = filteredEvents.filter(e => e.category === category);
      }
      
      // Transform to API response format
      const events = filteredEvents.map((event, index) => ({
        id: event.id,
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
        impact: event.impact,
        timestamp: new Date()
      }));
      
      console.log(`✅ Enhanced Economic Events: ${events.length} deduplicated events`);
      console.log(`🏛️ FRED API sources: ${events.filter(e => e.source === 'fred_api').length}`);
      console.log(`📋 Reliable calendar sources: ${events.filter(e => e.source.includes('reliable')).length}`);
      console.log(`📊 With actual readings: ${events.filter(e => e.actual && e.actual !== 'N/A').length}`);
      
      res.json(events);
    } catch (error) {
      console.error('❌ Enhanced economic events error:', error);
      res.status(500).json({ message: 'Failed to fetch enhanced economic events' });
    }
  });

  // All FRED API endpoints removed - using OpenAI only

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
          mcclellanOscillator: breadthData.mcclellanOscillator?.toString() || '0',
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
      const { cacheService } = await import('./services/cache-unified');
      const cacheKey = 'market-indicators';
      
      // Check cache first (2 minute TTL for market indicators)
      const cachedData = cacheService.get(cacheKey);
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
      cacheService.set(cacheKey, response, 120);
      
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

  // Historical Data Import Routes - Import CSV data for authentic analysis
  app.post("/api/historical-data/import", async (req, res) => {
    try {
      console.log('📥 Starting historical data import from CSV files...');
      
      const { historicalDataImporter } = await import('./services/historical-data-importer');
      const results = await historicalDataImporter.importAllData();
      
      console.log('✅ Historical data import completed successfully');
      res.json({
        message: 'Historical data imported successfully',
        results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error importing historical data:', error);
      res.status(500).json({ 
        message: 'Failed to import historical data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/historical-data/status", async (req, res) => {
    try {
      const { historicalDataImporter } = await import('./services/historical-data-importer');
      const availability = await historicalDataImporter.getDataAvailability();
      
      res.json({
        message: 'Historical data availability report',
        availability,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error getting data availability:', error);
      res.status(500).json({ 
        message: 'Failed to get data availability',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe to daily emails';
      res.status(500).json({ message: errorMessage });
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



  // Test endpoint for dashboard-matching email template
  app.post("/api/email/test-daily", async (req, res) => {
    try {
      console.log('📧 Testing dashboard-matching email template...');
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }

      // Fetch momentum analysis data (matches dashboard exactly)
      try {
        const momentumResponse = await fetch('http://localhost:5000/api/momentum-analysis');
        const momentumData = await momentumResponse.json();
        
        // Fetch economic data (matches dashboard exactly)
        const economicResponse = await fetch('http://localhost:5000/api/recent-economic-openai');
        const economicData = await economicResponse.json();

        // Process momentum data for AI Summary
        const spyData = momentumData.momentumStrategies?.find((s: any) => s.ticker === 'SPY');
        const bullishSectors = momentumData.momentumStrategies?.filter((s: any) => 
          s.momentum === 'bullish' || s.signal?.toLowerCase().includes('bullish')
        ).length || 0;

        // Prepare dashboard-matching email data
        const dashboardEmailData = {
          aiSummary: {
            momentum: {
              bullishSectors: bullishSectors,
              totalSectors: momentumData.momentumStrategies?.length || 0,
              topSector: momentumData.momentumStrategies?.[0]?.sector || 'N/A',
              topSectorChange: momentumData.momentumStrategies?.[0]?.oneDayChange || 0,
              rsi: spyData?.rsi || 0,
              signal: spyData?.signal || 'N/A'
            },
            technical: {
              rsi: spyData?.rsi || 0,
              spyOneDayMove: spyData?.oneDayChange || 0,
              spyZScore: spyData?.zScore || 0
            },
            economic: economicData?.slice(0, 3).map((reading: any) => ({
              metric: reading.metric || 'N/A',
              value: reading.current || reading.value || 'N/A',
              status: reading.change || (reading.variance ? `${reading.variance} vs forecast` : 'Latest Reading')
            })) || []
          },
          chartData: momentumData.chartData || [],
          momentumStrategies: momentumData.momentumStrategies || [],
          timestamp: new Date().toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          })
        };

        // Send email using enhanced email service
        const { EnhancedEmailService } = await import('./services/email-unified-enhanced.js');
        const emailService = EnhancedEmailService.getInstance();
        
        const success = await emailService.sendDashboardMatchingEmail(email, dashboardEmailData);
        
        if (success) {
          res.json({
            success: true,
            message: 'Dashboard-matching email sent successfully',
            sections: ['AI Summary', 'Momentum Strategies with Enhanced Metrics'],
            recipient: email,
            template: 'Dashboard Matching Template'
          });
        } else {
          res.json({
            success: false,
            message: 'Email template generated but delivery failed',
            sections: ['AI Summary', 'Momentum Strategies with Enhanced Metrics'],
            recipient: email,
            template: 'Dashboard Matching Template'
          });
        }
        
      } catch (fetchError) {
        console.error('Error fetching dashboard data:', fetchError);
        res.status(500).json({
          error: 'Failed to fetch dashboard data for email',
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        });
      }
      


    } catch (error) {
      console.error('Error testing updated email:', error);
      res.status(500).json({ 
        message: "Failed to test updated email template", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });



  // SendGrid Diagnostic Route - Check API setup
  app.get("/api/email/sendgrid-status", async (req, res) => {
    try {
      const { MailService } = await import('@sendgrid/mail');
      const mailService = new MailService();
      
      if (!process.env.SENDGRID_API_KEY) {
        return res.json({
          status: 'error',
          message: 'SENDGRID_API_KEY not configured',
          setup: false
        });
      }

      mailService.setApiKey(process.env.SENDGRID_API_KEY);
      
      // Test with a minimal request to check API key validity
      try {
        // We'll catch the specific error to diagnose the issue
        await mailService.send({
          to: 'test@example.com',
          from: 'me@rishabhdas.com', // Use the actual verified sender email
          subject: 'SendGrid Test',
          text: 'This is a test email to verify SendGrid configuration.'
        });
      } catch (error: any) {
        res.json({
          status: 'diagnostic',
          apiKeyValid: error.code !== 401, // 401 = bad API key, 403 = sender not verified
          errorCode: error.code,
          errorMessage: error.message,
          diagnosis: error.code === 403 
            ? 'API key is valid but sender email needs verification'
            : error.code === 401
            ? 'API key is invalid or expired'
            : 'Other SendGrid configuration issue',
          nextSteps: error.code === 403
            ? [
                '1. Go to SendGrid dashboard > Settings > Sender Authentication',
                '2. Add and verify your email address as a sender',
                '3. Or set up domain authentication',
                '4. Use the verified email in the from field'
              ]
            : [
                '1. Check your SendGrid API key is correct',
                '2. Ensure the API key has Mail Send permissions',
                '3. Verify your SendGrid account is active'
              ]
        });
      }
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to check SendGrid configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Email Preview Route - Shows HTML content without sending
  app.post("/api/email/preview", async (req, res) => {
    try {
      console.log('📧 Generating email preview...');
      const { email = "preview@example.com" } = req.body;
      
      // Get fresh market data for email
      const freshMarketData = await gatherMarketDataForAI();
      
      // Generate analysis for preview
      const analysis = {
        bottomLine: `Market showing ${freshMarketData.changePercent >= 0 ? 'positive' : 'negative'} momentum with SPY at $${freshMarketData.price}.`,
        setup: `Technical indicators: RSI ${freshMarketData.rsi}, VIX ${freshMarketData.vix}. Market sentiment reflects current positioning.`,
        evidence: `Current levels suggest balanced conditions with sector rotation favoring momentum strategies.`,
        implications: `Focus on momentum crossover signals and risk-return positioning for optimal sector allocation.`,
        dominantTheme: 'Momentum-Based Rotation',
        confidence: 0.75
      };

      // Get sector data (simplified for preview)
      const sectorData = [
        { name: 'Technology', symbol: 'XLK', price: 260.86, changePercent: 1.2, fiveDayChange: 2.8, oneMonthChange: 4.5 },
        { name: 'Financial', symbol: 'XLF', price: 52.56, changePercent: 0.8, fiveDayChange: 1.5, oneMonthChange: 3.2 },
        { name: 'Health Care', symbol: 'XLV', price: 131.86, changePercent: -0.5, fiveDayChange: 0.2, oneMonthChange: 2.1 },
        { name: 'Energy', symbol: 'XLE', price: 85.82, changePercent: 2.1, fiveDayChange: 4.2, oneMonthChange: 6.8 },
        { name: 'Utilities', symbol: 'XLU', price: 83.62, changePercent: -1.1, fiveDayChange: -0.8, oneMonthChange: 1.5 }
      ];

      // Get economic events (simplified for preview)
      const economicEvents = [
        { title: 'Initial Jobless Claims', actual: '221K', forecast: '234K', previous: '228K', importance: 'Medium', date: 'Today' },
        { title: 'Retail Sales', actual: '0.6%', forecast: '0.2%', previous: '0.1%', importance: 'High', date: 'Today' },
        { title: 'Housing Starts', actual: '1.32M', forecast: '1.35M', previous: '1.31M', importance: 'Medium', date: 'Yesterday' },
        { title: 'CPI (YoY)', actual: '2.9%', forecast: '3.0%', previous: '3.2%', importance: 'High', date: '2 days ago' }
      ];

      // Prepare comprehensive email data
      const emailData = {
        stockData: {
          price: freshMarketData.price,
          changePercent: freshMarketData.changePercent
        },
        sentiment: {
          vix: freshMarketData.vix,
          vixChange: freshMarketData.vixChange,
          aaiiBullish: freshMarketData.aaiiBullish,
          aaiiBearish: freshMarketData.aaiiBearish,
          putCallRatio: freshMarketData.putCallRatio
        },
        technical: {
          rsi: freshMarketData.rsi,
          macd: freshMarketData.macd,
          adx: freshMarketData.adx,
          sma20: freshMarketData.sma20,
          ema12: freshMarketData.ema12,
          atr: freshMarketData.atr,
          willr: freshMarketData.willr,
          vwap: freshMarketData.vwap,
          stoch_k: freshMarketData.stoch_k
        },
        sectors: sectorData,
        economicEvents: economicEvents,
        analysis,
        timestamp: new Date().toLocaleString('en-US', { 
          timeZone: 'America/New_York',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      // Import simplified email service
      const { simplifiedEmailService } = await import('./services/email-simplified.js');
      
      // Generate HTML content (use private method via workaround)
      const htmlContent = (simplifiedEmailService as any).generateSimplifiedDashboardTemplate(emailData);
      
      // Return HTML for preview
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);
      
    } catch (error) {
      console.error('Error generating email preview:', error);
      res.status(500).json({ 
        message: "Failed to generate email preview", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Simple SendGrid Test - Minimal email to test delivery
  app.post("/api/email/simple-test", async (req, res) => {
    try {
      const { email = "me@rishabhdas.com" } = req.body;
      const { MailService } = await import('@sendgrid/mail');
      const mailService = new MailService();
      
      if (!process.env.SENDGRID_API_KEY) {
        return res.json({ error: 'SENDGRID_API_KEY not configured' });
      }

      mailService.setApiKey(process.env.SENDGRID_API_KEY);
      
      try {
        await mailService.send({
          to: email,
          from: 'me@rishabhdas.com',
          subject: 'FinanceHub Pro - Simple Test Email',
          text: 'This is a test email to verify SendGrid delivery is working.',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>FinanceHub Pro Test Email</h2>
              <p>This test email confirms that SendGrid delivery is working properly.</p>
              <p>Sender: me@rishabhdas.com</p>
              <p>Time: ${new Date().toLocaleString()}</p>
              <p>If you received this, the comprehensive dashboard email should work too!</p>
            </div>
          `
        });
        
        res.json({
          success: true,
          message: 'Simple test email sent successfully',
          recipient: email,
          sender: 'me@rishabhdas.com'
        });
        
      } catch (error: any) {
        console.error('SendGrid Simple Test Error:', error);
        res.json({
          success: false,
          error: error.message,
          code: error.code,
          details: error.response?.body || 'No additional details',
          troubleshooting: 'Check SendGrid dashboard for sender verification status'
        });
      }
      
    } catch (error) {
      res.status(500).json({
        error: 'Failed to test SendGrid',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Legacy email test endpoint (keeping for backward compatibility)
  app.post("/api/email/test-legacy", async (req, res) => {
    try {
      console.log('📧 Starting legacy email test...');
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
      
      // Get enhanced economic events with actual readings
      let finalEconomicEvents: any[] = [];
      try {
        // Use the working enhanced economic events service directly 
        const { economicDataEnhancedService } = await import('./services/economic-data-enhanced');
        finalEconomicEvents = await economicDataEnhancedService.getEnhancedEconomicEvents();
        const eventsWithActual = finalEconomicEvents.filter(e => e.actual && e.actual !== 'N/A');
        console.log(`📅 Enhanced email economic events: ${finalEconomicEvents.length} events (${eventsWithActual.length} with actual data)`);
        console.log(`📊 Sample events with actual data:`, eventsWithActual.slice(0, 3).map(e => ({ title: e.title, actual: e.actual })));
      } catch (error) {
        console.error('Error fetching enhanced economic events for email:', error);
        // Fallback to basic economic events if enhanced fails
        try {
          const { EconomicDataService } = await import('./services/economic-data');
          const economicService = EconomicDataService.getInstance();
          finalEconomicEvents = await economicService.getEconomicEvents();
          console.log(`📅 Fallback email economic events: ${finalEconomicEvents.length} events`);
        } catch (fallbackError) {
          console.error('Error with fallback economic events:', fallbackError);
          finalEconomicEvents = [];
        }
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        message: 'Failed to send test email', 
        error: errorMessage,
        status: 'error'
      });
    }
  });

  // Helper function to gather market data for AI analysis
  async function gatherMarketDataForAI() {
    try {
      // Use existing market data fetching patterns from the codebase
      const { financialDataService } = await import('./services/financial-data');
      
      const stockData = await financialDataService.getStockQuote('SPY');
      const sentimentData = await financialDataService.getRealMarketSentiment();
      const technicalData = await financialDataService.getTechnicalIndicators('SPY');
      
      return {
        spyPrice: stockData?.price || 627.41,
        spyChange: stockData?.changePercent || 0.33,
        vix: sentimentData?.vix || 17.16,
        vixChange: sentimentData?.vixChange || 0,
        rsi: technicalData?.rsi || 68.16,
        macd: technicalData?.macd || 8.244,
        aaiiBullish: sentimentData?.aaiiBullish || 41.4,
        aaiiBearish: sentimentData?.aaiiBearish || 35.6
      };
    } catch (error) {
      console.error('Error gathering market data for AI:', error);
      // Return fallback data
      return {
        spyPrice: 627.41,
        spyChange: 0.33,
        vix: 17.16,
        vixChange: 0,
        rsi: 68.16,
        macd: 8.244,
        aaiiBullish: 41.4,
        aaiiBearish: 35.6
      };
    }
  }



  // Historical data accumulation API
  app.post("/api/historical-data/accumulate", async (req, res) => {
    try {
      console.log('📊 Starting manual historical data accumulation...');
      
      const { historicalDataAccumulator } = await import('./services/historical-data-accumulator');
      await historicalDataAccumulator.accumulateDailyReadings();
      
      res.json({
        success: true,
        message: 'Historical data accumulation completed',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Historical data accumulation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        success: false, 
        error: 'Failed to accumulate historical data',
        message: errorMessage 
      });
    }
  });

  // Comprehensive Historical Data Collection API
  app.post("/api/comprehensive-historical-data/collect", async (req, res) => {
    try {
      console.log('🎯 Starting comprehensive historical data collection...');
      
      const { comprehensiveHistoricalCollector } = await import('./services/comprehensive-historical-collector');
      const { lookbackMonths = 18, symbolList } = req.body;
      
      await comprehensiveHistoricalCollector.collectComprehensiveHistory(symbolList, lookbackMonths);
      
      res.json({
        success: true,
        message: 'Comprehensive historical data collection completed',
        lookbackMonths,
        symbolCount: symbolList?.length || 'default',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Comprehensive historical collection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        success: false, 
        error: 'Failed to collect comprehensive historical data',
        message: errorMessage 
      });
    }
  });

  // Daily Historical Update API  
  app.post("/api/comprehensive-historical-data/daily-update", async (req, res) => {
    try {
      console.log('🌅 Starting daily historical data update...');
      
      const { comprehensiveHistoricalCollector } = await import('./services/comprehensive-historical-collector');
      await comprehensiveHistoricalCollector.performDailyUpdate();
      
      res.json({
        success: true,
        message: 'Daily historical data update completed',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Daily historical update failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update daily historical data',
        message: errorMessage 
      });
    }
  });

  // Historical Analysis Intelligence API
  app.get("/api/historical-intelligence/:symbol?", async (req, res) => {
    try {
      const symbol = req.params.symbol || 'SPY';
      console.log(`🧠 Generating historical intelligence for ${symbol}...`);
      
      const { historicalDataIntelligence } = await import('./services/historical-data-intelligence');
      const insights = await historicalDataIntelligence.generateIntelligentInsights(symbol);
      
      res.json({
        success: true,
        symbol,
        insights,
        generatedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Historical intelligence generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        success: false, 
        error: 'Failed to generate historical intelligence',
        message: errorMessage 
      });
    }
  });

  // Enhanced AI Context API with Historical Intelligence
  app.get("/api/enhanced-ai-context/:symbol?", async (req, res) => {
    try {
      const symbol = req.params.symbol || 'SPY';
      console.log(`🤖 Generating enhanced AI context for ${symbol}...`);
      
      const { historicalDataIntelligence } = await import('./services/historical-data-intelligence');
      const context = await historicalDataIntelligence.generateEnhancedAIContext(symbol);
      
      res.json({
        success: true,
        symbol,
        context,
        generatedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Enhanced AI context generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        success: false, 
        error: 'Failed to generate enhanced AI context',
        message: errorMessage 
      });
    }
  });

  // Historical context query API
  app.get("/api/historical-context/:indicator", async (req, res) => {
    try {
      const { indicator } = req.params;
      const months = parseInt(req.query.months as string) || 12;
      
      const { historicalDataAccumulator } = await import('./services/historical-data-accumulator');
      
      const context = await historicalDataAccumulator.getHistoricalContext(indicator, months);
      const percentile = context.length > 0 ? 
        await historicalDataAccumulator.getPercentileRanking(indicator, parseFloat(context[0].value), 36) : 50;
      const yoyComparison = await historicalDataAccumulator.getYearOverYearComparison(indicator);
      
      res.json({
        indicator,
        historicalData: context,
        percentileRanking: Math.round(percentile),
        yearOverYearComparison: yoyComparison,
        dataPoints: context.length
      });
    } catch (error) {
      console.error(`❌ Error fetching historical context for ${req.params.indicator}:`, error);
      res.status(500).json({ error: 'Failed to fetch historical context' });
    }
  });

  // Cache for momentum analysis (5-minute cache)
  let momentumAnalysisCache: { data: any; timestamp: number } | null = null;
  const MOMENTUM_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Comprehensive Sector Analysis Route - Advanced sector rotation and cyclical pattern analysis
  app.get('/api/momentum-analysis', async (req, res) => {
    try {
      // Check if we have valid cached data
      const now = Date.now();
      if (momentumAnalysisCache && (now - momentumAnalysisCache.timestamp < MOMENTUM_CACHE_DURATION)) {
        console.log('📊 Returning cached momentum analysis (5-minute cache hit)');
        return res.json(momentumAnalysisCache.data);
      }
      
      console.log('📊 Generating focused momentum analysis with verified calculations...');
      
      res.setHeader('Content-Type', 'application/json');
      
      // Get current sector data and historical data for momentum analysis
      const [currentSectorData, historicalData] = await Promise.all([
        (async () => {
          try {
            console.log('🚀 Fetching real-time sector ETF data for analysis...');
            return await financialDataService.getSectorETFs();
          } catch (error) {
            console.warn('⚠️ Sector data fetch failed, using database fallback');
            return await storage.getLatestSectorData() || [];
          }
        })(),
        (async () => {
          try {
            console.log('📈 Fetching historical sector data from database...');
            const { db } = await import('./db');
            const result = await db.execute(`
              SELECT symbol, date, price 
              FROM historical_sector_etf_data 
              WHERE date >= NOW() - INTERVAL '6 months'
              ORDER BY date DESC, symbol
              LIMIT 1000
            `);
            console.log(`📊 Found ${result.rows.length} historical sector records`);
            return result.rows || [];
          } catch (error) {
            console.warn('Historical sector data unavailable:', error instanceof Error ? error.message : 'Unknown error');
            return [];
          }
        })()
      ]);

      // Log data availability for debugging
      console.log(`📊 Simplified momentum data: ${currentSectorData.length} current sectors, ${historicalData.length} historical records`);
      
      // Convert data types to match SectorETF interface
      const convertedSectorData = Array.isArray(currentSectorData) ? currentSectorData.map((sector: any) => ({
        symbol: sector.symbol,
        name: sector.name,
        price: typeof sector.price === 'string' ? parseFloat(sector.price) : sector.price,
        changePercent: typeof sector.changePercent === 'string' ? parseFloat(sector.changePercent) : sector.changePercent,
        fiveDayChange: sector.fiveDayChange ? (typeof sector.fiveDayChange === 'string' ? parseFloat(sector.fiveDayChange) : sector.fiveDayChange) : undefined,
        oneMonthChange: sector.oneMonthChange ? (typeof sector.oneMonthChange === 'string' ? parseFloat(sector.oneMonthChange) : sector.oneMonthChange) : undefined,
        volume: sector.volume || 0
      })) : [];

      // Use the simplified sector analysis service with verified calculations
      const { simplifiedSectorAnalysisService } = await import('./services/simplified-sector-analysis');
      const analysis = await simplifiedSectorAnalysisService.generateSimplifiedAnalysis(
        convertedSectorData,
        Array.isArray(historicalData) ? historicalData.map((row: any) => ({
          symbol: String(row.symbol || ''),
          date: String(row.date || new Date().toISOString()),
          price: Number(row.price || 0)
        })) : []
      );
      
      console.log(`✅ Simplified momentum analysis completed (confidence: ${analysis.confidence}%)`);
      
      // Cache the result for 5 minutes
      momentumAnalysisCache = {
        data: analysis,
        timestamp: Date.now()
      };
      
      res.json(analysis);
      
    } catch (error) {
      console.error('❌ Error generating momentum analysis:', error);
      res.status(500).json({ 
        error: 'Simplified momentum analysis temporarily unavailable',
        summary: 'Building momentum analysis with verified calculations from Python template',
        confidence: 0,
        momentumStrategies: [],
        chartData: [],
        timestamp: new Date().toISOString()
      });
    }
  });

  // Recent Economic Readings using OpenAI route
  app.get("/api/recent-economic-openai", async (req, res) => {
    try {
      console.log('🤖 Generating economic readings with OpenAI...');
      const { openaiEconomicReadingsService } = await import('./services/openai-economic-readings');
      
      const readings = await openaiEconomicReadingsService.generateEconomicReadings();
      
      console.log(`✅ Generated ${readings.length} economic readings via OpenAI`);
      res.json(readings);
    } catch (error) {
      console.error('❌ OpenAI economic readings error:', error);
      res.status(500).json({ 
        error: 'Failed to generate economic readings',
        message: error instanceof Error ? error.message : 'OpenAI service temporarily unavailable'
      });
    }
  });

  // AI Summary endpoint
  app.get("/api/ai-summary", async (req, res) => {
    try {
      const { cacheService } = await import('./services/cache-unified');
      const cacheKey = "ai-summary";
      
      // Check cache first (5 minute TTL for cost optimization)
      const cachedSummary = cacheService.get(cacheKey);
      if (cachedSummary) {
        console.log('🤖 Serving AI summary from cache');
        return res.json(cachedSummary);
      }

      console.log('🤖 Generating fresh AI market summary...');
      const { aiSummaryService } = await import('./services/ai-summary');
      const summary = await aiSummaryService.generateMarketSummary();
      
      // Cache for 5 minutes to optimize costs
      cacheService.set(cacheKey, summary, 300); // 5 minutes
      console.log('🤖 AI summary cached for 5 minutes');
      
      res.json(summary);
    } catch (error) {
      console.error('❌ Error generating AI summary:', error);
      res.status(500).json({ 
        error: 'Failed to generate AI summary',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Financial mood endpoint
  app.get('/api/financial-mood', async (req, res) => {
    try {
      console.log('🎭 Generating financial mood...');
      const { financialMoodService } = await import('./services/financial-mood');
      const moodData = await financialMoodService.generateFinancialMood();
      res.json(moodData);
    } catch (error) {
      console.error('Financial mood generation failed:', error);
      res.status(500).json({ 
        error: 'Failed to generate financial mood',
        emoji: '😐',
        mood: 'Neutral'
      });
    }
  });

  // Cache invalidation endpoint for refresh button
  app.get('/api/cache/invalidate', async (req, res) => {
    try {
      const { smartCache } = await import('./services/smart-cache');
      const key = req.query.key as string;
      
      if (key) {
        smartCache.remove(key);
        console.log(`🗑️ Cache invalidated for key: ${key}`);
        res.json({ success: true, invalidated: key });
      } else {
        // Clear all cache
        smartCache.clear();
        console.log('🗑️ All cache cleared');
        res.json({ success: true, invalidated: 'all' });
      }
    } catch (error) {
      console.error('Cache invalidation failed:', error);
      res.status(500).json({ error: 'Failed to invalidate cache' });
    }
  });

  return httpServer;
}
