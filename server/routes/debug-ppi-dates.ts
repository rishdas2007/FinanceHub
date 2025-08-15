import { Router } from 'express';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * DEBUG: Check raw PPI dates in database to identify date mismatch issue
 */
router.get('/', async (req, res) => {
  try {
    logger.info('🔍 Debug PPI dates request');
    
    // Check raw data in database for PPI series
    const ppiDebugData = await db.execute(sql`
      SELECT 
        eso.series_id,
        esd.label,
        eso.period_end,
        eso.value_standardized,
        eso.value_raw,
        eso.created_at,
        TO_CHAR(eso.period_end, 'MM/DD/YYYY') as period_end_formatted,
        TO_CHAR(eso.created_at, 'MM/DD/YYYY HH24:MI:SS') as created_at_formatted
      FROM econ_series_observation eso
      INNER JOIN econ_series_def esd ON eso.series_id = esd.series_id
      WHERE eso.series_id IN ('PPIACO', 'WPUSOP3000', 'PPIFIS', 'PPIENG', 'PPIFGS')
      ORDER BY eso.series_id, eso.period_end DESC
      LIMIT 20
    `);

    // Also check what the economic indicators API is returning
    const economicApiData = await db.execute(sql`
      SELECT 
        series_id,
        label,
        period_end,
        value_standardized,
        release_date,
        TO_CHAR(period_end, 'MM/DD/YYYY') as period_formatted,
        TO_CHAR(release_date, 'MM/DD/YYYY') as release_formatted
      FROM econ_series_observation eso
      INNER JOIN econ_series_def esd ON eso.series_id = esd.series_id
      WHERE eso.series_id IN ('PPIACO', 'WPUSOP3000', 'PPIFIS')
        AND eso.period_end >= '2025-05-01'
      ORDER BY eso.period_end DESC, eso.series_id
      LIMIT 15
    `);

    const debugResult = {
      status: 'debug',
      timestamp: new Date().toISOString(),
      
      raw_ppi_data: ppiDebugData.rows.map(row => ({
        series_id: row.series_id,
        label: row.label,
        period_end: row.period_end,
        period_end_formatted: row.period_end_formatted,
        value_standardized: row.value_standardized,
        value_raw: row.value_raw,
        created_at_formatted: row.created_at_formatted
      })),
      
      recent_ppi_data: economicApiData.rows.map(row => ({
        series_id: row.series_id,
        label: row.label,
        period_end: row.period_end,
        period_formatted: row.period_formatted,
        release_formatted: row.release_formatted,
        value_standardized: row.value_standardized
      })),
      
      analysis: {
        question_1: "Do the period_end dates show 2025-06-30 for June PPI data?",
        question_2: "Are we displaying period_end or release_date in the frontend?",
        question_3: "Is there a date transformation bug in the display logic?",
        
        expected_june_date: "2025-06-30",
        currently_showing: "5/31/2025",
        should_show: "6/30/2025"
      }
    };

    res.json(debugResult);
    
  } catch (error) {
    logger.error('Debug PPI dates failed:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;