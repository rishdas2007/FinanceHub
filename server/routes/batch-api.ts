import express from 'express';
import { logger } from '../middleware/logging';
import { batchAPIService } from '../services/batch-api-service';

const router = express.Router();

// Endpoint to add requests to batch queue
router.post('/batch/add', async (req, res) => {
  try {
    const { requests } = req.body;
    
    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({
        success: false,
        error: 'Requests array is required'
      });
    }

    // Validate request format
    const validRequests = requests.filter(req => 
      req.id && req.endpoint && typeof req.id === 'string' && typeof req.endpoint === 'string'
    );

    if (validRequests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid requests found. Each request needs id and endpoint fields.'
      });
    }

    const results = await batchAPIService.addToBatch(validRequests);
    
    res.json({
      success: true,
      processed: validRequests.length,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Batch API add error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint to get queue status
router.get('/batch/status', (req, res) => {
  try {
    const status = batchAPIService.getQueueStatus();
    
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Batch API status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint to clear the queue (emergency use)
router.post('/batch/clear', (req, res) => {
  try {
    const clearedCount = batchAPIService.clearQueue();
    
    res.json({
      success: true,
      message: `Cleared ${clearedCount} requests from queue`,
      clearedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Batch API clear error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint for bulk ETF metrics request
router.post('/batch/etf-metrics', async (req, res) => {
  try {
    const { symbols } = req.body;
    
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        success: false,
        error: 'Symbols array is required'
      });
    }

    // Create batch requests for each symbol
    const batchRequests = symbols.map((symbol, index) => ({
      id: `etf-${symbol}-${Date.now()}-${index}`,
      endpoint: 'technical-indicators',
      params: { symbol },
      priority: 'high' as const
    }));

    const results = await batchAPIService.addToBatch(batchRequests);
    
    res.json({
      success: true,
      processed: batchRequests.length,
      results: results.filter(r => r.success).map(r => r.data),
      errors: results.filter(r => !r.success),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Batch ETF metrics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;