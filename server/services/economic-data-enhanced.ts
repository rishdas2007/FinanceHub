import { comprehensiveFredApiService } from './comprehensive-fred-api.js';
import { simplifiedEconomicCalendarService } from './simplified-economic-calendar.js';

interface FredEconomicIndicator {
  seriesId: string;
  title: string;
  units: string;
  frequency: string;
  latestValue: string;
  latestDate: string;
  previousValue?: string;
  category: string;
  importance: 'high' | 'medium' | 'low';
  monthlyChange?: string;
  annualChange?: string;
}

export interface EconomicEvent {
  id: string;
  title: string;
  description: string;
  date: Date;
  time?: string;
  country: string;
  currency?: string;
  category: string;
  importance: 'high' | 'medium' | 'low';
  forecast?: string;
  previous?: string;
  actual?: string;
  impact?: 'positive' | 'negative' | 'neutral';
  source: string;
}

export class EconomicDataEnhancedService {
  private static instance: EconomicDataEnhancedService;
  private cache = new Map<string, { data: EconomicEvent[], timestamp: number }>();
  private readonly CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

  static getInstance(): EconomicDataEnhancedService {
    if (!EconomicDataEnhancedService.instance) {
      EconomicDataEnhancedService.instance = new EconomicDataEnhancedService();
    }
    return EconomicDataEnhancedService.instance;
  }

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.CACHE_DURATION;
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[\s\-_]+/g, ' ')
      .replace(/\(.*?\)/g, '')
      .trim()
      .replace(/initial jobless claims/i, 'jobless claims')
      .replace(/nonfarm payrolls/i, 'payrolls')
      .replace(/consumer price index/i, 'cpi')
      .replace(/producer price index/i, 'ppi')
      .replace(/university of michigan consumer sentiment/i, 'consumer sentiment');
  }

  private getFredPriority(title: string): number {
    const fredTitles = [
      'nonfarm payrolls', 'unemployment rate', 'initial jobless claims', 'continuing claims',
      'consumer price index', 'core cpi', 'producer price index', 'core ppi',
      'retail sales', 'housing starts', 'building permits', 'industrial production',
      'consumer sentiment', 'jolts', 'average hourly earnings'
    ];
    
    const normalizedTitle = this.normalizeTitle(title);
    for (let i = 0; i < fredTitles.length; i++) {
      if (normalizedTitle.includes(fredTitles[i])) {
        return 100 + i; // High priority for FRED matches
      }
    }
    return 50; // Medium priority for non-FRED
  }

  private deduplicateEvents(events: EconomicEvent[]): EconomicEvent[] {
    console.log(`🔄 Deduplicating ${events.length} economic events...`);
    
    // Group events by normalized title and date
    const groups = new Map<string, EconomicEvent[]>();
    
    events.forEach(event => {
      const normalizedTitle = this.normalizeTitle(event.title);
      const dateKey = event.date.toISOString().split('T')[0]; // YYYY-MM-DD
      const key = `${normalizedTitle}-${dateKey}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    });

    const deduplicatedEvents: EconomicEvent[] = [];
    
    groups.forEach((eventGroup, key) => {
      if (eventGroup.length === 1) {
        // No duplicates, keep as-is
        deduplicatedEvents.push(eventGroup[0]);
      } else {
        // Multiple events with same title/date - prioritize by source and data quality
        console.log(`📊 Found ${eventGroup.length} duplicates for: ${key}`);
        
        // Sort by priority: FRED API > reliable calendar > others
        const sortedEvents = eventGroup.sort((a, b) => {
          // Primary sort: FRED API priority
          const aFredScore = this.getFredPriority(a.title);
          const bFredScore = this.getFredPriority(b.title);
          if (aFredScore !== bFredScore) return bFredScore - aFredScore;
          
          // Secondary sort: source priority
          const sourceWeight = (source: string) => {
            if (source === 'fred_api') return 100;
            if (source.includes('reliable_calendar')) return 80;
            if (source.includes('enhanced')) return 60;
            return 40;
          };
          
          const aSourceWeight = sourceWeight(a.source);
          const bSourceWeight = sourceWeight(b.source);
          if (aSourceWeight !== bSourceWeight) return bSourceWeight - aSourceWeight;
          
          // Tertiary sort: prefer events with actual values
          const aHasActual = a.actual && a.actual !== 'N/A' ? 1 : 0;
          const bHasActual = b.actual && b.actual !== 'N/A' ? 1 : 0;
          if (aHasActual !== bHasActual) return bHasActual - aHasActual;
          
          // Quaternary sort: importance
          const importanceWeight = (imp: string) => {
            if (imp === 'high') return 3;
            if (imp === 'medium') return 2;
            return 1;
          };
          
          return importanceWeight(b.importance) - importanceWeight(a.importance);
        });
        
        const bestEvent = sortedEvents[0];
        console.log(`✅ Selected best event: ${bestEvent.title} (${bestEvent.source})`);
        deduplicatedEvents.push(bestEvent);
      }
    });

    console.log(`✅ Deduplication complete: ${events.length} → ${deduplicatedEvents.length} events`);
    return deduplicatedEvents;
  }

  async getEnhancedEconomicEvents(): Promise<EconomicEvent[]> {
    const cacheKey = 'enhanced-economic-events';
    
    if (this.isCacheValid(cacheKey)) {
      console.log('📋 Using cached enhanced economic events');
      return this.cache.get(cacheKey)!.data;
    }

    console.log('🚀 Fetching enhanced economic events with FRED API priority...');

    try {
      // Fetch data from both sources in parallel
      const [fredResult, reliableResult] = await Promise.allSettled([
        this.fetchFredEvents(),
        this.fetchReliableCalendarEvents()
      ]);

      const allEvents: EconomicEvent[] = [];

      // Add FRED events (highest priority)
      if (fredResult.status === 'fulfilled' && fredResult.value.length > 0) {
        allEvents.push(...fredResult.value);
        console.log(`📊 FRED API: ${fredResult.value.length} events with official government data`);
      }

      // Add reliable calendar events
      if (reliableResult.status === 'fulfilled' && reliableResult.value.length > 0) {
        allEvents.push(...reliableResult.value);
        console.log(`📋 Reliable Calendar: ${reliableResult.value.length} supplementary events`);
      }

      // Deduplicate events with FRED priority
      const deduplicatedEvents = this.deduplicateEvents(allEvents);
      
      // Sort by date (most recent first) and importance
      const sortedEvents = deduplicatedEvents.sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        
        const importanceWeight = (imp: string) => {
          if (imp === 'high') return 3;
          if (imp === 'medium') return 2;
          return 1;
        };
        
        return importanceWeight(b.importance) - importanceWeight(a.importance);
      });

      // Cache the results
      this.cache.set(cacheKey, {
        data: sortedEvents,
        timestamp: Date.now()
      });

      console.log(`✅ Enhanced Economic Events: ${sortedEvents.length} deduplicated events`);
      console.log(`🏛️ FRED sources: ${sortedEvents.filter(e => e.source === 'fred_api').length}`);
      console.log(`📋 Reliable sources: ${sortedEvents.filter(e => e.source.includes('reliable')).length}`);
      
      return sortedEvents;

    } catch (error) {
      console.error('❌ Error fetching enhanced economic events:', error);
      
      // Fallback to reliable calendar only
      const fallbackEvents = await this.fetchReliableCalendarEvents();
      console.log(`📅 Using fallback reliable calendar: ${fallbackEvents.length} events`);
      return fallbackEvents;
    }
  }

  private async fetchFredEvents(): Promise<EconomicEvent[]> {
    try {
      const indicators = await comprehensiveFredApiService.getComprehensiveEconomicIndicators();
      
      // Convert FRED indicators to economic events format
      return indicators
        .filter(indicator => indicator.latestValue && indicator.latestValue !== 'N/A')
        .map(indicator => ({
          id: `fred-${indicator.seriesId}`,
          title: indicator.title,
          description: `${indicator.title} - Official Federal Reserve data`,
          date: new Date(indicator.latestDate),
          time: '8:30 AM ET',
          country: 'US',
          currency: 'USD',
          category: indicator.category,
          importance: indicator.importance,
          forecast: null, // FRED doesn't provide forecasts
          previous: indicator.previousValue,
          actual: indicator.latestValue,
          impact: indicator.monthlyChange ? 
            (indicator.monthlyChange.startsWith('-') ? 'negative' : 'positive') : 
            'neutral',
          source: 'fred_api'
        }));
    } catch (error) {
      console.error('❌ FRED events fetch failed:', error);
      return [];
    }
  }

  private async fetchReliableCalendarEvents(): Promise<EconomicEvent[]> {
    try {
      const events = await simplifiedEconomicCalendarService.getCalendarEvents();
      
      return events.map(event => ({
        id: `reliable-${event.id}`,
        title: event.title,
        description: event.description,
        date: new Date(event.date),
        time: event.time,
        country: event.country,
        currency: event.currency,
        category: event.category,
        importance: event.importance,
        forecast: event.forecast,
        previous: event.previous,
        actual: event.actual,
        impact: event.impact,
        source: 'reliable_calendar'
      }));
    } catch (error) {
      console.error('❌ Reliable calendar events fetch failed:', error);
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Enhanced economic data cache cleared');
  }
}

export const economicDataEnhancedService = EconomicDataEnhancedService.getInstance();