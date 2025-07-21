import type { Express } from "express";
import { ComprehensiveEconomicDataService } from '../services/comprehensive-economic-data.js';

export function registerEnhancedEconomicRoutes(app: Express): void {
  
  // Test endpoint for enhanced MarketWatch scraper
  app.get("/api/test/marketwatch-enhanced", async (req, res) => {
    try {
      console.log('🧪 Testing enhanced MarketWatch scraper...');
      
      const { EnhancedMarketWatchScraper } = await import('../services/enhanced-marketwatch-scraper');
      const scraper = EnhancedMarketWatchScraper.getInstance();
      
      const events = await scraper.scrapeComprehensiveData(7);
      
      res.json({
        success: true,
        eventsCount: events.length,
        actualReadings: events.filter(e => e.actual).length,
        sample: events.slice(0, 3),
        sources: Array.from(new Set(events.map(e => e.source)))
      });
    } catch (error) {
      console.error('❌ Enhanced MarketWatch test failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Enhanced MarketWatch scraper test failed' 
      });
    }
  });

  // Test endpoint for Investing.com scraper
  app.get("/api/test/investing-scraper", async (req, res) => {
    try {
      console.log('🧪 Testing Investing.com scraper...');
      
      const { InvestingComScraper } = await import('../services/investing-scraper');
      const scraper = InvestingComScraper.getInstance();
      
      const events = await scraper.scrapeEconomicCalendar('thisweek');
      
      res.json({
        success: true,
        eventsCount: events.length,
        usEvents: events.filter(e => e.country === 'US').length,
        mediumHighImportance: events.filter(e => e.importance !== 'low').length,
        sample: events.slice(0, 3),
        sources: Array.from(new Set(events.map(e => e.source)))
      });
    } catch (error) {
      console.error('❌ Investing.com test failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Investing.com scraper test failed' 
      });
    }
  });

  // Test endpoint for comprehensive data service
  app.get("/api/test/comprehensive-data", async (req, res) => {
    try {
      console.log('🧪 Testing comprehensive economic data service...');
      
      const comprehensiveService = ComprehensiveEconomicDataService.getInstance();
      const comprehensiveData = await comprehensiveService.getComprehensiveEconomicData();
      
      // Analytics
      const sourceAnalysis = comprehensiveData.reduce((acc, event) => {
        const source = event.source;
        if (!acc[source]) acc[source] = 0;
        acc[source]++;
        return acc;
      }, {} as Record<string, number>);

      const importanceAnalysis = comprehensiveData.reduce((acc, event) => {
        const importance = event.importance;
        if (!acc[importance]) acc[importance] = 0;
        acc[importance]++;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        totalEvents: comprehensiveData.length,
        withActualReadings: comprehensiveData.filter(e => e.actual).length,
        sourceBreakdown: sourceAnalysis,
        importanceBreakdown: importanceAnalysis,
        recentSample: comprehensiveData.slice(0, 5).map(e => ({
          title: e.title,
          actual: e.actual,
          forecast: e.forecast,
          source: e.source,
          importance: e.importance
        }))
      });
    } catch (error) {
      console.error('❌ Comprehensive data test failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Comprehensive economic data test failed' 
      });
    }
  });

  // Clear cache endpoint for testing
  app.post("/api/economic/clear-cache", async (req, res) => {
    try {
      console.log('🗑️ Clearing comprehensive economic data cache...');
      
      const comprehensiveService = ComprehensiveEconomicDataService.getInstance();
      comprehensiveService.clearCache();
      
      res.json({
        success: true,
        message: 'Comprehensive economic data cache cleared'
      });
    } catch (error) {
      console.error('❌ Cache clear failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to clear cache' 
      });
    }
  });

  // Enhanced economic data with fallback to original
  app.get("/api/economic-data/hybrid", async (req, res) => {
    try {
      console.log('🔄 Fetching hybrid economic data (enhanced + fallback)...');
      
      const comprehensiveService = ComprehensiveEconomicDataService.getInstance();
      let comprehensiveData: any[] = [];
      
      try {
        comprehensiveData = await comprehensiveService.getComprehensiveEconomicData();
      } catch (enhancedError) {
        console.warn('⚠️ Enhanced data failed, falling back to reliable calendar');
      }
      
      // If enhanced data is insufficient, supplement with reliable calendar
      if (comprehensiveData.length < 15) {
        console.log('📋 Supplementing with reliable calendar data...');
        
        const { simplifiedEconomicCalendarService } = await import('../services/simplified-economic-calendar');
        const reliableData = await simplifiedEconomicCalendarService.getCalendarEvents();
        
        // Add reliable data that's not already included
        const existingTitles = new Set(comprehensiveData.map(e => e.title.toLowerCase()));
        const supplementData = reliableData
          .filter(event => !existingTitles.has(event.title.toLowerCase()))
          .slice(0, 20 - comprehensiveData.length)
          .map(event => ({
            id: `reliable-${event.id}`,
            title: event.title,
            description: event.description,
            date: new Date(event.date),
            time: '8:30 AM ET',
            country: 'US',
            currency: 'USD',
            category: event.category,
            importance: event.importance as 'high' | 'medium' | 'low',
            actual: event.actual || null,
            forecast: event.forecast || null,
            previous: event.previous || null,
            impact: null,
            source: 'reliable_calendar_supplement'
          }));
        
        comprehensiveData = [...comprehensiveData, ...supplementData];
      }
      
      // Transform to API format
      const events = comprehensiveData.map((event, index) => ({
        id: typeof event.id === 'string' ? event.id : `hybrid-${index}`,
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
      
      console.log(`✅ Hybrid Economic Data: ${events.length} events total`);
      console.log(`📊 Sources: ${Array.from(new Set(events.map(e => e.source))).join(', ')}`);
      
      res.json(events);
    } catch (error) {
      console.error('❌ Hybrid economic data failed:', error);
      res.status(500).json({ message: 'Failed to fetch hybrid economic data' });
    }
  });
}