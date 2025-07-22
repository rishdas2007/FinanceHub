/**
 * Unified Market Hours Utility
 * Single source of truth for all market hours logic
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

export function getMarketStatus(): 'open' | 'closed' | 'pre-market' | 'after-hours' {
  const now = new Date();
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hour = etTime.getHours();
  const minute = etTime.getMinutes();
  const dayOfWeek = etTime.getDay();
  
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  
  if (!isWeekday) return 'closed';
  
  const currentTime = hour * 60 + minute;
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM
  
  if (currentTime >= marketOpen && currentTime < marketClose) {
    return 'open';
  } else if (currentTime < marketOpen) {
    return 'pre-market';
  } else {
    return 'after-hours';
  }
}

export function formatMarketTimestamp(): string {
  const now = new Date();
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const status = getMarketStatus();
  
  const timeStr = etTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York'
  });
  
  return `${timeStr} ET (Market ${status === 'open' ? 'Open' : 'Closed'})`;
}