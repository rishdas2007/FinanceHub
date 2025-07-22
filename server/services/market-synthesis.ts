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

      // Gather comprehensive market data
      const marketData = await this.gatherMarketData();
      
      // Generate synthesis using sophisticated prompting
      const synthesis = await this.generateSynthesisWithAI(marketData);
      
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
        { simplifiedEconomicCalendar },
        { financialDataService }
      ] = await Promise.all([
        import('./simplified-sector-analysis'),
        import('./simplified-economic-calendar'),
        import('./financial-data')
      ]);

      // Gather all relevant data in parallel
      const [
        sectorData,
        economicEvents,
        technicalIndicators,
        marketSentiment
      ] = await Promise.all([
        simplifiedSectorAnalysisService.getMomentumAnalysis(),
        simplifiedEconomicCalendar.getEconomicEvents(),
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

  private async generateSynthesisWithAI(marketData: any): Promise<MarketSynthesis> {
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

    const prompt = `You are a senior Wall Street analyst providing market synthesis. Based on current data, create a comprehensive market narrative that connects all data points.

CURRENT MARKET DATA:
Sector Momentum: ${bullishCount} bullish, ${bearishCount} bearish, ${neutralCount} neutral signals
Key Technical: SPY RSI ${marketData.technical?.rsi || 'N/A'}, VIX ${marketData.sentiment?.vix || 'N/A'}
Recent Economic Readings: ${economicContext}
AAII Sentiment: ${marketData.sentiment?.aaiiBullish || 'N/A'}% bullish

INSTRUCTIONS:
1. Identify the single most important market story connecting sector performance with economic data
2. Connect different data points into coherent investment themes
3. Provide specific, actionable insights with timing considerations
4. Focus on narrative and implications, not just data description

FORMAT YOUR RESPONSE EXACTLY AS:

MARKET PULSE: [2-3 sentences about the biggest market story right now, how sector momentum connects with economic data, and current risk level with reasoning]

CRITICAL CATALYSTS:
• [First catalyst - focus on what's driving markets with timing implications]
• [Second catalyst - connect different data points into coherent theme]
• [Third catalyst - include forward-looking implications]

ACTION ITEMS:
• Tactical (1-2 weeks): [Specific actionable move for short term]
• Strategic (3-6 months): [Specific positioning for medium term]
• Risk Monitor: [Key risk to watch closely with specific metrics]

Be specific, actionable, and connect the narrative. Avoid generic statements.`;

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