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

export function getMarketHoursInfo(): { 
  isOpen: boolean; 
  message: string; 
  timestamp: string;
  nextOpen: string;
  nextClose: string;
  session: 'open' | 'closed' | 'premarket' | 'afterhours';
} {
  const isOpen = isMarketOpen();
  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  
  const { nextOpen, nextClose, session } = getNextMarketTimes(estTime);
  
  return {
    isOpen,
    message: isOpen ? "Live Market Data" : "As of 4:00 PM ET (Market Closed)",
    timestamp: estTime.toISOString(),
    nextOpen,
    nextClose,
    session
  };
}

/**
 * Calculate next market open and close times in Eastern Time
 */
export function getNextMarketTimes(currentEtTime: Date): {
  nextOpen: string;
  nextClose: string;
  session: 'open' | 'closed' | 'premarket' | 'afterhours';
} {
  const dayOfWeek = currentEtTime.getDay();
  const hours = currentEtTime.getHours();
  const minutes = currentEtTime.getMinutes();
  const currentTimeMinutes = hours * 60 + minutes;
  
  // Market hours in minutes since midnight
  const marketOpenMinutes = 9 * 60 + 30; // 9:30 AM
  const marketCloseMinutes = 16 * 60; // 4:00 PM
  
  // Helper to create ET date
  const createEtDate = (date: Date, hour: number, minute: number = 0) => {
    const etDate = new Date(date);
    etDate.setHours(hour, minute, 0, 0);
    // Convert to UTC by adding the ET offset
    const etOffset = getEtOffset(etDate);
    etDate.setMinutes(etDate.getMinutes() + etOffset);
    return etDate.toISOString();
  };
  
  let nextOpen: string;
  let nextClose: string;
  let session: 'open' | 'closed' | 'premarket' | 'afterhours' = 'closed';
  
  // Check if it's a weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Weekend - next open is Monday 9:30 AM
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2; // Sunday = 1 day, Saturday = 2 days
    const nextMonday = new Date(currentEtTime);
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    
    nextOpen = createEtDate(nextMonday, 9, 30);
    nextClose = createEtDate(nextMonday, 16, 0);
    session = 'closed';
  }
  // Weekday logic
  else if (currentTimeMinutes < marketOpenMinutes) {
    // Before market open - premarket
    nextOpen = createEtDate(currentEtTime, 9, 30);
    nextClose = createEtDate(currentEtTime, 16, 0);
    session = 'premarket';
  }
  else if (currentTimeMinutes >= marketOpenMinutes && currentTimeMinutes < marketCloseMinutes) {
    // Market is open
    nextClose = createEtDate(currentEtTime, 16, 0);
    // Next open is tomorrow at 9:30 AM (or Monday if it's Friday)
    const tomorrow = new Date(currentEtTime);
    const daysToAdd = dayOfWeek === 5 ? 3 : 1; // Friday adds 3 days (to Monday), others add 1
    tomorrow.setDate(tomorrow.getDate() + daysToAdd);
    nextOpen = createEtDate(tomorrow, 9, 30);
    session = 'open';
  }
  else {
    // After hours
    const tomorrow = new Date(currentEtTime);
    const daysToAdd = dayOfWeek === 5 ? 3 : 1; // Friday adds 3 days (to Monday), others add 1
    tomorrow.setDate(tomorrow.getDate() + daysToAdd);
    nextOpen = createEtDate(tomorrow, 9, 30);
    nextClose = createEtDate(tomorrow, 16, 0);
    session = 'afterhours';
  }
  
  return { nextOpen, nextClose, session };
}

/**
 * Get Eastern Time offset in minutes (accounts for DST)
 */
function getEtOffset(date: Date): number {
  // Create two dates: one in ET, one in UTC
  const utcDate = new Date(date.toISOString());
  const etDate = new Date(date.toLocaleString("en-US", { timeZone: "America/New_York" }));
  
  // Calculate the difference in minutes
  return (utcDate.getTime() - etDate.getTime()) / (1000 * 60);
}

export function getMarketStatus(): string {
  const isOpen = isMarketOpen();
  return isOpen ? "OPEN" : "CLOSED";
}

export function getDataTimestamp(): string {
  const { message } = getMarketHoursInfo();
  return message;
}