import { logger } from '../middleware/logging';

interface MarketStatus {
  isOpen: boolean;
  isPremarket: boolean;
  isAfterHours: boolean;
  nextOpen: Date;
  nextClose: Date;
  session: 'closed' | 'premarket' | 'open' | 'afterhours';
}

interface MarketHours {
  premarket: { start: number; end: number };
  regular: { start: number; end: number };
  afterhours: { start: number; end: number };
}

export class MarketHoursDetector {
  private readonly marketHours: MarketHours = {
    premarket: { start: 4, end: 9.5 },    // 4:00 AM - 9:30 AM EST
    regular: { start: 9.5, end: 16 },     // 9:30 AM - 4:00 PM EST
    afterhours: { start: 16, end: 20 }    // 4:00 PM - 8:00 PM EST
  };

  private readonly marketHolidays = [
    '2025-01-01', // New Year's Day
    '2025-01-20', // MLK Day
    '2025-02-17', // Presidents Day
    '2025-04-18', // Good Friday
    '2025-05-26', // Memorial Day
    '2025-06-19', // Juneteenth
    '2025-07-04', // Independence Day
    '2025-09-01', // Labor Day
    '2025-11-27', // Thanksgiving
    '2025-12-25'  // Christmas
  ];

  getCurrentMarketStatus(): MarketStatus {
    const now = new Date();
    const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = est.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = est.getHours() + est.getMinutes() / 60;
    const dateStr = est.toISOString().split('T')[0];

    // Check if it's a weekend
    if (day === 0 || day === 6) {
      return this.createClosedStatus(est);
    }

    // Check if it's a market holiday
    if (this.marketHolidays.includes(dateStr)) {
      return this.createClosedStatus(est);
    }

    // Determine market session
    if (hour >= this.marketHours.premarket.start && hour < this.marketHours.premarket.end) {
      return {
        isOpen: false,
        isPremarket: true,
        isAfterHours: false,
        nextOpen: this.getNextMarketOpen(est),
        nextClose: this.getNextMarketClose(est),
        session: 'premarket'
      };
    } else if (hour >= this.marketHours.regular.start && hour < this.marketHours.regular.end) {
      return {
        isOpen: true,
        isPremarket: false,
        isAfterHours: false,
        nextOpen: this.getNextMarketOpen(est),
        nextClose: this.getNextMarketClose(est),
        session: 'open'
      };
    } else if (hour >= this.marketHours.afterhours.start && hour < this.marketHours.afterhours.end) {
      return {
        isOpen: false,
        isPremarket: false,
        isAfterHours: true,
        nextOpen: this.getNextMarketOpen(est),
        nextClose: this.getNextMarketClose(est),
        session: 'afterhours'
      };
    } else {
      return this.createClosedStatus(est);
    }
  }

  private createClosedStatus(est: Date): MarketStatus {
    return {
      isOpen: false,
      isPremarket: false,
      isAfterHours: false,
      nextOpen: this.getNextMarketOpen(est),
      nextClose: this.getNextMarketClose(est),
      session: 'closed'
    };
  }

  private getNextMarketOpen(from: Date): Date {
    let nextOpen = new Date(from);
    nextOpen.setHours(9, 30, 0, 0); // 9:30 AM

    // If already past market open today, move to next business day
    const currentHour = from.getHours() + from.getMinutes() / 60;
    if (currentHour >= this.marketHours.regular.start) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }

    // Skip weekends and holidays
    while (this.isNonTradingDay(nextOpen)) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }

    return nextOpen;
  }

  private getNextMarketClose(from: Date): Date {
    let nextClose = new Date(from);
    nextClose.setHours(16, 0, 0, 0); // 4:00 PM

    // If already past market close today, move to next business day
    const currentHour = from.getHours() + from.getMinutes() / 60;
    if (currentHour >= this.marketHours.regular.end) {
      nextClose.setDate(nextClose.getDate() + 1);
      while (this.isNonTradingDay(nextClose)) {
        nextClose.setDate(nextClose.getDate() + 1);
      }
    }

    return nextClose;
  }

  private isNonTradingDay(date: Date): boolean {
    const day = date.getDay();
    const dateStr = date.toISOString().split('T')[0];
    
    return day === 0 || day === 6 || this.marketHolidays.includes(dateStr);
  }

  getUpdateFrequency(): { 
    momentum: number; 
    economic: number; 
    technical: number; 
    aiSummary: number;
  } {
    const status = this.getCurrentMarketStatus();
    
    if (status.isOpen) {
      // Market hours - frequent updates
      return {
        momentum: 2,     // Every 2 minutes
        economic: 30,    // Every 30 minutes
        technical: 10,   // Every 10 minutes
        aiSummary: 30    // Every 30 minutes
      };
    } else if (status.isPremarket || status.isAfterHours) {
      // Extended hours - moderate updates
      return {
        momentum: 15,    // Every 15 minutes
        economic: 60,    // Every hour
        technical: 30,   // Every 30 minutes
        aiSummary: 60    // Every hour
      };
    } else {
      // Market closed - minimal updates
      return {
        momentum: 60,    // Every hour
        economic: 240,   // Every 4 hours
        technical: 120,  // Every 2 hours
        aiSummary: 240   // Every 4 hours
      };
    }
  }

  shouldUpdateNow(lastUpdate: Date, dataType: keyof ReturnType<typeof this.getUpdateFrequency>): boolean {
    const frequencies = this.getUpdateFrequency();
    const frequencyMinutes = frequencies[dataType];
    const timeSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60);
    
    return timeSinceUpdate >= frequencyMinutes;
  }

  logMarketStatus(): void {
    const status = this.getCurrentMarketStatus();
    const frequencies = this.getUpdateFrequency();
    
    logger.info(`📊 Market Status: ${status.session.toUpperCase()}`, {
      isOpen: status.isOpen,
      session: status.session,
      frequencies
    });
  }
}

export const marketHoursDetector = new MarketHoursDetector();