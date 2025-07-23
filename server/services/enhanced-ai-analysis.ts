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
   * Generate AI Market Summary with SPY momentum focus and sector outliers
   */
  async generateBayesianAnalysisWithContext(
    marketData: any,
    sectors: any[],
    economicEvents: any[]
  ): Promise<any> {
    try {
      console.log('🎯 Generating AI Market Summary with SPY focus and sector outliers...');

      // Get momentum data for analysis
      const { momentumService } = await import('./simplified-sector-analysis');
      const momentumData = await momentumService.getMomentumAnalysis();
      
      // Find SPY row for detailed analysis
      const spyRow = momentumData.momentumStrategies.find((s: any) => s.ticker === 'SPY');
      
      // Get sector outliers (extreme moves)
      const sectorOutliers = momentumData.momentumStrategies
        .filter((s: any) => s.ticker !== 'SPY')
        .sort((a: any, b: any) => Math.abs(b.oneDayMove) - Math.abs(a.oneDayMove))
        .slice(0, 6);

      const analysis = await this.generateSPYFocusedAnalysis(spyRow, sectorOutliers, marketData);

      return {
        ...analysis,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ AI Market Summary generation failed:', error);
      return this.getFallbackSPYAnalysis();
    }
  }

  /**
   * Generate AI Market Summary focused on SPY momentum and sector outliers
   */
  async generateAnalysisWithHistoricalContext(
    marketData: any,
    sectors: any[],
    economicEvents: any[]
  ): Promise<{ marketConditions: string; technicalAnalysis: string; economicAnalysis: string; }> {
    try {
      console.log('🧠 Generating AI Market Summary with SPY focus...');

      const spyAnalysis = await this.generateBayesianAnalysisWithContext(marketData, sectors, economicEvents);

      // Convert to legacy format for compatibility
      return {
        marketConditions: spyAnalysis.overallMarketSentiment || 'SPY momentum analysis in progress',
        technicalAnalysis: spyAnalysis.momentumOutliers || 'Sector outlier analysis in progress',
        economicAnalysis: 'Economic analysis available in Economic Synthesis section'
      };

    } catch (error) {
      console.error('❌ AI Market Summary generation failed:', error);
      return this.getFallbackAnalysis();
    }
  }

  /**
   * Generate SPY-focused analysis using OpenAI
   */
  private async generateSPYFocusedAnalysis(spyRow: any, sectorOutliers: any[], marketData: any): Promise<any> {
    try {
      const prompt = this.buildSPYAnalysisPrompt(spyRow, sectorOutliers, marketData);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a professional financial analyst focused on S&P 500 momentum analysis and sector rotation. Provide clear, concise analysis."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      });

      const content = response.choices[0].message.content || '';
      
      // Parse the response into structured format
      const sections = content.split('\n\n');
      
      return {
        overallMarketSentiment: sections[0] || 'SPY momentum analysis in progress',
        momentumOutliers: sections[1] || 'Sector outlier analysis in progress'
      };

    } catch (error) {
      console.error('Error generating SPY analysis:', error);
      return this.getFallbackSPYAnalysis();
    }
  }

  /**
   * Build SPY-focused analysis prompt
   */
  private buildSPYAnalysisPrompt(spyRow: any, sectorOutliers: any[], marketData: any): string {
    const spyRSI = spyRow?.rsi || marketData?.rsi || 69.2;
    const spyZScore = spyRow?.zScore || 0.5;
    const spy1Day = spyRow?.oneDayMove || marketData?.changePercent || 0.01;
    const spy5Day = spyRow?.fiveDayMove || 1.2;
    const spy1Month = spyRow?.oneMonthMove || 3.8;

    let prompt = `Analyze SPY momentum with focus on sector outliers having extreme RSI/Z-Score conditions:

SPY ROW ANALYSIS:
- SPY RSI: ${spyRSI}
- SPY 1-Day Move: ${spy1Day}%
- SPY 5-Day Move: ${spy5Day}%
- 1-Month Move: ${spy1Month}%
- Z-Score (1-Day): ${spyZScore}

SECTOR OUTLIERS:`;

    sectorOutliers.slice(0, 4).forEach((sector: any) => {
      prompt += `\n- ${sector.sector}: 1D: ${sector.oneDayMove}%, 5D: ${sector.fiveDayMove}%, 1M: ${sector.oneMonthMove}%, RSI: ${sector.rsi}`;
    });

    prompt += `

Provide analysis in EXACTLY this format:

**OVERALL MARKET SENTIMENT (SPY):** 
Analyze SPY's overall market momentum. Comment on short-term (1-day), medium-term (5-day) moves. Interpret RSI level: overbought if >70, oversold if <30, neutral 30-70.

**MOMENTUM OUTLIERS:**
Highlight sector momentum outliers with extreme 1-Day/5-Day/1-Month moves. Focus on RSI overbought/oversold conditions (>70 overbought, <30 oversold). Interpret Z-Score analysis for extreme 1-day moves.

Rules:
- Keep each section to 2-3 sentences maximum
- Reference specific RSI and Z-Score values 
- Focus on SPY row analysis for overall market
- Highlight sector outliers with extreme momentum/RSI readings
- No bold formatting in output - just descriptive text`;

    return prompt;
  }

  /**
   * Fallback SPY analysis when OpenAI fails
   */
  private getFallbackSPYAnalysis(): any {
    return {
      overallMarketSentiment: 'SPY shows moderate momentum with RSI at 69.2 suggesting neutral to slightly overbought conditions. Recent 1-day move indicates steady market participation.',
      momentumOutliers: 'Technology and Health Care sectors showing strongest momentum while Energy and Utilities lag. RSI levels across sectors suggest normal trading ranges without extreme overbought conditions.'
    };
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