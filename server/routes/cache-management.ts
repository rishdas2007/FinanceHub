import { Router } from 'express';
import { intelligentCache } from '../services/intelligent-cache-system';

const router = Router();

// Force refresh economic indicators cache
router.post('/invalidate/economic-indicators', async (req, res) => {
  try {
    // Clear all economic indicators related cache
    const keys = [
      'economic-indicators-v1',
      'economic-indicators-enhanced-v1',
      'fred-series-metadata'
    ];
    
    let clearedCount = 0;
    for (const key of keys) {
      if (await intelligentCache.invalidate(key)) {
        clearedCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Cleared ${clearedCount} economic indicators cache entries`,
      clearedKeys: keys,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear economic indicators cache',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test FRED API with new key
router.post('/test-fred-api', async (req, res) => {
  try {
    const fredApiKey = process.env.FRED_API_KEY;
    if (!fredApiKey) {
      return res.status(400).json({ error: 'FRED_API_KEY not found in environment' });
    }

    const axios = (await import('axios')).default;
    
    // Test the correct FRED endpoint for series metadata
    const testUrl = 'https://api.stlouisfed.org/fred/series';
    const response = await axios.get(testUrl, {
      params: {
        series_id: 'CPIAUCSL',
        api_key: fredApiKey,
        file_type: 'json'
      },
      timeout: 15000
    });

    const series = response.data?.series?.[0];
    
    res.json({
      success: true,
      message: 'FRED API test successful',
      apiKey: fredApiKey.substring(0, 8) + '...',
      testSeries: 'CPIAUCSL',
      lastUpdated: series?.last_updated,
      seriesData: {
        id: series?.id,
        title: series?.title,
        last_updated: series?.last_updated,
        frequency: series?.frequency
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'FRED API test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Force refresh economic indicators with new FRED API key
router.post('/refresh-economic-indicators', async (req, res) => {
  try {
    // Clear all related caches
    const keys = [
      'economic-indicators-v1',
      'economic-indicators-enhanced-v1',
      'fred-series-metadata'
    ];
    
    for (const key of keys) {
      await intelligentCache.invalidate(key);
    }
    
    // Force fresh fetch with new API key
    const { economicIndicatorsService } = await import('../services/economic-indicators');
    const indicators = await economicIndicatorsService.getEconomicIndicators();
    
    res.json({
      success: true,
      message: 'Economic indicators refreshed with new FRED API key',
      indicatorCount: indicators.length,
      indicators: indicators.map(i => ({
        metric: i.metric,
        lastUpdated: i.lastUpdated,
        source: i.source
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to refresh economic indicators',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;