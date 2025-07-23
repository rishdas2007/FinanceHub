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
  private readonly CACHE_KEY = 'market-synthesis-v6-economic-focus'; // Updated for new Economic Synthesis format with 6 recent readings
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes during market hours - back to standard
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateMarketSynthesis(): Promise<MarketSynthesis> {
    try {
      // Force bypass cache to implement new prompt changes
      const cached = null; // Temporarily force fresh generation for new prompt implementation
      // const cached = cacheService.get(this.CACHE_KEY);
      // if (cached) {
      //   logger.info('Market synthesis served from cache for cost optimization');
      //   return cached;
      // }

      logger.info('Generating fresh market synthesis with OpenAI');

      // Clear any old cache entries to force fresh generation
      cacheService.delete('market-synthesis-v5');
      cacheService.delete('market-synthesis-v6-economic-focus');

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
    console.log('🤖 Starting OpenAI Economic Synthesis generation...');
    
    // Get economic indicators data
    const economicIndicators = marketData.economicIndicators || [];
    
    // Sort by last update date and get 6 most recent
    const recentIndicators = economicIndicators
      .filter((indicator: any) => indicator.lastUpdated)
      .sort((a: any, b: any) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
      .slice(0, 6);

    const analysis = await this.generateEconomicSynthesisWithAI(recentIndicators);

    return analysis;
  }

  private async generateEconomicSynthesisWithAI(recentIndicators: any[]): Promise<MarketSynthesis> {
    try {
      const prompt = this.buildEconomicSynthesisPrompt(recentIndicators);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a senior economic analyst providing economic synthesis for institutional investors. Focus exclusively on economic indicators and their implications."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 700
      });

      const content = response.choices[0].message.content || '';
      
      console.log('✅ OpenAI response received, length:', content.length);
      console.log('📝 OpenAI content preview:', content.substring(0, 200) + '...');
      
      return this.parseSynthesisResponse(content);

    } catch (error) {
      logger.error('Error generating economic synthesis', { error });
      return this.getFallbackSynthesis();
    }
  }

  private buildEconomicSynthesisPrompt(recentIndicators: any[]): string {
    // Create display of 6 most recent readings in screenshot format
    const recentReadingsDisplay = recentIndicators.map((ind: any) => {
      const variance = ind.vsForecast !== null && ind.vsForecast !== undefined ? 
        (ind.vsForecast >= 0 ? `+${ind.vsForecast}` : `${ind.vsForecast}`) : 'vs';
      const forecast = ind.forecast !== null && ind.forecast !== undefined ? `${ind.forecast}` : 'forecast';
      const date = new Date(ind.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      return `${ind.metric}: ${ind.current} ${variance} ${forecast} forecast - ${date}`;
    }).join('\n');

    return `Analyze the 6 most recent economic indicators and provide Economic Synthesis:

RECENT ECONOMIC READINGS (by Last Update date):
${recentReadingsDisplay}

Generate analysis in this EXACT format:

**OVERALL ECONOMIC HEALTH**
Based on leading, coincident, and lagging indicators, assess the general direction of the economy (expanding, contracting, stable). Reference specific data points from the recent readings.

**KEY VARIANCES**
• [Highlight significant variance 1 against forecast that indicates unexpected economic shift]
• [Highlight significant variance 2 against forecast that indicates unexpected economic shift]  
• [Highlight significant variance 3 against forecast that indicates unexpected economic shift]

**RISKS AND OPPORTUNITIES**
• [Emerging risk 1 - e.g., potential recession signal, persistent inflation]
• [Emerging opportunity 1 - e.g., strong growth indicator, disinflation trend]
• [Key risk/opportunity 2 - balance between risks and opportunities]

Rules:
- Focus only on economic indicators, not market/sector performance
- Prioritize the 6 most recent readings by Last Update date
- Reference specific indicator names and values
- Keep each section concise (2-3 sentences for health, bullet points for variances/risks)
- Total response under 400 words`;
  }

  private getFallbackSynthesis(): MarketSynthesis {
    return {
      marketPulse: 'Economic conditions show mixed signals with the Leading Economic Index rising while Consumer Confidence declined, indicating potential growth alongside consumer caution.',
      criticalCatalysts: [
        'Consumer Confidence Index dropped significantly below forecast, signaling potential consumer spending weakness',
        'Leading Economic Index exceeded expectations, suggesting underlying economic momentum remains intact',  
        'Durable Goods Orders showed sharp decline, indicating business investment caution'
      ],
      actionItems: [
        'Monitor consumer spending patterns for recession signals given confidence decline',
        'Watch for confirmation of growth momentum from Leading Economic Index strength',
        'Assess manufacturing sector health given durable goods weakness'
      ],
      confidence: 75,
      timestamp: new Date().toISOString()
    };
  }

  private calculateConfidence(content: string, marketPulse: string, catalysts: string[], actions: string[]): number {
    let confidence = 50;
    
    if (content.length > 200) confidence += 20;
    if (marketPulse.length > 50) confidence += 10;
    if (catalysts.length >= 3) confidence += 10;
    if (actions.length >= 3) confidence += 10;
    
    return Math.min(confidence, 95);
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
      
      // Extract sections using new format (OVERALL ECONOMIC HEALTH, KEY VARIANCES, RISKS AND OPPORTUNITIES)
      const marketPulseMatch = cleanContent.match(/OVERALL ECONOMIC HEALTH[\s:]*\n*(.*?)(?=KEY VARIANCES|$)/si);
      const catalystsMatch = cleanContent.match(/KEY VARIANCES[\s:]*\n*(.*?)(?=RISKS AND OPPORTUNITIES|$)/si);
      const actionItemsMatch = cleanContent.match(/RISKS AND OPPORTUNITIES[\s:]*\n*(.*?)$/si);
      
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
      logger.error('Failed to parse synthesis response', { error });
      return this.getFallbackSynthesis();
    }
  }

  // Clear cache method for testing/debugging
  clearCache(): void {
    cacheService.delete(this.CACHE_KEY);
    logger.info('Market synthesis cache cleared');
  }
}

export const marketSynthesisService = new MarketSynthesisService();
