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
  async generateMarketAnalysis(marketData: MarketData): Promise<AnalysisResult> {
    try {
      const macroContext = marketData.macroContext || "Recent economic data shows mixed signals.";
      
      const prompt = `Analyze the current market conditions based on the following data:

MARKET DATA:
Stock: ${marketData.symbol}
Price: $${marketData.price}
Change: ${marketData.change} (${marketData.changePercent}%)
RSI: ${marketData.rsi || 'N/A'} ${marketData.rsi && marketData.rsi > 70 ? '(Overbought)' : marketData.rsi && marketData.rsi < 30 ? '(Oversold)' : '(Neutral)'}
MACD: ${marketData.macd || 'N/A'} vs Signal: ${marketData.macdSignal || 'N/A'} ${marketData.macd && marketData.macdSignal && marketData.macd < marketData.macdSignal ? '(Bearish Crossover)' : '(Bullish Territory)'}
VIX: ${marketData.vix || 'N/A'} (Volatility measure)
Put/Call Ratio: ${marketData.putCallRatio || 'N/A'}
AAII Bullish: ${marketData.aaiiBullish || 'N/A'}% vs Bearish: ${marketData.aaiiBearish || 'N/A'}%

CURRENT ECONOMIC CALENDAR DATA:
Inflation Trends: Core CPI 2.9% (vs 2.8% forecast, accelerating from 2.4%), Headline CPI 2.7% (vs 2.6% estimate). PPI 2.1% (down from 2.4%, beating 2.2% forecast - wholesale prices cooling).
Consumer Activity: Retail Sales surged 1.0% (vs 0.3% expectation), showing resilient spending despite rate pressures.
Labor Market: JOLTS 8.18M openings (steady above 8.14M forecast), indicating balanced demand without overheating.
Business Activity: ISM Services PMI 52.5 (down from 53.8, missing 52.8 forecast). Industrial Production slowing to 0.3% from 0.9%.
Housing Sector: Starts expected 1.31M (up from 1.28M), showing modest improvement.

KEY ECONOMIC THEMES: Persistent core inflation above Fed's 2% target, resilient consumer spending, wholesale price relief, balanced labor markets, moderating business activity suggesting sustainable growth pace.

Provide a comprehensive market analysis in JSON format that INTEGRATES technical indicators with specific economic calendar data points:
{
  "marketConditions": "Analysis incorporating current price action with specific economic data points from the calendar (quote actual figures like CPI, Retail Sales, etc.)",
  "technicalOutlook": "Technical analysis including MACD crossover status, RSI levels, and sentiment backdrop", 
  "riskAssessment": "Risk factors incorporating inflation persistence, Fed policy implications based on economic calendar data, and growth trajectory",
  "confidence": 0.85
}

Focus on how the specific economic data points from the calendar influence market outlook and Fed policy expectations.`;

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
        max_tokens: 800,
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
