import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { cpus } from 'os';
import { logger } from '../middleware/logging';
import { optimizedZScoreCalculator } from './optimized-zscore-calculator';
import { zScoreCalculationCircuitBreaker } from './zscore-circuit-breaker';
import { optimizedDbPool } from './optimized-db-pool';

interface ZScoreTask {
  symbol: string;
  historicalData: number[];
  currentValue: number;
  vixLevel: number;
  marketData?: any;
}

interface ZScoreWorkerResult {
  symbol: string;
  result: any;
  error?: string;
  processingTime: number;
}

/**
 * Parallel Z-Score Processor using Worker Threads
 * Distributes z-score calculations across multiple CPU cores for improved performance
 */
export class ParallelZScoreProcessor {
  private workerPool: Worker[] = [];
  private readonly poolSize: number;
  private taskQueue: ZScoreTask[] = [];
  private activeWorkers: Set<number> = new Set();
  private workerResults: Map<string, ZScoreWorkerResult> = new Map();

  constructor(poolSize?: number) {
    this.poolSize = poolSize || Math.min(4, cpus().length);
    logger.info(`🔧 Parallel Z-Score Processor initialized with ${this.poolSize} workers`);
  }

  /**
   * Initialize worker pool
   */
  private async initializeWorkerPool(): Promise<void> {
    if (this.workerPool.length > 0) return; // Already initialized

    try {
      logger.info('🚀 Initializing worker thread pool...');

      for (let i = 0; i < this.poolSize; i++) {
        const worker = new Worker(__filename, {
          workerData: { isWorker: true, workerId: i }
        });

        worker.on('message', (result: ZScoreWorkerResult) => {
          this.handleWorkerResult(result);
        });

        worker.on('error', (error) => {
          logger.error(`💥 Worker ${i} error:`, error);
          this.restartWorker(i);
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            logger.warn(`⚠️ Worker ${i} exited with code ${code}`);
            this.restartWorker(i);
          }
        });

        this.workerPool[i] = worker;
      }

      logger.info(`✅ Worker pool initialized with ${this.poolSize} threads`);

    } catch (error) {
      logger.error('💥 Failed to initialize worker pool:', error);
      throw error;
    }
  }

  /**
   * Restart a failed worker
   */
  private restartWorker(workerId: number): void {
    try {
      if (this.workerPool[workerId]) {
        this.workerPool[workerId].terminate();
      }

      const newWorker = new Worker(__filename, {
        workerData: { isWorker: true, workerId }
      });

      newWorker.on('message', (result: ZScoreWorkerResult) => {
        this.handleWorkerResult(result);
      });

      this.workerPool[workerId] = newWorker;
      this.activeWorkers.delete(workerId);

      logger.info(`🔄 Worker ${workerId} restarted successfully`);

    } catch (error) {
      logger.error(`💥 Failed to restart worker ${workerId}:`, error);
    }
  }

  /**
   * Handle result from worker thread
   */
  private handleWorkerResult(result: ZScoreWorkerResult): void {
    this.workerResults.set(result.symbol, result);
    
    if (result.error) {
      logger.error(`💥 Worker calculation failed for ${result.symbol}:`, result.error);
    } else {
      logger.debug(`✅ Z-score calculated for ${result.symbol} in ${result.processingTime}ms`);
    }
  }

  /**
   * Split array into chunks for parallel processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Process all ETFs in parallel using worker threads
   */
  async processAllETFs(symbols: string[], vixLevel: number = 20): Promise<Map<string, any>> {
    const startTime = Date.now();
    
    try {
      await this.initializeWorkerPool();

      logger.info(`🧮 Processing ${symbols.length} ETFs in parallel across ${this.poolSize} workers`);

      // Fetch historical data for all symbols
      const tasks = await Promise.all(
        symbols.map(async (symbol) => {
          const historicalData = await this.getHistoricalDataForSymbol(symbol);
          const currentValue = historicalData[0] || 0;
          
          return {
            symbol,
            historicalData: historicalData.slice(1), // Remove current value
            currentValue,
            vixLevel,
            marketData: await this.getMarketDataForSymbol(symbol)
          };
        })
      );

      // Distribute tasks to workers
      await this.distributeTasks(tasks);

      // Wait for all results
      const results = await this.waitForAllResults(symbols);

      const totalTime = Date.now() - startTime;
      logger.info(`✅ Parallel z-score processing completed in ${totalTime}ms`);

      return results;

    } catch (error) {
      logger.error('💥 Parallel z-score processing failed:', error);
      throw error;
    }
  }

  /**
   * Distribute tasks to available workers
   */
  private async distributeTasks(tasks: ZScoreTask[]): Promise<void> {
    const chunks = this.chunkArray(tasks, Math.ceil(tasks.length / this.poolSize));
    
    const promises = chunks.map((chunk, index) => {
      const workerId = index % this.poolSize;
      this.activeWorkers.add(workerId);
      
      return new Promise<void>((resolve) => {
        this.workerPool[workerId].postMessage({ tasks: chunk });
        // Note: Resolution handled by worker message handler
        setTimeout(resolve, 100); // Immediate return for async processing
      });
    });

    await Promise.all(promises);
  }

  /**
   * Wait for all worker results
   */
  private async waitForAllResults(symbols: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const timeout = 30000; // 30 second timeout
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkResults = () => {
        // Check if all results are ready
        const completedSymbols = symbols.filter(symbol => 
          this.workerResults.has(symbol)
        );

        if (completedSymbols.length === symbols.length) {
          // All results ready
          for (const symbol of symbols) {
            const workerResult = this.workerResults.get(symbol);
            if (workerResult && !workerResult.error) {
              results.set(symbol, workerResult.result);
            }
          }
          resolve(results);
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeout) {
          logger.warn('⏰ Parallel z-score processing timeout reached');
          
          // Return partial results
          for (const symbol of completedSymbols) {
            const workerResult = this.workerResults.get(symbol);
            if (workerResult && !workerResult.error) {
              results.set(symbol, workerResult.result);
            }
          }
          resolve(results);
          return;
        }

        // Continue waiting
        setTimeout(checkResults, 100);
      };

      checkResults();
    });
  }

  /**
   * Get historical data for symbol (optimized query)
   */
  private async getHistoricalDataForSymbol(symbol: string): Promise<number[]> {
    try {
      const data = await optimizedDbPool.getZScoreBaseData(symbol, 756);
      return data.map(row => parseFloat(row.close));
      
    } catch (error) {
      logger.error(`💥 Failed to fetch historical data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get market data for factor loading calculations
   */
  private async getMarketDataForSymbol(symbol: string): Promise<any> {
    try {
      // Simplified market data - in production, this would fetch from market data service
      const query = `
        SELECT symbol, 
               COALESCE(beta, 1.0) as beta,
               COALESCE(momentum, 0.0) as momentum,
               COALESCE(volatility, 1.0) as volatility
        FROM etf_metrics 
        WHERE symbol = $1 
        ORDER BY updated_at DESC 
        LIMIT 1
      `;
      
      const result = await optimizedDbPool.query(query, [symbol]);
      return result.rows[0] || { beta: 1.0, momentum: 0.0, volatility: 1.0 };
      
    } catch (error) {
      logger.warn(`⚠️ Failed to fetch market data for ${symbol}, using defaults`);
      return { beta: 1.0, momentum: 0.0, volatility: 1.0 };
    }
  }

  /**
   * Process single ETF with circuit breaker protection
   */
  async processSingleETF(symbol: string, vixLevel: number = 20): Promise<any> {
    return await zScoreCalculationCircuitBreaker.executeWithCircuitBreaker(
      async () => {
        const historicalData = await this.getHistoricalDataForSymbol(symbol);
        const currentValue = historicalData[0] || 0;
        const marketData = await this.getMarketDataForSymbol(symbol);

        return await optimizedZScoreCalculator.calculateEnhancedZScore(
          symbol,
          historicalData.slice(1),
          currentValue,
          marketData,
          vixLevel
        );
      },
      `z-score-calculation-${symbol}`
    );
  }

  /**
   * Get processing performance statistics
   */
  getPerformanceStats(): any {
    return {
      workerPoolSize: this.poolSize,
      activeWorkers: this.activeWorkers.size,
      completedCalculations: this.workerResults.size,
      calculatorStats: optimizedZScoreCalculator.getPerformanceReport(),
      circuitBreakerStatus: zScoreCalculationCircuitBreaker.getStatus()
    };
  }

  /**
   * Graceful shutdown of worker pool
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🛑 Shutting down parallel z-score processor...');

      const shutdownPromises = this.workerPool.map(async (worker, index) => {
        try {
          await worker.terminate();
          logger.debug(`✅ Worker ${index} terminated successfully`);
        } catch (error) {
          logger.warn(`⚠️ Error terminating worker ${index}:`, error);
        }
      });

      await Promise.all(shutdownPromises);
      this.workerPool = [];
      this.activeWorkers.clear();
      
      logger.info('✅ Parallel z-score processor shut down successfully');

    } catch (error) {
      logger.error('💥 Error during parallel processor shutdown:', error);
      throw error;
    }
  }
}

// Worker thread code
if (!isMainThread && workerData?.isWorker) {
  const workerId = workerData.workerId;
  
  // Listen for tasks from main thread
  parentPort?.on('message', async ({ tasks }: { tasks: ZScoreTask[] }) => {
    for (const task of tasks) {
      const startTime = Date.now();
      
      try {
        const result = await optimizedZScoreCalculator.calculateEnhancedZScore(
          task.symbol,
          task.historicalData,
          task.currentValue,
          task.marketData,
          task.vixLevel
        );

        const processingTime = Date.now() - startTime;

        parentPort?.postMessage({
          symbol: task.symbol,
          result,
          processingTime
        } as ZScoreWorkerResult);

      } catch (error) {
        const processingTime = Date.now() - startTime;
        
        parentPort?.postMessage({
          symbol: task.symbol,
          result: null,
          error: (error as Error).message,
          processingTime
        } as ZScoreWorkerResult);
      }
    }
  });
}

// Export singleton instance
export const parallelZScoreProcessor = new ParallelZScoreProcessor();