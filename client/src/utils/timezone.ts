// Timezone utility functions for market status display

/**
 * Get user's timezone, fallback to ET
 */
export function getUserTimezone(): string {
  try {
    return Intl?.DateTimeFormat?.().resolvedOptions().timeZone || 'America/New_York';
  } catch {
    return 'America/New_York'; // fallback to ET
  }
}

/**
 * Format UTC ISO string for display in user's timezone
 */
export function formatMarketTime(isoUtc: string | null, userTz?: string): string {
  if (!isoUtc) return '—';
  
  const tz = userTz || getUserTimezone();
  
  try {
    const date = new Date(isoUtc);
    
    // Timezone conversion debug (remove after fix)
    console.log('🕐 timezone debug:', { input: isoUtc, output: date.toLocaleString("en-US", { timeZone: tz }) });
    
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    console.warn('Failed to format market time:', error);
    return '—';
  }
}

/**
 * Get current date/time in user's timezone
 */
export function getCurrentTimeInUserTz(userTz?: string): string {
  const tz = userTz || getUserTimezone();
  
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date());
  } catch (error) {
    console.warn('Failed to get current time:', error);
    return new Date().toLocaleString();
  }
}