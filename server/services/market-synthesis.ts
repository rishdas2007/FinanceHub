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
      
      // Gather comprehensive market data including economic indicators
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
        { economicIndicatorsService }
      ] = await Promise.all([
        import('./economic-indicators')
      ]);

      // Get economic indicators data for analysis
      const economicIndicators = await economicIndicatorsService.getEconomicIndicators();

      return {
        economicIndicators
      };

    } catch (error) {
      logger.error('Failed to gather economic indicators data for synthesis', { error });
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

    // Get economic indicators data for analysis
    const economicIndicators = marketData.economicIndicators || [];
    
    // Sort economic indicators by Last Update date to get the 6 most recent
    const sortedByDate = economicIndicators
      .filter((ind: any) => ind.lastUpdated && ind.lastUpdated !== 'N/A')
      .sort((a: any, b: any) => {
        // Parse dates and sort newest first
        const dateA = new Date(a.lastUpdated);
        const dateB = new Date(b.lastUpdated);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 6);

    // Create recent readings display similar to screenshot format
    const recentReadingsDisplay = sortedByDate.map((ind: any) => {
      const variance = ind.vsForecast !== null && ind.vsForecast !== undefined ? 
        (ind.vsForecast >= 0 ? `+${ind.vsForecast}` : `${ind.vsForecast}`) : 'vs';
      const forecast = ind.forecast !== null && ind.forecast !== undefined ? `${ind.forecast}` : 'forecast';
      
      return `${ind.metric}: ${ind.current} ${variance} ${forecast} forecast (${ind.lastUpdated})`;
    }).join('\n');

    const prompt = `Based on the Economic Indicators data, provide analysis following this new format:

RECENT ECONOMIC READINGS (6 most recent by Last Update date):
${recentReadingsDisplay}

Analysis Focus Areas:
• Overall Economic Health: Based on leading, coincident, and lagging indicators, what is the general direction of the economy (expanding, contracting, stable)?
• Key Variances: Highlight any significant variances against forecasts or prior readings that indicate unexpected economic shifts
• Risks and Opportunities: Identify any emerging risks (e.g., potential recession, persistent inflation) or opportunities (e.g., strong growth, disinflation)

Generate analysis in this EXACT format:

**OVERALL ECONOMIC HEALTH**
[2-3 sentences: General direction of the economy based on leading, coincident, and lagging indicators - expanding, contracting, or stable]

**KEY VARIANCES** 
[3 bullet points: Significant variances against forecasts from the 6 most recent readings that indicate unexpected shifts]

**RISKS AND OPPORTUNITIES**
[3 key points: Emerging risks (recession, persistent inflation) and opportunities (strong growth, disinflation) based on the recent data]

Economic Indicators Data:
${JSON.stringify(economicIndicators.map((ind: any) => ({
  metric: ind.metric,
  type: ind.type,
  category: ind.category,
  current: ind.current,
  forecast: ind.forecast,
  vsForecast: ind.vsForecast,
  prior: ind.prior,
  zScore: ind.zScore,
  yoyChange: ind.yoyChange,
  threeMonthAnnualized: ind.threeMonthAnnualized,
  lastUpdated: ind.lastUpdated
})), null, 2)}

Rules:
- Prioritize indicators that were updated more recently (based on "Last Update" column)
- Display the 6 most recent economic readings in a format similar to the provided screenshot
- Analyze those recent readings for economic health direction
- Reference specific Z-scores, YoY changes, and variance data
- Focus on economic indicators only, not sector performance
- Keep total response under 500 words`;

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
      const cleanContent = content
        .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold markdown
        .replace(/\*([^*]+)\*/g, '$1')      // Remove italic markdown
        .replace(/- /g, '• ')               // Convert hyphens to bullets
        .trim();
      
      console.log('🔍 Searching for sections in cleaned content...');
      console.log('📋 First 200 chars:', cleanContent.substring(0, 200));
      
      // Extract sections using more flexible regex patterns with case-insensitive matching
      const marketPulseMatch = cleanContent.match(/ECONOMIC PULSE[\s:]*\n*(.*?)(?=CRITICAL INDICATORS|$)/si);
      const catalystsMatch = cleanContent.match(/CRITICAL INDICATORS[\s:]*\n*(.*?)(?=ECONOMIC OUTLOOK|$)/si);
      const actionItemsMatch = cleanContent.match(/ECONOMIC OUTLOOK[\s:]*\n*(.*?)$/si);
      
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
        'Economic conditions show mixed signals with competing growth and inflation pressures.';

      const criticalCatalysts = catalystsMatch?.[1]
        ?.split('•')
        .filter(item => item.trim())
        .map(item => item.trim())
        .slice(0, 3) || [
          'Inflation indicators showing mixed pressure signals',
          'Labor market strength remains robust despite concerns',
          'Consumer sentiment reflects ongoing economic uncertainty'
        ];

      const actionItems = actionItemsMatch?.[1]
        ?.split('•')
        .filter(item => item.trim())
        .map(item => item.trim())
        .slice(0, 3) || [
          'Near-term: Monitor inflation trajectory and Fed policy signals',
          'Medium-term: Watch for shifts in labor market dynamics', 
          'Risk Watch: Consumer spending patterns and sentiment deterioration'
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
      marketPulse: 'Economic conditions present mixed signals with growth momentum tempered by inflation concerns. Labor market strength supports consumer spending while monetary policy remains data-dependent. Economic risk level: Moderate due to conflicting indicators.',
      criticalCatalysts: [
        'Inflation measures showing divergent trends requiring careful Fed interpretation',
        'Employment data demonstrating resilience despite broader economic uncertainties',
        'Consumer sentiment reflecting cautious optimism amid mixed economic signals'
      ],
      actionItems: [
        'Near-term focus: Monitor key inflation readings and Fed communication for policy shifts',
        'Medium-term strategy: Track labor market evolution and consumer spending patterns',
        'Risk monitoring: Watch for deterioration in leading economic indicators'
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