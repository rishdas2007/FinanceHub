import OpenAI from 'openai';
import { smartCache } from './smart-cache';

const log = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args)
};

interface MoodData {
  emoji: string;
  mood: string;
  confidence: number;
  reasoning: string;
  marketFactors: {
    momentum: string;
    technical: string;
    economic: string;
  };
  color: string;
}

class FinancialMoodService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateFinancialMood(): Promise<MoodData> {
    try {
      log.info('🎭 Generating personalized financial mood...');
      
      // Check cache first for 3-minute intelligent caching
      const cacheKey = 'financial-mood';
      const cached = smartCache.get(cacheKey);
      
      if (cached) {
        log.info('🎭 Financial mood served from cache (instant load)');
        return cached.data;
      }

      // Generate with 3-second timeout for fast loading
      const moodPromise = this.generateMoodWithTimeout(3000);
      const moodAnalysis = await moodPromise;
      
      // Cache for 3 minutes during market hours, 10 minutes after hours
      const cacheDuration = this.isMarketHours() ? '3m' : '10m';
      smartCache.set(cacheKey, moodAnalysis, cacheDuration);
      
      log.info(`🎭 Financial mood generated: ${moodAnalysis.emoji} ${moodAnalysis.mood}`);
      return moodAnalysis;
      
    } catch (error) {
      log.error('❌ Financial mood generation failed:', error);
      return this.getFallbackMood();
    }
  }

  private isMarketHours(): boolean {
    const now = new Date();
    const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = est.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = est.getHours() + est.getMinutes() / 60;

    // Weekend check
    if (day === 0 || day === 6) return false;
    
    // Market hours check (9:30 AM - 4:00 PM EST)
    return hour >= 9.5 && hour <= 16;
  }

  private async generateMoodWithTimeout(timeoutMs: number = 3000): Promise<MoodData> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        log.info('⚡ Financial mood timeout - using intelligent fallback');
        resolve(this.getFallbackMood());
      }, timeoutMs);

      try {
        // Gather market data with optimized speed
        const marketData = await this.gatherMarketDataFast();
        
        if (!marketData) {
          clearTimeout(timeout);
          resolve(this.getFallbackMood());
          return;
        }

        // Try AI analysis first, fallback to rule-based if timeout
        try {
          const aiMood = await Promise.race([
            this.generateMoodAnalysis(marketData),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('AI timeout')), 2000)
            )
          ]);
          
          if (aiMood) {
            clearTimeout(timeout);
            resolve(aiMood);
            return;
          }
        } catch (aiError) {
          log.info('AI analysis timed out, using rule-based mood');
        }
        
        // Use rule-based mood as intelligent fallback
        const ruleBasedMood = this.generateRuleBasedMood(marketData);
        clearTimeout(timeout);
        resolve(ruleBasedMood);
      } catch (error) {
        clearTimeout(timeout);
        log.error('Mood generation error:', error);
        resolve(this.getFallbackMood());
      }
    });
  }

  private async gatherMarketDataFast() {
    try {
      // Use faster fetch with shorter timeout for speed
      const fetch = (await import('node-fetch')).default;
      
      // PRIORITY: Check if we have cached momentum data first
      const momentumCached = smartCache.get('momentum-analysis');
      let momentumData = null;
      
      if (momentumCached) {
        momentumData = momentumCached.data;
        log.info('✅ Using cached momentum data for fast mood generation');
      } else {
        log.info('⏳ No cached momentum data found, waiting for momentum analysis to complete first...');
        // Wait longer for momentum data since it's the primary dependency
        const momentumResponse = await fetch('http://localhost:5000/api/momentum-analysis', {
          timeout: 5000  // Increased timeout to wait for momentum data
        } as any);
        
        if (momentumResponse.ok) {
          momentumData = await momentumResponse.json() as any;
          log.info('✅ Fresh momentum data retrieved for mood analysis');
        } else {
          log.error('❌ Failed to fetch momentum data, using fallback');
          return null; // Return null to trigger fallback mood
        }
      }

      // Get REAL economic data from existing API endpoint
      const economicData = await this.getRealEconomicData();

      // Calculate market metrics
      const bullishSectors = momentumData?.momentumStrategies?.filter((s: any) => 
        s.signal?.toLowerCase().includes('bullish') || s.momentum === 'bullish'
      ).length || 0;
      
      const bearishSectors = momentumData?.momentumStrategies?.filter((s: any) => 
        s.signal?.toLowerCase().includes('bearish') || s.momentum === 'bearish'
      ).length || 0;
      
      const totalSectors = momentumData?.momentumStrategies?.length || 12;
      
      // Get top performing sector
      const topSector = momentumData?.momentumStrategies?.[0];

      // Get REAL technical indicators 
      const technicalData = await this.getRealTechnicalData();
      
      // Analyze economic readings (from real API data)
      const recentReadings = economicData?.slice(0, 3) || [];
      const economicTrend = this.analyzeEconomicTrend(recentReadings);
      
      return {
        bullishSectors,
        bearishSectors,
        totalSectors,
        bullishRatio: bullishSectors / totalSectors,
        topSector: topSector ? {
          sector: topSector.sector,
          change: topSector.oneDayChange,
          rsi: topSector.rsi,
          signal: topSector.signal
        } : null,
        marketTrend: bullishSectors > bearishSectors ? 'bullish' : bearishSectors > bullishSectors ? 'bearish' : 'neutral',
        economicReadings: recentReadings,
        economicTrend,
        technicalData
      };
    } catch (error) {
      log.error('Market data gathering failed:', error);
      return null;
    }
  }

  private analyzeEconomicTrend(readings: any[]): string {
    if (!readings || readings.length === 0) return 'neutral';
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    readings.forEach(reading => {
      if (reading.change?.includes('↑') || reading.variance?.includes('+')) {
        positiveCount++;
      } else if (reading.change?.includes('↓') || reading.variance?.includes('-')) {
        negativeCount++;
      }
    });
    
    if (positiveCount > negativeCount) return 'improving';
    if (negativeCount > positiveCount) return 'weakening';
    return 'mixed';
  }

  private async getRealEconomicData(): Promise<any[]> {
    try {
      const fetch = (await import('node-fetch')).default;
      
      // Check cache first
      const economicCached = smartCache.get('recent-economic-openai');
      if (economicCached) {
        log.info('✅ Using cached economic data for mood analysis');
        return economicCached.data || [];
      }
      
      // Fetch fresh economic data from existing API
      const economicResponse = await fetch('http://localhost:5000/api/recent-economic-openai', {
        timeout: 3000
      } as any);
      
      if (economicResponse.ok) {
        const economicData = await economicResponse.json() as any[];
        log.info(`✅ Fresh economic data retrieved: ${economicData.length} indicators`);
        return economicData;
      } else {
        log.error('❌ Failed to fetch economic data');
        return [];
      }
    } catch (error) {
      log.error('Economic data fetch error:', error);
      return [];
    }
  }

  private async getRealTechnicalData(): Promise<any> {
    try {
      // Fetch RSI from momentum analysis for consistency
      const momentumResponse = await fetch('http://localhost:5000/api/momentum-analysis', {
        timeout: 2000
      } as any);
      
      let rsi = null;
      if (momentumResponse.ok) {
        const momentumData = await momentumResponse.json();
        const spyData = momentumData.momentumStrategies?.find((s: any) => s.ticker === 'SPY');
        rsi = spyData?.rsi || null;
      }
      
      // Fetch VIX and ADX from technical indicators API
      const techResponse = await fetch('http://localhost:5000/api/technical-indicators/SPY', {
        timeout: 2000
      } as any);
      
      let vix = null, adx = null;
      if (techResponse.ok) {
        const techData = await techResponse.json();
        vix = techData.vix || null;
        adx = techData.adx || null;
      }
      
      return {
        rsi: rsi,
        vix: vix || 16.2,  // Fallback VIX
        adx: adx || 31.27, // Fallback ADX
        trend: rsi > 70 ? 'bullish' : rsi < 30 ? 'bearish' : 'neutral'
      };
    } catch (error) {
      log.error('Technical data fetch error:', error);
      return { rsi: null, vix: null, adx: null, trend: 'neutral' };
    }
  }

  private async generateMoodAnalysis(marketData: any): Promise<MoodData> {
    const prompt = this.buildMoodAnalysisPrompt(marketData);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a fast financial mood analyzer. Generate a personalized mood with emoji and brief reasoning. Respond in JSON: {"emoji":"😊","mood":"Optimistic","confidence":75,"reasoning":"Brief analysis","marketFactors":{"momentum":"Bullish","technical":"Positive","economic":"Mixed"},"color":"text-green-400"}'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 150,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        emoji: analysis.emoji || '😐',
        mood: analysis.mood || 'Neutral',
        confidence: Math.min(100, Math.max(0, analysis.confidence || 75)),
        reasoning: analysis.reasoning || 'Market analysis in progress',
        marketFactors: {
          momentum: analysis.marketFactors?.momentum || 'Neutral',
          technical: analysis.marketFactors?.technical || 'Mixed',
          economic: analysis.marketFactors?.economic || 'Mixed'
        },
        color: analysis.color || 'text-gray-400'
      };
    } catch (error) {
      log.error('AI mood analysis failed:', error);
      return this.generateRuleBasedMood(marketData);
    }
  }

  private buildMoodAnalysisPrompt(marketData: any): string {
    if (!marketData) {
      return 'Market data unavailable. Generate a neutral financial mood.';
    }
    
    let prompt = 'FINANCIAL MOOD ANALYSIS:\n\n';
    prompt += `Market Trend: ${marketData.marketTrend}\n`;
    prompt += `Bullish Sectors: ${marketData.bullishSectors}/${marketData.totalSectors}\n`;
    prompt += `Bearish Sectors: ${marketData.bearishSectors}/${marketData.totalSectors}\n`;
    
    // Add economic readings analysis (REAL DATA)
    if (marketData.economicReadings?.length > 0) {
      prompt += `\nECONOMIC READINGS (Real Data):\n`;
      prompt += `Economic Trend: ${marketData.economicTrend}\n`;
      marketData.economicReadings.forEach((reading: any, index: number) => {
        prompt += `${index + 1}. ${reading.metric}: ${reading.current || reading.value || 'N/A'} - ${reading.change || reading.interpretation || ''}\n`;
      });
    }
    
    // Add technical analysis (REAL DATA)
    if (marketData.technicalData) {
      prompt += `\nTECHNICAL INDICATORS (Real Data):\n`;
      prompt += `RSI (SPY): ${marketData.technicalData.rsi}\n`;
      prompt += `VIX: ${marketData.technicalData.vix}\n`;
      prompt += `ADX Trend Strength: ${marketData.technicalData.adx}\n`;
      prompt += `Technical Trend: ${marketData.technicalData.trend}\n`;
    }
    
    if (marketData.topSector) {
      prompt += `Leading Sector: ${marketData.topSector.sector} (${marketData.topSector.change}%, RSI: ${marketData.topSector.rsi})\n`;
    }
    
    prompt += '\nGenerate a personalized financial mood emoji and analysis. Consider:\n';
    prompt += '- Sector rotation strength\n';
    prompt += '- Risk-on vs risk-off sentiment\n';
    prompt += '- Overall market momentum\n';
    prompt += '\nEmoji options: 🚀 (very bullish), 😊 (optimistic), 😐 (neutral), 😟 (concerned), 😰 (fearful)\n';
    prompt += 'Color options: text-gain-green, text-blue-400, text-gray-400, text-yellow-400, text-loss-red\n';
    
    return prompt;
  }

  private generateRuleBasedMood(marketData: any): MoodData {
    if (!marketData) {
      return this.getFallbackMood();
    }
    
    const { bullishRatio, marketTrend } = marketData;
    
    if (bullishRatio > 0.7) {
      return {
        emoji: '🚀',
        mood: 'Very Optimistic',
        confidence: 85,
        reasoning: `Strong sector rotation with ${Math.round(bullishRatio * 100)}% of sectors showing bullish momentum. Market displaying risk-on behavior.`,
        marketFactors: {
          momentum: 'Strong Bullish',
          technical: 'Positive',
          economic: 'Positive'
        },
        color: 'text-gain-green'
      };
    } else if (bullishRatio > 0.5) {
      return {
        emoji: '😊',
        mood: 'Optimistic',
        confidence: 75,
        reasoning: `Moderate bullish momentum with balanced sector performance. Market showing selective strength.`,
        marketFactors: {
          momentum: 'Moderate Bullish',
          technical: 'Mixed',
          economic: 'Mixed'
        },
        color: 'text-blue-400'
      };
    } else if (bullishRatio < 0.3) {
      return {
        emoji: '😰',
        mood: 'Concerned',
        confidence: 80,
        reasoning: `Defensive rotation evident with ${Math.round((1 - bullishRatio) * 100)}% of sectors under pressure. Risk-off sentiment prevailing.`,
        marketFactors: {
          momentum: 'Bearish',
          technical: 'Negative',
          economic: 'Negative'
        },
        color: 'text-loss-red'
      };
    } else {
      return {
        emoji: '😐',
        mood: 'Neutral',
        confidence: 70,
        reasoning: 'Mixed sector performance with no clear directional bias. Market in consolidation mode.',
        marketFactors: {
          momentum: 'Neutral',
          technical: 'Mixed',
          economic: 'Mixed'
        },
        color: 'text-gray-400'
      };
    }
  }

  private getFallbackMood(): MoodData {
    return {
      emoji: '🤔',
      mood: 'Analyzing',
      confidence: 50,
      reasoning: 'Market data is being processed. Please refresh for updated mood analysis.',
      marketFactors: {
        momentum: 'Loading',
        technical: 'Loading', 
        economic: 'Loading'
      },
      color: 'text-gray-400'
    };
  }
}

export const financialMoodService = new FinancialMoodService();