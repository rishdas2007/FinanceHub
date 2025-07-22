/**
 * Unified AI Analysis Service
 * Consolidates: ai-analysis.ts, thematic-ai-analysis.ts, enhanced-ai-analysis.ts
 */

import OpenAI from 'openai';
import { logger } from '../../shared/utils/logger';
import { formatNumber, formatPercentage } from '../../shared/utils/numberFormatting-unified';

interface AnalysisInput {
  stockData?: any;
  sentiment?: any;
  technical?: any;
  sectors?: any[];
  economicEvents?: any[];
}

interface StandardAnalysis {
  summary: string;
  technicalAnalysis: string;
  economicAnalysis: string;
  sectorAnalysis: string;
  marketSetup: string;
  keyLevels: string[];
  riskFactors: string[];
  timeframe: string;
  confidence: number;
  timestamp: string;
}

interface ThematicAnalysis {
  bottomLine: string;
  dominantTheme: string;
  setup: string;
  evidence: string;
  implications: string;
  confidence: number;
  timestamp: string;
}

export class AIAnalysisService {
  private static instance: AIAnalysisService;
  private openai: OpenAI;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  static getInstance(): AIAnalysisService {
    if (!AIAnalysisService.instance) {
      AIAnalysisService.instance = new AIAnalysisService();
    }
    return AIAnalysisService.instance;
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      logger.debug(`Using cached analysis: ${key}`, 'AIAnalysis');
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  async generateStandardAnalysis(input: AnalysisInput, cacheTtl = 120000): Promise<StandardAnalysis> {
    const cacheKey = 'standard_analysis';
    const cached = this.getCached<StandardAnalysis>(cacheKey);
    if (cached) return cached;

    try {
      const prompt = this.buildStandardPrompt(input);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are a professional Wall Street analyst providing market commentary. Be concise, data-driven, and specific."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1500
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      
      const analysis: StandardAnalysis = {
        summary: result.summary || 'Market analysis unavailable',
        technicalAnalysis: result.technicalAnalysis || '',
        economicAnalysis: result.economicAnalysis || '',
        sectorAnalysis: result.sectorAnalysis || '',
        marketSetup: result.marketSetup || '',
        keyLevels: result.keyLevels || [],
        riskFactors: result.riskFactors || [],
        timeframe: result.timeframe || 'short-term',
        confidence: result.confidence || 75,
        timestamp: new Date().toISOString()
      };

      this.setCache(cacheKey, analysis, cacheTtl);
      logger.info('Standard analysis generated successfully', 'AIAnalysis');
      
      return analysis;

    } catch (error) {
      logger.error('Error generating standard analysis', 'AIAnalysis', error);
      
      return {
        summary: 'Market analysis currently unavailable due to technical issues.',
        technicalAnalysis: '',
        economicAnalysis: '',
        sectorAnalysis: '',
        marketSetup: '',
        keyLevels: [],
        riskFactors: ['Analysis service temporarily unavailable'],
        timeframe: 'unknown',
        confidence: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  async generateThematicAnalysis(input: AnalysisInput, cacheTtl = 120000): Promise<ThematicAnalysis> {
    const cacheKey = 'thematic_analysis';
    const cached = this.getCached<ThematicAnalysis>(cacheKey);
    if (cached) return cached;

    try {
      const prompt = this.buildThematicPrompt(input);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system", 
            content: "You are a sophisticated market strategist providing thematic analysis. Focus on narrative-driven insights and market themes."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 1200
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      
      const analysis: ThematicAnalysis = {
        bottomLine: result.bottomLine || 'Market theme analysis unavailable',
        dominantTheme: result.dominantTheme || 'Mixed signals',
        setup: result.setup || '',
        evidence: result.evidence || '',
        implications: result.implications || '',
        confidence: result.confidence || 75,
        timestamp: new Date().toISOString()
      };

      this.setCache(cacheKey, analysis, cacheTtl);
      logger.info('Thematic analysis generated successfully', 'AIAnalysis');
      
      return analysis;

    } catch (error) {
      logger.error('Error generating thematic analysis', 'AIAnalysis', error);
      
      return {
        bottomLine: 'Thematic analysis currently unavailable.',
        dominantTheme: 'Service unavailable',
        setup: '',
        evidence: '',
        implications: '',
        confidence: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  private buildStandardPrompt(input: AnalysisInput): string {
    const { stockData, sentiment, technical, sectors } = input;
    
    return `Analyze current market conditions and provide a JSON response with the following structure:
{
  "summary": "Brief market overview (2-3 sentences)",
  "technicalAnalysis": "Technical indicator analysis",
  "economicAnalysis": "Economic data interpretation", 
  "sectorAnalysis": "Sector rotation and performance",
  "marketSetup": "Current market positioning",
  "keyLevels": ["Support and resistance levels"],
  "riskFactors": ["Main risk considerations"],
  "timeframe": "short-term/medium-term/long-term",
  "confidence": 85
}

Current Data:
- SPY: $${stockData?.price || 'N/A'} (${stockData?.changePercent || '0'}%)
- VIX: ${sentiment?.vix || 'N/A'}
- RSI: ${technical?.rsi || 'N/A'}
- MACD: ${technical?.macd || 'N/A'}
- Top Sector: ${sectors?.[0]?.name || 'N/A'} (${sectors?.[0]?.changePercent || '0'}%)

Provide professional, concise analysis.`;
  }

  private buildThematicPrompt(input: AnalysisInput): string {
    const { stockData, sentiment, technical, sectors, economicEvents } = input;
    
    return `Provide thematic market analysis in JSON format:
{
  "bottomLine": "One-sentence market theme",
  "dominantTheme": "Primary market narrative",
  "setup": "Current market positioning and setup",
  "evidence": "Supporting evidence and data points",
  "implications": "Strategic implications and outlook",
  "confidence": 85
}

Market Data:
- SPY: $${stockData?.price || 'N/A'} (${stockData?.changePercent || '0'}%)
- VIX: ${sentiment?.vix || 'N/A'} 
- RSI: ${technical?.rsi || 'N/A'}
- Recent Economic Events: ${economicEvents?.length || 0} events
- Sector Leaders: ${sectors?.slice(0, 3).map(s => `${s.name} (${s.changePercent}%)`).join(', ') || 'N/A'}

Focus on narrative-driven insights and market themes.`;
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('AI analysis cache cleared', 'AIAnalysis');
  }

  getCacheStats(): { entries: number; totalSize: number } {
    return {
      entries: this.cache.size,
      totalSize: Array.from(this.cache.values()).reduce((size, entry) => 
        size + JSON.stringify(entry.data).length, 0
      )
    };
  }
}

export const aiAnalysisService = AIAnalysisService.getInstance();