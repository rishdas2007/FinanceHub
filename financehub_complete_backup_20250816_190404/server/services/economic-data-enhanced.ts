import { simplifiedEconomicCalendarService } from './simplified-economic-calendar';

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

  async getEnhancedEconomicEvents(): Promise<EconomicEvent[]> {
    const cacheKey = 'enhanced_economic_events';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log('📋 Using cached enhanced economic events');
      return cached.data;
    }

    try {
      console.log('🔄 Fetching enhanced economic events from reliable calendar...');
      
      const reliableEvents = await this.fetchReliableCalendarEvents();
      console.log(`📊 Reliable events: ${reliableEvents.length}`);

      // Cache the results
      this.cache.set(cacheKey, {
        data: reliableEvents,
        timestamp: Date.now()
      });

      return reliableEvents;

    } catch (error) {
      console.error('❌ Enhanced economic events failed:', error);
      return this.generateFallbackEvents();
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
        time: event.time || '8:30 AM ET',
        country: event.country || 'US',
        currency: event.currency || 'USD',
        category: event.category || 'Economic',
        importance: event.importance || 'medium',
        forecast: event.forecast,
        previous: event.previous,
        actual: event.actual,
        impact: event.actual && event.forecast ? 
          (parseFloat(event.actual) > parseFloat(event.forecast) ? 'positive' : 'negative') : 
          'neutral',
        source: 'reliable_calendar'
      }));
    } catch (error) {
      console.error('❌ Reliable calendar events fetch failed:', error);
      return [];
    }
  }

  private generateFallbackEvents(): EconomicEvent[] {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return [
      {
        id: 'fallback-1',
        title: 'Initial Jobless Claims',
        description: 'Weekly measure of new unemployment benefit claims',
        date: tomorrow,
        time: '8:30 AM ET',
        country: 'US',
        currency: 'USD',
        category: 'Labor Market',
        importance: 'high',
        forecast: '220K',
        previous: '221K',
        actual: null,
        impact: 'neutral',
        source: 'fallback_generator'
      },
      {
        id: 'fallback-2',
        title: 'Retail Sales',
        description: 'Monthly change in retail sales excluding autos',
        date: tomorrow,
        time: '8:30 AM ET',
        country: 'US',
        currency: 'USD',
        category: 'Economic Growth',
        importance: 'high',
        forecast: '0.3%',
        previous: '0.6%',
        actual: null,
        impact: 'neutral',
        source: 'fallback_generator'
      },
      {
        id: 'fallback-3',
        title: 'Consumer Price Index',
        description: 'Monthly inflation rate measure',
        date: tomorrow,
        time: '8:30 AM ET',
        country: 'US',
        currency: 'USD',
        category: 'Inflation',
        importance: 'high',
        forecast: '2.9%',
        previous: '2.9%',
        actual: null,
        impact: 'neutral',
        source: 'fallback_generator'
      }
    ];
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Economic data enhanced cache cleared');
  }
}

export const economicDataEnhancedService = EconomicDataEnhancedService.getInstance();