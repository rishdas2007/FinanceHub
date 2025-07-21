import axios from 'axios';
import * as cheerio from 'cheerio';

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

export class EnhancedMarketWatchScraper {
  private static instance: EnhancedMarketWatchScraper;
  private readonly baseUrl = 'https://www.marketwatch.com/economy-politics/calendar';

  static getInstance(): EnhancedMarketWatchScraper {
    if (!EnhancedMarketWatchScraper.instance) {
      EnhancedMarketWatchScraper.instance = new EnhancedMarketWatchScraper();
    }
    return EnhancedMarketWatchScraper.instance;
  }

  async scrapeComprehensiveData(daysRange: number = 14): Promise<EconomicEvent[]> {
    try {
      console.log('🔍 Enhanced MarketWatch scraping with actual readings...');
      
      const response = await axios.get(this.baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const events: EconomicEvent[] = [];
      const today = new Date();
      const startDate = new Date(today.getTime() - (daysRange/2 * 24 * 60 * 60 * 1000)); // Past events too
      const endDate = new Date(today.getTime() + (daysRange/2 * 24 * 60 * 60 * 1000));

      // Enhanced parsing with actual readings
      this.parseMainCalendar($, events, startDate, endDate);
      this.parseAlternativeLayouts($, events, startDate, endDate);

      console.log(`📅 MarketWatch Enhanced: Found ${events.length} events with actual readings`);
      return this.filterAndDeduplicate(events);
    } catch (error) {
      console.error('❌ Enhanced MarketWatch scraping failed:', error);
      return [];
    }
  }

  private parseMainCalendar($: cheerio.CheerioAPI, events: EconomicEvent[], startDate: Date, endDate: Date): void {
    // Primary parsing strategy for MarketWatch's main layout
    $('.calendar-item, .ec-table tr, .economic-calendar-row, table.table tr').each((_, element) => {
      try {
        const $row = $(element);
        
        // Skip header rows
        if ($row.find('th').length > 0) return;
        
        const cells = $row.find('td, .cell, .column');
        if (cells.length < 4) return;

        // Extract event details with enhanced selectors
        const eventData = this.extractEventData($, $row, cells);
        if (!eventData) return;

        const eventDate = this.parseEventDate(eventData.dateText, eventData.timeText);
        if (eventDate < startDate || eventDate > endDate) return;

        // Filter for US events only and medium/high importance
        if (eventData.country !== 'US' && eventData.country !== 'United States') return;
        if (eventData.importance === 'low') return;

        const event: EconomicEvent = {
          id: `mw-enhanced-${Date.now()}-${Math.random()}`,
          title: this.cleanTitle(eventData.title),
          description: this.generateDescription(eventData.title),
          date: eventDate,
          time: eventData.timeText || '8:30 AM ET',
          country: 'US',
          category: this.categorizeEvent(eventData.title),
          importance: eventData.importance,
          currency: 'USD',
          actual: this.cleanValue(eventData.actual), // ENHANCED: Capture actual readings
          forecast: this.cleanValue(eventData.forecast),
          previous: this.cleanValue(eventData.previous),
          impact: this.calculateImpact(eventData.actual, eventData.forecast),
          source: 'marketwatch_enhanced'
        };

        events.push(event);
      } catch (error) {
        console.error('Error parsing MarketWatch row:', error);
      }
    });
  }

  private parseAlternativeLayouts($: cheerio.CheerioAPI, events: EconomicEvent[], startDate: Date, endDate: Date): void {
    // Alternative parsing for different MarketWatch layouts
    $('.calendar-row, .event-row, .mw-calendar-item').each((_, element) => {
      try {
        const $row = $(element);
        const title = $row.find('.event-name, .indicator, .title').text().trim();
        if (!title || title.length < 3) return;

        // Extract all possible data points
        const actual = $row.find('.actual, .result, .released, [data-actual]').text().trim();
        const forecast = $row.find('.forecast, .consensus, .estimate, .expected, [data-forecast]').text().trim();
        const previous = $row.find('.previous, .prior, .last, .prev, [data-previous]').text().trim();
        const dateText = $row.find('.date, .event-date, .time-date').text().trim();
        const timeText = $row.find('.time, .event-time, .release-time').text().trim();

        if (actual || forecast) {
          const eventDate = this.parseEventDate(dateText, timeText);
          if (eventDate >= startDate && eventDate <= endDate) {
            const event: EconomicEvent = {
              id: `mw-alt-${Date.now()}-${Math.random()}`,
              title: this.cleanTitle(title),
              description: this.generateDescription(title),
              date: eventDate,
              time: timeText || '8:30 AM ET',
              country: 'US',
              category: this.categorizeEvent(title),
              importance: this.determineImportance(title),
              currency: 'USD',
              actual: this.cleanValue(actual),
              forecast: this.cleanValue(forecast),
              previous: this.cleanValue(previous),
              impact: this.calculateImpact(actual, forecast),
              source: 'marketwatch_enhanced'
            };
            events.push(event);
          }
        }
      } catch (error) {
        console.error('Error parsing alternative MarketWatch layout:', error);
      }
    });
  }

  private extractEventData($: cheerio.CheerioAPI, $row: cheerio.Cheerio<any>, cells: cheerio.Cheerio<any>) {
    // Enhanced data extraction with multiple selector strategies
    let title = '', dateText = '', timeText = '', actual = '', forecast = '', previous = '';
    let country = 'US', importance: 'high' | 'medium' | 'low' = 'medium';

    // Strategy 1: Standard table layout (Time, Event, Actual, Forecast, Previous)
    if (cells.length >= 5) {
      timeText = $(cells[0]).text().trim();
      title = $(cells[1]).text().trim();
      actual = $(cells[2]).text().trim();
      forecast = $(cells[3]).text().trim();
      previous = $(cells[4]).text().trim();
    } 
    // Strategy 2: Alternative layout (Event, Actual, Forecast, Previous)
    else if (cells.length >= 4) {
      title = $(cells[0]).text().trim();
      actual = $(cells[1]).text().trim();
      forecast = $(cells[2]).text().trim();
      previous = $(cells[3]).text().trim();
    }
    // Strategy 3: Minimal layout (Event, Forecast)
    else if (cells.length >= 2) {
      title = $(cells[0]).text().trim();
      forecast = $(cells[1]).text().trim();
    }

    // Enhanced selectors for finding actual values
    if (!actual) {
      actual = $row.find('.actual, .result, .released, [data-actual]').text().trim();
    }
    if (!forecast) {
      forecast = $row.find('.forecast, .consensus, .estimate, .expected, [data-forecast]').text().trim();
    }
    if (!previous) {
      previous = $row.find('.previous, .prior, .last, .prev, [data-previous]').text().trim();
    }

    // Extract importance from star ratings or CSS classes
    const stars = $row.find('.star, .importance, .impact').length;
    if (stars >= 3 || $row.hasClass('high-impact') || title.toLowerCase().includes('cpi') || title.toLowerCase().includes('payroll')) {
      importance = 'high';
    } else if (stars >= 2 || $row.hasClass('medium-impact')) {
      importance = 'medium';
    } else {
      importance = 'low';
    }

    // Extract date information
    dateText = $row.find('.date, .event-date, .time-date').text().trim();
    if (!timeText) {
      timeText = $row.find('.time, .event-time, .release-time').text().trim() || '8:30 AM ET';
    }

    // Validate we have minimum required data
    if (!title || title.length < 3) return null;

    return { title, dateText, timeText, actual, forecast, previous, country, importance };
  }

  private calculateImpact(actual: string | null, forecast: string | null): string | null {
    if (!actual || !forecast) return null;

    try {
      const actualNum = this.parseNumericValue(actual);
      const forecastNum = this.parseNumericValue(forecast);
      
      if (isNaN(actualNum) || isNaN(forecastNum)) return null;

      const difference = actualNum - forecastNum;
      const percentDiff = Math.abs(difference / forecastNum) * 100;

      if (percentDiff < 5) return 'neutral';
      if (difference > 0) return 'positive';
      return 'negative';
    } catch {
      return null;
    }
  }

  private parseNumericValue(value: string): number {
    // Handle various formats: 2.5%, 1.2M, 234K, etc.
    const cleanValue = value.replace(/[,%$]/g, '');
    
    if (cleanValue.includes('M')) {
      return parseFloat(cleanValue.replace('M', '')) * 1000000;
    }
    if (cleanValue.includes('K')) {
      return parseFloat(cleanValue.replace('K', '')) * 1000;
    }
    if (cleanValue.includes('%')) {
      return parseFloat(cleanValue.replace('%', ''));
    }
    
    return parseFloat(cleanValue);
  }

  private parseEventDate(dateText: string, timeText: string): Date {
    // Enhanced date parsing
    const today = new Date();
    
    if (!dateText || dateText.toLowerCase().includes('today')) {
      return today;
    }
    
    if (dateText.toLowerCase().includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    
    // Try to parse various date formats
    try {
      const parsed = new Date(dateText);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    } catch {}
    
    // Default to today
    return today;
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\.%]/g, '')
      .trim();
  }

  private cleanValue(value: string | null): string | null {
    if (!value || value === '' || value === '--' || value === 'N/A') return null;
    return value.trim();
  }

  private generateDescription(title: string): string {
    const descriptions: { [key: string]: string } = {
      'cpi': 'Consumer Price Index - Measures inflation for consumer goods and services',
      'ppi': 'Producer Price Index - Measures wholesale inflation',
      'retail sales': 'Monthly change in retail sales activity',
      'jobless claims': 'Weekly initial unemployment claims',
      'nonfarm payrolls': 'Monthly change in non-farm employment',
      'housing starts': 'New residential construction starts',
      'building permits': 'New construction permits issued',
      'gdp': 'Gross Domestic Product - Economic growth measure'
    };

    const lowerTitle = title.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerTitle.includes(key)) {
        return desc;
      }
    }
    
    return `Economic indicator: ${title}`;
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

  private determineImportance(title: string): 'high' | 'medium' | 'low' {
    const lowerTitle = title.toLowerCase();
    
    // High importance indicators
    if (lowerTitle.includes('cpi') || lowerTitle.includes('nonfarm payroll') || 
        lowerTitle.includes('gdp') || lowerTitle.includes('fed')) {
      return 'high';
    }
    
    // Medium importance indicators
    if (lowerTitle.includes('retail sales') || lowerTitle.includes('housing') ||
        lowerTitle.includes('jobless claims') || lowerTitle.includes('ppi')) {
      return 'medium';
    }
    
    return 'low';
  }

  private filterAndDeduplicate(events: EconomicEvent[]): EconomicEvent[] {
    // Remove duplicates based on title and date
    const seen = new Set<string>();
    const filtered = events.filter(event => {
      const key = `${event.title}-${event.date.toDateString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by date (most recent first)
    return filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
  }
}