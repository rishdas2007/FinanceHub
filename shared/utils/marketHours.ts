/**
 * Centralized market hours utility
 * Eliminates redundant market hours logic across the codebase
 */

export interface MarketHoursInfo {
  isOpen: boolean;
  isWeekend: boolean;
  currentETTime: Date;
  nextMarketOpen?: Date;
  nextMarketClose?: Date;
}

/**
 * Check if US stock market is currently open
 * Market Hours: 9:30 AM - 4:00 PM ET, Monday-Friday
 */
// Re-export from unified utility  
export { isMarketOpen, getMarketStatus, getDataTimestamp } from './marketHours-unified';

/**
 * Get comprehensive market hours information
 */
export function getMarketHoursInfo(): MarketHoursInfo {
  const now = new Date();
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dayOfWeek = etTime.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  return {
    isOpen: isMarketOpen(),
    isWeekend,
    currentETTime: etTime,
  };
}

/**
 * Get the last trading day
 * Used for economic analysis and data fetching
 */
export function getLastTradingDay(): Date {
  const { isOpen, currentETTime } = getMarketHoursInfo();
  const lastTradingDay = new Date(currentETTime);
  
  if (isOpen) {
    // Market is open, return current day
    return lastTradingDay;
  }
  
  // Market is closed, find the previous trading day
  let dayOffset = 0;
  do {
    dayOffset++;
    lastTradingDay.setDate(currentETTime.getDate() - dayOffset);
    const dayOfWeek = lastTradingDay.getDay();
    
    // If it's a weekday, it's a trading day
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      break;
    }
  } while (dayOffset < 7); // Safety check
  
  return lastTradingDay;
}

/**
 * Get multiple past trading days for analysis
 */
export function getPastTradingDays(count: number): Date[] {
  const tradingDays: Date[] = [];
  const { currentETTime } = getMarketHoursInfo();
  let currentDay = new Date(currentETTime);
  
  while (tradingDays.length < count) {
    const dayOfWeek = currentDay.getDay();
    
    // If it's a weekday, add it as a trading day
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      tradingDays.push(new Date(currentDay));
    }
    
    // Move to previous day
    currentDay.setDate(currentDay.getDate() - 1);
  }
  
  return tradingDays;
}

/**
 * Check if a date is a trading day (Monday-Friday)
 */
export function isTradingDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}