import { logger } from '../middleware/logging';
import { marketHoursDetector } from './market-hours-detector';
import { smartCache } from './smart-cache';
import OpenAI from 'openai';

interface APICallResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
  retryCount: number;
}

interface CachedDataEntry {
  data: any;
  timestamp: Date;
  isStale: boolean;
  source: 'api' | 'cache' | 'fallback';
}

export class BackgroundDataFetcher {
  private openai: OpenAI;
  private retryDelays = [1000, 2000, 5000, 10000]; // Exponential backoff

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async fetchMomentumData(): Promise<APICallResult> {
    const startTime = Date.now();
    let retryCount = 0;

    while (retryCount < this.retryDelays.length) {
      try {
        logger.info(`📈 Fetching momentum data (attempt ${retryCount + 1})`);
        
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('http://localhost:5000/api/momentum-analysis', {
          timeout: 10000
        } as any);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const duration = Date.now() - startTime;

        logger.info(`✅ Momentum data fetched successfully in ${duration}ms`);
        
        // Store in cache
        smartCache.set('momentum-analysis-background', data, '30m');
        
        return {
          success: true,
          data,
          timestamp: new Date(),
          retryCount
        };

      } catch (error) {
        retryCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        logger.warn(`❌ Momentum data fetch failed (attempt ${retryCount}): ${errorMsg}`);
        
        if (retryCount < this.retryDelays.length) {
          await this.delay(this.retryDelays[retryCount - 1]);
        }
      }
    }

    // All retries failed - mark existing cache as stale but preserve it
    const existingCache = smartCache.get('momentum-analysis-background');
    if (existingCache) {
      logger.info('📊 Marking existing momentum data as stale');
      smartCache.set('momentum-analysis-background', {
        ...existingCache.data,
        isStale: true,
        lastAttempt: new Date()
      }, '30m');
    }

    return {
      success: false,
      error: 'All retry attempts failed',
      timestamp: new Date(),
      retryCount
    };
  }

  async fetchEconomicReadings(): Promise<APICallResult> {
    const startTime = Date.now();
    let retryCount = 0;

    while (retryCount < this.retryDelays.length) {
      try {
        logger.info(`📊 Fetching economic readings (attempt ${retryCount + 1})`);
        
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('http://localhost:5000/api/recent-economic-openai', {
          timeout: 15000
        } as any);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const duration = Date.now() - startTime;

        logger.info(`✅ Economic readings fetched successfully in ${duration}ms`);
        
        // Store in cache
        smartCache.set('economic-readings-background', data, '1h');
        
        return {
          success: true,
          data,
          timestamp: new Date(),
          retryCount
        };

      } catch (error) {
        retryCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        logger.warn(`❌ Economic readings fetch failed (attempt ${retryCount}): ${errorMsg}`);
        
        if (retryCount < this.retryDelays.length) {
          await this.delay(this.retryDelays[retryCount - 1]);
        }
      }
    }

    // Use fallback economic data to maintain functionality
    const fallbackData = this.getFallbackEconomicData();
    smartCache.set('economic-readings-background', {
      ...fallbackData,
      isStale: true,
      lastAttempt: new Date()
    }, '1h');

    return {
      success: false,
      error: 'All retry attempts failed, using fallback data',
      timestamp: new Date(),
      retryCount
    };
  }

  async generateAISummary(): Promise<APICallResult> {
    const startTime = Date.now();
    let retryCount = 0;

    try {
      logger.info('🤖 Generating AI summary from cached data');

      // Get latest cached data
      const momentumCache = smartCache.get('momentum-analysis-background');
      const economicCache = smartCache.get('economic-readings-background');

      if (!momentumCache || !economicCache) {
        throw new Error('Required cached data not available');
      }

      const prompt = this.buildSummaryPrompt(momentumCache.data, economicCache.data);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst creating a concise market summary. Focus on key trends, sector rotation, and economic implications. Keep it under 200 words.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 250,
      });

      const summary = response.choices[0].message.content;
      const duration = Date.now() - startTime;

      logger.info(`✅ AI summary generated successfully in ${duration}ms`);

      const summaryData = {
        summary,
        timestamp: new Date(),
        dataAge: {
          momentum: momentumCache.timestamp,
          economic: economicCache.timestamp
        },
        confidence: 85
      };

      // Store in cache
      smartCache.set('ai-summary-background', summaryData, '1h');

      return {
        success: true,
        data: summaryData,
        timestamp: new Date(),
        retryCount: 0
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`❌ AI summary generation failed: ${errorMsg}`);

      // Keep previous summary if available, just update timestamp
      const existingCache = smartCache.get('ai-summary-background');
      if (existingCache) {
        logger.info('📊 Keeping previous AI summary, marked as stale');
        smartCache.set('ai-summary-background', {
          ...existingCache.data,
          isStale: true,
          lastAttempt: new Date()
        }, '1h');
      }

      return {
        success: false,
        error: errorMsg,
        timestamp: new Date(),
        retryCount: 0
      };
    }
  }

  private buildSummaryPrompt(momentumData: any, economicData: any): string {
    let prompt = 'MARKET SUMMARY REQUEST:\n\n';
    
    if (momentumData?.momentumStrategies) {
      const bullish = momentumData.momentumStrategies.filter((s: any) => 
        s.signal?.toLowerCase().includes('bullish')).length;
      const bearish = momentumData.momentumStrategies.filter((s: any) => 
        s.signal?.toLowerCase().includes('bearish')).length;
      
      prompt += `SECTOR MOMENTUM: ${bullish} bullish, ${bearish} bearish out of ${momentumData.momentumStrategies.length} sectors\n`;
      prompt += `TOP PERFORMER: ${momentumData.momentumStrategies[0]?.sector} (${momentumData.momentumStrategies[0]?.oneDayChange}%)\n`;
    }

    if (economicData && Array.isArray(economicData)) {
      prompt += `\nECONOMIC READINGS (${economicData.length} indicators):\n`;
      economicData.slice(0, 3).forEach((reading: any, i: number) => {
        prompt += `${i + 1}. ${reading.metric}: ${reading.current} vs ${reading.forecast}\n`;
      });
    }

    prompt += '\nGenerate a concise market summary highlighting key trends and implications.';
    return prompt;
  }

  private getFallbackEconomicData(): any[] {
    return [
      {
        metric: 'Initial Jobless Claims',
        current: '221K',
        forecast: '225K',
        variance: '-4K',
        impact: 'Positive'
      },
      {
        metric: 'Retail Sales',
        current: '0.6%',
        forecast: '0.4%',
        variance: '+0.2%',
        impact: 'Positive'
      },
      {
        metric: 'Producer Price Index',
        current: '0.0%',
        forecast: '0.1%',
        variance: '-0.1%',
        impact: 'Positive'
      }
    ];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runCompleteDataUpdate(): Promise<{
    momentum: APICallResult;
    economic: APICallResult;
    aiSummary: APICallResult;
    totalDuration: number;
  }> {
    const startTime = Date.now();
    logger.info('🔄 Starting complete background data update');

    // Check market status first
    marketHoursDetector.logMarketStatus();

    // Run data fetching in parallel for speed
    const [momentumResult, economicResult] = await Promise.all([
      this.fetchMomentumData(),
      this.fetchEconomicReadings()
    ]);

    // Generate AI summary after data is available
    const aiResult = await this.generateAISummary();

    const totalDuration = Date.now() - startTime;
    
    logger.info(`✅ Complete background update finished in ${totalDuration}ms`, {
      momentum: momentumResult.success,
      economic: economicResult.success,
      ai: aiResult.success
    });

    return {
      momentum: momentumResult,
      economic: economicResult,
      aiSummary: aiResult,
      totalDuration
    };
  }
}

export const backgroundDataFetcher = new BackgroundDataFetcher();