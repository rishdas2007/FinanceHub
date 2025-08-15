import { sql } from 'drizzle-orm';
import { db } from '../../db';

interface DailyClose {
  date: string;
  close: number;
}

export async function loadDailyCloses(symbol: string, days: number = 30): Promise<DailyClose[] | null> {
  try {
    const result = await db.execute(sql`
      select ts_utc::date as date, close
      from equity_daily_bars
      where symbol = ${symbol}
        and ts_utc >= current_date - interval '${sql.raw(days.toString())} days'
      order by ts_utc asc
      limit ${days};
    `);
    
    return (result.rows as any[]).map(row => ({
      date: row.date,
      close: Number(row.close)
    }));
  } catch (error) {
    console.warn(`Failed to load daily closes for ${symbol}:`, error);
    return null;
  }
}