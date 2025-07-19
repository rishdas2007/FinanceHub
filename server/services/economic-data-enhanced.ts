import { EconomicDataService } from './economic-data';
import { TradingViewCalendarService } from './tradingview-calendar';

/**
 * Enhanced Economic Data Service that integrates TradingView calendar
 * with existing MarketWatch and FRED data sources
 */
export class EnhancedEconomicDataService extends EconomicDataService {
  private tradingViewService = new TradingViewCalendarService();
  
  /**
   * Get comprehensive economic events from multiple sources
   * Filters TradingView events for medium (2 bars) and high (3 bars) importance only
   */
  async getEnhancedEconomicEvents(): Promise<any[]> {
    try {
      console.log('🔄 Fetching enhanced economic events from multiple sources...');
      
      // Get existing events from parent service (MarketWatch + FRED)
      const existingEvents = await this.getEconomicEvents();
      
      // Get TradingView events (filtered for medium/high importance)
      const tradingViewEvents = await this.tradingViewService.fetchUSEconomicEvents(7);
      
      // Merge and deduplicate events
      const mergedEvents = this.mergeEconomicEvents(existingEvents, tradingViewEvents);
      
      // Filter for US events with medium/high importance only
      const filteredEvents = mergedEvents.filter(event => 
        event.country === 'US' && 
        (event.importance === 'high' || event.importance === 'medium')
      );
      
      // Sort by date (recent first) and importance
      const sortedEvents = filteredEvents.sort((a, b) => {
        const dateA = new Date(a.eventDate || a.date);
        const dateB = new Date(b.eventDate || b.date);
        
        // First sort by date (descending - recent first)
        const dateDiff = dateB.getTime() - dateA.getTime();
        if (dateDiff !== 0) return dateDiff;
        
        // Then by importance (high > medium > low)
        const importanceOrder = { high: 3, medium: 2, low: 1 };
        const aImportance = importanceOrder[a.importance] || 1;
        const bImportance = importanceOrder[b.importance] || 1;
        return bImportance - aImportance;
      });
      
      console.log(`📊 Enhanced calendar: ${sortedEvents.length} US medium/high importance events`);
      console.log(`🎯 TradingView contribution: ${tradingViewEvents.length} events`);
      
      return sortedEvents;
      
    } catch (error) {
      console.error('❌ Error in enhanced economic events:', error);
      // Fallback to existing service
      return await this.getEconomicEvents();
    }
  }
  
  /**
   * Get market hours-aware economic events
   * Returns current trading day events if market open, last trading day if closed
   */
  async getMarketHoursEconomicEvents(): Promise<any[]> {
    const allEvents = await this.getEnhancedEconomicEvents();
    return this.tradingViewService.getCurrentTradingDayEvents(allEvents);
  }
  
  /**
   * Merge economic events from different sources and deduplicate
   */
  private mergeEconomicEvents(existingEvents: any[], tradingViewEvents: any[]): any[] {
    const allEvents = [...existingEvents, ...tradingViewEvents];
    const seen = new Map<string, any>();
    
    // Deduplicate by title and date, preferring events with actual data
    for (const event of allEvents) {
      const eventDate = new Date(event.eventDate || event.date);
      const key = `${event.title}-${eventDate.toDateString()}`;
      
      if (!seen.has(key)) {
        seen.set(key, event);
      } else {
        // Prefer event with actual data
        const existing = seen.get(key);
        if (event.actual && !existing.actual) {
          seen.set(key, event);
        } else if (event.source === 'tradingview' && existing.source !== 'fred') {
          // Prefer TradingView over MarketWatch if no FRED data
          seen.set(key, event);
        }
      }
    }
    
    return Array.from(seen.values());
  }
  
  /**
   * Get events specifically for AI analysis with market hours awareness
   */
  async getAIAnalysisEvents(): Promise<{
    currentTradingDay: any[];
    recent: any[];
    highImpact: any[];
    summary: string;
  }> {
    const allEvents = await this.getEnhancedEconomicEvents();
    const currentTradingDayEvents = this.tradingViewService.getCurrentTradingDayEvents(allEvents);
    
    // Get recent events (last 7 days with actual data)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentEvents = allEvents.filter(event => {
      const eventDate = new Date(event.eventDate || event.date);
      return eventDate >= oneWeekAgo && event.actual;
    }).slice(0, 10);
    
    // Get high impact events with actual data
    const highImpactEvents = allEvents.filter(event => 
      event.importance === 'high' && event.actual
    ).slice(0, 8);
    
    // Generate summary
    const keyEvents = [...currentTradingDayEvents, ...recentEvents, ...highImpactEvents]
      .filter((event, index, self) => 
        self.findIndex(e => e.id === event.id) === index
      )
      .slice(0, 12);
    
    const summary = keyEvents.map(event => {
      if (!event.actual) return null;
      
      const variance = this.calculateEventVariance(event.actual, event.forecast);
      const direction = variance && variance > 0 ? 'beat' : variance && variance < 0 ? 'missed' : 'met';
      const forecastText = event.forecast ? `${event.forecast}` : 'expectations';
      const varianceText = variance ? ` (variance: ${variance > 0 ? '+' : ''}${variance.toFixed(2)})` : '';
      
      return `${event.title}: ${event.actual} ${direction} ${forecastText}${varianceText}`;
    }).filter(Boolean).join('; ');
    
    return {
      currentTradingDay: currentTradingDayEvents,
      recent: recentEvents,
      highImpact: highImpactEvents,
      summary
    };
  }
  
  /**
   * Calculate variance between actual and forecast values
   */
  private calculateEventVariance(actual: string, forecast: string): number | null {
    if (!actual || !forecast) return null;
    const actualValue = parseFloat(actual.replace(/[^\d.-]/g, ''));
    const forecastValue = parseFloat(forecast.replace(/[^\d.-]/g, ''));
    return isNaN(actualValue) || isNaN(forecastValue) ? null : actualValue - forecastValue;
  }
}

export const enhancedEconomicDataService = new EnhancedEconomicDataService();