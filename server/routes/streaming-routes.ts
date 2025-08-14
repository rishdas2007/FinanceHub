// Streaming data routes for large dataset access
// Provides endpoints for streaming large financial datasets

import { Router } from 'express';
import { enhancedStreamingService } from '../services/streaming-query-enhanced.js';

const router = Router();

// Stream ETF historical data
router.get('/etf-historical/:symbols', async (req, res) => {
  try {
    const symbols = req.params.symbols.split(',');
    const startDate = new Date(req.query.start as string || '2020-01-01');
    const endDate = new Date(req.query.end as string || new Date().toISOString());
    const format = req.query.format as string || 'json';

    // Validate input
    if (symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one symbol is required'
      });
    }

    if (symbols.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 symbols allowed per stream'
      });
    }

    // Set appropriate headers for streaming
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    let isFirstChunk = true;
    let rowCount = 0;

    // Start streaming response
    if (format === 'json') {
      res.write('{"data":[');
    } else if (format === 'csv') {
      res.write('symbol,date,open,high,low,close,volume,price_change,price_change_percent\n');
    }

    try {
      for await (const batch of enhancedStreamingService.streamETFHistoricalData(symbols, startDate, endDate)) {
        for (const row of batch) {
          if (format === 'json') {
            if (!isFirstChunk) res.write(',');
            res.write(JSON.stringify(row));
          } else if (format === 'csv') {
            res.write(`${row.symbol},${row.date},${row.open},${row.high},${row.low},${row.close},${row.volume},${row.price_change},${row.price_change_percent}\n`);
          }
          
          isFirstChunk = false;
          rowCount++;
        }

        // Flush data to client
        if (res.flushHeaders) {
          res.flushHeaders();
        }
      }

      // Close the response
      if (format === 'json') {
        res.write(`],"count":${rowCount},"timestamp":"${new Date().toISOString()}"}`);
      }

      res.end();

    } catch (streamError) {
      console.error('Streaming error:', streamError);
      if (format === 'json') {
        res.write(']}');
      }
      res.end();
    }

  } catch (error) {
    console.error('ETF streaming route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stream ETF historical data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Stream economic time series data
router.get('/economic-series/:seriesIds', async (req, res) => {
  try {
    const seriesIds = req.params.seriesIds.split(',');
    const startDate = new Date(req.query.start as string || '2020-01-01');
    const endDate = new Date(req.query.end as string || new Date().toISOString());
    const includeFeatures = req.query.features === 'true';

    // Validate input
    if (seriesIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one series ID is required'
      });
    }

    // Set streaming headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    let isFirstChunk = true;
    let rowCount = 0;

    res.write('{"series":[');

    try {
      for await (const batch of enhancedStreamingService.streamEconomicTimeSeries(seriesIds, startDate, endDate)) {
        for (const row of batch) {
          if (!isFirstChunk) res.write(',');
          
          const responseRow = {
            series_id: row.series_id,
            period_end: row.period_end,
            value: row.value_std,
            transform_code: row.transform_code
          };

          if (includeFeatures) {
            Object.assign(responseRow, {
              level_z: row.level_z,
              trend_z: row.trend_z,
              volatility_z: row.volatility_z,
              z_score_composite: row.z_score_composite,
              signal_strength: row.signal_strength
            });
          }

          res.write(JSON.stringify(responseRow));
          isFirstChunk = false;
          rowCount++;
        }

        // Flush periodically
        if (res.flushHeaders) {
          res.flushHeaders();
        }
      }

      res.write(`],"count":${rowCount},"timestamp":"${new Date().toISOString()}"}`);
      res.end();

    } catch (streamError) {
      console.error('Economic series streaming error:', streamError);
      res.write(']}');
      res.end();
    }

  } catch (error) {
    console.error('Economic series streaming route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stream economic series data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get streaming statistics
router.get('/stats', (req, res) => {
  try {
    const stats = enhancedStreamingService.getStreamingStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get streaming statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cancel active streams (admin endpoint)
router.post('/cancel-all', (req, res) => {
  try {
    const cancelledCount = enhancedStreamingService.cancelAllStreams();
    
    res.json({
      success: true,
      message: `Cancelled ${cancelledCount} active streams`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to cancel streams',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Stream with custom aggregation
router.get('/aggregated/:type', async (req, res) => {
  try {
    const type = req.params.type; // 'daily', 'weekly', 'monthly'
    const symbols = (req.query.symbols as string || '').split(',').filter(Boolean);
    
    if (symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Symbols parameter is required'
      });
    }

    // Create aggregation pipeline
    const etfTransform = enhancedStreamingService.createETFTransform();
    const aggregationTransform = enhancedStreamingService.createAggregationTransform('symbol');

    const query = `
      SELECT symbol, date, close, volume, 
             EXTRACT(${type === 'weekly' ? 'week' : type === 'monthly' ? 'month' : 'day'} FROM date) as period
      FROM stock_data 
      WHERE symbol = ANY($1) 
      AND date >= CURRENT_DATE - INTERVAL '1 year'
      ORDER BY symbol, date
    `;

    const streamResult = await enhancedStreamingService.streamWithPipeline(
      query,
      [symbols],
      [etfTransform, aggregationTransform]
    );

    // Set streaming headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    let isFirstChunk = true;
    res.write('{"aggregatedData":[');

    streamResult.on('data', (chunk) => {
      if (!isFirstChunk) res.write(',');
      res.write(JSON.stringify(chunk));
      isFirstChunk = false;
    });

    streamResult.on('end', () => {
      res.write(`],"timestamp":"${new Date().toISOString()}"}`);
      res.end();
    });

    streamResult.on('error', (error) => {
      console.error('Aggregation stream error:', error);
      res.write(']}');
      res.end();
    });

  } catch (error) {
    console.error('Aggregated streaming route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stream aggregated data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as streamingRoutes };