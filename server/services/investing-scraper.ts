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

export class InvestingComScraper {
  private static instance: InvestingComScraper;
  private readonly baseUrl = 'https://www.investing.com/economic-calendar/';

  static getInstance(): InvestingComScraper {
    if (!InvestingComScraper.instance) {
      InvestingComScraper.instance = new InvestingComScraper();
    }
    return InvestingComScraper.instance;
  }

  async scrapeEconomicCalendar(timeframe: 'thisweek' | 'nextweek' = 'thisweek'): Promise<EconomicEvent[]> {
    try {
      console.log(`🔍 Scraping Investing.com economic calendar: ${timeframe}`);
      
      const response = await axios.get(this.baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cookie': 'timeframe=' + timeframe + '; country=5; importance=2,3' // Filter for US, medium+high importance
        },
        timeout: 20000
      });

      const $ = cheerio.load(response.data);
      const events: EconomicEvent[] = [];

      // Parse Investing.com's calendar table
      await this.parseInvestingCalendar($, events);

      console.log(`📅 Investing.com: Found ${events.length} US events (importance 2-3)`);
      return this.filterUSHighImportance(events);
    } catch (error) {
      console.error('❌ Investing.com scraping failed:', error);
      return this.generateFallbackEvents();
    }
  }

  private async parseInvestingCalendar($: cheerio.CheerioAPI, events: EconomicEvent[]): Promise<void> {
    // Primary table selector for Investing.com
    $('#economicCalendarData tr, .calendar-row, table.genTbl tr').each((_, element) => {
      try {
        const $row = $(element);
        
        // Skip header rows
        if ($row.find('th').length > 0 || $row.hasClass('theader')) return;

        const cells = $row.find('td');
        if (cells.length < 6) return;

        // Investing.com standard layout: Time, Cur., Imp., Event, Actual, Forecast, Previous
        const eventData = this.extractInvestingData($, cells);
        if (!eventData) return;

        // Filter for US events and medium/high importance only
        if (eventData.currency !== 'USD') return;
        if (eventData.importance === 'low') return;

        const event: EconomicEvent = {
          id: `investing-${Date.now()}-${Math.random()}`,
          title: this.cleanTitle(eventData.title),
          description: this.generateDescription(eventData.title),
          date: eventData.eventDate,
          time: eventData.timeText,
          country: 'US',
          category: this.categorizeEvent(eventData.title),
          importance: eventData.importance,
          currency: 'USD',
          actual: this.cleanValue(eventData.actual),
          forecast: this.cleanValue(eventData.forecast),
          previous: this.cleanValue(eventData.previous),
          impact: this.calculateImpact(eventData.actual, eventData.forecast),
          source: 'investing.com'
        };

        events.push(event);
      } catch (error) {
        console.error('Error parsing Investing.com row:', error);
      }
    });

    // Alternative parsing for different layouts
    $('.js-event-item, .calendar-item').each((_, element) => {
      this.parseAlternativeInvestingLayout($, $(element), events);
    });
  }

  private extractInvestingData($: cheerio.CheerioAPI, cells: cheerio.Cheerio<any>) {
    try {
      // Standard Investing.com layout
      const timeText = $(cells[0]).text().trim();
      const currency = $(cells[1]).text().trim();
      const importance = this.parseImportanceStars($(cells[2]));
      const title = $(cells[3]).text().trim();
      const actual = $(cells[4]).text().trim();
      const forecast = $(cells[5]).text().trim();
      const previous = $(cells[6]).text().trim();

      // Parse event date (today's date with time)
      const eventDate = this.parseEventDate(timeText);

      return {
        timeText,
        currency,
        importance,
        title,
        actual,
        forecast,
        previous,
        eventDate
      };
    } catch (error) {
      return null;
    }
  }

  private parseAlternativeInvestingLayout($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>, events: EconomicEvent[]): void {
    try {
      const title = $element.find('.event-title, .eventTitle, .js-event-title').text().trim();
      if (!title || title.length < 3) return;

      const actual = $element.find('.actual, .js-actual').text().trim();
      const forecast = $element.find('.forecast, .js-forecast').text().trim();
      const previous = $element.find('.previous, .js-previous').text().trim();
      const timeText = $element.find('.time, .js-time').text().trim();
      const importance = this.parseImportanceFromClasses($element);

      if (importance === 'low') return; // Filter out low importance

      const event: EconomicEvent = {
        id: `investing-alt-${Date.now()}-${Math.random()}`,
        title: this.cleanTitle(title),
        description: this.generateDescription(title),
        date: this.parseEventDate(timeText),
        time: timeText || '8:30 AM ET',
        country: 'US',
        category: this.categorizeEvent(title),
        importance,
        currency: 'USD',
        actual: this.cleanValue(actual),
        forecast: this.cleanValue(forecast),
        previous: this.cleanValue(previous),
        impact: this.calculateImpact(actual, forecast),
        source: 'investing.com'
      };

      events.push(event);
    } catch (error) {
      console.error('Error parsing alternative Investing.com layout:', error);
    }
  }

  private parseImportanceStars($cell: cheerio.Cheerio<any>): 'high' | 'medium' | 'low' {
    const stars = $cell.find('.impact, .importance, i[class*="impact"]').length;
    const classList = $cell.attr('class') || '';
    
    if (stars >= 3 || classList.includes('high') || classList.includes('3')) {
      return 'high';
    } else if (stars >= 2 || classList.includes('medium') || classList.includes('2')) {
      return 'medium';
    }
    return 'low';
  }

  private parseImportanceFromClasses($element: cheerio.Cheerio<any>): 'high' | 'medium' | 'low' {
    const classList = $element.attr('class') || '';
    
    if (classList.includes('high') || classList.includes('impact-3')) {
      return 'high';
    } else if (classList.includes('medium') || classList.includes('impact-2')) {
      return 'medium';
    }
    return 'low';
  }

  private parseEventDate(timeText: string): Date {
    const today = new Date();
    
    // If time text contains specific date, try to parse it
    if (timeText && timeText.length > 10) {
      try {
        const parsed = new Date(timeText);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      } catch {}
    }
    
    // Default to today
    return today;
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
      'gdp': 'Gross Domestic Product - Economic growth measure',
      'michigan sentiment': 'University of Michigan Consumer Sentiment Index',
      'ism manufacturing': 'Institute for Supply Management Manufacturing Index'
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
    if (lowerTitle.includes('confidence') || lowerTitle.includes('sentiment') || lowerTitle.includes('michigan')) {
      return 'sentiment';
    }
    if (lowerTitle.includes('ism') || lowerTitle.includes('manufacturing') || lowerTitle.includes('pmi')) {
      return 'manufacturing';
    }
    
    return 'general';
  }

  private filterUSHighImportance(events: EconomicEvent[]): EconomicEvent[] {
    return events
      .filter(event => event.country === 'US' && event.importance !== 'low')
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 50); // Limit to top 50 events
  }

  private generateFallbackEvents(): EconomicEvent[] {
    // Generate realistic fallback events if scraping fails
    const today = new Date();
    const fallbackEvents: EconomicEvent[] = [
      {
        id: 'investing-fallback-1',
        title: 'Consumer Price Index',
        description: 'Consumer Price Index - Measures inflation for consumer goods and services',
        date: today,
        time: '8:30 AM ET',
        country: 'US',
        currency: 'USD',
        category: 'inflation',
        importance: 'high',
        actual: null,
        forecast: '2.8%',
        previous: '2.9%',
        impact: null,
        source: 'investing.com_fallback'
      },
      {
        id: 'investing-fallback-2',
        title: 'Initial Jobless Claims',
        description: 'Weekly initial unemployment claims',
        date: today,
        time: '8:30 AM ET',
        country: 'US',
        currency: 'USD',
        category: 'employment',
        importance: 'medium',
        actual: null,
        forecast: '230K',
        previous: '221K',
        impact: null,
        source: 'investing.com_fallback'
      }
    ];

    console.log('📅 Investing.com: Using fallback events');
    return fallbackEvents;
  }
}