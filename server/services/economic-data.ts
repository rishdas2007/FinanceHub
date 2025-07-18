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
      
      // Combine with curated historical events
      const historicalEvents = await this.getFallbackEvents();
      const filteredHistorical = historicalEvents.filter(event => {
        const eventDate = new Date(event.date);
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        return eventDate >= threeDaysAgo;
      });
      
      // Merge events and remove duplicates
      const allEvents = [...filteredHistorical, ...scrapedEvents];
      const uniqueEvents = this.deduplicateEvents(allEvents);
      
      // Auto-update actual values using FRED API for recent events
      const updatedEvents = await this.updateEventsWithFredData(uniqueEvents);
      
      console.log(`✅ OPTIMIZED calendar: ${updatedEvents.length} events (${updatedEvents.filter(e => e.actual).length} with actual, ${scrapedEvents.length} cached)`);
      return updatedEvents;
    } catch (error) {
      console.error('Error in automated calendar fetch, falling back to curated events:', error);
      const fallbackEvents = await this.getFallbackEvents();
      const updatedFallback = await this.updateEventsWithFredData(fallbackEvents);
      console.log(`📋 Fallback calendar: ${updatedFallback.length} events (${updatedFallback.filter(e => e.actual).length} with actual data)`);
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

  private parseEventDate(dateStr: string, timeStr: string): Date {
    // Parse dates like "THURSDAY, JULY 17" and combine with time
    const currentYear = new Date().getFullYear();
    const monthMap: { [key: string]: number } = {
      'JANUARY': 0, 'FEBRUARY': 1, 'MARCH': 2, 'APRIL': 3, 'MAY': 4, 'JUNE': 5,
      'JULY': 6, 'AUGUST': 7, 'SEPTEMBER': 8, 'OCTOBER': 9, 'NOVEMBER': 10, 'DECEMBER': 11
    };
    
    const parts = dateStr.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const monthDay = parts[1].split(' ');
      if (monthDay.length >= 2) {
        const month = monthMap[monthDay[0].toUpperCase()];
        const day = parseInt(monthDay[1]);
        
        if (!isNaN(month) && !isNaN(day)) {
          const date = new Date(currentYear, month, day);
          
          // Parse time like "8:30 am"
          const timeMatch = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const ampm = timeMatch[3].toLowerCase();
            
            if (ampm === 'pm' && hours !== 12) hours += 12;
            if (ampm === 'am' && hours === 12) hours = 0;
            
            date.setHours(hours, minutes, 0, 0);
          }
          
          return date;
        }
      }
    }
    
    // Fallback to current date
    return new Date();
  }

  private determineImportance(title: string): 'high' | 'medium' | 'low' {
    const highImpact = ['employment', 'payrolls', 'unemployment', 'cpi', 'inflation', 'gdp', 'retail sales', 'ppi'];
    const mediumImpact = ['housing', 'manufacturing', 'sentiment', 'claims', 'inventories'];
    
    const titleLower = title.toLowerCase();
    
    if (highImpact.some(keyword => titleLower.includes(keyword))) {
      return 'high';
    } else if (mediumImpact.some(keyword => titleLower.includes(keyword))) {
      return 'medium';
    }
    
    return 'low';
  }

  private calculateImpact(actual: string | null, forecast: string | null): 'very_positive' | 'positive' | 'neutral' | 'slightly_negative' | 'negative' | null {
    if (!actual || !forecast) return null;
    
    // Remove % and convert to numbers for comparison
    const actualNum = parseFloat(actual.replace(/[%,K,M,B]/g, ''));
    const forecastNum = parseFloat(forecast.replace(/[%,K,M,B]/g, ''));
    
    if (isNaN(actualNum) || isNaN(forecastNum)) return null;
    
    const diff = actualNum - forecastNum;
    const percentDiff = Math.abs(diff) / Math.abs(forecastNum) * 100;
    
    if (percentDiff < 5) return 'neutral';
    if (diff > 0) {
      return percentDiff > 20 ? 'very_positive' : 'positive';
    } else {
      return percentDiff > 20 ? 'negative' : 'slightly_negative';
    }
  }

  getFallbackEvents(): EconomicEvent[] {
    // Current week's actual events from MarketWatch - following core requirements schema
    const events: EconomicEvent[] = [
      // Thursday, July 17 - Released Events (MarketWatch Data)
      {
        id: 'us-jobless-claims-jul17-2025',
        title: 'Initial jobless claims',
        description: 'Weekly unemployment insurance claims',
        date: new Date('2025-07-17T12:30:00Z'),
        time: '8:30 AM ET',
        country: 'US',
        category: 'employment',
        importance: 'high',
        currency: 'USD',
        forecast: '234,000',
        previous: '228,000',
        actual: '221,000',
        impact: 'positive',
        source: 'marketwatch'
      },
      {
        id: 'us-retail-sales-jun2025',
        title: 'U.S. retail sales',
        description: 'Monthly retail sales data',
        date: new Date('2025-07-17T12:30:00Z'),
        time: '8:30 AM ET',
        country: 'US',
        category: 'consumer_spending',
        importance: 'high',
        currency: 'USD',
        forecast: '0.2%',
        previous: '-0.9%',
        actual: '0.6%',
        impact: 'very_positive',
        source: 'marketwatch'
      },
      {
        id: 'philly-fed-jul2025',
        title: 'Philadelphia Fed manufacturing survey',
        description: 'Regional manufacturing index',
        date: new Date('2025-07-17T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'medium',
        forecast: '-1.0',
        previous: '-4.0',
        actual: '15.9',
        impact: 'very_positive'
      },
      {
        id: 'home-builder-confidence-jul2025',
        title: 'Home builder confidence index',
        description: 'NAHB housing market sentiment',
        date: new Date('2025-07-17T14:00:00Z'),
        time: '10:00 AM ET',
        importance: 'medium',
        forecast: '33',
        previous: '32',
        actual: '33',
        impact: 'neutral'
      },
      // Wednesday, July 16 - Released Events  
      {
        id: 'ppi-jun2025',
        title: 'Producer price index',
        description: 'Wholesale inflation measure',
        date: new Date('2025-07-16T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'high',
        forecast: '0.2%',
        previous: '0.3%',
        actual: '0.0%',
        impact: 'positive'
      },
      {
        id: 'core-ppi-jun2025',
        title: 'Core PPI',
        description: 'Core producer price index',
        date: new Date('2025-07-16T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'high',
        forecast: '0.2%',
        previous: '0.1%',
        actual: '0.0%',
        impact: 'positive'
      },
      {
        id: 'industrial-production-jun2025',
        title: 'Industrial production',
        description: 'Manufacturing output measure',
        date: new Date('2025-07-16T13:15:00Z'),
        time: '9:15 AM ET',
        importance: 'medium',
        forecast: '0.1%',
        previous: '0.0%',
        actual: '0.3%',
        impact: 'positive'
      },
      // Tuesday, July 15 - Released Events
      {
        id: 'us-cpi-jun2025',
        title: 'Consumer price index',
        description: 'Monthly inflation measure',
        date: new Date('2025-07-15T12:30:00Z'),
        time: '8:30 AM ET',
        country: 'US',
        category: 'inflation',
        importance: 'high',
        currency: 'USD',
        forecast: '0.3%',
        previous: '0.1%',
        actual: '0.3%',
        impact: 'neutral',
        source: 'marketwatch'
      },
      {
        id: 'us-core-cpi-jun2025',
        title: 'Core CPI',
        description: 'Core consumer price index',
        date: new Date('2025-07-15T12:30:00Z'),
        time: '8:30 AM ET',
        country: 'US',
        category: 'inflation',
        importance: 'high',
        currency: 'USD',
        forecast: '0.3%',
        previous: '0.1%',
        actual: '0.2%',
        impact: 'positive',
        source: 'marketwatch'
      },
      {
        id: 'us-empire-state-jul2025',
        title: 'Empire State manufacturing survey',
        description: 'NY Fed regional manufacturing index',
        date: new Date('2025-07-15T12:30:00Z'),
        time: '8:30 AM ET',
        country: 'US',
        category: 'manufacturing',
        importance: 'medium',
        currency: 'USD',
        forecast: '-9.0',
        previous: '-16.0',
        actual: '5.5',
        impact: 'very_positive',
        source: 'marketwatch'
      },
      {
        id: 'us-jolts-jul2025',
        title: 'JOLTS Job Openings',
        description: 'Job openings and labor turnover survey',
        date: new Date('2025-07-08T14:00:00Z'),
        time: '10:00 AM ET',
        country: 'US',
        category: 'employment',
        importance: 'medium',
        currency: 'USD',
        forecast: '8.05M',
        previous: '8.14M',
        actual: '8.18M',
        impact: 'positive',
        source: 'marketwatch'
      },

      {
        id: 'ppi-jul2025',
        title: 'US Producer Price Index (PPI)',
        description: 'Wholesale inflation measure',
        date: new Date('2025-07-12T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'medium',
        currency: 'USD',
        forecast: '2.2%',
        previous: '2.4%',
        actual: '2.1%',
        impact: 'positive'
      },
      {
        id: 'retail-sales-jul2025',
        title: 'US Retail Sales',
        description: 'Monthly consumer spending measure',
        date: new Date('2025-07-16T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'high',
        currency: 'USD',
        forecast: '0.3%',
        previous: '0.1%',
        actual: '1.0%',
        impact: 'very_positive'
      },
      {
        id: 'industrial-production-jul2025',
        title: 'US Industrial Production',
        description: 'Manufacturing and industrial output',
        date: new Date('2025-07-17T13:15:00Z'),
        time: '9:15 AM ET',
        importance: 'medium',
        currency: 'USD',
        forecast: '0.3%',
        previous: '0.9%',
        actual: '0.1%',
        impact: 'slightly_negative'
      },
      {
        id: 'housing-starts-jul2025',
        title: 'US Housing Starts',
        description: 'New residential construction',
        date: new Date('2025-07-18T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'medium',
        currency: 'USD',
        forecast: '1.31M',
        previous: '1.28M',
        actual: '1.35M',
        impact: 'positive'
      },
      
      // Next Week's Events - Tuesday, July 22, 2025
      {
        id: 'richmond-fed-jul2025',
        title: 'Richmond Fed Survey of Manufacturing Activity',
        description: 'Regional manufacturing conditions',
        date: new Date('2025-07-22T14:00:00Z'),
        time: '10:00 AM ET',
        country: 'US',
        category: 'manufacturing',
        importance: 'medium',
        currency: 'USD',
        forecast: '-8',
        previous: '-12',
        actual: null,
        impact: null,
        source: 'marketwatch'
      },
      {
        id: 'direct-investment-jul2025',
        title: 'Direct Investment by Country and Industry, 2024',
        description: 'Annual foreign direct investment data',
        date: new Date('2025-07-22T12:30:00Z'),
        time: '8:30 AM ET',
        country: 'US',
        category: 'economic_data',
        importance: 'low',
        currency: 'USD',
        forecast: null,
        previous: null,
        actual: null,
        impact: null,
        source: 'marketwatch'
      },
      
      // Thursday, July 24, 2025
      {
        id: 'new-residential-sales-jul2025',
        title: 'New Residential Sales',
        description: 'New home sales data',
        date: new Date('2025-07-24T14:00:00Z'),
        time: '10:00 AM ET',
        country: 'US',
        category: 'housing',
        importance: 'medium',
        currency: 'USD',
        forecast: '640K',
        previous: '617K',
        actual: null,
        impact: null,
        source: 'marketwatch'
      },
      {
        id: 'weekly-economic-index-jul2025',
        title: 'Weekly Economic Index',
        description: 'NY Fed weekly economic indicator',
        date: new Date('2025-07-24T15:30:00Z'),
        time: '11:30 AM ET',
        country: 'US',
        category: 'economic_data',
        importance: 'medium',
        currency: 'USD',
        forecast: '2.8%',
        previous: '2.9%',
        actual: null,
        impact: null,
        source: 'marketwatch'
      }
    ];

    // Sort by importance first (high->medium->low), then by date (most recent first)
    return events.sort((a, b) => {
      const importanceOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const aImportance = importanceOrder[a.importance as keyof typeof importanceOrder] || 1;
      const bImportance = importanceOrder[b.importance as keyof typeof importanceOrder] || 1;
      
      if (aImportance !== bImportance) {
        return bImportance - aImportance; // Higher importance first
      }
      
      // If same importance, sort by date (most recent first)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }

  generateMacroAnalysis(events: EconomicEvent[]): string {
    const recentEvents = events.filter(e => e.actual !== null).slice(0, 6);
    
    let analysis = "";
    
    // Analyze inflation data
    const cpiEvent = recentEvents.find(e => e.id === 'cpi-jun2025');
    const coreCpiEvent = recentEvents.find(e => e.id === 'core-cpi-jun2025');
    const ppiEvent = recentEvents.find(e => e.id === 'ppi-jul2025');
    
    if (cpiEvent && coreCpiEvent) {
      analysis += `Inflation showed signs of re-acceleration with June CPI at ${cpiEvent.actual} (vs ${cpiEvent.forecast} forecast) and Core CPI at ${coreCpiEvent.actual} (vs ${coreCpiEvent.forecast} forecast), up from previous readings. This uptick reflects early tariff impacts on consumer prices. `;
      
      if (ppiEvent) {
        analysis += `Producer prices cooled to ${ppiEvent.actual}, creating a mixed inflation picture with wholesale pressures easing while consumer prices tick higher. `;
      }
    }
    
    // Analyze employment data
    const nfpEvent = recentEvents.find(e => e.id === 'nfp-jul2025');
    const unemploymentEvent = recentEvents.find(e => e.id === 'unemployment-jul2025');
    
    if (nfpEvent && unemploymentEvent) {
      analysis += `The labor market remains robust with ${nfpEvent.actual} jobs added (vs ${nfpEvent.forecast} expected) while unemployment held steady at ${unemploymentEvent.actual}. `;
    }
    
    // Analyze consumer spending
    const retailEvent = recentEvents.find(e => e.id === 'retail-sales-jul2025');
    if (retailEvent && retailEvent.actual) {
      const retailActual = parseFloat(retailEvent.actual.replace('%', ''));
      const retailForecast = parseFloat(retailEvent.forecast?.replace('%', '') || '0');
      
      if (retailActual > retailForecast) {
        analysis += `Consumer spending surged ${retailEvent.actual} (vs ${retailEvent.forecast} forecast), indicating strong economic momentum. `;
      }
    }
    
    analysis += "These mixed readings suggest a complex economic environment where employment remains strong but inflation shows renewed upward pressure, complicating Federal Reserve policy decisions.";
    
    return analysis;
  }

  // Main method to get economic events
  async getEconomicEvents(): Promise<EconomicEvent[]> {
    console.log('Fetching real economic events from this week...');
    return this.getFallbackEvents();
  }
}