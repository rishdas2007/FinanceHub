import fetch from 'node-fetch';
import { db } from '../db';
import { economicEvents } from '@shared/schema';

interface TradingViewEvent {
  id: string;
  title: string;
  country: string;
  ticker?: string | null;
  comment?: string | null;
  scale?: string | null;
  datetime: string;
  importance: number; // 1=low, 2=medium, 3=high
  actual?: number | null;
  forecast?: number | null;
  previous?: number | null;
}

interface TradingViewResponse {
  result: TradingViewEvent[];
}

export class TradingViewCalendarService {
  private readonly baseUrl = 'https://economic-calendar.tradingview.com/events';
  
  /**
   * Fetch US economic events from TradingView, filtering for medium (2) and high (3) importance only
   */
  async fetchUSEconomicEvents(days: number = 7): Promise<any[]> {
    try {
      console.log('🔄 Fetching TradingView US economic calendar...');
      
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + days);
      
      const headers = {
        'Origin': 'https://in.tradingview.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };
      
      const params = new URLSearchParams({
        from: today.toISOString(),
        to: endDate.toISOString(),
        countries: 'US'
      });
      
      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers,
        timeout: 10000
      });
      
      if (!response.ok) {
        console.log('⚠️ TradingView API request failed, using fallback data');
        return this.getFallbackEvents();
      }
      
      const data = await response.json() as TradingViewResponse;
      
      if (!data.result || !Array.isArray(data.result)) {
        console.log('⚠️ Invalid TradingView response structure');
        return this.getFallbackEvents();
      }
      
      // Filter for medium (2 bars) and high (3 bars) importance events only
      const filteredEvents = data.result.filter(event => 
        event.country === 'US' && (event.importance === 2 || event.importance === 3)
      );
      
      console.log(`📊 TradingView: Found ${filteredEvents.length} medium/high importance US events`);
      
      // Transform to our event format
      const transformedEvents = filteredEvents.map(event => ({
        id: `tv-${event.id}`,
        title: event.title,
        description: event.comment || `${event.title} economic indicator`,
        eventDate: new Date(event.datetime),
        time: new Date(event.datetime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York',
          timeZoneName: 'short'
        }),
        country: event.country,
        category: this.categorizeEvent(event.title),
        importance: event.importance === 3 ? 'high' : 'medium',
        currency: 'USD',
        forecast: event.forecast?.toString() || null,
        previous: event.previous?.toString() || null,
        actual: event.actual?.toString() || null,
        impact: this.calculateImpact(event.actual, event.forecast),
        source: 'tradingview'
      }));
      
      console.log('📈 TradingView events successfully transformed');
      return transformedEvents;
      
    } catch (error) {
      console.error('❌ TradingView calendar fetch failed:', error.message);
      return this.getFallbackEvents();
    }
  }
  
  /**
   * Get current trading day events based on market hours (9:30 AM - 4:00 PM ET)
   */
  getCurrentTradingDayEvents(events: any[]): any[] {
    const now = new Date();
    const easternTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).format(now);
    
    const [hours, minutes] = easternTime.split(':').map(Number);
    const currentTimeMinutes = hours * 60 + minutes;
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM
    
    const isMarketHours = currentTimeMinutes >= marketOpen && currentTimeMinutes <= marketClose;
    const targetDate = isMarketHours ? now : this.getLastTradingDay(now);
    
    console.log(`📅 Market hours check: ${isMarketHours ? 'OPEN' : 'CLOSED'} - analyzing ${targetDate.toDateString()} events`);
    
    // Filter events from target date
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.eventDate);
      return eventDate.toDateString() === targetDate.toDateString();
    });
    
    console.log(`📊 Found ${dayEvents.length} events from ${isMarketHours ? 'current' : 'last'} trading day`);
    return dayEvents;
  }
  
  /**
   * Get last trading day (excluding weekends)
   */
  private getLastTradingDay(date: Date): Date {
    const lastDay = new Date(date);
    lastDay.setDate(date.getDate() - 1);
    
    // Skip weekends
    while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
      lastDay.setDate(lastDay.getDate() - 1);
    }
    
    return lastDay;
  }
  
  /**
   * Categorize events based on title keywords
   */
  private categorizeEvent(title: string): string {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('cpi') || titleLower.includes('ppi') || titleLower.includes('inflation')) {
      return 'inflation';
    }
    if (titleLower.includes('payroll') || titleLower.includes('unemployment') || titleLower.includes('jobless') || titleLower.includes('employment')) {
      return 'employment';
    }
    if (titleLower.includes('retail') || titleLower.includes('consumer') || titleLower.includes('spending')) {
      return 'consumer_spending';
    }
    if (titleLower.includes('manufacturing') || titleLower.includes('industrial') || titleLower.includes('production')) {
      return 'manufacturing';
    }
    if (titleLower.includes('housing') || titleLower.includes('home')) {
      return 'housing';
    }
    if (titleLower.includes('gdp') || titleLower.includes('growth')) {
      return 'growth';
    }
    if (titleLower.includes('fed') || titleLower.includes('interest') || titleLower.includes('rate')) {
      return 'monetary_policy';
    }
    
    return 'other';
  }
  
  /**
   * Calculate impact based on actual vs forecast
   */
  private calculateImpact(actual: number | null, forecast: number | null): string | null {
    if (!actual || !forecast) return null;
    
    const difference = actual - forecast;
    if (Math.abs(difference) < 0.01) return 'neutral';
    return difference > 0 ? 'positive' : 'negative';
  }
  
  /**
   * Fallback events for when TradingView is unavailable
   */
  private getFallbackEvents(): any[] {
    const today = new Date();
    const baseEvents = [
      {
        id: 'fallback-cpi',
        title: 'Consumer Price Index (CPI)',
        description: 'Monthly inflation measure',
        importance: 'high',
        category: 'inflation'
      },
      {
        id: 'fallback-ppi',
        title: 'Producer Price Index (PPI)',
        description: 'Wholesale inflation measure',
        importance: 'high',
        category: 'inflation'
      },
      {
        id: 'fallback-nfp',
        title: 'Nonfarm Payrolls',
        description: 'Monthly employment change',
        importance: 'high',
        category: 'employment'
      },
      {
        id: 'fallback-retail',
        title: 'Retail Sales',
        description: 'Monthly consumer spending data',
        importance: 'high',
        category: 'consumer_spending'
      }
    ];
    
    return baseEvents.map(event => ({
      ...event,
      eventDate: today,
      time: '8:30 AM ET',
      country: 'US',
      currency: 'USD',
      forecast: null,
      previous: null,
      actual: null,
      impact: null,
      source: 'tradingview-fallback'
    }));
  }
  
  /**
   * Merge TradingView events with existing MarketWatch data
   */
  async getMergedEconomicCalendar(): Promise<any[]> {
    try {
      // Get TradingView events
      const tradingViewEvents = await this.fetchUSEconomicEvents(7);
      
      // Get existing MarketWatch events
      const existingEvents = await this.getExistingEvents();
      
      // Merge and deduplicate
      const allEvents = [...tradingViewEvents, ...existingEvents];
      const uniqueEvents = this.deduplicateEvents(allEvents);
      
      // Sort by date (newest first) and importance
      const sortedEvents = uniqueEvents.sort((a, b) => {
        const dateA = new Date(a.eventDate);
        const dateB = new Date(b.eventDate);
        
        // First sort by date (descending)
        const dateDiff = dateB.getTime() - dateA.getTime();
        if (dateDiff !== 0) return dateDiff;
        
        // Then by importance (high > medium > low)
        const importanceOrder = { high: 3, medium: 2, low: 1 };
        return importanceOrder[b.importance] - importanceOrder[a.importance];
      });
      
      console.log(`📊 Merged calendar: ${sortedEvents.length} total events (${tradingViewEvents.length} from TradingView)`);
      return sortedEvents;
      
    } catch (error) {
      console.error('❌ Error merging economic calendars:', error);
      return [];
    }
  }
  
  /**
   * Get existing events from database/cache
   */
  private async getExistingEvents(): Promise<any[]> {
    // This would typically query your existing economic events
    // For now, return empty array to avoid conflicts
    return [];
  }
  
  /**
   * Remove duplicate events based on title and date
   */
  private deduplicateEvents(events: any[]): any[] {
    const seen = new Set<string>();
    const unique = [];
    
    for (const event of events) {
      const key = `${event.title}-${new Date(event.eventDate).toDateString()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(event);
      }
    }
    
    return unique;
  }
}

export const tradingViewCalendarService = new TradingViewCalendarService();