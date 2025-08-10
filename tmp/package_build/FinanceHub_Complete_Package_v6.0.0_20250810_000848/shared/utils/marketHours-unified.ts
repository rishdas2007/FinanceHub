/**
 * Unified Market Hours Utilities
 * Consolidates all market hours logic from scattered implementations
 */

export function isMarketOpen(): boolean {
  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  
  // Check if it's a weekend
  const dayOfWeek = estTime.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday = 0, Saturday = 6
    return false;
  }
  
  // Market hours: 9:30 AM - 4:00 PM EST
  const hours = estTime.getHours();
  const minutes = estTime.getMinutes();
  
  // Convert to minutes since midnight for easier comparison
  const currentTimeMinutes = hours * 60 + minutes;
  const marketOpenMinutes = 9 * 60 + 30; // 9:30 AM
  const marketCloseMinutes = 16 * 60; // 4:00 PM
  
  return currentTimeMinutes >= marketOpenMinutes && currentTimeMinutes < marketCloseMinutes;
}

export function getMarketHoursInfo(): { isOpen: boolean; message: string; timestamp: string } {
  const isOpen = isMarketOpen();
  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  
  return {
    isOpen,
    message: isOpen ? "Live Market Data" : "As of 4:00 PM ET (Market Closed)",
    timestamp: estTime.toISOString()
  };
}

export function getMarketStatus(): string {
  const isOpen = isMarketOpen();
  return isOpen ? "OPEN" : "CLOSED";
}

export function getDataTimestamp(): string {
  const { message } = getMarketHoursInfo();
  return message;
}