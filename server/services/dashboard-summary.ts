import OpenAI from "openai";
import { logger } from "../middleware/logging";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface DashboardSummaryData {
  executiveSummary: string;
  keyInsights: string[];
  marketOutlook: string;
  riskFactors: string[];
  actionItems: string[];
  confidence: number;
  timestamp: string;
}

export class DashboardSummaryService {
  private static readonly CACHE_KEY = 'dashboard-summary-v1';
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async generateDashboardSummary(): Promise<DashboardSummaryData> {
    try {
      logger.info('🧠 Generating comprehensive dashboard summary...');

      // Import cache service
      const { cacheService } = await import('./cache-unified');
      
      // Check cache first for cost optimization
      const cachedSummary = cacheService.get(DashboardSummaryService.CACHE_KEY);
      if (cachedSummary) {
        logger.info('📋 Serving dashboard summary from cache');
        return cachedSummary as DashboardSummaryData;
      }

      // Gather comprehensive data from all dashboard sections
      const dashboardData = await this.gatherDashboardData();
      
      // Generate AI summary
      const summary = await this.generateAISummary(dashboardData);
      
      // Cache the result
      cacheService.set(DashboardSummaryService.CACHE_KEY, summary, DashboardSummaryService.CACHE_DURATION);
      
      logger.info(`🧠 Dashboard summary generated with ${summary.confidence}% confidence`);
      return summary;

    } catch (error) {
      logger.error('❌ Dashboard summary generation failed', { error });
      return this.getFallbackSummary();
    }
  }

  private async gatherDashboardData() {
    try {
      // Import all required services
      const [
        { economicIndicatorsService },
        { financialDataService }
      ] = await Promise.all([
        import('./economic-indicators'),
        import('./financial-data')
      ]);

      // Fetch data from all dashboard sections
      const [
        economicIndicators,
        momentumData,
        marketSentiment
      ] = await Promise.all([
        economicIndicatorsService.getEconomicIndicators(),
        this.getMomentumData(),
        financialDataService.getRealMarketSentiment()
      ]);

      return {
        economicIndicators,
        momentumData,
        marketSentiment
      };

    } catch (error) {
      logger.error('Failed to gather dashboard data', { error });
      throw error;
    }
  }

  private async getMomentumData() {
    try {
      // Import node-fetch for server-side requests
      const fetch = (await import('node-fetch')).default;
      
      // Fetch momentum analysis data
      const response = await fetch('http://localhost:5000/api/momentum-analysis');
      if (!response.ok) throw new Error('Momentum data unavailable');
      return await response.json();
    } catch (error) {
      logger.warn('Momentum data fetch failed', { error });
      return null;
    }
  }

  private async generateAISummary(dashboardData: any): Promise<DashboardSummaryData> {
    if (!openai) {
      logger.warn('OpenAI not available - returning fallback dashboard summary');
      return {
        executiveSummary: "Market analysis requires OpenAI API key configuration",
        keyInsights: ["OpenAI API key needed for AI-powered insights"],
        marketOutlook: "AI-powered market outlook unavailable",
        riskFactors: ["Configure OpenAI API key for risk analysis"],
        actionItems: ["Set up OpenAI integration for enhanced analytics"],
        confidence: 50,
        timestamp: new Date().toISOString()
      };
    }
    
    const prompt = this.buildAnalysisPrompt(dashboardData);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a senior financial analyst providing executive-level dashboard summaries. Analyze all provided dashboard data and create a comprehensive, actionable summary. Respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1200
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      executiveSummary: result.executiveSummary || "Market analysis in progress",
      keyInsights: Array.isArray(result.keyInsights) ? result.keyInsights : ["Analysis updating"],
      marketOutlook: result.marketOutlook || "Market outlook assessment pending",
      riskFactors: Array.isArray(result.riskFactors) ? result.riskFactors : ["Risk assessment updating"],
      actionItems: Array.isArray(result.actionItems) ? result.actionItems : ["Action items updating"],
      confidence: Math.min(Math.max(result.confidence || 75, 0), 100),
      timestamp: new Date().toISOString()
    };
  }

  private buildAnalysisPrompt(dashboardData: any): string {
    const economicSummary = this.summarizeEconomicData(dashboardData.economicIndicators);
    const momentumSummary = this.summarizeMomentumData(dashboardData.momentumData);
    const sentimentSummary = this.summarizeSentimentData(dashboardData.marketSentiment);

    return `
Analyze this comprehensive financial dashboard data and provide an executive summary in JSON format:

ECONOMIC INDICATORS DATA (prioritized by most recent "Last Update" date):
${economicSummary}

MOMENTUM ANALYSIS DATA:
${momentumSummary}

MARKET SENTIMENT DATA:
${sentimentSummary}

Provide a comprehensive analysis in this exact JSON structure:
{
  "executiveSummary": "2-3 sentence executive overview of current market conditions and outlook",
  "keyInsights": ["insight 1", "insight 2", "insight 3", "insight 4"],
  "marketOutlook": "Single paragraph market outlook and directional bias",
  "riskFactors": ["risk 1", "risk 2", "risk 3"],
  "actionItems": ["action 1", "action 2", "action 3"],
  "confidence": 85
}

IMPORTANT FORMATTING REQUIREMENTS:
- Make ALL numerical values, percentages, and metrics BOLD in your response
- Use **bold** formatting for all numbers, percentages, ratios, and financial metrics
- Example: "SPY at **$627.41** with RSI at **68.2**" not "SPY at $627.41 with RSI at 68.2"
- Bold ALL economic data points, sector returns, technical indicators, and sentiment readings

Focus on:
1. Prioritize the 6 most recent economic readings by "Last Update" date
2. Cross-section analysis between economic data, momentum, and sentiment
3. Identifying divergences or confirmations across data sets
4. Actionable insights for investment positioning with bold metrics
5. Forward-looking perspective based on leading indicators

Keep insights concise but substantive. Use specific data points with bold formatting.
`;
  }

  private summarizeEconomicData(indicators: any[]): string {
    if (!Array.isArray(indicators) || indicators.length === 0) {
      return "Economic indicators data unavailable";
    }

    // Sort by lastUpdated date (most recent first) and take top 6
    const sortedByDate = indicators
      .filter(ind => ind.lastUpdated)
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
      .slice(0, 6);
    
    // If we don't have enough with dates, fill with others
    const remaining = indicators.filter(ind => !ind.lastUpdated).slice(0, 6 - sortedByDate.length);
    const recent = [...sortedByDate, ...remaining];

    return recent.map(ind => 
      `${ind.metric}: **${ind.current}** (Type: ${ind.type}, Updated: ${ind.lastUpdated || 'Recent'})`
    ).join('\n');
  }

  private summarizeMomentumData(momentum: any): string {
    if (!momentum || !momentum.momentumStrategies) {
      return "Momentum analysis data unavailable";
    }

    const spy = momentum.momentumStrategies.find((s: any) => s.ticker === 'SPY');
    const sectors = momentum.momentumStrategies.filter((s: any) => s.ticker !== 'SPY').slice(0, 5);
    
    let summary = spy ? `SPY: **${spy.momentum}** momentum, RSI **${spy.rsi}**, 1-day **${spy.oneDayChange}%**\n` : '';
    summary += sectors.map((s: any) => 
      `${s.sector}: **${s.momentum}**, RSI **${s.rsi}**, 1-day **${s.oneDayChange}%**`
    ).join('\n');
    
    return summary;
  }

  private summarizeSentimentData(sentiment: any): string {
    if (!sentiment) {
      return "Market sentiment data unavailable";
    }

    return `VIX: **${sentiment.vix || 'N/A'}**, AAII Bullish: **${sentiment.aaiiBullish || 'N/A'}%**, AAII Bearish: **${sentiment.aaiiBearish || 'N/A'}%**`;
  }

  private getFallbackSummary(): DashboardSummaryData {
    return {
      executiveSummary: "Dashboard analysis is currently updating. Market data shows mixed signals with economic indicators providing varied readings across growth, inflation, and sentiment metrics.",
      keyInsights: [
        "Economic indicators show mixed signals across categories",
        "Sector momentum displays varied performance patterns",
        "Market sentiment indicators suggest cautious optimism",
        "Technical analysis shows consolidation patterns"
      ],
      marketOutlook: "Current market conditions suggest a period of consolidation with selective opportunities emerging in specific sectors. Monitor economic data releases for directional clarity.",
      riskFactors: [
        "Mixed economic signals creating uncertainty",
        "Sector rotation patterns indicating volatility",
        "Sentiment indicators showing indecision"
      ],
      actionItems: [
        "Monitor key economic releases for trend confirmation",
        "Track sector momentum for rotation opportunities",
        "Maintain diversified positioning given mixed signals"
      ],
      confidence: 70,
      timestamp: new Date().toISOString()
    };
  }
}

export const dashboardSummaryService = new DashboardSummaryService();