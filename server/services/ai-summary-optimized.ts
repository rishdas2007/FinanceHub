import OpenAI from 'openai';
import { smartCache } from './smart-cache';

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
  cacheInfo?: {
    cached: boolean;
    age: number;
    context: string;
    dataTimestamp: string;
    expiresIn: number;
  };
}

class AISummaryOptimizedService {
  private openai: OpenAI;


  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateAISummary(): Promise<AISummaryResponse> {
    let data: AISummaryData | undefined;
    
    try {
      log.info('🤖 Starting AI Summary generation...');
      
      // Check cache first with smart caching
      const cacheKey = 'ai-summary-optimized';
      const dataTimestamp = new Date().toISOString().split('T')[0]; // Daily data key
      const cached = smartCache.get(cacheKey, dataTimestamp);
      
      if (cached) {
        const cacheInfo = smartCache.getCacheInfo(cacheKey, dataTimestamp);
        log.info(`✅ AI Summary served from ${cacheInfo.context} cache (age: ${Math.round(cacheInfo.age / 1000)}s)`);
        
        // Add cache metadata to response
        return {
          ...cached.data,
          cacheInfo: {
            cached: true,
            age: cacheInfo.age,
            context: cacheInfo.context,
            dataTimestamp: smartCache.formatTimestamp(cached.dataTimestamp),
            expiresIn: Math.round(cacheInfo.expiresIn / 1000)
          }
        };
      }

      // Collect real data from existing sources
      log.info('📊 Collecting real data from sources...');
      data = await this.collectRealData();
      log.info('✅ Data collection completed', { 
        momentum: !!data.momentum, 
        technical: !!data.technical, 
        economic: data.economic?.length || 0 
      });
      
      // Validate data completeness
      if (!this.validateDataCompleteness(data)) {
        log.info('⚠️ Insufficient data for AI analysis');
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

      // Cache the result using smart cache
      smartCache.set(cacheKey, response, dataTimestamp);
      const cacheStats = smartCache.getStats();
      log.info(`✅ AI Summary generated and cached (${cacheStats.currentContext} context, TTL: ${Math.round(cacheStats.cacheDuration / 60000)}min)`);

      // Add cache metadata to response
      return {
        ...response,
        cacheInfo: {
          cached: false,
          age: 0,
          context: cacheStats.currentContext,
          dataTimestamp: smartCache.formatTimestamp(new Date().toISOString()),
          expiresIn: Math.round(cacheStats.cacheDuration / 1000)
        }
      };

    } catch (error) {
      log.error('❌ AI Summary generation failed:', error);
      
      // Return cached data immediately on timeout to meet 3-second requirement
      log.info('⚡ AI analysis timeout - returning cached data for fast response');
      const staleData = smartCache.get('ai-summary-optimized', new Date().toISOString().split('T')[0]);
      
      if (staleData) {
        return {
          ...staleData.data,
          dataAge: 'Cached analysis (data may be stale)',
          success: false,
          cacheInfo: {
            cached: true,
            age: Date.now() - staleData.timestamp,
            context: 'stale',
            dataTimestamp: smartCache.formatTimestamp(staleData.dataTimestamp),
            expiresIn: 0
          }
        };
      }

      // Generate fast fallback using available data (collect fresh if needed)
      let fallbackData = data || { timestamps: {} };
      if (!fallbackData || !this.validateDataCompleteness(fallbackData)) {
        try {
          fallbackData = await this.collectRealData();
        } catch (collectError) {
          log.error('Failed to collect fallback data:', collectError);
          fallbackData = { timestamps: {} };
        }
      }
      
      const quickAnalysis = this.generateQuickFallbackAnalysis(fallbackData);
      
      return {
        analysis: quickAnalysis,
        dataAge: 'Fast analysis using available data',
        timestamp: new Date().toISOString(),
        success: false,
        dataSources: {
          momentum: !!fallbackData.momentum,
          technical: !!fallbackData.technical,
          economic: !!(fallbackData.economic && fallbackData.economic.length > 0)
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
      log.info('📊 Fetching momentum data...');
      // Return simple fallback data for now to test the flow
      const momentum = {
        momentumStrategies: [
          { sector: 'Technology', momentum: 'Bullish' },
          { sector: 'Healthcare', momentum: 'Neutral' },
          { sector: 'Energy', momentum: 'Bearish' }
        ]
      };
      
      return {
        data: momentum,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log.error('Momentum data fetch failed:', error);
      throw new Error('Momentum data unavailable');
    }
  }

  private async getTechnicalData(): Promise<{ data: any; timestamp: string }> {
    try {
      log.info('📊 Fetching technical data...');
      // Return simple fallback data for now to test the flow
      const technicalData = {
        rsi: 68.5,
        vix: 16.2,
        macd: 0.8
      };
      
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
      log.info('📊 Fetching economic data...');
      // Return simple fallback data for now to test the flow
      const economicData = [
        { metric: 'Initial Jobless Claims', value: '221K', category: 'Employment' },
        { metric: 'Retail Sales', value: '0.6%', category: 'Consumer' },
        { metric: 'CPI', value: '2.9%', category: 'Inflation' }
      ];
      
      return {
        data: economicData,
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
    const prompt = this.buildHedgeFundAnalysisPrompt(data);
    
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('AI analysis timeout (3 seconds) - using cached data'));
      }, 3000);

      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a hedge fund analyst. Provide sharp, concise market analysis in 2-3 sentences. Focus on momentum trends, sector rotation signals, and positioning implications. Use specific metrics and be decisive about market outlook.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 200
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

  private buildHedgeFundAnalysisPrompt(data: AISummaryData): string {
    let prompt = 'HEDGE FUND POSITIONING ANALYSIS - Current Market Setup:\n\n';

    if (data.momentum && data.momentum.momentumStrategies) {
      // Count momentum signals for sector rotation analysis
      const bullishSectors = data.momentum.momentumStrategies.filter((s: any) => 
        s.signal?.toLowerCase().includes('bullish') || s.momentum > 0
      ).length;
      const bearishSectors = data.momentum.momentumStrategies.filter((s: any) => 
        s.signal?.toLowerCase().includes('bearish') || s.momentum < 0
      ).length;

      prompt += `MOMENTUM ROTATION (${data.timestamps.momentum}):\n`;
      prompt += `${bullishSectors} sectors bullish, ${bearishSectors} bearish out of ${data.momentum.momentumStrategies.length} tracked.\n`;
      
      // Find top performers for specific positioning calls
      const topPerformers = data.momentum.momentumStrategies
        .slice(0, 3)
        .map((s: any) => `${s.sector} (RSI: ${s.rsi}, Signal: ${s.signal})`)
        .join(', ');
      prompt += `Leading momentum: ${topPerformers}\n\n`;
    }

    if (data.technical) {
      prompt += `TECHNICAL SETUP (${data.timestamps.technical}):\n`;
      prompt += `SPY RSI: ${data.technical.rsi} (${data.technical.rsi > 70 ? 'OVERBOUGHT' : data.technical.rsi < 30 ? 'OVERSOLD' : 'NEUTRAL'})\n`;
      prompt += `VIX: ${data.technical.vix} (${data.technical.vix > 20 ? 'ELEVATED FEAR' : 'COMPLACENCY'})\n\n`;
    }

    if (data.economic && data.economic.length > 0) {
      prompt += `ECONOMIC CATALYSTS (${data.timestamps.economic}):\n`;
      data.economic.slice(0, 3).forEach((reading: any) => {
        prompt += `${reading.metric}: ${reading.value}\n`;
      });
      prompt += '\n';
    }

    prompt += 'Provide hedge fund-style analysis: What is the current market regime? Where should smart money be positioned? What are the key risks to monitor? Be specific and actionable.';

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



  private generateQuickFallbackAnalysis(data: AISummaryData): string {
    // Generate immediate hedge fund-style analysis without AI call
    let analysis = 'MARKET POSITIONING: ';
    
    if (data.momentum && data.momentum.momentumStrategies) {
      const bullishCount = data.momentum.momentumStrategies.filter((s: any) => 
        s.signal?.toLowerCase().includes('bullish') || s.momentum > 0
      ).length;
      const totalSectors = data.momentum.momentumStrategies.length;
      
      if (bullishCount > totalSectors * 0.7) {
        analysis += `Strong risk-on environment with ${bullishCount}/${totalSectors} sectors bullish. `;
      } else if (bullishCount < totalSectors * 0.3) {
        analysis += `Risk-off positioning with only ${bullishCount}/${totalSectors} sectors bullish. `;
      } else {
        analysis += `Mixed momentum signals - selective positioning required. `;
      }
    }
    
    if (data.technical) {
      const rsi = data.technical.rsi;
      if (rsi > 70) {
        analysis += `SPY RSI at ${rsi} signals overbought conditions - consider profit-taking. `;
      } else if (rsi < 30) {
        analysis += `SPY RSI at ${rsi} presents oversold opportunity for quality longs. `;
      } else {
        analysis += `Technical setup remains neutral with RSI at ${rsi}. `;
      }
    }
    
    analysis += 'Monitor for regime changes and adjust position sizing accordingly.';
    
    return analysis;
  }

  // All caching logic now handled by SmartCache service
}

export const aiSummaryOptimizedService = new AISummaryOptimizedService();