import OpenAI from 'openai';

interface MomentumData {
  momentumStrategies: any[];
  chartData: any[];
}

interface EconomicEvent {
  title: string;
  actual: string;
  forecast: string;
  date: string;
  category: string;
}

interface AISummaryResult {
  summary: string;
  keyInsights: string[];
  marketOutlook: string;
  riskLevel: 'low' | 'moderate' | 'high';
  confidence: number;
}

export class AISummaryService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateMarketSummary(): Promise<AISummaryResult> {
    try {
      // Fetch momentum data
      const momentumData = await this.getMomentumData();
      
      // Fetch recent economic events
      const economicEvents = await this.getRecentEconomicEvents();

      // Generate AI analysis
      const analysis = await this.generateAIAnalysis(momentumData, economicEvents);

      return analysis;
    } catch (error) {
      console.error('Error generating AI market summary:', error);
      throw new Error('Failed to generate AI market summary');
    }
  }

  private async getMomentumData(): Promise<MomentumData> {
    try {
      const { simplifiedSectorAnalysisService } = await import('./simplified-sector-analysis');
      return await simplifiedSectorAnalysisService.generateSimplifiedAnalysis();
    } catch (error) {
      console.error('Error fetching momentum data:', error);
      // Return fallback data
      return {
        momentumStrategies: [],
        chartData: []
      };
    }
  }

  private async getRecentEconomicEvents(): Promise<EconomicEvent[]> {
    try {
      const { economicDataEnhancedService } = await import('./economic-data-enhanced');
      const events = await economicDataEnhancedService.getEnhancedEconomicEvents();
      
      // Filter for recent events (last 3 days) and only those with actual values
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      return events
        .filter(event => {
          const eventDate = new Date(event.date);
          return eventDate >= threeDaysAgo && event.actual && event.actual !== 'N/A';
        })
        .slice(0, 8); // Limit to most recent 8 events
    } catch (error) {
      console.error('Error fetching economic events:', error);
      return [];
    }
  }

  private async generateAIAnalysis(momentumData: MomentumData, economicEvents: EconomicEvent[]): Promise<AISummaryResult> {
    const prompt = this.buildAnalysisPrompt(momentumData, economicEvents);

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a professional financial analyst providing concise market insights. Analyze the provided momentum data and economic readings to generate a brief, actionable summary. Focus on key momentum signals from RSI analysis and recent economic data impact. Respond in JSON format only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      summary: result.summary || 'Market analysis unavailable',
      keyInsights: result.keyInsights || [],
      marketOutlook: result.marketOutlook || 'Outlook analysis unavailable',
      riskLevel: result.riskLevel || 'moderate',
      confidence: result.confidence || 75
    };
  }

  private buildAnalysisPrompt(momentumData: MomentumData, economicEvents: EconomicEvent[]): string {
    const { momentumStrategies } = momentumData;
    
    // Calculate momentum statistics
    const bullishCount = momentumStrategies.filter(s => s.momentum === 'bullish').length;
    const bearishCount = momentumStrategies.filter(s => s.momentum === 'bearish').length;
    const avgRSI = momentumStrategies.reduce((sum, s) => sum + s.rsi, 0) / momentumStrategies.length;
    const avgZScore = momentumStrategies.reduce((sum, s) => sum + Math.abs(s.fiveDayZScore), 0) / momentumStrategies.length;
    
    // Top performing sectors
    const topPerformers = momentumStrategies
      .filter(s => s.momentum === 'bullish')
      .slice(0, 3)
      .map(s => s.sector);
    
    // Bottom performing sectors  
    const bottomPerformers = momentumStrategies
      .filter(s => s.momentum === 'bearish')
      .slice(0, 3)
      .map(s => s.sector);

    // Economic readings summary
    const economicSummary = economicEvents.length > 0 
      ? economicEvents.map(e => `${e.title}: ${e.actual} (forecast: ${e.forecast})`).join(', ')
      : 'No recent economic readings available';

    return `
Analyze this market data and provide a JSON response with the following structure:
{
  "summary": "2-3 sentence overview of current market momentum and economic conditions",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "marketOutlook": "1-2 sentence outlook based on momentum and economic data",
  "riskLevel": "low|moderate|high",
  "confidence": number (0-100)
}

MOMENTUM DATA:
- Total sectors analyzed: ${momentumStrategies.length}
- Bullish momentum signals: ${bullishCount}
- Bearish momentum signals: ${bearishCount}
- Average RSI across sectors: ${avgRSI.toFixed(1)}
- Average Z-Score magnitude: ${avgZScore.toFixed(2)}
- Top performing sectors: ${topPerformers.join(', ') || 'None'}
- Underperforming sectors: ${bottomPerformers.join(', ') || 'None'}

RECENT ECONOMIC READINGS (last 3 days):
${economicSummary}

Focus on:
1. RSI momentum signals (overbought >70, oversold <30)
2. Z-score extremes indicating potential reversals
3. Economic data beats/misses and market implications
4. Overall risk assessment based on momentum distribution

Keep insights actionable and specific to the data provided.
    `;
  }
}

export const aiSummaryService = new AISummaryService();