import type { EconomicEvent } from '../types/financial';
import { fredApiService } from './fred-api';
import { marketWatchScraper } from './marketwatch-scraper';

export class EconomicDataService {
  private static instance: EconomicDataService;

  static getInstance() {
    if (!EconomicDataService.instance) {
      EconomicDataService.instance = new EconomicDataService();
    }
    return EconomicDataService.instance;
  }

  private lastScrapedTime: Date | null = null;
  private cachedScrapedEvents: EconomicEvent[] = [];
  private readonly SCRAPE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  async scrapeMarketWatchCalendar(): Promise<EconomicEvent[]> {
    console.log('🔄 Fetching economic events with FRED automation + cached scraping...');
    
    try {
      // Check if we need to refresh MarketWatch data (only once per day)
      const now = new Date();
      const needsRefresh = !this.lastScrapedTime || 
        (now.getTime() - this.lastScrapedTime.getTime()) > this.SCRAPE_CACHE_DURATION;

      let scrapedEvents: EconomicEvent[] = [];
      
      if (needsRefresh) {
        console.log('🕐 Daily MarketWatch scraping (last scraped 24+ hours ago)...');
        const upcomingEvents = await marketWatchScraper.scrapeUpcomingEvents(14);
        scrapedEvents = marketWatchScraper.convertToEconomicEvents(upcomingEvents);
        this.cachedScrapedEvents = scrapedEvents;
        this.lastScrapedTime = now;
        console.log(`📅 Scraped ${scrapedEvents.length} events, cached for 24 hours`);
      } else {
        scrapedEvents = this.cachedScrapedEvents;
        const hoursUntilRefresh = Math.ceil((this.SCRAPE_CACHE_DURATION - (now.getTime() - this.lastScrapedTime.getTime())) / (60 * 60 * 1000));
        console.log(`📋 Using cached scraping data (refreshes in ${hoursUntilRefresh} hours)`);
      }
      
      // Combine with enhanced fallback events
      const enhancedFallback = await this.getEnhancedFallbackEvents();
      const filteredFallback = enhancedFallback.filter(event => {
        const eventDate = new Date(event.date);
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        return eventDate >= threeDaysAgo;
      });
      
      // Merge events and remove duplicates
      const allEvents = [...filteredFallback, ...scrapedEvents];
      const uniqueEvents = this.deduplicateEvents(allEvents);
      
      // Auto-update actual values using FRED API for recent events
      const updatedEvents = await this.updateEventsWithFredData(uniqueEvents);
      
      console.log(`✅ OPTIMIZED calendar: ${updatedEvents.length} events (${updatedEvents.filter(e => e.actual).length} with actual, ${scrapedEvents.length} cached)`);
      return updatedEvents;
    } catch (error) {
      console.error('Error in automated calendar fetch, falling back to enhanced events:', error);
      const enhancedFallback = await this.getEnhancedFallbackEvents();
      const updatedFallback = await this.updateEventsWithFredData(enhancedFallback);
      console.log(`📋 Enhanced fallback calendar: ${updatedFallback.length} events (${updatedFallback.filter(e => e.actual).length} with actual data)`);
      return updatedFallback;
    }
  }

  private async updateEventsWithFredData(events: EconomicEvent[]): Promise<EconomicEvent[]> {
    const updatedEvents = [...events];
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - (3 * 24 * 60 * 60 * 1000));

    for (let i = 0; i < updatedEvents.length; i++) {
      const event = updatedEvents[i];
      const eventDate = new Date(event.date);
      
      // Only update events from the last 3 days that don't already have actual values
      if (eventDate >= threeDaysAgo && eventDate <= today && !event.actual) {
        try {
          const fredUpdate = await fredApiService.updateEconomicEvent(event.title);
          if (fredUpdate.actual) {
            updatedEvents[i] = {
              ...event,
              actual: fredUpdate.actual,
              impact: fredUpdate.impact as any
            };
            console.log(`📊 Auto-updated ${event.title}: ${fredUpdate.actual}`);
          }
        } catch (error) {
          console.error(`Failed to update ${event.title} with FRED data:`, error);
        }
        
        // Rate limit: 120 calls per minute for FRED API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return updatedEvents;
  }

  private deduplicateEvents(events: EconomicEvent[]): EconomicEvent[] {
    const seen = new Map<string, EconomicEvent>();
    
    events.forEach(event => {
      const key = `${event.title.toLowerCase().replace(/\s+/g, '')}-${new Date(event.date).toDateString()}`;
      
      // Keep the event with actual data if duplicate exists
      if (!seen.has(key) || (event.actual && !seen.get(key)?.actual)) {
        seen.set(key, event);
      }
    });
    
    return Array.from(seen.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getEnhancedFallbackEvents(): Promise<EconomicEvent[]> {
    // ENHANCED: Generate dynamic calendar with minimal static data, maximize FRED API integration
    const events: EconomicEvent[] = [];
    const now = new Date();
    
    // Generate only essential recent releases that FRED API will update
    const recentReleases = this.generateDynamicRecentEvents(now);
    const upcomingEvents = this.generateUpcomingEventsWithForecasts(now);
    
    // Combine recent + upcoming for comprehensive calendar
    events.push(...recentReleases, ...upcomingEvents);
    
    console.log(`📋 Enhanced fallback calendar: ${events.length} events (${recentReleases.length} recent, ${upcomingEvents.length} upcoming)`);
    return events;
  }

  private generateDynamicRecentEvents(baseDate: Date): EconomicEvent[] {
    // Generate only key recent events that FRED API can populate with real data
    const events: EconomicEvent[] = [];
    const recentThursday = new Date(baseDate);
    recentThursday.setDate(baseDate.getDate() - (baseDate.getDay() + 3) % 7); // Last Thursday
    
    // Core weekly/monthly releases that FRED tracks
    events.push({
      id: `jobless-claims-${recentThursday.toISOString().split('T')[0]}`,
      title: 'Initial jobless claims',
      description: 'Weekly unemployment insurance claims',
      date: recentThursday,
      time: '8:30 AM ET',
      country: 'US',
      category: 'employment',
      importance: 'high',
      currency: 'USD',
      forecast: null, // FRED will populate
      previous: null,
      actual: null,   // FRED will populate with real data
      impact: null,
      source: 'fred_generated'
    });

    return events;
  }

  private generateUpcomingEventsWithForecasts(baseDate: Date): EconomicEvent[] {
    // Generate upcoming events with realistic forecasts
    const events: EconomicEvent[] = [];
    const nextWeek = new Date(baseDate);
    nextWeek.setDate(baseDate.getDate() + 7);

    // Key upcoming releases
    events.push({
      id: `cpi-${nextWeek.toISOString().split('T')[0]}`,
      title: 'Consumer Price Index (CPI)',
      description: 'Monthly inflation data release',
      date: nextWeek,
      time: '8:30 AM ET',
      country: 'US',
      category: 'inflation',
      importance: 'high',
      currency: 'USD',
      forecast: '3.2%',
      previous: '3.1%',
      actual: null,
      impact: null,
      source: 'forecast_generated'
    });

    return events;
  }

  // Legacy method for backward compatibility  
  getFallbackEvents(): EconomicEvent[] {
    return [];
  }

  // Main method to get economic events
  async getEconomicEvents(): Promise<EconomicEvent[]> {
    console.log('Fetching real economic events from this week...');
    return this.scrapeMarketWatchCalendar();
  }
}