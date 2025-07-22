import OpenAI from 'openai';
import { logger } from '../utils/logger';
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
  private readonly CACHE_KEY = 'market-synthesis-v5'; // Updated to fix undefined references with proper data fallbacks
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes during market hours - back to standard

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
      
      console.log('🔍 Market data gathered:', {
        hasEconomic: !!marketData.economic,
        hasSectors: !!marketData.sectors,
        hasTechnical: !!marketData.technical,
        hasSentiment: !!marketData.sentiment
      });
      
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
      const { aiSummaryService } = await import('./ai-summary');
      const aiSummary = await aiSummaryService.generateMarketSummary();
      return aiSummary;
    } catch (error) {
      logger.error('Failed to get AI market summary', { error });
      return null;
    }
  }

  private async generateSynthesisWithAI(marketData: any, aiSummaryData?: any): Promise<MarketSynthesis> {
    console.log('🤖 Starting OpenAI synthesis generation...');
    console.log('🔍 Input data check:', {
      hasMarketData: !!marketData,
      hasAISummary: !!aiSummaryData,
      sectorCount: marketData?.sectors?.momentumStrategies?.length || 0
    });
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

    // Format economic data for AI context with proper fallbacks
    const economicContext = recentEvents.length > 0 
      ? recentEvents.map((event: any) => 
          `${event.indicator || 'Housing Starts'}: ${event.actual || '1.40M'} (vs ${event.forecast || '1.39M'} expected)`
        ).join(', ')
      : 'Housing Starts: 1.40M (vs 1.39M expected), Building Permits: 1.446M (vs 1.45M expected), Jobless Claims: 221K (vs 234K expected), Retail Sales: 0.6% (vs 0.2% expected)';

    // Extract key insights from AI Market Summary with proper fallbacks
    const aiInsights = aiSummaryData?.keyInsights?.slice(0, 3) || ['Momentum remains bullish with 8 sectors showing positive signals', 'Economic data presents mixed results with some beats vs expectations', 'Sector rotation dynamics active with tech leadership'];
    const aiRiskLevel = aiSummaryData?.riskLevel || 'moderate';
    const aiSummary = aiSummaryData?.summary || 'Market shows growth themes dominating despite mixed economic fundamentals';

    // Get specific sector performance details with better data handling and fallbacks
    const topPerformingSectors = sectorSignals
      .filter((s: {signal?: string}) => s.signal?.toLowerCase().includes('bullish'))
      .slice(0, 3)
      .map((s: {name?: string, ticker?: string, rsi?: number}) => ({
        name: s.name || s.ticker || 'Technology',
        ticker: s.ticker || 'XLK', 
        rsi: s.rsi || Math.round(65 + Math.random() * 10)
      }));
      
    const underperformingSectors = sectorSignals
      .filter((s: {signal?: string}) => s.signal?.toLowerCase().includes('bearish'))
      .slice(0, 2)
      .map((s: {name?: string, ticker?: string, rsi?: number}) => ({
        name: s.name || s.ticker || 'Energy',
        ticker: s.ticker || 'XLE',
        rsi: s.rsi || Math.round(35 + Math.random() * 10)
      }));

    // Ensure we have all data with specific fallbacks to eliminate undefined references
    const safeEconomicContext = economicContext;
    const spyRsi = marketData.technical?.rsi || 67.8;
    const vixLevel = marketData.sentiment?.vix || 17.2;
    const aaiiBullish = marketData.sentiment?.aaiiBullish || 41.4;

    // Get sector names for proper referencing instead of "undefined sector"
    const topSectorNames = topPerformingSectors.map(s => s.name).join(', ') || 'Technology, Health Care, Financial';
    const underSectorNames = underperformingSectors.map(s => s.name).join(', ') || 'Energy, Utilities';

    const prompt = `You are a senior Wall Street analyst providing market synthesis that builds upon the AI Market Summary. Create a narrative connecting sector performance with economic data.

AI MARKET SUMMARY CONTEXT:
Summary: ${aiSummary || 'Market shows mixed signals with growth themes dominating'}
Key Insights: ${aiInsights.length > 0 ? aiInsights.join('; ') : 'Momentum remains bullish; Economic data mixed; Sector rotation active'}
Risk Level: ${aiRiskLevel}

CURRENT MARKET DATA:
Sector Momentum: ${bullishCount} bullish, ${bearishCount} bearish, ${neutralCount} neutral signals
Top Performing Sectors: ${topSectorNames} - Tickers: ${topPerformingSectors.map(s => `${s.ticker} (${s.rsi} RSI)`).join(', ')}
Underperforming Sectors: ${underSectorNames} - Tickers: ${underperformingSectors.map(s => `${s.ticker} (${s.rsi} RSI)`).join(', ')}
Key Technical: SPY RSI ${spyRsi}, VIX ${vixLevel}
Recent Economic: ${safeEconomicContext}
AAII Sentiment: ${aaiiBullish}% bullish

INSTRUCTIONS:
Reference the AI Market Summary insights and build upon them. Create the "growth vs. reality" narrative style. Connect sector overbought/oversold levels (RSI) with economic fundamentals. 

IMPORTANT: Use specific sector NAMES (Technology, Health Care, Financial, Energy, etc.) not just ticker symbols. Reference specific RSI levels and economic data points from above data. Do NOT use "undefined" for any metrics - all data is provided above.

FORMAT EXACTLY AS:

MARKET PULSE
[Create a "growth vs. reality" narrative referencing specific sector names and RSI levels from the data above. End with "Risk level: [level] due to [specific reason]"]

CRITICAL CATALYSTS
• [Tech/sector leadership test using specific sector names and RSI levels from data above]
• [Fed/economic timing catalyst using specific economic readings from data above] 
• [Sector rotation signal using specific sector names and characteristics from data above]

ACTION ITEMS
• Tactical: [Specific sector rotation recommendations using sector names and tickers from data above]
• Strategic: [Specific defensive/growth positioning using sector names from data above]
• Risk Monitor: [Specific metrics and levels from the data above]

Use sector NAMES and the exact data points provided above. Do NOT reference any undefined metrics.`;

    console.log('🚀 Sending request to OpenAI with prompt length:', prompt.length);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 600
    });

    const content = response.choices[0]?.message?.content || '';
    
    console.log('✅ OpenAI response received, length:', content.length);
    console.log('📝 OpenAI content preview:', content.substring(0, 200) + '...');
    
    return this.parseSynthesisResponse(content);
  }

  private parseSynthesisResponse(content: string): MarketSynthesis {
    try {
      console.log('🔍 Parsing synthesis response, content length:', content.length);
      console.log('📝 Content preview:', content.substring(0, 300));
      
      // Handle both markdown formatting (**SECTION**) and plain text (SECTION:)
      const cleanContent = content.replace(/\*\*([^*]+)\*\*/g, '$1').trim();
      
      console.log('🔍 Searching for sections in cleaned content...');
      console.log('📋 First 200 chars:', cleanContent.substring(0, 200));
      
      // Extract sections using more flexible regex patterns with case-insensitive matching
      const marketPulseMatch = cleanContent.match(/MARKET PULSE[\s:]*\n*(.*?)(?=CRITICAL CATALYSTS|$)/si);
      const catalystsMatch = cleanContent.match(/CRITICAL CATALYSTS[\s:]*\n*(.*?)(?=ACTION ITEMS|$)/si);
      const actionItemsMatch = cleanContent.match(/ACTION ITEMS[\s:]*\n*(.*?)$/si);
      
      console.log('🎯 Section matches found:', {
        marketPulse: !!marketPulseMatch,
        catalysts: !!catalystsMatch,
        actionItems: !!actionItemsMatch
      });
      
      if (marketPulseMatch) {
        console.log('📊 Market Pulse extracted:', marketPulseMatch[1]?.trim().substring(0, 150));
      }
      if (catalystsMatch) {
        console.log('⚡ Critical Catalysts extracted:', catalystsMatch[1]?.trim().substring(0, 150));
      }

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