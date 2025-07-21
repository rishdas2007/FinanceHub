import type { Express } from "express";
import { comprehensiveFredApiService } from '../services/comprehensive-fred-api.js';

export function registerComprehensiveFredRoutes(app: Express): void {
  
  // Test endpoint for comprehensive FRED API
  app.get("/api/test/fred-comprehensive", async (req, res) => {
    try {
      console.log('🧪 Testing comprehensive FRED API (50+ indicators)...');
      
      const indicators = await comprehensiveFredApiService.getComprehensiveEconomicIndicators();
      
      // Analytics
      const categoryAnalysis = indicators.reduce((acc, indicator) => {
        const category = indicator.category;
        if (!acc[category]) acc[category] = 0;
        acc[category]++;
        return acc;
      }, {} as Record<string, number>);

      const importanceAnalysis = indicators.reduce((acc, indicator) => {
        const importance = indicator.importance;
        if (!acc[importance]) acc[importance] = 0;
        acc[importance]++;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        totalIndicators: indicators.length,
        withActualReadings: indicators.filter(i => i.latestValue && i.latestValue !== 'N/A').length,
        categoryBreakdown: categoryAnalysis,
        importanceBreakdown: importanceAnalysis,
        recentSample: indicators.slice(0, 10).map(i => ({
          title: i.title,
          latestValue: i.latestValue,
          category: i.category,
          importance: i.importance,
          monthlyChange: i.monthlyChange
        }))
      });
    } catch (error) {
      console.error('❌ Comprehensive FRED test failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Comprehensive FRED API test failed' 
      });
    }
  });

  // Get indicators by category
  app.get("/api/fred/category/:category", async (req, res) => {
    try {
      const { category } = req.params;
      console.log(`📊 Fetching FRED indicators for category: ${category}`);
      
      const indicators = await comprehensiveFredApiService.getIndicatorsByCategory(category);
      
      res.json({
        category,
        count: indicators.length,
        indicators: indicators.map(i => ({
          title: i.title,
          latestValue: i.latestValue,
          latestDate: i.latestDate,
          monthlyChange: i.monthlyChange,
          annualChange: i.annualChange,
          importance: i.importance
        }))
      });
    } catch (error) {
      console.error(`❌ Error fetching FRED category ${req.params.category}:`, error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: `Failed to fetch FRED category ${req.params.category}` 
      });
    }
  });

  // Get high importance indicators only
  app.get("/api/fred/high-importance", async (req, res) => {
    try {
      console.log('📊 Fetching high importance FRED indicators...');
      
      const indicators = await comprehensiveFredApiService.getHighImportanceIndicators();
      
      res.json({
        count: indicators.length,
        indicators: indicators.map(i => ({
          title: i.title,
          category: i.category,
          latestValue: i.latestValue,
          latestDate: i.latestDate,
          monthlyChange: i.monthlyChange,
          annualChange: i.annualChange
        }))
      });
    } catch (error) {
      console.error('❌ Error fetching high importance FRED indicators:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to fetch high importance FRED indicators' 
      });
    }
  });

  // Clear FRED cache endpoint
  app.post("/api/fred/clear-cache", async (req, res) => {
    try {
      console.log('🗑️ Clearing comprehensive FRED API cache...');
      
      comprehensiveFredApiService.clearCache();
      
      res.json({
        success: true,
        message: 'Comprehensive FRED API cache cleared'
      });
    } catch (error) {
      console.error('❌ FRED cache clear failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to clear FRED cache' 
      });
    }
  });

  // Test deduplication system
  app.get("/api/test/deduplication", async (req, res) => {
    try {
      console.log('🧪 Testing deduplication system...');
      
      const { economicDataEnhancedService } = await import('../services/economic-data-enhanced.js');
      
      const enhancedEvents = await economicDataEnhancedService.getEnhancedEconomicEvents();
      
      // Analyze duplicates by title
      const titleAnalysis = enhancedEvents.reduce((acc, event) => {
        const normalizedTitle = event.title.toLowerCase().replace(/[\s\-_]+/g, ' ').trim();
        if (!acc[normalizedTitle]) {
          acc[normalizedTitle] = [];
        }
        acc[normalizedTitle].push({
          source: event.source,
          actual: event.actual,
          forecast: event.forecast,
          importance: event.importance
        });
        return acc;
      }, {} as Record<string, any[]>);

      const duplicateAnalysis = Object.entries(titleAnalysis)
        .filter(([_, events]) => events.length > 1)
        .map(([title, events]) => ({ title, count: events.length, events }));

      res.json({
        success: true,
        totalEvents: enhancedEvents.length,
        fredSources: enhancedEvents.filter(e => e.source === 'fred_api').length,
        reliableSources: enhancedEvents.filter(e => e.source.includes('reliable')).length,
        eventsWithActual: enhancedEvents.filter(e => e.actual && e.actual !== 'N/A').length,
        duplicatesFound: duplicateAnalysis.length,
        duplicateDetails: duplicateAnalysis.slice(0, 5), // Show first 5 examples
        deduplicationSuccess: duplicateAnalysis.length === 0,
        sampleEvents: enhancedEvents.slice(0, 10).map(e => ({
          title: e.title,
          source: e.source,
          actual: e.actual,
          importance: e.importance
        }))
      });
    } catch (error) {
      console.error('❌ Deduplication test failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Deduplication test failed' 
      });
    }
  });

  // Hybrid economic data with FRED priority
  app.get("/api/economic-data/fred-hybrid", async (req, res) => {
    try {
      console.log('🔄 Fetching hybrid economic data (FRED + reliable calendar fallback)...');
      
      let fredIndicators: any[] = [];
      
      try {
        const indicators = await comprehensiveFredApiService.getComprehensiveEconomicIndicators();
        fredIndicators = indicators.slice(0, 30); // Take top 30 most important
      } catch (fredError) {
        console.warn('⚠️ FRED data failed, falling back to reliable calendar');
      }
      
      // If FRED data is insufficient, supplement with reliable calendar
      if (fredIndicators.length < 20) {
        console.log('📋 Supplementing with reliable calendar data...');
        
        const { simplifiedEconomicCalendarService } = await import('../services/simplified-economic-calendar');
        const reliableData = await simplifiedEconomicCalendarService.getCalendarEvents();
        
        // Add reliable data that's not already included
        const existingTitles = new Set(fredIndicators.map((i: any) => i.title.toLowerCase()));
        const supplementData = reliableData
          .filter(event => !existingTitles.has(event.title.toLowerCase()))
          .slice(0, 25 - fredIndicators.length)
          .map(event => ({
            id: `reliable-${event.id}`,
            title: event.title,
            description: event.description,
            importance: event.importance,
            eventDate: new Date(event.date),
            forecast: event.forecast,
            previous: event.previous,
            actual: event.actual,
            country: 'US',
            category: event.category,
            source: 'reliable_calendar_supplement',
            impact: null,
            timestamp: new Date()
          }));
        
        fredIndicators = [...fredIndicators, ...supplementData];
      }
      
      // Transform FRED indicators to events format
      const events = fredIndicators.map((item: any, index: number) => {
        if (item.seriesId) {
          // FRED indicator
          return {
            id: `fred-${item.seriesId}`,
            title: item.title,
            description: `${item.title} - Official Federal Reserve data`,
            importance: item.importance,
            eventDate: new Date(item.latestDate),
            forecast: null,
            previous: item.previousValue,
            actual: item.latestValue,
            country: 'US',
            category: item.category,
            source: 'fred_api',
            impact: item.monthlyChange ? (item.monthlyChange.startsWith('-') ? 'negative' : 'positive') : null,
            timestamp: new Date(),
            monthlyChange: item.monthlyChange,
            annualChange: item.annualChange
          };
        } else {
          // Reliable calendar event
          return item;
        }
      });
      
      console.log(`✅ Hybrid FRED Economic Data: ${events.length} events total`);
      console.log(`🏛️ FRED indicators: ${events.filter((e: any) => e.source === 'fred_api').length}`);
      console.log(`📋 Reliable calendar: ${events.filter((e: any) => e.source === 'reliable_calendar_supplement').length}`);
      
      res.json(events);
    } catch (error) {
      console.error('❌ Hybrid FRED economic data failed:', error);
      res.status(500).json({ message: 'Failed to fetch hybrid FRED economic data' });
    }
  });
}