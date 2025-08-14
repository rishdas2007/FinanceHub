import { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { getCache, setCache } from '../cache/unified-dashboard-cache';

// Removed getSparkline12M function - no longer needed

// Mapping of series IDs to display names and metadata
const ECONOMIC_SERIES_MAP = {
  'DGS10': { 
    name: '10-Year Treasury Yield', 
    type: 'Leading', 
    category: 'Monetary Policy',
    unit: '%',
    hasRobustData: true
  },
  'PAYEMS': { 
    name: 'Average Hourly Earnings', 
    type: 'Lagging', 
    category: 'Labor',
    unit: 'USD',
    hasRobustData: true
  },
  'UNRATE': { 
    name: 'Unemployment Rate', 
    type: 'Leading', 
    category: 'Labor',
    unit: '%',
    hasRobustData: true
  },
  'CPIAUCSL': { 
    name: 'CPI All Items (Δ-adjusted)', 
    type: 'Lagging', 
    category: 'Inflation',
    unit: '%',
    hasRobustData: true
  },
  'T10Y2Y': { 
    name: 'Yield Curve (10yr-2yr)', 
    type: 'Leading', 
    category: 'Monetary Policy',
    unit: 'Index Pt',
    hasRobustData: true
  },
  'T10YIE': { 
    name: '10Y Breakeven Inflation', 
    type: 'Leading', 
    category: 'Monetary Policy',
    unit: '%',
    hasRobustData: true
  }
};

export const getEconomicPulse = async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(10, Number(req.query.limit) || 5));
  const cacheKey = `economic-pulse:${limit}:v1`;
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  try {
    // Get latest data for our key economic indicators with robust historical data
    const seriesIds = Object.keys(ECONOMIC_SERIES_MAP).slice(0, limit);
    
    const out = [];
    for (const seriesId of seriesIds) {
      const series = ECONOMIC_SERIES_MAP[seriesId as keyof typeof ECONOMIC_SERIES_MAP];
      const transform = 'LEVEL'; // Default transform
      
      // Get current and prior values
      const latest = await db.execute(sql`
        select period_end, value_std
        from econ_series_observation
        where series_id = ${seriesId}
          and transform_code = ${transform}
        order by period_end desc
        limit 2;
      `);
      
      if (latest.rows.length === 0) continue;
      
      const current = latest.rows[0] as { period_end: string; value_std: number };
      const prior = latest.rows[1] as { period_end: string; value_std: number } | undefined;
      
      // Calculate variance
      const vsPrior = prior ? current.value_std - prior.value_std : 0;
      
      // Get Z-Score from features table if available
      const zScoreQuery = await db.execute(sql`
        select level_z
        from econ_series_features
        where series_id = ${seriesId}
        limit 1;
      `);
      const zScore = (zScoreQuery.rows[0] as { level_z: number } | undefined)?.level_z || null;
      
      // Removed 12M sparkline data - no longer needed
      
      // Format values appropriately
      const formatValue = (val: number) => {
        if (series.unit === '%') return `${val.toFixed(2)}%`;
        if (series.unit === 'USD') return `$${val.toFixed(2)}`;
        return val.toFixed(2);
      };
      
      out.push({
        seriesId,
        metric: series.name,
        type: series.type,
        category: series.category,
        period: current.period_end,
        currentReading: formatValue(current.value_std),
        priorReading: prior ? formatValue(prior.value_std) : 'N/A',
        varianceFromPrior: vsPrior >= 0 ? `+${vsPrior.toFixed(2)}` : vsPrior.toFixed(2),
        zScore: zScore ? zScore.toFixed(2) : '0.00',
        deltaZScore: '0.00', // Placeholder for now
        releaseDate: current.period_end,
        period_date: current.period_end
      });
    }
    
    // Cache for 5 minutes
    await setCache(cacheKey, out, 5 * 60 * 1000);
    
    res.json({ success: true, data: out });
    
  } catch (error) {
    console.error('Error fetching economic pulse data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch economic pulse data',
      timestamp: new Date().toISOString()
    });
  }
};