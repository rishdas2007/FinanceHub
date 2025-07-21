import { EnhancedMarketWatchScraper } from './enhanced-marketwatch-scraper.js';
import { InvestingComScraper } from './investing-scraper.js';
import { FredApiService } from './fred-api.js';
import { SimplifiedEconomicCalendarService } from './simplified-economic-calendar.js';

export interface EconomicEvent {
  id: string;
  title: string;
  description: string;
  date: Date;
  time: string;
  country: string;
  currency: string;
  category: string;
  importance: 'high' | 'medium' | 'low';
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  impact: string | null;
  source: string;
}

export class ComprehensiveEconomicDataService {
  private static instance: ComprehensiveEconomicDataService;
  private marketWatchScraper: EnhancedMarketWatchScraper;
  private investingScraper: InvestingComScraper;
  private fredApi: FredApiService;
  private reliableCalendar: SimplifiedEconomicCalendarService;
  private cache: Map<string, { data: EconomicEvent[]; timestamp: number }> = new Map();
  private readonly cacheTimeout = 2 * 60 * 60 * 1000; // 2 hours

  static getInstance(): ComprehensiveEconomicDataService {
    if (!ComprehensiveEconomicDataService.instance) {
      ComprehensiveEconomicDataService.instance = new ComprehensiveEconomicDataService();
    }
    return ComprehensiveEconomicDataService.instance;
  }

  constructor() {
    this.marketWatchScraper = EnhancedMarketWatchScraper.getInstance();
    this.investingScraper = InvestingComScraper.getInstance();
    this.fredApi = FredApiService.getInstance();
    this.reliableCalendar = SimplifiedEconomicCalendarService.getInstance();
  }

  async getComprehensiveEconomicData(): Promise<EconomicEvent[]> {
    const cacheKey = 'comprehensive_economic_data';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('✅ Using cached comprehensive economic data');
      return cached.data;
    }

    console.log('🚀 Fetching comprehensive economic data from multiple sources...');
    
    try {
      // Fetch data from all sources in parallel
      const [
        marketWatchEvents,
        investingEvents,
        fredEvents,
        reliableEvents
      ] = await Promise.allSettled([
        this.fetchMarketWatchData(),
        this.fetchInvestingData(),
        this.fetchFredData(),
        this.fetchReliableData()
      ]);

      // Combine all successful results
      const allEvents: EconomicEvent[] = [];
      
      // Add MarketWatch events
      if (marketWatchEvents.status === 'fulfilled' && marketWatchEvents.value.length > 0) {
        allEvents.push(...marketWatchEvents.value);
        console.log(`📅 Enhanced MarketWatch: ${marketWatchEvents.value.length} events with actual readings`);
      }

      // Add Investing.com events
      if (investingEvents.status === 'fulfilled' && investingEvents.value.length > 0) {
        allEvents.push(...investingEvents.value);
        console.log(`📅 Investing.com: ${investingEvents.value.length} US medium/high importance events`);
      }

      // Add FRED API events
      if (fredEvents.status === 'fulfilled' && fredEvents.value.length > 0) {
        allEvents.push(...fredEvents.value);
        console.log(`📅 FRED API: ${fredEvents.value.length} actual economic readings`);
      }

      // Add reliable calendar events as fallback
      if (reliableEvents.status === 'fulfilled' && reliableEvents.value.length > 0) {
        allEvents.push(...reliableEvents.value);
        console.log(`📅 Reliable Calendar: ${reliableEvents.value.length} fallback events`);
      }

      // Process and deduplicate events
      const processedEvents = this.processAndMergeEvents(allEvents);
      
      // Cache the results
      this.cache.set(cacheKey, {
        data: processedEvents,
        timestamp: Date.now()
      });

      console.log(`✅ Comprehensive Economic Data: ${processedEvents.length} total events from multiple sources`);
      return processedEvents;

    } catch (error) {
      console.error('❌ Error fetching comprehensive economic data:', error);
      
      // Fallback to reliable calendar only
      const fallbackEvents = await this.fetchReliableData();
      console.log(`📅 Using fallback reliable calendar: ${fallbackEvents.length} events`);
      return fallbackEvents;
    }
  }

  private async fetchMarketWatchData(): Promise<EconomicEvent[]> {
    try {
      const events = await this.marketWatchScraper.scrapeComprehensiveData(14);
      return events.map(event => ({
        ...event,
        id: `mw-${event.id}`,
        source: 'marketwatch_enhanced'
      }));
    } catch (error) {
      console.error('❌ MarketWatch enhanced scraping failed:', error);
      return [];
    }
  }

  private async fetchInvestingData(): Promise<EconomicEvent[]> {
    try {
      // Fetch both current week and next week
      const [thisWeekEvents, nextWeekEvents] = await Promise.allSettled([
        this.investingScraper.scrapeEconomicCalendar('thisweek'),
        this.investingScraper.scrapeEconomicCalendar('nextweek')
      ]);

      const allInvestingEvents: EconomicEvent[] = [];
      
      if (thisWeekEvents.status === 'fulfilled') {
        allInvestingEvents.push(...thisWeekEvents.value);
      }
      
      if (nextWeekEvents.status === 'fulfilled') {
        allInvestingEvents.push(...nextWeekEvents.value);
      }

      return allInvestingEvents.map(event => ({
        ...event,
        id: `investing-${event.id}`,
        source: 'investing.com'
      }));
    } catch (error) {
      console.error('❌ Investing.com scraping failed:', error);
      return [];
    }
  }

  private async fetchFredData(): Promise<EconomicEvent[]> {
    try {
      // Get recent FRED economic data (placeholder - implement actual method)
      const fredData: any[] = [];
      
      // Convert FRED data to EconomicEvent format
      return fredData.map((data: any, index: number) => ({
        id: `fred-${Date.now()}-${index}`,
        title: data.title,
        description: `Official Federal Reserve economic data: ${data.title}`,
        date: new Date(data.date),
        time: '8:30 AM ET',
        country: 'US',
        currency: 'USD',
        category: this.categorizeFredData(data.title),
        importance: this.determineFredImportance(data.title),
        actual: data.value?.toString() || null,
        forecast: null, // FRED doesn't provide forecasts
        previous: null, // Would need historical comparison
        impact: null,
        source: 'fred_api'
      }));
    } catch (error) {
      console.error('❌ FRED API fetch failed:', error);
      return [];
    }
  }

  private async fetchReliableData(): Promise<EconomicEvent[]> {
    try {
      const reliableEvents = await this.reliableCalendar.getEconomicEvents();
      
      // Convert to comprehensive format
      return reliableEvents.map((event: any) => ({
        id: `reliable-${event.id}`,
        title: event.title,
        description: event.description,
        date: new Date(event.eventDate),
        time: '8:30 AM ET',
        country: 'US',
        currency: 'USD',
        category: this.categorizeEvent(event.title),
        importance: this.mapImportance(event.importance),
        actual: event.actual,
        forecast: event.forecast,
        previous: event.previous,
        impact: null,
        source: 'reliable_calendar'
      }));
    } catch (error) {
      console.error('❌ Reliable calendar fetch failed:', error);
      return [];
    }
  }

  private processAndMergeEvents(allEvents: EconomicEvent[]): EconomicEvent[] {
    // Step 1: Deduplicate events based on title and date similarity
    const deduplicatedEvents = this.deduplicateEvents(allEvents);
    
    // Step 2: Merge similar events to combine data from different sources
    const mergedEvents = this.mergeEventsFromSources(deduplicatedEvents);
    
    // Step 3: Prioritize events with actual readings
    const prioritizedEvents = this.prioritizeActualReadings(mergedEvents);
    
    // Step 4: Filter for US events and medium/high importance only
    const filteredEvents = prioritizedEvents.filter(event => 
      event.country === 'US' && 
      event.importance !== 'low'
    );
    
    // Step 5: Sort by date (most recent first) and limit results
    return filteredEvents
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 40); // Limit to top 40 events
  }

  private deduplicateEvents(events: EconomicEvent[]): EconomicEvent[] {
    const seen = new Map<string, EconomicEvent>();
    
    for (const event of events) {
      const key = this.generateEventKey(event);
      const existing = seen.get(key);
      
      if (!existing) {
        seen.set(key, event);
      } else {
        // Keep the event with more complete data (actual readings preferred)
        if (this.isMoreComplete(event, existing)) {
          seen.set(key, event);
        }
      }
    }
    
    return Array.from(seen.values());
  }

  private mergeEventsFromSources(events: EconomicEvent[]): EconomicEvent[] {
    const eventGroups = new Map<string, EconomicEvent[]>();
    
    // Group similar events
    for (const event of events) {
      const key = this.generateEventKey(event);
      if (!eventGroups.has(key)) {
        eventGroups.set(key, []);
      }
      eventGroups.get(key)!.push(event);
    }
    
    // Merge events in each group
    const mergedEvents: EconomicEvent[] = [];
    eventGroups.forEach((groupEvents, key) => {
      if (groupEvents.length === 1) {
        mergedEvents.push(groupEvents[0]);
      } else {
        const merged = this.mergeEventGroup(groupEvents);
        mergedEvents.push(merged);
      }
    });
    
    return mergedEvents;
  }

  private mergeEventGroup(events: EconomicEvent[]): EconomicEvent {
    // Use the most complete event as base
    const baseEvent = events.reduce((best, current) => 
      this.isMoreComplete(current, best) ? current : best
    );
    
    // Merge data from all sources
    const sources = events.map(e => e.source).join(', ');
    
    return {
      ...baseEvent,
      actual: this.selectBestValue(events.map(e => e.actual)),
      forecast: this.selectBestValue(events.map(e => e.forecast)),
      previous: this.selectBestValue(events.map(e => e.previous)),
      source: sources
    };
  }

  private prioritizeActualReadings(events: EconomicEvent[]): EconomicEvent[] {
    return events.sort((a, b) => {
      // Prioritize events with actual readings
      if (a.actual && !b.actual) return -1;
      if (!a.actual && b.actual) return 1;
      
      // Then by importance
      const importanceOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const aImportance = importanceOrder[a.importance] || 1;
      const bImportance = importanceOrder[b.importance] || 1;
      
      if (aImportance !== bImportance) {
        return bImportance - aImportance;
      }
      
      // Finally by date (most recent first)
      return b.date.getTime() - a.date.getTime();
    });
  }

  private generateEventKey(event: EconomicEvent): string {
    // Create a key for identifying similar events
    const normalizedTitle = event.title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const dateKey = event.date.toDateString();
    return `${normalizedTitle}-${dateKey}`;
  }

  private isMoreComplete(event1: EconomicEvent, event2: EconomicEvent): boolean {
    const score1 = this.calculateCompletenessScore(event1);
    const score2 = this.calculateCompletenessScore(event2);
    return score1 > score2;
  }

  private calculateCompletenessScore(event: EconomicEvent): number {
    let score = 0;
    if (event.actual) score += 3; // Actual readings are most valuable
    if (event.forecast) score += 2;
    if (event.previous) score += 1;
    if (event.impact) score += 1;
    return score;
  }

  private selectBestValue(values: (string | null)[]): string | null {
    // Select the first non-null value
    return values.find(value => value !== null && value !== '') || null;
  }

  private categorizeFredData(title: string): string {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('cpi') || lowerTitle.includes('price') || lowerTitle.includes('inflation')) {
      return 'inflation';
    }
    if (lowerTitle.includes('employment') || lowerTitle.includes('unemployment') || lowerTitle.includes('job')) {
      return 'employment';
    }
    if (lowerTitle.includes('gdp') || lowerTitle.includes('growth') || lowerTitle.includes('sales')) {
      return 'growth';
    }
    if (lowerTitle.includes('housing') || lowerTitle.includes('construction')) {
      return 'housing';
    }
    
    return 'general';
  }

  private determineFredImportance(title: string): 'high' | 'medium' | 'low' {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('cpi') || lowerTitle.includes('gdp') || 
        lowerTitle.includes('unemployment rate') || lowerTitle.includes('federal funds')) {
      return 'high';
    }
    
    if (lowerTitle.includes('employment') || lowerTitle.includes('housing') ||
        lowerTitle.includes('sales') || lowerTitle.includes('production')) {
      return 'medium';
    }
    
    return 'low';
  }

  private categorizeEvent(title: string): string {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('cpi') || lowerTitle.includes('ppi') || lowerTitle.includes('inflation')) {
      return 'inflation';
    }
    if (lowerTitle.includes('job') || lowerTitle.includes('employment') || lowerTitle.includes('payroll')) {
      return 'employment';
    }
    if (lowerTitle.includes('retail') || lowerTitle.includes('sales') || lowerTitle.includes('gdp')) {
      return 'growth';
    }
    if (lowerTitle.includes('housing') || lowerTitle.includes('building')) {
      return 'housing';
    }
    if (lowerTitle.includes('confidence') || lowerTitle.includes('sentiment')) {
      return 'sentiment';
    }
    
    return 'general';
  }

  private mapImportance(importance: string): 'high' | 'medium' | 'low' {
    const lower = importance.toLowerCase();
    if (lower.includes('high')) return 'high';
    if (lower.includes('medium')) return 'medium';
    return 'low';
  }

  // Method to clear cache when needed
  public clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Comprehensive economic data cache cleared');
  }
}