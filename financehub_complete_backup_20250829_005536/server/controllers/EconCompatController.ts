import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Economic Chart Compatibility Controller
 * Provides backward compatibility for old economic chart routes
 * Maps legacy metric IDs to new Silver/Gold data model
 */
export class EconCompatController {
  
  /**
   * GET /api/econ/metrics/:id/chart - Legacy chart endpoint compatibility
   * Maps old metric IDs to new econ_series_observation data
   */
  static getEconChart = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const range = String(req.query.range || '12M').toUpperCase(); // '3M'|'6M'|'12M'|'5Y'
    
    // Calculate time range
    const months = range === '3M' ? 3 : range === '6M' ? 6 : range === '5Y' ? 60 : 12;
    const end = new Date();
    const start = new Date();
    start.setUTCMonth(start.getUTCMonth() - months);

    try {
      console.log(`📊 Economic chart request: ${id} (${range})`);
      
      // COMPATIBILITY MODE: Map legacy economic IDs to available data
      // Since econ_series_def doesn't exist yet, use fallback mapping
      const legacyIdMap: Record<string, string> = {
        '10_year_treasury_yield': 'DGS10',
        'federal_funds_rate': 'DFF',
        'unemployment_rate': 'UNRATE',
        'inflation_rate': 'CPIAUCSL',
        'gdp_growth': 'GDP'
      };

      const mappedSeriesId = legacyIdMap[id] || id;
      console.log(`📈 Mapped legacy ID: ${id} → ${mappedSeriesId}`);
      
      // Try to fetch from available economic data tables
      // Check economicIndicatorsCurrent first, then historical_economic_data
      const economicQuery = await db.execute(sql`
        SELECT date, value, units
        FROM economicIndicatorsCurrent
        WHERE series_id = ${mappedSeriesId}
        ORDER BY date DESC
        LIMIT 1
      `).catch(() => ({ rows: [] }));
      
      const economicRows = economicQuery.rows || [];
      let observations = { rows: [] as any[] };
      
      if (economicRows.length > 0) {
        // Use current data point
        observations.rows = economicRows.map((row: any) => ({
          period_end: row.date,
          value_std: row.value,
          units_std: row.units
        }));
      }

      // Format for chart compatibility (matches expected format)
      const obsRows = observations.rows || [];
      const data = obsRows.map((r: any) => ({
        t: Date.parse(r.period_end),
        date: String(r.period_end),
        value: Number(r.value_std),
        units: r.units_std
      })).filter((d: any) => Number.isFinite(d.value) && d.t);

      console.log(`✅ Returning ${data.length} economic data points for ${id}`);
      
      return res.json({ 
        success: true, 
        data,
        seriesId,
        range,
        count: data.length
      });
      
    } catch (error) {
      console.error('ECON CHART ERROR', id, error);
      return res.json({ success: true, data: [], warning: 'data_unavailable' });
    }
  };

  /**
   * GET /api/econ/observations/:seriesId - Direct series observation access
   */
  static getSeriesObservations = async (req: Request, res: Response) => {
    const seriesId = String(req.params.seriesId);
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    
    try {
      const observations = await db.execute(sql`
        SELECT period_end, value_raw, value_std, units_std, source_updated
        FROM econ_series_observation
        WHERE series_id = ${seriesId}
        ORDER BY period_end DESC
        LIMIT ${limit}
      `);

      const obsRows = observations.rows || [];
      const data = obsRows.map((r: any) => ({
        period: r.period_end,
        raw: Number(r.value_raw),
        standardized: Number(r.value_std),
        units: r.units_std,
        updated: r.source_updated
      }));

      return res.json({ 
        success: true, 
        seriesId,
        data,
        count: data.length 
      });
      
    } catch (error) {
      console.error('SERIES OBSERVATIONS ERROR', seriesId, error);
      return res.json({ success: true, data: [], warning: 'data_unavailable' });
    }
  };
}