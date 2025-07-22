/**
 * Unified market hours utility - consolidating all market time logic
 * Replaces scattered implementations across the codebase
 */

export function isMarketOpen(): boolean {
  const now = new Date();
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hour = etTime.getHours();
  const minute = etTime.getMinutes();
  const dayOfWeek = etTime.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Market is open Monday-Friday, 9:30 AM - 4:00 PM ET
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isMarketHours = (hour > 9 || (hour === 9 && minute >= 30)) && hour < 16;
  
  return isWeekday && isMarketHours;
}

export function getMarketStatus(): {
  isOpen: boolean;
  status: 'open' | 'closed' | 'pre-market' | 'after-hours';
  nextOpen?: Date;
  timezone: string;
} {
  const now = new Date();
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hour = etTime.getHours();
  const minute = etTime.getMinutes();
  const dayOfWeek = etTime.getDay();
  
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isMarketHours = (hour > 9 || (hour === 9 && minute >= 30)) && hour < 16;
  const isPreMarket = isWeekday && hour >= 4 && (hour < 9 || (hour === 9 && minute < 30));
  const isAfterHours = isWeekday && hour >= 16 && hour < 20;
  
  let status: 'open' | 'closed' | 'pre-market' | 'after-hours';
  
  if (isMarketHours) {
    status = 'open';
  } else if (isPreMarket) {
    status = 'pre-market';
  } else if (isAfterHours) {
    status = 'after-hours';
  } else {
    status = 'closed';
  }
  
  return {
    isOpen: isMarketHours,
    status,
    timezone: 'America/New_York'
  };
}

export function formatMarketTimestamp(includeSeconds: boolean = false): string {
  const now = new Date();
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const { isOpen } = getMarketStatus();
  
  const timeFormat = includeSeconds ? 
    etTime.toLocaleTimeString("en-US", { timeZone: "America/New_York" }) :
    etTime.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: '2-digit', minute: '2-digit' });
  
  const status = isOpen ? "Market Open" : "Market Closed";
  return `${timeFormat} ET (${status})`;
}