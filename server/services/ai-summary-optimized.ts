import OpenAI from 'openai';
// Simple in-memory cache for this service
class SimpleCache {
  private cache = new Map<string, { data: any; expiry: number }>();

  get(key: string, allowStale = false): any {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (!allowStale && Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }
}

const cacheService = new SimpleCache();

const log = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args)
};

interface AISummaryData {
  momentum?: any;
  technical?: any;
  economic?: any[];
  timestamps: {
    momentum?: string;
    technical?: string;
    economic?: string;
  };
}

interface AISummaryResponse {
  analysis: string;
  dataAge: string;
  timestamp: string;
  success: boolean;
  dataSources: {
    momentum: boolean;
    technical: boolean;
    economic: boolean;
  };
}

class AISummaryOptimizedService {
  private openai: OpenAI;
  private readonly CACHE_DURATIONS = {
    marketHours: 5 * 60 * 1000,    // 5 minutes during market hours
    afterHours: 15 * 60 * 1000,    // 15 minutes after hours
    weekends: 30 * 60 * 1000       // 30 minutes on weekends
  };

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateAISummary(): Promise<AISummaryResponse> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey();
      const cached = cacheService.get(cacheKey);
      if (cached) {
        log.info('✅ AI Summary served from cache');
        return cached;
      }

      // Collect real data from existing sources
      const data = await this.collectRealData();
      
      // Validate data completeness
      if (!this.validateDataCompleteness(data)) {
        return {
          analysis: 'Market data is currently updating, please refresh in a moment',
          dataAge: 'Data updating',
          timestamp: new Date().toISOString(),
          success: false,
          dataSources: {
            momentum: false,
            technical: false,
            economic: false
          }
        };
      }

      // Generate AI analysis with timeout
      const analysis = await this.generateAnalysisWithTimeout(data);
      
      // Cache successful result
      const response: AISummaryResponse = {
        analysis,
        dataAge: this.calculateDataAge(data.timestamps),
        timestamp: new Date().toISOString(),
        success: true,
        dataSources: {
          momentum: !!data.momentum,
          technical: !!data.technical,
          economic: !!(data.economic && data.economic.length > 0)
        }
      };

      const cacheDuration = this.getCurrentCacheDuration();
      cacheService.set(cacheKey, response, cacheDuration);
      
      log.info(`✅ AI Summary generated and cached for ${cacheDuration/1000/60} minutes`);
      return response;

    } catch (error) {
      log.error('❌ AI Summary generation failed:', error);
      
      // Try to return stale cached data with warning
      const staleCacheKey = this.getCacheKey();
      const staleData = cacheService.get(staleCacheKey, true); // Allow stale
      
      if (staleData) {
        return {
          ...staleData,
          dataAge: 'Cached analysis (data may be stale)',
          success: false
        };
      }

      return {
        analysis: 'AI analysis is temporarily updating',
        dataAge: 'Service updating',
        timestamp: new Date().toISOString(),
        success: false,
        dataSources: {
          momentum: false,
          technical: false,
          economic: false
        }
      };
    }
  }

  private async collectRealData(): Promise<AISummaryData> {
    const data: AISummaryData = {
      timestamps: {}
    };

    try {
      // Collect momentum data (parallel execution)
      const [momentumResult, technicalResult, economicResult] = await Promise.allSettled([
        this.getMomentumData(),
        this.getTechnicalData(),
        this.getEconomicData()
      ]);

      if (momentumResult.status === 'fulfilled') {
        data.momentum = momentumResult.value.data;
        data.timestamps.momentum = momentumResult.value.timestamp;
      }

      if (technicalResult.status === 'fulfilled') {
        data.technical = technicalResult.value.data;
        data.timestamps.technical = technicalResult.value.timestamp;
      }

      if (economicResult.status === 'fulfilled') {
        data.economic = economicResult.value.data;
        data.timestamps.economic = economicResult.value.timestamp;
      }

    } catch (error) {
      log.error('❌ Error collecting real data:', error);
    }

    return data;
  }

  private async getMomentumData(): Promise<{ data: any; timestamp: string }> {
    try {
      // Import and use existing momentum service
      const { simplifiedSectorAnalysisService } = await import('./simplified-sector-analysis');
      const momentum = await simplifiedSectorAnalysisService.getSimplifiedMomentumAnalysis();
      
      return {
        data: momentum,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error('Momentum data unavailable');
    }
  }

  private async getTechnicalData(): Promise<{ data: any; timestamp: string }> {
    try {
      // Get fresh technical data from existing service
      const { financialDataService } = await import('./financial-data');
      const technicalData = await financialDataService.getTechnicalIndicators('SPY');
      
      return {
        data: technicalData,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log.error('Technical data fetch failed:', error);
      throw new Error('Technical data unavailable');
    }
  }

  private async getEconomicData(): Promise<{ data: any[]; timestamp: string }> {
    try {
      // Use existing OpenAI economic readings service for consistent data
      const { openaiEconomicReadingsService } = await import('./openai-economic-readings');
      const economicReadings = await openaiEconomicReadingsService.generateEconomicReadings();
      
      return {
        data: economicReadings,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log.error('Economic data fetch failed:', error);
      throw new Error('Economic data unavailable');
    }
  }

  private validateDataCompleteness(data: AISummaryData): boolean {
    // Require at least one data source to be available
    return !!(data.momentum || data.technical || (data.economic && data.economic.length > 0));
  }

  private async generateAnalysisWithTimeout(data: AISummaryData): Promise<string> {
    const prompt = this.buildAnalysisPrompt(data);
    
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('AI analysis timeout (10 seconds)'));
      }, 10000);

      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a financial analyst. Provide concise market analysis in 3-4 sentences using only the provided real data. Include specific metrics and dates.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 300
        });

        clearTimeout(timeout);
        const analysis = response.choices[0].message.content;
        if (!analysis) {
          throw new Error('No analysis content received');
        }
        resolve(analysis);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private buildAnalysisPrompt(data: AISummaryData): string {
    let prompt = 'Analyze the current market conditions based on this real data:\n\n';

    if (data.momentum) {
      prompt += `MOMENTUM DATA (${data.timestamps.momentum}):\n`;
      prompt += `Sector performance trends from ${data.momentum.momentumStrategies?.length || 0} sectors\n\n`;
    }

    if (data.technical) {
      prompt += `TECHNICAL DATA (${data.timestamps.technical}):\n`;
      prompt += `SPY RSI: ${data.technical.rsi || 'N/A'}, VIX: ${data.technical.vix || 'N/A'}\n\n`;
    }

    if (data.economic && data.economic.length > 0) {
      prompt += `ECONOMIC DATA (${data.timestamps.economic}):\n`;
      data.economic.forEach((reading: any) => {
        prompt += `${reading.metric}: ${reading.value} (${reading.category})\n`;
      });
      prompt += '\n';
    }

    prompt += 'Provide a brief analysis focusing on market sentiment, momentum, and recent economic impacts. Keep to 3-4 sentences with specific data points.';

    return prompt;
  }

  private calculateDataAge(timestamps: AISummaryData['timestamps']): string {
    const now = Date.now();
    const ages: string[] = [];

    Object.entries(timestamps).forEach(([source, timestamp]) => {
      if (timestamp) {
        const ageMinutes = Math.floor((now - new Date(timestamp).getTime()) / 60000);
        if (ageMinutes < 2) {
          ages.push(`${source}: Live`);
        } else if (ageMinutes < 10) {
          ages.push(`${source}: Recent`);
        } else {
          ages.push(`${source}: ${ageMinutes}m old`);
        }
      }
    });

    return ages.length > 0 ? ages.join(', ') : 'Data updating';
  }

  private getCacheKey(): string {
    return 'ai-summary-optimized-v1';
  }

  private getCurrentCacheDuration(): number {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();

    // Weekend cache
    if (day === 0 || day === 6) {
      return this.CACHE_DURATIONS.weekends;
    }

    // Market hours (9:30 AM - 4:00 PM EST)
    if (hour >= 9 && hour < 16) {
      return this.CACHE_DURATIONS.marketHours;
    }

    // After hours
    return this.CACHE_DURATIONS.afterHours;
  }

  private isMarketHours(): boolean {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Weekend
    if (day === 0 || day === 6) return false;

    // Market hours (9:30 AM - 4:00 PM EST)
    if (hour < 9 || hour > 16) return false;
    if (hour === 9 && minute < 30) return false;

    return true;
  }
}

export const aiSummaryOptimizedService = new AISummaryOptimizedService();