import OpenAI from "openai";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { historicalContextService } from "./historical-context";
import { narrativeMemoryService } from "./narrative-memory";

interface ThematicAnalysisResult {
  bottomLine: string;
  dominantTheme: string;
  setup: string;
  evidence: string;
  implications: string;
  catalysts: string;
  contrarianView: string;
  confidence: number;
  historicalContext?: string;
  narrativeEvolution?: string;
  percentileInsights?: string;
}

export class ThematicAIAnalysisService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  async generateThematicAnalysis(
    marketData: any, 
    sectorData: any[], 
    economicEvents: any[],
    technicalData: any,
    includeHistoricalContext = true
  ): Promise<ThematicAnalysisResult> {
    
    // Get historical context and narrative memory
    let historicalContext = "";
    let narrativeContext = "";
    let percentileInsights = "";
    
    if (includeHistoricalContext) {
      try {
        // Get percentile rankings for key metrics
        const rsiPercentile = await historicalContextService.getMetricPercentile(
          'RSI', technicalData.rsi || 68, '3Y'
        );
        const vixPercentile = await historicalContextService.getMetricPercentile(
          'VIX', marketData.vix || 16.5, '3Y'
        );
        
        // Get current market regime
        const currentRegime = await historicalContextService.identifyCurrentRegime();
        
        // Get historical precedents for current RSI level
        const rsiPrecedents = await historicalContextService.getHistoricalPrecedents(
          'RSI', technicalData.rsi || 68, 0.05
        );

        percentileInsights = `RSI at ${rsiPercentile.currentPercentile}th percentile (${rsiPercentile.historicalSignificance}), VIX at ${vixPercentile.currentPercentile}th percentile`;
        historicalContext = `Current regime: ${currentRegime}. ${rsiPrecedents.length} historical precedents found`;
        
        // Get narrative continuity
        const narrativeEvolution = await narrativeMemoryService.analyzeThemeEvolution(
          this.detectDominantTheme(marketData, sectorData, technicalData),
          marketData
        );
        
        narrativeContext = narrativeEvolution.narrativeConnection;
        
      } catch (error) {
        console.error('Error getting historical context:', error);
        percentileInsights = 'Historical context temporarily unavailable';
      }
    }

    // Process economic events to extract key readings with actual vs forecast
    console.log(`🧮 Economic Events for Thematic Analysis: ${economicEvents.length} events`);
    console.log(`📊 Sample Economic Events:`, economicEvents.slice(0, 3).map(e => ({ title: e.title, actual: e.actual, forecast: e.forecast })));
    
    const economicInsights = this.processEconomicReadings(economicEvents);

    const thematicPrompt = this.buildThematicPrompt(
      marketData, 
      sectorData, 
      economicEvents, 
      technicalData,
      historicalContext,
      narrativeContext,
      percentileInsights,
      economicInsights
    );
    
    console.log('🧠 Sending request to OpenAI for thematic analysis...');
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a senior Wall Street analyst specializing in thematic market narratives. 
          Your analysis must follow the exact structure provided and create coherent stories from market data.
          Focus on narrative coherence over individual data points. Use professional trader language.`
        },
        {
          role: "user",
          content: thematicPrompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.7,
    });

    console.log('✅ OpenAI response received, parsing JSON...');
    const result = JSON.parse(response.choices[0].message.content || '{}');
    console.log('🔍 Parsed thematic analysis result keys:', Object.keys(result));
    
    return {
      bottomLine: result.bottomLine || "Market narrative analysis unavailable",
      dominantTheme: result.dominantTheme || "Mixed signals",
      setup: result.setup || "Market conditions are evolving",
      evidence: result.evidence || "Technical indicators show neutral readings",
      implications: result.implications || "Monitor key levels for direction",
      catalysts: result.catalysts || "Economic data and Fed policy decisions",
      contrarianView: result.contrarianView || "Alternative scenarios warrant consideration",
      confidence: Math.max(0, Math.min(1, result.confidence || 0.7))
    };
  }

  private buildThematicPrompt(
    marketData: any, 
    sectorData: any[], 
    economicEvents: any[],
    technicalData: any,
    historicalContext: string = "",
    narrativeContext: string = "",
    percentileInsights: string = "",
    economicInsights: string = ""
  ): string {
    
    const formatNumber = (num: number) => num?.toFixed(1) || 'N/A';
    
    // Analyze dominant theme based on data patterns
    const themeAnalysis = this.analyzeMarketTheme(marketData, sectorData, technicalData);
    
    return `Generate a thematic market commentary following this EXACT structure:

## REQUIRED JSON RESPONSE FORMAT:
{
  "bottomLine": "[One sentence market thesis]",
  "dominantTheme": "[Primary market theme from options below]",
  "setup": "[2-3 sentences explaining current market story with key data points]",
  "evidence": "[Technical, sentiment, and cross-asset evidence supporting the theme]",
  "implications": "[Forward-looking conclusions from evidence combination]",
  "catalysts": "[Specific levels/events that could extend or reverse theme]",
  "contrarianView": "[Alternative interpretation of current data]",
  "confidence": [0.0-1.0 confidence score]
}

## THEME OPTIONS (choose most appropriate):
- Risk-on/risk-off rotation
- Growth vs value dynamics  
- Inflation concerns vs disinflationary forces
- Liquidity-driven momentum vs fundamental concerns
- Defensive positioning vs FOMO buying
- Sector rotation story
- Volatility regime change

## CURRENT MARKET DATA:
**SPY**: $${formatNumber(marketData.price)} (${formatNumber(marketData.changePercent)}%)
**Technical**: RSI ${formatNumber(technicalData.rsi)}, MACD ${formatNumber(technicalData.macd)}, ADX ${formatNumber(technicalData.adx)}
**Sentiment**: VIX ${formatNumber(marketData.vix)}, Put/Call ${formatNumber(marketData.putCallRatio)}, AAII Bull% ${formatNumber(marketData.aaiiBullish)}
**Volatility**: ATR ${formatNumber(technicalData.atr)}, Williams %R ${formatNumber(technicalData.willr)}

## SECTOR PERFORMANCE:
${this.formatSectorData(sectorData)}

## ECONOMIC CONTEXT:
${this.formatEconomicEvents(economicEvents)}

## ECONOMIC READINGS ANALYSIS:
${economicInsights}

## HISTORICAL CONTEXT:
${historicalContext || 'Historical context not available'}

## PERCENTILE INSIGHTS:
${percentileInsights || 'Percentile data not available'}

## NARRATIVE CONTINUITY:
${narrativeContext || 'New narrative thread starting'}

## NARRATIVE REQUIREMENTS:
1. Start with dominant theme identification
2. Build logical narrative arc: Setup → Evidence → Implications → What to Watch
3. Connect technical, sentiment, and fundamental data points
4. Provide specific levels and catalysts
5. Include contrarian perspective
6. Use professional Wall Street language
7. Focus on forward-looking actionable insights

## STYLE GUIDELINES:
- Professional, authoritative tone
- Specific data references with context
- Logical flow between sections  
- Actionable insights for traders/investors
- Clear narrative thread throughout`;
  }

  private analyzeMarketTheme(marketData: any, sectorData: any[], technicalData: any): string {
    // Logic to auto-detect dominant theme based on data patterns
    const rsi = technicalData.rsi || 50;
    const vix = marketData.vix || 20;
    const sectorSpread = this.calculateSectorSpread(sectorData);
    
    if (vix > 25) return "Risk-off positioning";
    if (rsi > 70) return "Liquidity-driven momentum";
    if (sectorSpread > 2) return "Sector rotation story";
    
    return "Mixed market signals";
  }

  private formatSectorData(sectorData: any[]): string {
    if (!sectorData?.length) return "Sector data unavailable";
    
    const top3 = sectorData
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 3)
      .map(s => `${s.name}: ${s.changePercent?.toFixed(1)}%`)
      .join(', ');
    
    const bottom3 = sectorData
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 3)
      .map(s => `${s.name}: ${s.changePercent?.toFixed(1)}%`)
      .join(', ');
    
    return `Top Performers: ${top3}\nLaggards: ${bottom3}`;
  }

  private formatEconomicEvents(economicEvents: any[]): string {
    if (!economicEvents?.length) return "No major economic events today";
    
    return economicEvents
      .slice(0, 5)
      .map(event => `${event.title}: ${event.actual || 'Pending'} (vs ${event.forecast || 'N/A'} est)`)
      .join('\n');
  }

  private calculateSectorSpread(sectorData: any[]): number {
    if (!sectorData?.length) return 0;
    
    const changes = sectorData.map(s => s.changePercent || 0);
    const max = Math.max(...changes);
    const min = Math.min(...changes);
    
    return max - min;
  }

  private processEconomicReadings(economicEvents: any[]): string {
    if (!economicEvents?.length) return "No recent economic readings available";

    // Filter for events with actual readings and extract key indicators
    const recentReadings = economicEvents
      .filter(event => event.actual && event.forecast && (event.title || event.indicator))
      .slice(0, 10) // Top 10 most recent/important
      .map(event => {
        const title = event.title || event.indicator || 'Unknown';
        const actual = event.actual;
        const forecast = event.forecast;
        
        // For numeric comparisons
        if (!isNaN(parseFloat(actual)) && !isNaN(parseFloat(forecast))) {
          const actualNum = parseFloat(actual);
          const forecastNum = parseFloat(forecast);
          const variance = actualNum - forecastNum;
          const impact = variance > 0 ? "beats" : variance < 0 ? "misses" : "meets";
          return `• **${title}**: ${actual} vs ${forecast} forecast (${impact} by ${Math.abs(variance).toFixed(2)})`;
        } else {
          // For non-numeric data, just show actual vs forecast
          return `• **${title}**: ${actual} vs ${forecast} forecast`;
        }
      });

    if (recentReadings.length === 0) {
      return "Recent economic data shows mixed signals with most indicators meeting expectations.";
    }

    const beatCount = recentReadings.filter(r => r.includes("beats")).length;
    const missCount = recentReadings.filter(r => r.includes("misses")).length;
    
    const summary = beatCount > missCount 
      ? `Economic data trending positive with ${beatCount}/${recentReadings.length} indicators beating forecasts`
      : missCount > beatCount 
        ? `Economic data showing weakness with ${missCount}/${recentReadings.length} indicators missing forecasts`
        : "Economic data showing mixed results with balanced beats and misses";

    return `${summary}:\n\n${recentReadings.join('\n')}`;
  }

  private detectDominantTheme(marketData: any, sectorData: any[], technicalData: any): string {
    const rsi = technicalData.rsi || 50;
    const vix = marketData.vix || 20;
    const putCallRatio = marketData.putCallRatio || 1;
    const sectorSpread = this.calculateSectorSpread(sectorData);
    
    // Risk-off conditions
    if (vix > 25 || putCallRatio > 1.2) return 'risk_on_off';
    
    // Momentum conditions
    if (rsi > 70 && vix < 18) return 'liquidity_momentum';
    
    // Sector rotation
    if (sectorSpread > 2.5) return 'sector_rotation';
    
    // Volatility regime
    if (vix > 22 || vix < 15) return 'volatility_regime';
    
    // Defensive positioning
    if (rsi < 35 || putCallRatio > 1.1) return 'defensive_positioning';
    
    return 'mixed_signals';
  }
}

export const thematicAIAnalysisService = new ThematicAIAnalysisService();