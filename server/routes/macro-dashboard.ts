import { Router } from 'express';
import { db } from '../db';
import { economicIndicatorsCurrent } from '@shared/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';

const router = Router();

// GDP Data endpoint
router.get('/gdp-data', async (req, res) => {
  try {
    console.log('🏦 Fetching GDP data from database...');
    
    // Get GDP-related indicators from our database
    const gdpIndicators = await db
      .select()
      .from(economicIndicatorsCurrent)
      .where(sql`series_id IN ('GDP', 'GDPC1', 'A191RL1Q225SBEA')`)
      .orderBy(desc(economicIndicatorsCurrent.periodDate))
      .limit(20);

    if (!gdpIndicators.length) {
      console.log('⚠️ No GDP data found in database');
      return res.json({
        success: false,
        message: 'GDP data not available',
        data: null
      });
    }

    console.log(`✅ Found ${gdpIndicators.length} GDP data points`);

    // Transform data for frontend
    const gdpData = {
      nominal: 28000, // Will be calculated from actual data
      real: 26500,    // Will be calculated from actual data
      quarterlyGrowth: 2.4,
      annualGrowth: 3.1,
      trend: 'up' as const,
      lastUpdated: new Date().toISOString(),
      indicators: gdpIndicators.map(item => ({
        seriesId: item.seriesId,
        value: parseFloat(item.valueNumeric) || 0,
        date: item.periodDate,
        title: item.metric,
        units: item.unit
      }))
    };

    res.json({
      success: true,
      data: gdpData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ GDP data fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch GDP data',
      timestamp: new Date().toISOString()
    });
  }
});

// Inflation Data endpoint
router.get('/inflation-data', async (req, res) => {
  try {
    console.log('📊 Fetching inflation data from database...');
    
    // Get inflation-related indicators (CPI, PCE)
    const inflationIndicators = await db
      .select()
      .from(economicIndicatorsCurrent)
      .where(sql`series_id IN ('CPIAUCSL', 'CPILFESL', 'PCEPI', 'PCEPILFE')`)
      .orderBy(desc(economicIndicatorsCurrent.periodDate))
      .limit(24); // Last 6 months * 4 indicators

    if (!inflationIndicators.length) {
      console.log('⚠️ No inflation data found in database');
      return res.json({
        success: false,
        message: 'Inflation data not available',
        data: null
      });
    }

    console.log(`✅ Found ${inflationIndicators.length} inflation data points`);

    // Transform data for frontend
    const inflationData = {
      headline: 2.6,
      core: 2.4,
      target: 2.0,
      trend: 'down' as const,
      lastUpdated: new Date().toISOString(),
      indicators: inflationIndicators.map(item => ({
        seriesId: item.seriesId,
        value: parseFloat(item.valueNumeric) || 0,
        date: item.periodDate,
        title: item.metric,
        units: item.unit
      }))
    };

    res.json({
      success: true,
      data: inflationData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Inflation data fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inflation data',
      timestamp: new Date().toISOString()
    });
  }
});

// Quarterly Data endpoint
router.get('/quarterly-data', async (req, res) => {
  try {
    console.log('📈 Fetching quarterly economic data...');
    
    // Get quarterly indicators for the last 5 quarters
    const quarterlyIndicators = await db
      .select()
      .from(economicIndicatorsCurrent)
      .where(sql`series_id IN ('GDP', 'GDPC1', 'A191RL1Q225SBEA')`)
      .orderBy(desc(economicIndicatorsCurrent.periodDate))
      .limit(10);

    console.log(`✅ Found ${quarterlyIndicators.length} quarterly data points`);

    // Sample quarterly data structure
    const quarterlyData = [
      { quarter: 'Q2 2024', nominal: 679.0, real: 624.0, growth: 3.1 },
      { quarter: 'Q1 2024', nominal: 674.0, real: 622.0, growth: -0.5 },
      { quarter: 'Q4 2023', nominal: 672.0, real: 620.0, growth: 2.4 },
      { quarter: 'Q3 2023', nominal: 668.0, real: 618.0, growth: 1.2 },
      { quarter: 'Q2 2023', nominal: 665.0, real: 615.0, growth: 3.0 }
    ];

    res.json({
      success: true,
      data: {
        quarters: quarterlyData,
        indicators: quarterlyIndicators.map(item => ({
          seriesId: item.seriesId,
          value: parseFloat(item.valueNumeric) || 0,
          date: item.periodDate,
          title: item.metric,
          units: item.unit
        })),
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Quarterly data fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quarterly data',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;