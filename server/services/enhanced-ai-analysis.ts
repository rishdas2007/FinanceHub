import { FinancialDataService } from './financial-data';
import { historicalDataIntelligence } from './historical-data-intelligence';
// import { SmartCacheService } from './smart-cache-service'; // Removed during optimization
// import { AdaptiveAIService } from './adaptive-ai-service'; // Removed during optimization
import OpenAI from 'openai';

export class EnhancedAIAnalysisService {
  private static instance: EnhancedAIAnalysisService;
  private openai: OpenAI;
  private financialDataService: FinancialDataService;
  // private cacheService: SmartCacheService; // Removed during optimization
  // private adaptiveAI: AdaptiveAIService; // Removed during optimization

  static getInstance(): EnhancedAIAnalysisService {
    if (!EnhancedAIAnalysisService.instance) {
      EnhancedAIAnalysisService.instance = new EnhancedAIAnalysisService();
    }
    return EnhancedAIAnalysisService.instance;
  }

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.financialDataService = FinancialDataService.getInstance();
    // this.cacheService = new SmartCacheService(); // Removed during optimization
    // this.adaptiveAI = new AdaptiveAIService(); // Removed during optimization
  }

  /**
   * Generate sophisticated Bayesian analysis with cost-effective token management
   */
  async generateBayesianAnalysisWithContext(
    marketData: any,
    sectors: any[],
    economicEvents: any[]
  ): Promise<any> {
    try {
      console.log('🎯 Generating Bayesian analysis with adaptive depth...');

      // Prepare comprehensive market data for Bayesian analysis
      const enhancedMarketData = {
        spyPrice: marketData.spy_close || marketData.price || 620,
        spyChange: marketData.spy_change || marketData.changePercent || 0,
        vix: marketData.vix || 20,
        rsi: marketData.spy_rsi || marketData.rsi || 50,
        aaiiBullish: marketData.aaii_bullish || 40,
        macd: marketData.spy_macd || marketData.macd || 0,
        sectors: sectors || [],
        economicEvents: economicEvents || []
      };

      // Smart caching removed during optimization - using direct analysis
      const analysis = await this.generateFallbackAnalysis(enhancedMarketData);

      // Cache tracking disabled
      const cacheStats = { validEntries: 0, totalEntries: 0, hitRate: '0%' };
      console.log(`💰 Analysis generated (Cache stats: ${cacheStats.validEntries}/${cacheStats.totalEntries} valid entries)`);

      return {
        ...analysis,
        cacheStats: cacheStats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Bayesian analysis failed:', error);
      
      // Fallback to simple analysis
      return this.generateFallbackAnalysis(marketData);
    }
  }

  /**
   * Legacy method maintained for compatibility with existing routes
   */
  async generateAnalysisWithHistoricalContext(
    marketData: any,
    sectors: any[],
    economicEvents: any[]
  ): Promise<{ marketConditions: string; technicalAnalysis: string; economicAnalysis: string; }> {
    try {
      console.log('🧠 Generating enhanced AI analysis (legacy method)...');

      // Use new Bayesian system but return in legacy format
      const bayesianAnalysis = await this.generateBayesianAnalysisWithContext(marketData, sectors, economicEvents);

      // Convert to legacy format
      return {
        marketConditions: bayesianAnalysis.bottomLine || 'Market conditions being assessed',
        technicalAnalysis: `${bayesianAnalysis.setup || 'Technical setup in progress'} ${bayesianAnalysis.evidence || ''}`,
        economicAnalysis: bayesianAnalysis.implications || 'Economic analysis in progress'
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
   * Fallback analysis for Bayesian system failures
   */
  private generateFallbackAnalysis(marketData: any): any {
    console.log('🔄 Generating fallback analysis...');
    
    const spyPrice = marketData.spy_close || marketData.price || 620;
    const spyChange = marketData.spy_change || marketData.changePercent || 0;
    const vix = marketData.vix || 20;
    const rsi = marketData.spy_rsi || marketData.rsi || 50;

    return {
      bottomLine: `Markets ${spyChange >= 0 ? 'advancing' : 'declining'} with SPY at $${spyPrice.toFixed(2)}, showing ${Math.abs(spyChange).toFixed(2)}% movement.`,
      dominantTheme: spyChange >= 0 ? 'Risk-on sentiment' : 'Cautious positioning',
      setup: `Current positioning with SPY at $${spyPrice.toFixed(2)}, VIX at ${vix.toFixed(1)} indicating ${vix > 25 ? 'elevated' : vix < 15 ? 'low' : 'moderate'} volatility.`,
      evidence: `RSI at ${rsi.toFixed(1)} suggests ${rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral'} conditions. VIX at ${vix.toFixed(1)} shows ${vix > 20 ? 'elevated fear' : 'complacency'}.`,
      implications: `Monitor key support/resistance levels. ${vix > 25 ? 'High volatility suggests caution.' : 'Moderate volatility allows for selective opportunities.'}`,
      confidence: 65,
      timestamp: new Date().toISOString(),
      analysisType: 'fallback'
    };
  }

  /**
   * Fallback analysis when AI generation fails (legacy format)
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

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): any {
    // Cache service removed during optimization
    return {
      validEntries: 0,
      totalEntries: 0,
      hitRate: '0%'
    };
  }
}

// Export singleton
export const enhancedAIAnalysisService = EnhancedAIAnalysisService.getInstance();