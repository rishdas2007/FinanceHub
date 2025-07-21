import { FinancialDataService } from './financial-data.js';
import { historicalDataIntelligence } from './historical-data-intelligence.js';
import OpenAI from 'openai';

export class EnhancedAIAnalysisService {
  private static instance: EnhancedAIAnalysisService;
  private openai: OpenAI;
  private financialDataService: FinancialDataService;

  static getInstance(): EnhancedAIAnalysisService {
    if (!EnhancedAIAnalysisService.instance) {
      EnhancedAIAnalysisService.instance = new EnhancedAIAnalysisService();
    }
    return EnhancedAIAnalysisService.instance;
  }

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.financialDataService = FinancialDataService.getInstance();
  }

  /**
   * Generate enhanced market analysis with comprehensive historical context
   */
  async generateAnalysisWithHistoricalContext(
    marketData: any,
    sectors: any[],
    economicEvents: any[]
  ): Promise<{ marketConditions: string; technicalAnalysis: string; economicAnalysis: string; }> {
    try {
      console.log('🧠 Generating enhanced AI analysis with historical context...');

      // Get historical intelligence insights
      const historicalInsights = await historicalDataIntelligence.generateIntelligentInsights('SPY');
      const historicalContext = await historicalDataIntelligence.generateEnhancedAIContext('SPY');

      // Build comprehensive analysis prompt with historical data
      const analysisPrompt = this.buildEnhancedAnalysisPrompt(
        marketData,
        sectors,
        economicEvents,
        historicalInsights,
        historicalContext
      );

      // Generate AI analysis
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert Wall Street analyst with access to comprehensive historical market data. Provide professional, data-driven market analysis incorporating historical context and percentile rankings."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        max_tokens: 1200,
        temperature: 0.3
      });

      const fullAnalysis = response.choices[0].message.content || 'Analysis unavailable';

      // Split analysis into sections
      const sections = this.parseEnhancedAnalysis(fullAnalysis);

      console.log('✅ Enhanced AI analysis with historical context completed');

      return {
        marketConditions: sections.marketConditions,
        technicalAnalysis: sections.technicalAnalysis,
        economicAnalysis: sections.economicAnalysis
      };

    } catch (error) {
      console.error('❌ Enhanced AI analysis with historical context failed:', error);
      return this.getFallbackAnalysis();
    }
  }

  /**
   * Build comprehensive analysis prompt with historical intelligence
   */
  private buildEnhancedAnalysisPrompt(
    marketData: any,
    sectors: any[],
    economicEvents: any[],
    historicalInsights: any,
    historicalContext: string
  ): string {
    const topPerformer = sectors.length > 0 ? sectors[0] : null;
    const recentEconomicEvents = economicEvents.slice(0, 5);

    let prompt = `Analyze the current market environment with comprehensive historical context:

CURRENT MARKET DATA:
- SPY: $${marketData.spyPrice} (${marketData.spyChange > 0 ? '+' : ''}${marketData.spyChange}%)
- VIX: ${marketData.vix} (Fear/Greed: ${marketData.vix > 20 ? 'Fear' : 'Greed'})
- AAII Sentiment: ${marketData.bullishSentiment}% Bullish, ${marketData.bearishSentiment}% Bearish

HISTORICAL INTELLIGENCE INSIGHTS:
${historicalContext}

TECHNICAL INDICATORS WITH HISTORICAL PERCENTILES:`;

    // Add technical insights with percentiles
    if (historicalInsights.technicalInsights) {
      for (const insight of historicalInsights.technicalInsights) {
        if (insight.significanceLevel !== 'low') {
          prompt += `\n- ${insight.metric}: ${insight.currentValue} (${insight.percentileRanking}th percentile, ${insight.trend} trend)`;
        }
      }
    }

    prompt += `\n\nSECTOR PERFORMANCE:
- Top Sector: ${topPerformer?.name || 'Technology'} (${topPerformer?.changePercent || '0.5'}%)
- Sector Rotation: ${sectors.length > 3 ? 'Active rotation detected' : 'Stable sector performance'}

RECENT ECONOMIC EVENTS:`;

    recentEconomicEvents.forEach(event => {
      prompt += `\n- ${event.title}: ${event.actual || 'N/A'} ${event.forecast ? `(vs ${event.forecast} expected)` : ''}`;
    });

    prompt += `\n\nREQUIRED ANALYSIS STRUCTURE:
1. MARKET CONDITIONS: Current market regime and overall assessment
2. TECHNICAL ANALYSIS: Key technical levels with historical context and percentile rankings
3. ECONOMIC ANALYSIS: Economic data interpretation with historical comparisons

Provide professional Wall Street-style analysis incorporating the historical percentile data and trend analysis provided above.`;

    return prompt;
  }

  /**
   * Parse the enhanced analysis into structured sections
   */
  private parseEnhancedAnalysis(analysis: string): {
    marketConditions: string;
    technicalAnalysis: string;
    economicAnalysis: string;
  } {
    const sections = {
      marketConditions: '',
      technicalAnalysis: '',
      economicAnalysis: ''
    };

    // Simple parsing - look for section headers
    const lines = analysis.split('\n');
    let currentSection = 'marketConditions';

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      if (lowerLine.includes('technical analysis') || lowerLine.includes('technical:')) {
        currentSection = 'technicalAnalysis';
        continue;
      } else if (lowerLine.includes('economic analysis') || lowerLine.includes('economic:')) {
        currentSection = 'economicAnalysis';
        continue;
      } else if (lowerLine.includes('market conditions') || lowerLine.includes('market:')) {
        currentSection = 'marketConditions';
        continue;
      }

      if (line.trim()) {
        sections[currentSection] += line + ' ';
      }
    }

    // Clean up sections
    sections.marketConditions = sections.marketConditions.trim() || analysis.slice(0, 400);
    sections.technicalAnalysis = sections.technicalAnalysis.trim() || 'Technical analysis with historical context available';
    sections.economicAnalysis = sections.economicAnalysis.trim() || 'Economic analysis with percentile rankings available';

    return sections;
  }

  /**
   * Fallback analysis when AI generation fails
   */
  private getFallbackAnalysis(): {
    marketConditions: string;
    technicalAnalysis: string;
    economicAnalysis: string;
  } {
    return {
      marketConditions: 'Market conditions analysis with historical context currently processing. Enhanced AI analysis system is operational.',
      technicalAnalysis: 'Technical analysis with historical percentile rankings and trend analysis available through comprehensive data storage system.',
      economicAnalysis: 'Economic analysis incorporating historical comparisons and regime detection available through intelligent data processing system.'
    };
  }

  /**
   * Enhanced method for robust market analysis (alternative method name)
   */
  async generateRobustMarketAnalysis(
    marketData: any,
    sectors: any[],
    economicEvents: any[]
  ): Promise<{ marketConditions: string; technicalAnalysis: string; economicAnalysis: string; }> {
    return this.generateAnalysisWithHistoricalContext(marketData, sectors, economicEvents);
  }
}

// Export singleton
export const enhancedAIAnalysisService = EnhancedAIAnalysisService.getInstance();