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
    sentiment: string;
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
      
      // Check cache first
      const cacheKey = 'financial-mood';
      const cached = smartCache.get(cacheKey);
      
      if (cached) {
        log.info('🎭 Financial mood served from cache');
        return cached.data;
      }

      // Gather market data
      const marketData = await this.gatherMarketData();
      
      // Generate mood analysis
      const moodAnalysis = await this.generateMoodAnalysis(marketData);
      
      // Cache the result for 2 minutes
      smartCache.set(cacheKey, moodAnalysis, '2m');
      
      log.info(`🎭 Financial mood generated: ${moodAnalysis.emoji} ${moodAnalysis.mood}`);
      return moodAnalysis;
      
    } catch (error) {
      log.error('❌ Financial mood generation failed:', error);
      return this.getFallbackMood();
    }
  }

  private async gatherMarketData() {
    try {
      // Fetch momentum data
      const fetch = (await import('node-fetch')).default;
      const momentumResponse = await fetch('http://localhost:5000/api/momentum-analysis');
      const momentumData = momentumResponse.ok ? await momentumResponse.json() as any : null;

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
        marketTrend: bullishSectors > bearishSectors ? 'bullish' : bearishSectors > bullishSectors ? 'bearish' : 'neutral'
      };
    } catch (error) {
      log.error('Market data gathering failed:', error);
      return null;
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
            content: 'You are a financial mood analyzer. Based on market data, generate a personalized financial mood with emoji, sentiment, and reasoning. Respond in JSON format with: emoji, mood, confidence (0-100), reasoning, marketFactors (momentum/technical/sentiment), and color (CSS class).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 300,
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
          sentiment: analysis.marketFactors?.sentiment || 'Cautious'
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
          sentiment: 'Risk-On'
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
          sentiment: 'Cautiously Optimistic'
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
          sentiment: 'Risk-Off'
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
          sentiment: 'Indecisive'
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
        sentiment: 'Loading'
      },
      color: 'text-gray-400'
    };
  }
}

export const financialMoodService = new FinancialMoodService();