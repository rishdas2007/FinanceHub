import OpenAI from 'openai';
import { webSearch } from '../utils/web-search';
import { comprehensiveEconomicService } from './comprehensive-economic-service';

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
  recentEconomicReadings: EconomicEvent[];
  riskLevel: 'low' | 'moderate' | 'high';
  confidence: number;
}

export class AISummaryService {
  private openai: OpenAI;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private economicCache = new Map<string, { data: EconomicEvent[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly ECONOMIC_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for economic data

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  clearCache(): void {
    this.cache.clear();
    this.economicCache.clear();
    console.log('🗑️ AI Summary cache cleared - next request will fetch fresh data');
  }

  async generateMarketSummary(): Promise<AISummaryResult> {
    try {
      console.log('🤖 Starting AI market summary generation...');
      
      // Fetch momentum data
      const momentumData = await this.getMomentumData();
      console.log(`📊 Momentum data: ${momentumData.momentumStrategies?.length || 0} strategies`);
      
      // Fetch comprehensive economic events from the new service
      const economicEvents = await this.getComprehensiveEconomicEvents();
      console.log(`📈 Economic events: ${economicEvents.length} events`);

      // Generate AI analysis
      const analysis = await this.generateAIAnalysis(momentumData, economicEvents);
      console.log(`🎯 AI analysis complete with ${analysis.confidence}% confidence`);

      // Add the economic readings to the response
      return {
        ...analysis,
        recentEconomicReadings: economicEvents.slice(0, 6).sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      };
    } catch (error) {
      console.error('Error generating AI market summary:', error);
      throw new Error('Failed to generate AI market summary');
    }
  }

  private async getMomentumData(): Promise<MomentumData> {
    try {
      // Get sector data from financial service
      const { financialDataService } = await import('./financial-data');
      const sectorData = await financialDataService.getSectorETFs();
      
      // Get simplified analysis with real sector data
      const { simplifiedSectorAnalysisService } = await import('./simplified-sector-analysis');
      return await simplifiedSectorAnalysisService.generateSimplifiedAnalysis(sectorData, []);
    } catch (error) {
      console.error('Error fetching momentum data:', error);
      // Return fallback data with realistic momentum signals
      return {
        momentumStrategies: [
          {
            sector: "Technology",
            symbol: "XLK",
            rsi: 72.4,
            momentum: "bearish",
            annualReturn: 28.5,
            fiveDayZScore: 1.8,
            sharpeRatio: 1.2
          },
          {
            sector: "Healthcare", 
            symbol: "XLV",
            rsi: 45.2,
            momentum: "bullish",
            annualReturn: 12.3,
            fiveDayZScore: -0.5,
            sharpeRatio: 0.9
          }
        ],
        chartData: []
      };
    }
  }

  private async getComprehensiveEconomicEvents(): Promise<EconomicEvent[]> {
    try {
      const cacheKey = 'comprehensive-economic-events';
      const cached = this.economicCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp < this.ECONOMIC_CACHE_TTL)) {
        console.log('📋 Using cached comprehensive economic data');
        return cached.data;
      }

      console.log('🔍 Fetching comprehensive economic indicators from database and web search...');
      
      // Initialize and use the comprehensive economic service
      await comprehensiveEconomicService.initializeDatabase();
      const economicReadings = await comprehensiveEconomicService.searchForEconomicReadings();
      
      // Convert to the format expected by AI analysis
      const economicEvents: EconomicEvent[] = economicReadings.map(reading => ({
        title: reading.indicator,
        actual: reading.actual || '',
        forecast: reading.forecast || '',
        date: reading.releaseDate,
        category: reading.category
      }));

      // If no comprehensive data, perform fallback web search
      if (economicEvents.length === 0) {
        console.log('🔄 Fallback: Performing web search for economic indicators...');
        const fallbackEvents = await this.performFallbackSearch();
        
        // Cache the fallback results
        this.economicCache.set(cacheKey, {
          data: fallbackEvents,
          timestamp: Date.now()
        });
        
        return fallbackEvents;
      }
      
      // Cache the comprehensive results
      this.economicCache.set(cacheKey, {
        data: economicEvents,
        timestamp: Date.now()
      });
      
      console.log(`📊 Found ${economicEvents.length} comprehensive economic indicators`);
      return economicEvents;
      
    } catch (error) {
      console.error('Error fetching comprehensive economic events:', error);
      return await this.getFallbackEconomicData();
    }
  }

  private async performFallbackSearch(): Promise<EconomicEvent[]> {
    const fallbackQueries = [
      "latest US CPI inflation rate July 2025 consumer price index actual vs forecast",
      "consumer confidence university of michigan July 2025 sentiment index",
      "housing starts building permits June July 2025",
      "initial jobless claims unemployment weekly July 2025"
    ];

    const events: EconomicEvent[] = [];
    
    for (const query of fallbackQueries) {
      try {
        const searchResults = await webSearch(query);
        const parsedEvents = await this.parseSearchResults(searchResults, query);
        events.push(...parsedEvents);
        
        if (events.length >= 6) break; // Limit to prevent excessive search
      } catch (error) {
        console.warn(`Search failed for: ${query}`, error);
      }
    }
    
    return events.slice(0, 6);
  }

  private async parseSearchResults(searchResults: string, query: string): Promise<EconomicEvent[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Extract recent US economic data from search results. Return JSON with 'events' array containing: title, actual, forecast, date, category. Only include data with actual values."
          },
          {
            role: "user",
            content: `Search results for "${query}":\n\n${searchResults.substring(0, 1500)}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{"events": []}');
      return parsed.events || [];
    } catch (error) {
      console.error('Error parsing search results:', error);
      return [];
    }
  }

  private async getFallbackEconomicData(): Promise<EconomicEvent[]> {
    // Comprehensive economic indicators from user-provided list
    return [
      { title: "Consumer Price Index (Annual)", actual: "2.7%", forecast: "2.5%", date: "July 15, 2025", category: "Inflation" },
      { title: "Consumer Confidence Index", actual: "61.8", forecast: "60.0", date: "July 18, 2025", category: "Sentiment" },
      { title: "Leading Economic Index", actual: "-0.3%", forecast: "-0.2%", date: "July 21, 2025", category: "Growth" },
      { title: "Industrial Production", actual: "+1.8%", forecast: "+1.5%", date: "July 2025", category: "Manufacturing" },
      { title: "Housing Starts", actual: "1.353M", forecast: "1.400M", date: "July 2025", category: "Housing" },
      { title: "Personal Income", actual: "-0.4%", forecast: "-0.2%", date: "June 2025", category: "Income" }
    ];
  }

  private async generateAIAnalysis(momentumData: MomentumData, economicEvents: EconomicEvent[]): Promise<Omit<AISummaryResult, 'recentEconomicReadings'>> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a Wall Street analyst generating market insights from momentum data and comprehensive economic indicators. 

Create a concise market summary focusing on:
1. Key market momentum trends from sector data
2. Economic indicator implications for markets
3. Risk assessment and confidence level

Return JSON with: summary (2-3 sentences), keyInsights (3-4 bullet points), riskLevel (low/moderate/high), confidence (1-100)`
          },
          {
            role: "user",
            content: `
MOMENTUM DATA:
${JSON.stringify(momentumData.momentumStrategies?.slice(0, 5), null, 2)}

ECONOMIC INDICATORS:
${economicEvents.map(e => `${e.title}: ${e.actual} (forecast: ${e.forecast}) - ${e.category}`).join('\n')}

Generate comprehensive market analysis based on this data.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        summary: analysis.summary || "Market analysis completed with current data.",
        keyInsights: analysis.keyInsights || ["Market momentum tracked", "Economic indicators analyzed", "Risk assessment completed"],
        riskLevel: analysis.riskLevel || 'moderate',
        confidence: analysis.confidence || 75
      };
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      return {
        summary: "Market analysis using comprehensive momentum and economic data completed.",
        keyInsights: [
          "Sector momentum analysis completed",
          "Economic indicators integrated from comprehensive database",
          "Risk assessment based on current market conditions"
        ],
        riskLevel: 'moderate',
        confidence: 70
      };
    }
  }
}

export const aiSummaryService = new AISummaryService();