import { DateTime } from "luxon";

const ET = "America/New_York";
const OPEN = { hour: 9, minute: 30 };
const CLOSE = { hour: 16, minute: 0 };

// NYSE holiday calendar (keep updated yearly)
const HOLIDAYS_ET = new Set<string>([
  // 2025 holidays
  "2025-01-01", // New Year's Day
  "2025-01-20", // Martin Luther King Jr. Day
  "2025-02-17", // Presidents Day
  "2025-04-18", // Good Friday
  "2025-05-26", // Memorial Day
  "2025-06-19", // Juneteenth
  "2025-07-04", // Independence Day
  "2025-09-01", // Labor Day
  "2025-11-27", // Thanksgiving Day
  "2025-12-25", // Christmas Day
]);

// Half-day early close at 1:00 PM ET
const HALF_DAYS_ET = new Set<string>([
  "2025-07-03", // Day before Independence Day
  "2025-11-28", // Day after Thanksgiving
  "2025-12-24", // Christmas Eve
]);

function isTradingDay(dtEt: DateTime): boolean {
  const iso = dtEt.toISODate();
  if (!iso) return false;
  if (dtEt.weekday === 6 || dtEt.weekday === 7) return false; // Weekend
  if (HOLIDAYS_ET.has(iso)) return false;
  return true;
}

function todaySessionBounds(dtEt: DateTime) {
  const open = dtEt.set({ ...OPEN, second: 0, millisecond: 0 });
  const iso = dtEt.toISODate();
  const isHalf = iso ? HALF_DAYS_ET.has(iso) : false;
  const closeH = isHalf ? 13 : CLOSE.hour;
  const closeM = isHalf ? 0 : CLOSE.minute;
  const close = dtEt.set({ hour: closeH, minute: closeM, second: 0, millisecond: 0 });
  return { open, close, isHalf };
}

function nextTradingDayEt(dtEt: DateTime): DateTime {
  let d = dtEt.plus({ days: 1 }).startOf("day");
  while (!isTradingDay(d)) {
    d = d.plus({ days: 1 });
  }
  return d;
}

export interface MarketClockData {
  isOpen: boolean;
  isPremarket: boolean;
  isAfterHours: boolean;
  isHalfDay: boolean;
  session: 'premarket' | 'open' | 'afterhours' | 'closed';
  computedInZone: string;
  nowUtc: string;
  nextOpenUtc: string;
  nextCloseUtc: string | null;
}

export function computeMarketClock(): MarketClockData {
  const nowEt = DateTime.utc().setZone(ET);
  const tradingToday = isTradingDay(nowEt);
  const { open, close, isHalf } = todaySessionBounds(nowEt);

  // Premarket: 4:00 AM - 9:30 AM ET
  const premarketStart = nowEt.set({ hour: 4, minute: 0, second: 0, millisecond: 0 });
  
  // After hours: 4:00 PM - 8:00 PM ET (or 1:00 PM - 8:00 PM on half days)
  const afterHoursEnd = nowEt.set({ hour: 20, minute: 0, second: 0, millisecond: 0 });

  let isOpen = false;
  let isPremarket = false;
  let isAfterHours = false;
  let session: 'premarket' | 'open' | 'afterhours' | 'closed' = 'closed';
  let nextOpenEt: DateTime;
  let nextCloseEt: DateTime | null = null;

  if (tradingToday) {
    if (nowEt >= open && nowEt < close) {
      // Market is open
      isOpen = true;
      session = 'open';
      nextCloseEt = close;
      nextOpenEt = nextTradingDayEt(nowEt).set({ ...OPEN, second: 0, millisecond: 0 });
    } else if (nowEt >= premarketStart && nowEt < open) {
      // Premarket hours
      isPremarket = true;
      session = 'premarket';
      nextOpenEt = open;
    } else if (nowEt >= close && nowEt < afterHoursEnd) {
      // After hours
      isAfterHours = true;
      session = 'afterhours';
      nextOpenEt = nextTradingDayEt(nowEt).set({ ...OPEN, second: 0, millisecond: 0 });
    } else if (nowEt < premarketStart) {
      // Early morning before premarket
      nextOpenEt = open;
    } else {
      // Late evening after after hours
      nextOpenEt = nextTradingDayEt(nowEt).set({ ...OPEN, second: 0, millisecond: 0 });
    }
  } else {
    // No trading today, find next trading day
    const nextDay = nextTradingDayEt(nowEt);
    nextOpenEt = nextDay.set({ ...OPEN, second: 0, millisecond: 0 });
  }

  // Convert to UTC ISO strings for client
  const nowUtc = nowEt.toUTC().toISO() || new Date().toISOString();
  const nextOpenUtc = nextOpenEt.toUTC().toISO() || new Date().toISOString();
  const nextCloseUtc = nextCloseEt ? nextCloseEt.toUTC().toISO() : null;
  
  // Debug the close conversion issue
  if (nextCloseEt) {
    console.log('🔍 CLOSE CONVERSION DEBUG:', {
      etTime: nextCloseEt.toString(),
      etHour: nextCloseEt.hour,
      utcTime: nextCloseUtc,
      shouldBe20UTC: nextCloseEt.hour === 16 ? 'YES (20:00)' : 'NO'
    });
  }

  return {
    isOpen,
    isPremarket,
    isAfterHours,
    isHalfDay: isHalf,
    session,
    computedInZone: ET,
    nowUtc,
    nextOpenUtc,
    nextCloseUtc
  };
}