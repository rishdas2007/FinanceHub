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
      
      const prompt = `Analyze current market conditions focusing on the specific areas requested:

SPY ANALYSIS:
Stock: ${marketData.symbol}
Price: $${formatPrice(marketData.price)}
Change: ${formatPrice(marketData.change)} (${formatPercent(marketData.changePercent)}%)
RSI: ${marketData.rsi ? formatPrice(marketData.rsi) : 'N/A'} ${marketData.rsi && marketData.rsi > 70 ? '(Overbought)' : marketData.rsi && marketData.rsi < 30 ? '(Oversold)' : '(Neutral)'}
MACD: ${marketData.macd ? formatPrice(marketData.macd) : 'N/A'} vs Signal: ${marketData.macdSignal ? formatPrice(marketData.macdSignal) : 'N/A'} ${marketData.macd && marketData.macdSignal && marketData.macd < marketData.macdSignal ? '(Bearish Crossover)' : '(Bullish Territory)'}
VIX: ${marketData.vix ? formatPrice(marketData.vix) : 'N/A'} (Volatility measure)
AAII Bullish: ${marketData.aaiiBullish ? formatPrice(marketData.aaiiBullish) : 'N/A'}% vs Bearish: ${marketData.aaiiBearish ? formatPrice(marketData.aaiiBearish) : 'N/A'}%

MOMENTUM STRATEGIES TABLE DATA:
${sectorAnalysis}

ANALYSIS FOCUS AREAS:

1. Overall Market Sentiment (SPY): Analyze the S&P 500 (SPY) row. What is the overall market momentum, and what do the short-term and medium-term moves suggest?

2. Momentum Outliers: Highlight any sectors with exceptionally high or low 1-Day, 5-Day, or 1-Month moves. Also interpret the RSI values (e.g., overbought/oversold conditions) and Z-Score of the latest 1-Day Move for key sectors.

Provide analysis in JSON format:
{
  "marketConditions": "Focus on SPY overall market momentum analysis. Discuss SPY's 1-day, 5-day, and 1-month moves. Analyze what SPY's short-term and medium-term trends suggest for overall market sentiment. Include RSI interpretation for SPY specifically.",
  "technicalOutlook": "Identify momentum outliers from the sector data. Highlight sectors with exceptionally high or low performance across 1-Day, 5-Day, and 1-Month timeframes. Interpret RSI overbought/oversold conditions (RSI >70 = overbought, RSI <30 = oversold). Explain Z-Score significance for sectors with extreme 1-day moves (Z-Score >1.5 or <-1.5 indicates unusual movement).", 
  "riskAssessment": "Synthesize SPY momentum with sector outlier analysis. What do extreme sector moves and SPY's position suggest about market rotation and risk? Identify which momentum outliers present opportunities vs risks based on RSI levels and Z-scores.",
  "confidence": 0.85
}

IMPORTANT RULES:
1. Focus specifically on SPY momentum analysis and sector momentum outliers
2. Interpret RSI levels: >70 = overbought, <30 = oversold, 30-70 = neutral
3. Highlight Z-scores >1.5 or <-1.5 as significant unusual movements
4. Use 1 decimal place for all numbers
5. Connect SPY trends with sector rotation patterns`;

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
