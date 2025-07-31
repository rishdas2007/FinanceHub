// import { BayesianAnalysisService } from './bayesian-analysis-service'; // Removed during optimization
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class AdaptiveAIService {
  
  async generateBayesianAnalysis(marketData: any): Promise<any> {
    console.log('🧠 Generating adaptive Bayesian analysis...');
    
    // Step 1: Assess market significance
    const significanceScore = await this.calculateMarketSignificanceScore(marketData);
    
    // Step 2: Choose analysis depth based on significance
    if (significanceScore < 3) {
      console.log('📊 Light analysis mode (normal conditions)');
      return this.generateLightAnalysis(marketData);
    } else if (significanceScore < 7) {
      console.log('📊 Medium analysis mode (notable conditions)');
      return this.generateMediumAnalysis(marketData);
    } else {
      console.log('📊 Deep Bayesian analysis mode (extreme conditions)');
      return this.generateDeepBayesianAnalysis(marketData);
    }
  }

  private async generateLightAnalysis(marketData: any): Promise<any> {
    console.log('💡 Generating light analysis for normal market conditions...');
    
    // Minimal token usage for normal market conditions
    const prompt = `Market conditions are within normal ranges. Current data:
- SPY: $${marketData.spyPrice} (${marketData.spyChange >= 0 ? '+' : ''}${marketData.spyChange?.toFixed(2)}%)
- VIX: ${marketData.vix?.toFixed(1)}
- RSI: ${marketData.rsi?.toFixed(1)}
- AAII Bullish: ${marketData.aaiiBullish?.toFixed(1)}%

Provide concise JSON analysis focusing on current positioning:
{
  "bottomLine": "One clear sentence assessment of current market state",
  "dominantTheme": "Brief theme (2-3 words)",
  "setup": "Current market positioning and key levels to watch",
  "evidence": "Most important technical and sentiment readings",
  "implications": "Near-term outlook and key catalysts",
  "confidence": 75
}

Keep response focused and professional. Avoid repetitive phrasing.`;

    return this.callOpenAI(prompt, 800); // Lower token limit
  }

  private async generateMediumAnalysis(marketData: any): Promise<any> {
    console.log('💡 Generating medium analysis with historical context...');
    
    // Moderate historical context for interesting conditions
    const historicalContext = await this.getSignificantHistoricalContext(marketData);
    
    const prompt = `Market conditions show notable readings requiring historical context analysis.

Current State:
- SPY: $${marketData.spyPrice} (${marketData.spyChange >= 0 ? '+' : ''}${marketData.spyChange?.toFixed(2)}%)
- VIX: ${marketData.vix?.toFixed(1)}
- RSI: ${marketData.rsi?.toFixed(1)}
- AAII Bullish: ${marketData.aaiiBullish?.toFixed(1)}%

Historical Context: ${historicalContext}

Provide Bayesian analysis considering prior probabilities from historical context:
{
  "bottomLine": "Assessment incorporating percentile context and historical significance",
  "dominantTheme": "Theme reflecting historical positioning",
  "setup": "Current positioning with historical comparison and percentile rankings", 
  "evidence": "Technical indicators with historical context and precedent strength",
  "implications": "Probability-weighted outlook based on historical patterns and base rates",
  "confidence": "Confidence level (0-100) based on historical precedent strength"
}

Use Bayesian reasoning: How do current readings update our beliefs given historical base rates? Focus on statistical significance.`;

    return this.callOpenAI(prompt, 1200);
  }

  private async generateDeepBayesianAnalysis(marketData: any): Promise<any> {
    console.log('💡 Generating deep Bayesian analysis for extreme conditions...');
    
    // Full historical context for extreme/unusual conditions
    const historicalContext = await this.getSignificantHistoricalContext(marketData);
    const regimeAnalysis = await this.getCurrentRegimeAnalysis();
    
    const prompt = `EXTREME MARKET CONDITIONS DETECTED - Full Bayesian Analysis Required

Current State (Multiple Extreme Readings):
- SPY: $${marketData.spyPrice} (${marketData.spyChange >= 0 ? '+' : ''}${marketData.spyChange?.toFixed(2)}%)
- VIX: ${marketData.vix?.toFixed(1)}
- RSI: ${marketData.rsi?.toFixed(1)}
- AAII Bullish: ${marketData.aaiiBullish?.toFixed(1)}%

Historical Context: ${historicalContext}

Market Regime: ${regimeAnalysis}

Use sophisticated Bayesian reasoning: Update prior beliefs based on current extreme evidence. Reference specific historical precedents and their subsequent outcomes.

{
  "bottomLine": "Bayesian assessment with specific percentile rankings and historical precedents",
  "dominantTheme": "Theme reflecting extreme conditions and precedent analysis",
  "setup": "Market positioning with regime analysis and extreme readings context",
  "evidence": "Technical indicators + historical precedents + regime characteristics + statistical significance",
  "implications": "Probability-weighted scenarios based on historical outcomes from similar extreme conditions",
  "confidence": "Confidence level based on strength and frequency of historical precedents"
}

Critical Bayesian Questions:
1. What do current extreme readings tell us that differs from base rates?
2. How should we update our priors given this evidence?
3. What were the subsequent moves after similar historical precedents?
4. What is the base rate of success for the current setup?

Focus on statistical rigor and precedent-based probabilities.`;

    return this.callOpenAI(prompt, 2000); // Higher limit for extreme conditions
  }

  private async callOpenAI(prompt: string, maxTokens: number): Promise<any> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are a sophisticated quantitative analyst specializing in Bayesian market analysis. Focus on statistical significance, historical precedents, and probability-weighted outcomes. Provide clear, data-driven insights without repetitive phrasing."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const analysis = JSON.parse(content);
      
      // Ensure all required fields are present
      return {
        bottomLine: analysis.bottomLine || 'Market analysis in progress',
        dominantTheme: analysis.dominantTheme || 'Mixed signals',
        setup: analysis.setup || 'Monitoring key levels',
        evidence: analysis.evidence || 'Technical indicators within range',
        implications: analysis.implications || 'Continue monitoring developments',
        confidence: analysis.confidence || 75,
        timestamp: new Date().toISOString(),
        analysisType: maxTokens <= 800 ? 'light' : maxTokens <= 1200 ? 'medium' : 'deep'
      };
      
    } catch (error) {
      console.error('❌ OpenAI API error:', error);
      throw new Error(`Bayesian analysis failed: ${error.message}`);
    }
  }

  calculateSectorMomentum(sectors: any[]): number {
    if (!sectors || sectors.length === 0) return 0;
    
    let positiveCount = 0;
    let totalCount = 0;
    
    for (const sector of sectors) {
      if (sector.changePercent !== undefined && !isNaN(sector.changePercent)) {
        if (sector.changePercent > 0) positiveCount++;
        totalCount++;
      }
    }
    
    if (totalCount === 0) return 0;
    
    // Return momentum score (-1 to 1)
    return (positiveCount / totalCount) * 2 - 1;
  }

  // Missing methods that were removed during optimization
  async calculateMarketSignificanceScore(marketData: any): Promise<number> {
    // Simplified significance scoring without external dependencies
    let score = 0;
    
    // VIX based significance
    if (marketData.vix > 30) score += 3;
    else if (marketData.vix > 25) score += 2;
    else if (marketData.vix > 20) score += 1;
    
    // Change magnitude
    const absChange = Math.abs(marketData.spyChange || 0);
    if (absChange > 2) score += 3;
    else if (absChange > 1) score += 2;
    else if (absChange > 0.5) score += 1;
    
    return score;
  }

  async getSignificantHistoricalContext(marketData: any): Promise<string> {
    // Simplified historical context without external services
    return "Market conditions being evaluated within historical context.";
  }

  async getCurrentRegimeAnalysis(marketData: any): Promise<string> {
    // Simplified regime analysis without external services
    return "Current market regime: Transitional phase with mixed signals.";
  }
}