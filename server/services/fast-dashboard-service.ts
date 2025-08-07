import { logger } from '../middleware/logging';
import { unifiedDashboardCache } from './unified-dashboard-cache';

interface DashboardData {
  component: string;
  data: any;
  timestamp: Date;
  isStale: boolean;
  loadTime: number;
  source: 'cache' | 'background' | 'fallback';
}

interface DataFreshness {
  fresh: boolean; // < 10 minutes
  recent: boolean; // 10-30 minutes
  stale: boolean; // > 30 minutes
  age: number; // minutes
  color: 'green' | 'yellow' | 'orange';
  indicator: '🟢' | '🟡' | '🟠';
}

export class FastDashboardService {
  
  /**
   * PARALLEL DASHBOARD LOADING - Load all dashboard components simultaneously
   */
  async getFastDashboardData(): Promise<{
    momentum: DashboardData;
    economic: DashboardData;
    technical: DashboardData;
    sentiment: DashboardData;
    totalLoadTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Load all dashboard components in parallel using Promise.all
      // Momentum analysis removed to conserve API quota
      const [economic, technical, sentiment] = await Promise.all([
        this.getFastEconomicReadings(),
        this.getFastTechnicalData(),
        this.getFastSentimentData()
      ]);
      
      const totalLoadTime = Date.now() - startTime;
      logger.info(`🚀 Parallel dashboard load completed in ${totalLoadTime}ms`);
      
      return {
        momentum: this.createFallbackData('momentum-analysis'),
        economic,
        technical,
        sentiment,
        totalLoadTime
      };
    } catch (error) {
      const totalLoadTime = Date.now() - startTime;
      logger.error('❌ Parallel dashboard load error:', error);
      
      // Return fallback data for all components
      return {
        momentum: this.createFallbackData('momentum-analysis'),
        economic: this.createFallbackData('economic-readings'),
        technical: this.createFallbackData('technical-data'),
        sentiment: this.createFallbackData('sentiment-data'),
        totalLoadTime
      };
    }
  }

  async getFastMomentumAnalysis(): Promise<DashboardData> {
    const startTime = Date.now();
    
    try {
      // Try background cache first
      const backgroundCache = unifiedDashboardCache.get('momentum-analysis-background');
      if (backgroundCache) {
        const loadTime = Date.now() - startTime;
        logger.info(`📊 Fast momentum served from background cache (${loadTime}ms)`);
        
        return {
          component: 'momentum-analysis',
          data: backgroundCache.data,
          timestamp: backgroundCache.timestamp,
          isStale: backgroundCache.data.isStale || false,
          loadTime,
          source: 'background'
        };
      }

      // Fallback to regular cache
      const regularCache = unifiedDashboardCache.get('momentum-analysis');
      if (regularCache) {
        const loadTime = Date.now() - startTime;
        logger.info(`📊 Fast momentum served from regular cache (${loadTime}ms)`);
        
        return {
          component: 'momentum-analysis',
          data: regularCache.data,
          timestamp: regularCache.timestamp,
          isStale: false,
          loadTime,
          source: 'cache'
        };
      }

      // Last resort - return minimal fallback structure
      const fallbackData = this.getMomentumFallback();
      const loadTime = Date.now() - startTime;
      
      logger.warn(`📊 Fast momentum using fallback data (${loadTime}ms)`);
      
      return {
        component: 'momentum-analysis',
        data: fallbackData,
        timestamp: new Date(),
        isStale: true,
        loadTime,
        source: 'fallback'
      };

    } catch (error) {
      const loadTime = Date.now() - startTime;
      logger.error('❌ Fast momentum analysis error:', error);
      
      return {
        component: 'momentum-analysis',
        data: this.getMomentumFallback(),
        timestamp: new Date(),
        isStale: true,
        loadTime,
        source: 'fallback'
      };
    }
  }

  async getFastEconomicReadings(): Promise<DashboardData> {
    const startTime = Date.now();
    
    try {
      // Try background cache first
      const backgroundCache = unifiedDashboardCache.get('economic-readings-background');
      if (backgroundCache) {
        const loadTime = Date.now() - startTime;
        logger.info(`📊 Fast economic served from background cache (${loadTime}ms)`);
        
        return {
          component: 'economic-readings',
          data: backgroundCache.data,
          timestamp: backgroundCache.timestamp,
          isStale: backgroundCache.data.isStale || false,
          loadTime,
          source: 'background'
        };
      }

      // Fallback to regular cache
      const regularCache = unifiedDashboardCache.get('recent-economic-openai');
      if (regularCache) {
        const loadTime = Date.now() - startTime;
        logger.info(`📊 Fast economic served from regular cache (${loadTime}ms)`);
        
        return {
          component: 'economic-readings',
          data: regularCache.data,
          timestamp: regularCache.timestamp,
          isStale: false,
          loadTime,
          source: 'cache'
        };
      }

      // Last resort - return fallback structure
      const fallbackData = this.getEconomicFallback();
      const loadTime = Date.now() - startTime;
      
      logger.warn(`📊 Fast economic using fallback data (${loadTime}ms)`);
      
      return {
        component: 'economic-readings',
        data: fallbackData,
        timestamp: new Date(),
        isStale: true,
        loadTime,
        source: 'fallback'
      };

    } catch (error) {
      const loadTime = Date.now() - startTime;
      logger.error('❌ Fast economic readings error:', error);
      
      return {
        component: 'economic-readings',
        data: this.getEconomicFallback(),
        timestamp: new Date(),
        isStale: true,
        loadTime,
        source: 'fallback'
      };
    }
  }

  async getFastFinancialMood(): Promise<DashboardData> {
    const startTime = Date.now();
    
    try {
      // Check existing financial mood cache
      const moodCache = unifiedDashboardCache.get('financial-mood');
      if (moodCache) {
        const loadTime = Date.now() - startTime;
        logger.info(`🎭 Fast financial mood served from cache (${loadTime}ms)`);
        
        return {
          component: 'financial-mood',
          data: moodCache.data,
          timestamp: moodCache.timestamp,
          isStale: false,
          loadTime,
          source: 'cache'
        };
      }

      // Generate quick mood based on available data
      const momentumData = await this.getFastMomentumAnalysis();
      const quickMood = this.generateQuickMood(momentumData.data);
      const loadTime = Date.now() - startTime;
      
      logger.info(`🎭 Fast financial mood generated quickly (${loadTime}ms)`);
      
      return {
        component: 'financial-mood',
        data: quickMood,
        timestamp: new Date(),
        isStale: true,
        loadTime,
        source: 'fallback'
      };

    } catch (error) {
      const loadTime = Date.now() - startTime;
      logger.error('❌ Fast financial mood error:', error);
      
      return {
        component: 'financial-mood',
        data: this.getMoodFallback(),
        timestamp: new Date(),
        isStale: true,
        loadTime,
        source: 'fallback'
      };
    }
  }

  async getFastAISummary(): Promise<DashboardData> {
    const startTime = Date.now();
    
    try {
      // Try background AI summary cache
      const backgroundCache = unifiedDashboardCache.get('ai-summary-background');
      if (backgroundCache) {
        const loadTime = Date.now() - startTime;
        logger.info(`🤖 Fast AI summary served from background cache (${loadTime}ms)`);
        
        return {
          component: 'ai-summary',
          data: backgroundCache.data,
          timestamp: backgroundCache.timestamp,
          isStale: backgroundCache.data.isStale || false,
          loadTime,
          source: 'background'
        };
      }

      // Generate minimal summary from cached data (momentum analysis removed to conserve API quota)
      const economic = await this.getFastEconomicReadings();
      const momentum = this.createFallbackData('momentum-analysis');

      const quickSummary = this.generateQuickSummary(momentum.data, economic.data);
      const loadTime = Date.now() - startTime;
      
      logger.info(`🤖 Fast AI summary generated from cached data (${loadTime}ms)`);
      
      return {
        component: 'ai-summary',
        data: quickSummary,
        timestamp: new Date(),
        isStale: true,
        loadTime,
        source: 'fallback'
      };

    } catch (error) {
      const loadTime = Date.now() - startTime;
      logger.error('❌ Fast AI summary error:', error);
      
      return {
        component: 'ai-summary',
        data: this.getSummaryFallback(),
        timestamp: new Date(),
        isStale: true,
        loadTime,
        source: 'fallback'
      };
    }
  }

  calculateDataFreshness(timestamp: Date): DataFreshness {
    const ageMs = Date.now() - timestamp.getTime();
    const ageMinutes = Math.floor(ageMs / (1000 * 60));

    if (ageMinutes < 10) {
      return {
        fresh: true,
        recent: false,
        stale: false,
        age: ageMinutes,
        color: 'green',
        indicator: '🟢'
      };
    } else if (ageMinutes < 30) {
      return {
        fresh: false,
        recent: true,
        stale: false,
        age: ageMinutes,
        color: 'yellow',
        indicator: '🟡'
      };
    } else {
      return {
        fresh: false,
        recent: false,
        stale: true,
        age: ageMinutes,
        color: 'orange',
        indicator: '🟠'
      };
    }
  }

  async getAllDashboardData(): Promise<{
    momentum: DashboardData;
    economic: DashboardData;
    mood: DashboardData;
    summary?: DashboardData;
    totalLoadTime: number;
    freshness: Record<string, DataFreshness>;
  }> {
    const startTime = Date.now();
    
    logger.info('🚀 Fast dashboard data loading started');

    // Load all components in parallel for maximum speed
    const [momentum, economic, mood] = await Promise.all([
      this.getFastMomentumAnalysis(),
      this.getFastEconomicReadings(),
      this.getFastFinancialMood()
    ]);

    const totalLoadTime = Date.now() - startTime;

    // Calculate freshness indicators
    const freshness = {
      momentum: this.calculateDataFreshness(momentum.timestamp),
      economic: this.calculateDataFreshness(economic.timestamp),
      mood: this.calculateDataFreshness(mood.timestamp)
    };

    logger.info(`✅ Fast dashboard loaded in ${totalLoadTime}ms`, {
      momentum: `${momentum.loadTime}ms (${momentum.source})`,
      economic: `${economic.loadTime}ms (${economic.source})`,
      mood: `${mood.loadTime}ms (${mood.source})`
    });

    return {
      momentum,
      economic,
      mood,
      totalLoadTime,
      freshness
    };
  }

  private getMomentumFallback(): any {
    return {
      momentumStrategies: [
        {
          sector: 'Loading...',
          ticker: 'N/A',
          momentum: 'updating',
          oneDayChange: '0.00',
          rsi: 50,
          signal: 'Data updating...'
        }
      ],
      isStale: true,
      message: 'Market data updating...'
    };
  }

  private getEconomicFallback(): any[] {
    return [
      {
        metric: 'Economic Data',
        current: 'Updating...',
        forecast: 'N/A',
        variance: 'N/A',
        impact: 'Pending'
      }
    ];
  }

  private getMoodFallback(): any {
    return {
      emoji: '🤔',
      mood: 'Analyzing',
      confidence: 50,
      reasoning: 'Market data is being processed. Refresh for updated analysis.',
      marketFactors: {
        momentum: 'Loading',
        technical: 'Loading',
        economic: 'Loading'
      },
      color: 'text-gray-400'
    };
  }

  private getSummaryFallback(): any {
    return {
      summary: 'Market analysis is being updated. Please refresh in a moment for the latest insights.',
      timestamp: new Date(),
      confidence: 0,
      isStale: true
    };
  }

  private generateQuickMood(momentumData: any): any {
    if (!momentumData?.momentumStrategies) {
      return this.getMoodFallback();
    }

    const strategies = momentumData.momentumStrategies;
    const bullishCount = strategies.filter((s: any) => 
      s.signal?.toLowerCase().includes('bullish')).length;
    const bearishCount = strategies.filter((s: any) => 
      s.signal?.toLowerCase().includes('bearish')).length;
    const total = strategies.length;
    const bullishRatio = bullishCount / total;

    if (bullishRatio > 0.6) {
      return {
        emoji: '😊',
        mood: 'Optimistic',
        confidence: 75,
        reasoning: `Market showing strength with ${bullishCount}/${total} sectors bullish.`,
        marketFactors: {
          momentum: 'Bullish',
          technical: 'Positive',
          economic: 'Mixed'
        },
        color: 'text-green-400'
      };
    } else if (bullishRatio < 0.4) {
      return {
        emoji: '😟',
        mood: 'Cautious',
        confidence: 70,
        reasoning: `Market showing weakness with ${bearishCount}/${total} sectors bearish.`,
        marketFactors: {
          momentum: 'Bearish',
          technical: 'Negative',
          economic: 'Mixed'
        },
        color: 'text-orange-400'
      };
    } else {
      return {
        emoji: '😐',
        mood: 'Neutral',
        confidence: 65,
        reasoning: `Mixed market signals with balanced sector performance.`,
        marketFactors: {
          momentum: 'Neutral',
          technical: 'Mixed',
          economic: 'Mixed'
        },
        color: 'text-gray-400'
      };
    }
  }

  private generateQuickSummary(momentumData: any, economicData: any): any {
    const bullishSectors = momentumData?.momentumStrategies?.filter((s: any) => 
      s.signal?.toLowerCase().includes('bullish')).length || 0;
    const total = momentumData?.momentumStrategies?.length || 12;
    
    let summary = `Market Update: ${bullishSectors}/${total} sectors showing bullish momentum. `;
    
    if (economicData && Array.isArray(economicData) && economicData.length > 0) {
      const positiveReadings = economicData.filter((reading: any) => 
        reading.variance?.includes('Better') || reading.impact === 'Positive').length;
      summary += `Economic indicators: ${positiveReadings}/${economicData.length} showing positive readings. `;
    }

    if (bullishSectors > total * 0.6) {
      summary += 'Overall market sentiment remains constructive with broad-based sector strength.';
    } else if (bullishSectors < total * 0.4) {
      summary += 'Market showing caution with defensive positioning across multiple sectors.';
    } else {
      summary += 'Mixed market conditions with selective sector rotation evident.';
    }

    return {
      summary,
      timestamp: new Date(),
      confidence: 60,
      isStale: true,
      source: 'quick-generation'
    };
  }
}

export const fastDashboardService = new FastDashboardService();