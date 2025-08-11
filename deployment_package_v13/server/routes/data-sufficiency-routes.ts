import { Router } from 'express';
import { HistoricalDataBackfillService } from '../services/historical-data-backfill-service';
import { logger } from '../utils/logger';

const router = Router();
const backfillService = new HistoricalDataBackfillService();

/**
 * Get data sufficiency report for a specific symbol
 */
router.get('/sufficiency/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const report = await backfillService.getDataSufficiencyForSymbol(symbol.toUpperCase());
    
    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting data sufficiency report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate data sufficiency report',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get data sufficiency warning for z-score calculations
 */
router.get('/warning/:symbol/:dataPoints', async (req, res) => {
  try {
    const { symbol, dataPoints } = req.params;
    const warning = await backfillService.getDataSufficiencyWarning(
      symbol.toUpperCase(),
      parseInt(dataPoints)
    );
    
    res.json({
      success: true,
      data: warning,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting data sufficiency warning:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate data sufficiency warning',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Execute strategic historical data backfill
 */
router.post('/backfill', async (req, res) => {
  try {
    const { symbols, targetMonths = 18 } = req.body;
    
    logger.info(`Starting strategic backfill for symbols: ${symbols?.join(', ') || 'default symbols'}`);
    
    const results = await backfillService.executeStrategicBackfill(symbols, targetMonths);
    
    const summary = {
      totalSymbols: results.length,
      successful: results.filter(r => r.completionStatus === 'complete').length,
      partial: results.filter(r => r.completionStatus === 'partial').length,
      failed: results.filter(r => r.completionStatus === 'failed').length,
      totalRecords: results.reduce((sum, r) => sum + r.recordsAdded, 0),
      totalApiCalls: results.reduce((sum, r) => sum + r.apiCallsUsed, 0)
    };
    
    res.json({
      success: true,
      data: {
        results,
        summary
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error executing strategic backfill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute strategic backfill',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Generate comprehensive data sufficiency reports for multiple symbols
 */
router.post('/reports', async (req, res) => {
  try {
    const { symbols } = req.body;
    const defaultSymbols = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'];
    
    const reports = await backfillService.generateDataSufficiencyReports(symbols || defaultSymbols);
    
    // Calculate aggregate statistics
    const summary = {
      totalSymbols: reports.length,
      highReliability: reports.filter(r => r.reliability === 'high').length,
      mediumReliability: reports.filter(r => r.reliability === 'medium').length,
      lowReliability: reports.filter(r => r.reliability === 'low').length,
      unreliable: reports.filter(r => r.reliability === 'unreliable').length,
      averageConfidence: reports.reduce((sum, r) => sum + r.confidence, 0) / reports.length,
      averageSufficiency: reports.reduce((sum, r) => sum + r.sufficiencyRatio, 0) / reports.length
    };
    
    res.json({
      success: true,
      data: {
        reports,
        summary
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating data sufficiency reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate data sufficiency reports',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;