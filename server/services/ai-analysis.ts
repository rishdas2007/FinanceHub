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
  vix?: number;
  putCallRatio?: number;
  aaiiBullish?: number;
  aaiiBearish?: number;
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
RSI: ${marketData.rsi || 'N/A'}
MACD: ${marketData.macd || 'N/A'}
VIX: ${marketData.vix || 'N/A'}
Put/Call Ratio: ${marketData.putCallRatio || 'N/A'}
AAII Bullish: ${marketData.aaiiBullish || 'N/A'}%
AAII Bearish: ${marketData.aaiiBearish || 'N/A'}%

MACROECONOMIC CONTEXT:
${macroContext}

Provide a comprehensive market analysis in JSON format that INTEGRATES both technical indicators AND macroeconomic factors:
{
  "marketConditions": "Analysis of current market conditions including macro impact (2-3 sentences)",
  "technicalOutlook": "Technical analysis with consideration of economic backdrop (2-3 sentences)",
  "riskAssessment": "Risk factors including volatility and economic considerations (2-3 sentences)",
  "confidence": 0.85
}

Focus on actionable insights that consider both technical signals and economic fundamentals.`;

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
