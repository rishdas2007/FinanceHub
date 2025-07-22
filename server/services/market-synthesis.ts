import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { marketDataUnifiedService } from './market-data-unified';
import { cacheService } from './cache-unified';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MarketSynthesis {
  marketPulse: string;
  criticalCatalysts: string[];
  actionItems: string[];
  confidence: number;
  timestamp: string;
}

class MarketSynthesisService {
  private readonly CACHE_KEY = 'market-synthesis';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes during market hours

  async generateMarketSynthesis(): Promise<MarketSynthesis> {
    try {
      // Check cache first for cost optimization
      const cached = cacheService.get(this.CACHE_KEY);
      if (cached) {
        logger.info('Market synthesis served from cache for cost optimization');
        return cached;
      }

      logger.info('Generating fresh market synthesis with OpenAI');

      // Wait for AI Market Summary to be available first
      const aiSummaryData = await this.getAIMarketSummary();
      
      // Gather comprehensive market data
      const marketData = await this.gatherMarketData();
      
      // Generate synthesis using sophisticated prompting with AI summary context
      const synthesis = await this.generateSynthesisWithAI(marketData, aiSummaryData);
      
      // Cache the result for cost optimization
      cacheService.set(this.CACHE_KEY, synthesis, this.CACHE_DURATION);
      
      logger.info('Market synthesis generated and cached', { 
        confidence: synthesis.confidence 
      });

      return synthesis;

    } catch (error) {
      logger.error('Market synthesis generation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return this.getFallbackSynthesis();
    }
  }

  private async gatherMarketData() {
    try {
      // Import services dynamically to avoid circular dependencies
      const [
        { simplifiedSectorAnalysisService },
        { economicDataEnhancedService },
        { financialDataService }
      ] = await Promise.all([
        import('./simplified-sector-analysis'),
        import('./economic-data-enhanced'),
        import('./financial-data')
      ]);

      // Get sector data first
      const sectorETFs = await financialDataService.getSectorETFs();

      // Gather all relevant data in parallel
      const [
        sectorData,
        economicEvents,
        technicalIndicators,
        marketSentiment
      ] = await Promise.all([
        simplifiedSectorAnalysisService.generateSimplifiedAnalysis(sectorETFs, []),
        economicDataEnhancedService.getEnhancedEconomicEvents(),
        financialDataService.getTechnicalIndicators('SPY'),
        this.getMarketSentiment()
      ]);

      return {
        sectors: sectorData,
        economic: economicEvents,
        technical: technicalIndicators,
        sentiment: marketSentiment
      };

    } catch (error) {
      logger.error('Failed to gather market data for synthesis', { error });
      throw error;
    }
  }

  private async getMarketSentiment() {
    try {
      const { storage } = await import('../storage');
      const sentiment = await storage.getLatestMarketSentiment();
      return sentiment;
    } catch (error) {
      logger.error('Failed to get market sentiment', { error });
      return null;
    }
  }

  private async getAIMarketSummary() {
    try {
      // Import AI analysis service to get existing summary
      const { aiAnalysisService } = await import('./ai-analysis-unified');
      const aiSummary = await aiAnalysisService.generateMarketSummary();
      return aiSummary;
    } catch (error) {
      logger.error('Failed to get AI market summary', { error });
      return null;
    }
  }

  private async generateSynthesisWithAI(marketData: any, aiSummaryData?: any): Promise<MarketSynthesis> {
    // Count bullish/bearish/neutral sectors
    const sectorSignals = marketData.sectors?.momentumStrategies || [];
    const bullishCount = sectorSignals.filter((s: any) => 
      s.signal?.toLowerCase().includes('bullish')).length;
    const bearishCount = sectorSignals.filter((s: any) => 
      s.signal?.toLowerCase().includes('bearish')).length;
    const neutralCount = sectorSignals.length - bullishCount - bearishCount;

    // Get recent economic events with actual readings
    const recentEvents = marketData.economic?.filter((event: any) => 
      event.actual && event.actual !== 'N/A').slice(0, 5) || [];

    // Format economic data for AI context
    const economicContext = recentEvents.map((event: any) => 
      `${event.indicator}: ${event.actual} (vs ${event.forecast || 'forecast'})`
    ).join(', ');

    // Extract key insights from AI Market Summary
    const aiInsights = aiSummaryData?.keyInsights?.slice(0, 3) || [];
    const aiRiskLevel = aiSummaryData?.riskLevel || 'moderate';
    const aiSummary = aiSummaryData?.summary || '';

    // Get specific sector performance details
    const topPerformingSectors = sectorSignals
      .filter((s: any) => s.signal?.toLowerCase().includes('bullish'))
      .slice(0, 3);
    const underperformingSectors = sectorSignals
      .filter((s: any) => s.signal?.toLowerCase().includes('bearish'))
      .slice(0, 2);

    const prompt = `You are a senior Wall Street analyst providing market synthesis that builds upon the AI Market Summary. Create a narrative connecting sector performance with economic data.

AI MARKET SUMMARY CONTEXT:
Summary: ${aiSummary}
Key Insights: ${aiInsights.join('; ')}
Risk Level: ${aiRiskLevel}

CURRENT MARKET DATA:
Sector Momentum: ${bullishCount} bullish, ${bearishCount} bearish, ${neutralCount} neutral signals
Top Performing: ${topPerformingSectors.map((s: any) => `${s.ticker} (${s.rsi || 'N/A'} RSI)`).join(', ')}
Underperforming: ${underperformingSectors.map((s: any) => `${s.ticker} (${s.rsi || 'N/A'} RSI)`).join(', ')}
Key Technical: SPY RSI ${marketData.technical?.rsi || 'N/A'}, VIX ${marketData.sentiment?.vix || 'N/A'}
Recent Economic: ${economicContext}
AAII Sentiment: ${marketData.sentiment?.aaiiBullish || 'N/A'}% bullish

INSTRUCTIONS:
Reference the AI Market Summary insights and build upon them. Create the "growth vs. reality" narrative style shown in the example. Connect sector overbought/oversold levels (RSI) with economic fundamentals. Include specific ticker symbols and RSI levels.

FORMAT EXACTLY AS:

MARKET PULSE
[Create a "growth vs. reality" or similar thematic narrative. Reference specific RSI levels and economic disconnects. End with "Risk level: [level] due to [specific reason]"]

CRITICAL CATALYSTS
• [Tech/sector leadership test with specific RSI levels and economic context]
• [Fed/economic timing catalyst with specific economic readings and implications] 
• [Sector rotation signal with specific defensive vs growth characteristics]

ACTION ITEMS
• Tactical: [Specific sector rotation recommendations with ticker symbols]
• Strategic: [Specific defensive/growth positioning recommendations]
• Risk Monitor: [Specific metrics and levels to watch]

Use the writing style of the example provided. Be specific with ticker symbols, RSI levels, and economic data points.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 600
    });

    const content = response.choices[0]?.message?.content || '';
    
    return this.parseSynthesisResponse(content);
  }

  private parseSynthesisResponse(content: string): MarketSynthesis {
    try {
      // Extract sections using regex patterns
      const marketPulseMatch = content.match(/MARKET PULSE:\s*(.*?)(?=CRITICAL CATALYSTS:|$)/s);
      const catalystsMatch = content.match(/CRITICAL CATALYSTS:\s*(.*?)(?=ACTION ITEMS:|$)/s);
      const actionItemsMatch = content.match(/ACTION ITEMS:\s*(.*?)$/s);

      const marketPulse = marketPulseMatch?.[1]?.trim() || 
        'Market conditions remain mixed with competing forces at play.';

      const criticalCatalysts = catalystsMatch?.[1]
        ?.split('•')
        .filter(item => item.trim())
        .map(item => item.trim())
        .slice(0, 3) || [
          'Sector rotation dynamics shifting',
          'Economic data mixed signals',
          'Technical levels under pressure'
        ];

      const actionItems = actionItemsMatch?.[1]
        ?.split('•')
        .filter(item => item.trim())
        .map(item => item.trim())
        .slice(0, 3) || [
          'Tactical: Monitor sector leadership changes',
          'Strategic: Maintain diversified positioning', 
          'Risk Monitor: Watch key support levels'
        ];

      // Calculate confidence based on content quality
      const confidence = this.calculateConfidence(content, marketPulse, criticalCatalysts, actionItems);

      return {
        marketPulse,
        criticalCatalysts,
        actionItems,
        confidence,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to parse synthesis response', { error, content });
      return this.getFallbackSynthesis();
    }
  }

  private calculateConfidence(content: string, marketPulse: string, catalysts: string[], actions: string[]): number {
    let confidence = 50; // Base confidence

    // Boost confidence for complete sections
    if (marketPulse.length > 50) confidence += 15;
    if (catalysts.length === 3) confidence += 15;
    if (actions.length === 3) confidence += 15;

    // Boost for specific terminology
    const specificTerms = ['RSI', 'support', 'resistance', 'bullish', 'bearish', '%', 'sector', 'economic'];
    const termCount = specificTerms.filter(term => content.toLowerCase().includes(term.toLowerCase())).length;
    confidence += Math.min(termCount * 2, 10);

    return Math.min(confidence, 95);
  }

  private getFallbackSynthesis(): MarketSynthesis {
    return {
      marketPulse: 'Market conditions are currently mixed with competing technical and fundamental factors. Sector rotation patterns suggest selective opportunities while overall sentiment remains cautious. Risk level: Moderate due to conflicting signals.',
      criticalCatalysts: [
        'Technical divergence between growth and value sectors creating rotation opportunities',
        'Economic data showing mixed signals requiring careful interpretation of trends',
        'Market structure changes suggesting need for active positioning'
      ],
      actionItems: [
        'Tactical (1-2 weeks): Focus on sector leaders with strong momentum signals',
        'Strategic (3-6 months): Build defensive positions while maintaining growth exposure',
        'Risk Monitor: Watch for breakdown in sector correlations and volatility spikes'
      ],
      confidence: 70,
      timestamp: new Date().toISOString()
    };
  }

  // Clear cache method for testing/debugging
  clearCache(): void {
    cacheService.delete(this.CACHE_KEY);
    logger.info('Market synthesis cache cleared');
  }
}

export const marketSynthesisService = new MarketSynthesisService();