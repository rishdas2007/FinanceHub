import OpenAI from 'openai';
import { historicalDataAccumulator } from './historical-data-accumulator.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class EnhancedAIAnalysisService {
  private static instance: EnhancedAIAnalysisService;

  static getInstance(): EnhancedAIAnalysisService {
    if (!EnhancedAIAnalysisService.instance) {
      EnhancedAIAnalysisService.instance = new EnhancedAIAnalysisService();
    }
    return EnhancedAIAnalysisService.instance;
  }

  async generateAnalysisWithHistoricalContext(marketData: any): Promise<any> {
    console.log('🧠 Generating AI analysis with historical context...');
    
    try {
      // Get historical context for key indicators
      const historicalContext = await this.getHistoricalContext();
      
      // Enhanced prompt with historical data
      const prompt = await this.buildEnhancedPrompt(marketData, historicalContext);
      
      console.log('📝 Sending enhanced request to OpenAI with historical context...');
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Latest OpenAI model
        messages: [
          {
            role: "system",
            content: `You are a Wall Street senior market analyst with access to comprehensive historical economic data. 
            Provide sophisticated analysis using historical precedents, percentile rankings, and trend analysis.
            Focus on data-driven insights with specific historical comparisons.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      console.log('✅ Enhanced AI analysis with historical context generated');
      
      return {
        ...analysis,
        generatedAt: new Date().toISOString(),
        historicalContextUsed: true,
        dataQuality: 'high'
      };
      
    } catch (error) {
      console.error('❌ Enhanced AI analysis failed:', error);
      throw new Error(`Failed to generate enhanced AI analysis: ${error.message}`);
    }
  }

  private async getHistoricalContext(): Promise<any> {
    console.log('📊 Gathering historical context for AI analysis...');
    
    try {
      // Get key indicators with historical context
      const indicators = [
        'Consumer Price Index (CPI)',
        'Core Consumer Price Index',
        'Unemployment Rate',
        'Nonfarm Payrolls',
        'Housing Starts',
        'Initial Jobless Claims'
      ];

      const historicalContext = {};
      
      for (const indicator of indicators) {
        try {
          // Get 24 months of historical data
          const history = await historicalDataAccumulator.getHistoricalContext(indicator, 24);
          
          if (history.length > 0) {
            const current = parseFloat(history[0].value);
            
            // Get percentile ranking over 36 months
            const percentile = await historicalDataAccumulator.getPercentileRanking(indicator, current, 36);
            
            // Get year-over-year comparison
            const yoyComparison = await historicalDataAccumulator.getYearOverYearComparison(indicator);
            
            // Calculate 6-month trend
            const sixMonthTrend = this.calculateTrend(history.slice(0, 6));
            
            historicalContext[indicator] = {
              current: {
                value: current,
                formatted: history[0].valueFormatted,
                date: history[0].periodDate
              },
              percentile: Math.round(percentile),
              yearOverYear: yoyComparison,
              sixMonthTrend: sixMonthTrend,
              historicalRange: {
                min: Math.min(...history.map(h => parseFloat(h.value))),
                max: Math.max(...history.map(h => parseFloat(h.value))),
                average: history.reduce((sum, h) => sum + parseFloat(h.value), 0) / history.length
              },
              recentHistory: history.slice(0, 12).map(h => ({
                value: parseFloat(h.value),
                date: h.periodDate,
                change: h.monthlyChange ? parseFloat(h.monthlyChange) : null
              }))
            };
          }
        } catch (error) {
          console.error(`❌ Error getting historical context for ${indicator}:`, error);
        }
      }
      
      console.log(`✅ Historical context gathered for ${Object.keys(historicalContext).length} indicators`);
      return historicalContext;
      
    } catch (error) {
      console.error('❌ Failed to gather historical context:', error);
      return {};
    }
  }

  private calculateTrend(recentData: any[]): string {
    if (recentData.length < 3) return 'insufficient_data';
    
    const values = recentData.map(d => parseFloat(d.value));
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 2) return 'rising';
    if (change < -2) return 'falling';
    return 'stable';
  }

  private async buildEnhancedPrompt(marketData: any, historicalContext: any): Promise<string> {
    const contextSummary = Object.entries(historicalContext).map(([indicator, data]: [string, any]) => {
      let summary = `${indicator}: ${data.current.formatted} (${data.percentile}th percentile over 3 years)`;
      
      if (data.yearOverYear) {
        const yoyChange = data.yearOverYear.change;
        const direction = yoyChange > 0 ? 'increased' : 'decreased';
        summary += ` - ${direction} ${Math.abs(yoyChange).toFixed(1)} from ${data.yearOverYear.yearAgo} last year`;
      }
      
      if (data.sixMonthTrend !== 'stable') {
        summary += ` - ${data.sixMonthTrend} trend over 6 months`;
      }
      
      return summary;
    }).join('\n');

    return `
CURRENT MARKET DATA:
SPY Price: $${marketData.spyPrice} (${marketData.spyChange}%)
VIX: ${marketData.vix} (${marketData.vixChange}%)
Technical Indicators: RSI ${marketData.rsi}, MACD ${marketData.macd}
AAII Sentiment: ${marketData.aaiiBullish}% bullish, ${marketData.aaiiBearish}% bearish

HISTORICAL ECONOMIC CONTEXT:
${contextSummary}

SECTOR PERFORMANCE:
${marketData.sectors ? marketData.sectors.map(s => `${s.name}: ${s.change}%`).join(', ') : 'Data unavailable'}

Please provide a comprehensive market analysis in JSON format with these sections:

{
  "bottomLine": "Single sentence assessment with specific percentile rankings",
  "technicalAnalysis": "Analysis incorporating current RSI/MACD with historical precedents",
  "economicAnalysis": "Detailed analysis using historical context - mention specific percentiles, year-over-year changes, and trends. Reference when indicators were last at similar levels.",
  "sectorAnalysis": "Sector rotation analysis with historical context",
  "historicalPrecedents": "Specific examples: 'Last time CPI was at X percentile in YEAR, markets...'",
  "riskAssessment": "Risk analysis using historical volatility and precedents",
  "outlook": "Forward-looking analysis based on historical patterns",
  "confidence": "Number 1-100 based on data quality and historical precedent strength"
}

Focus on specific historical comparisons like:
- "CPI at 2.9% is in the 78th percentile over 3 years"
- "Unemployment increased 0.3% from 3.7% last July" 
- "Housing starts have declined 15% over the past 6 months"
- "Last time inflation was this high was March 2023, which led to..."

Make the analysis sophisticated and data-driven with concrete historical references.
`;
  }
}

export const enhancedAIAnalysisService = EnhancedAIAnalysisService.getInstance();