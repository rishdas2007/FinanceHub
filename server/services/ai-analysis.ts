import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  vix?: number;
  putCallRatio?: number;
  aaiiBullish?: number;
  aaiiBearish?: number;
  macroContext?: string;
}

interface AnalysisResult {
  marketConditions: string;
  technicalOutlook: string;
  riskAssessment: string;
  confidence: number;
}

export class AIAnalysisService {
  async generateMarketAnalysis(marketData: MarketData, sectorData?: any[]): Promise<AnalysisResult> {
    try {
      const macroContext = marketData.macroContext || "Recent economic data shows mixed signals.";
      
      // Format numbers to 1 decimal place
      const formatPrice = (num: number) => num.toFixed(1);
      const formatPercent = (num: number) => num.toFixed(1);
      
      // Analyze sector performance if data is available
      let sectorAnalysis = "";
      if (sectorData && sectorData.length > 0) {
        const topPerformer1D = sectorData.reduce((max, sector) => 
          sector.changePercent > max.changePercent ? sector : max);
        const bottomPerformer1D = sectorData.reduce((min, sector) => 
          sector.changePercent < min.changePercent ? sector : min);
        
        const topPerformer5D = sectorData.reduce((max, sector) => 
          (sector.fiveDayChange || 0) > (max.fiveDayChange || 0) ? sector : max);
        const bottomPerformer5D = sectorData.reduce((min, sector) => 
          (sector.fiveDayChange || 0) < (min.fiveDayChange || 0) ? sector : min);
        
        sectorAnalysis = `
SECTOR PERFORMANCE ANALYSIS:
1-Day Leaders: ${topPerformer1D.name} (+${formatPercent(topPerformer1D.changePercent)}%), Laggards: ${bottomPerformer1D.name} (${formatPercent(bottomPerformer1D.changePercent)}%)
5-Day Leaders: ${topPerformer5D.name} (+${formatPercent(topPerformer5D.fiveDayChange || 0)}%), Laggards: ${bottomPerformer5D.name} (${formatPercent(bottomPerformer5D.fiveDayChange || 0)}%)
Energy sector showing weakness: 1D: ${formatPercent(sectorData.find(s => s.symbol === 'XLE')?.changePercent || 0)}%, 5D: ${formatPercent(sectorData.find(s => s.symbol === 'XLE')?.fiveDayChange || 0)}%
Technology resilience: 1D: +${formatPercent(sectorData.find(s => s.symbol === 'XLK')?.changePercent || 0)}%, 5D: +${formatPercent(sectorData.find(s => s.symbol === 'XLK')?.fiveDayChange || 0)}%`;
      }
      
      const prompt = `Analyze the current market conditions based on the following data:

MARKET DATA:
Stock: ${marketData.symbol}
Price: $${formatPrice(marketData.price)}
Change: ${formatPrice(marketData.change)} (${formatPercent(marketData.changePercent)}%)
RSI: ${marketData.rsi ? formatPrice(marketData.rsi) : 'N/A'} ${marketData.rsi && marketData.rsi > 70 ? '(Overbought)' : marketData.rsi && marketData.rsi < 30 ? '(Oversold)' : '(Neutral)'}
MACD: ${marketData.macd ? formatPrice(marketData.macd) : 'N/A'} vs Signal: ${marketData.macdSignal ? formatPrice(marketData.macdSignal) : 'N/A'} ${marketData.macd && marketData.macdSignal && marketData.macd < marketData.macdSignal ? '(Bearish Crossover)' : '(Bullish Territory)'}
VIX: ${marketData.vix ? formatPrice(marketData.vix) : 'N/A'} (Volatility measure)
Put/Call Ratio: ${marketData.putCallRatio ? formatPrice(marketData.putCallRatio) : 'N/A'}
AAII Bullish: ${marketData.aaiiBullish ? formatPrice(marketData.aaiiBullish) : 'N/A'}% vs Bearish: ${marketData.aaiiBearish ? formatPrice(marketData.aaiiBearish) : 'N/A'}%
${sectorAnalysis}

CURRENT ECONOMIC CALENDAR DATA (MarketWatch):
Recent High-Impact Releases:
- Consumer Price Index (CPI): 0.3% monthly (vs 0.3% forecast), annualized 2.7% (vs 2.6% estimate)
- Core CPI: 0.2% monthly (vs 0.3% forecast), annualized 2.9% (exceeding Fed's 2% target)
- Producer Price Index (PPI): 0.0% monthly (vs 0.2% forecast), showing wholesale price cooling at 2.1%
- Retail Sales: +0.6% monthly (vs 0.2% forecast), demonstrating consumer resilience
- Initial Jobless Claims: 221,000 (vs 234,000 forecast), labor market strength
- Philadelphia Fed Manufacturing: +15.9 (vs -1.0 forecast), significant manufacturing improvement
- Empire State Manufacturing: +5.5 (vs -9.0 forecast), NY region expansion
- JOLTS Job Openings: 8.18M (vs 8.05M forecast), stable employment demand
- Industrial Production: +0.3% (vs 0.1% forecast), steady manufacturing growth
- Housing Starts: 1.31M (vs 1.28M previous), modest housing sector improvement

KEY ECONOMIC THEMES: 
1. Inflation Persistence: Core CPI at 2.9% remains above Fed's 2% target despite PPI cooling
2. Consumer Resilience: Retail sales beating forecasts shows spending strength amid rate pressures
3. Labor Market Balance: Strong jobs data (221K claims vs 234K forecast) without overheating signs
4. Manufacturing Recovery: Philadelphia Fed (+15.9) and Empire State (+5.5) both beat expectations significantly
5. Wholesale Price Relief: PPI at 0.0% monthly suggests upstream inflation pressures easing

Provide a comprehensive market analysis in JSON format that INTEGRATES technical indicators with specific economic calendar data points:
{
  "marketConditions": "Provide technical and sentiment analysis commentary based on current indicators. Discuss RSI levels, MACD signals, volatility environment (VIX), and investor sentiment readings. Use 1 decimal place formatting. Do NOT include any economic data in this section.",
  "technicalOutlook": "Technical analysis including MACD crossover status, RSI levels, and sentiment backdrop. Use 1 decimal place for all technical values.", 
  "riskAssessment": "ECONOMIC ANALYSIS: Comprehensive analysis incorporating latest MarketWatch economic releases. BOLD all economic readings (e.g., **Core CPI at 2.9%**, **Retail Sales at 0.6%**, **Initial Claims at 221,000**). Address Fed policy implications from persistent inflation vs cooling PPI. Discuss consumer spending strength vs manufacturing recovery signals.\n\nSECTOR ROTATION ANALYSIS: Detailed sector performance analysis covering 1-day and 5-day trends. Include technology resilience, energy sector weakness, financial sector performance, and rotation patterns. This must be a separate complete paragraph.",
  "confidence": 0.85
}

IMPORTANT FORMATTING RULES:
1. Use exactly 1 decimal place for ALL prices and percentages (e.g., $624.2, 0.3%, 65.9)
2. BOLD all economic data readings in the riskAssessment section using **text** format
3. marketConditions should focus ONLY on technical indicators and sentiment - NO economic data repetition
4. riskAssessment should have two distinct paragraphs: Economic analysis first, then sector rotation analysis
5. Focus on how the specific economic data points from the calendar influence market outlook and Fed policy expectations.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a senior financial analyst with expertise in market analysis, technical indicators, and macroeconomic factors. Integrate technical analysis with economic fundamentals to provide comprehensive market commentary."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1200,
        temperature: 0.7,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        marketConditions: result.marketConditions || "Market analysis unavailable",
        technicalOutlook: result.technicalOutlook || "Technical outlook unavailable",
        riskAssessment: result.riskAssessment || "Risk assessment unavailable",
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      };
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      
      // Fallback analysis based on data
      return this.generateFallbackAnalysis(marketData);
    }
  }

  private generateFallbackAnalysis(marketData: MarketData): AnalysisResult {
    const isPositive = marketData.changePercent > 0;
    const isHighVolatility = marketData.vix && marketData.vix > 25;
    const isOverbought = marketData.rsi && marketData.rsi > 70;
    const isOversold = marketData.rsi && marketData.rsi < 30;

    let marketConditions = `${marketData.symbol} is trading at $${marketData.price.toFixed(2)}, ${isPositive ? 'up' : 'down'} ${Math.abs(marketData.changePercent).toFixed(2)}% today.`;
    
    if (marketData.rsi) {
      if (isOverbought) {
        marketConditions += " RSI indicates overbought conditions with potential for correction.";
      } else if (isOversold) {
        marketConditions += " RSI suggests oversold levels with potential buying opportunity.";
      } else {
        marketConditions += " RSI indicates balanced momentum conditions.";
      }
    }

    let technicalOutlook = "Technical indicators suggest ";
    if (marketData.macd && marketData.macd > 0) {
      technicalOutlook += "bullish momentum with positive MACD readings.";
    } else if (marketData.macd && marketData.macd < 0) {
      technicalOutlook += "bearish momentum with negative MACD readings.";
    } else {
      technicalOutlook += "neutral momentum in the current market environment.";
    }

    let riskAssessment = "Market risk appears ";
    if (isHighVolatility) {
      riskAssessment += "elevated with VIX above 25, indicating heightened fear and uncertainty.";
    } else {
      riskAssessment += "moderate with controlled volatility levels in the current session.";
    }

    return {
      marketConditions,
      technicalOutlook,
      riskAssessment,
      confidence: 0.75,
    };
  }
}

export const aiAnalysisService = new AIAnalysisService();
