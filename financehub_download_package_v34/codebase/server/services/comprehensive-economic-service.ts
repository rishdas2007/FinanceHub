import { db } from "../db";
import { economicIndicators, economicDataReadings, economicSearchCache } from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import type { EconomicIndicator, EconomicDataReading, InsertEconomicIndicator, InsertEconomicDataReading } from "@shared/schema";
import { webSearch } from "../utils/web-search";
import logger from "../utils/logger";

export interface EconomicReading {
  indicator: string;
  category: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  unit: string | null;
  period: string;
  releaseDate: string;
  variance: string | null;
  beatForecast: boolean | null;
  source: string;
}

class ComprehensiveEconomicService {
  private majorIndicators = [
    // Growth Indicators
    { name: "Gross Domestic Product (GDP)", type: "GDP", category: "Growth", agency: "BEA", frequency: "Quarterly" },
    { name: "Personal Income", type: "Personal Income", category: "Growth", agency: "BEA", frequency: "Monthly" },
    { name: "Personal Spending", type: "Personal Spending", category: "Growth", agency: "BEA", frequency: "Monthly" },
    { name: "Retail Sales", type: "Retail Sales", category: "Growth", agency: "Census", frequency: "Monthly" },
    { name: "Industrial Production", type: "Industrial Production", category: "Growth", agency: "Federal Reserve", frequency: "Monthly" },
    { name: "Capacity Utilization", type: "Capacity Utilization", category: "Growth", agency: "Federal Reserve", frequency: "Monthly" },
    
    // Inflation Indicators
    { name: "Consumer Price Index (CPI)", type: "CPI", category: "Inflation", agency: "BLS", frequency: "Monthly" },
    { name: "Core CPI", type: "Core CPI", category: "Inflation", agency: "BLS", frequency: "Monthly" },
    { name: "Producer Price Index (PPI)", type: "PPI", category: "Inflation", agency: "BLS", frequency: "Monthly" },
    { name: "Core PPI", type: "Core PPI", category: "Inflation", agency: "BLS", frequency: "Monthly" },
    { name: "PCE Price Index", type: "PCE", category: "Inflation", agency: "BEA", frequency: "Monthly" },
    { name: "Core PCE", type: "Core PCE", category: "Inflation", agency: "BEA", frequency: "Monthly" },
    
    // Employment Indicators
    { name: "Nonfarm Payrolls", type: "Employment", category: "Labor Market", agency: "BLS", frequency: "Monthly" },
    { name: "Unemployment Rate", type: "Unemployment", category: "Labor Market", agency: "BLS", frequency: "Monthly" },
    { name: "Initial Jobless Claims", type: "Jobless Claims", category: "Labor Market", agency: "Department of Labor", frequency: "Weekly" },
    { name: "Continuing Claims", type: "Continuing Claims", category: "Labor Market", agency: "Department of Labor", frequency: "Weekly" },
    { name: "Average Hourly Earnings", type: "Earnings", category: "Labor Market", agency: "BLS", frequency: "Monthly" },
    { name: "Labor Force Participation Rate", type: "Labor Force", category: "Labor Market", agency: "BLS", frequency: "Monthly" },
    { name: "Job Openings (JOLTS)", type: "JOLTS", category: "Labor Market", agency: "BLS", frequency: "Monthly" },
    
    // Housing Indicators
    { name: "Housing Starts", type: "Housing Starts", category: "Housing", agency: "Census", frequency: "Monthly" },
    { name: "Building Permits", type: "Building Permits", category: "Housing", agency: "Census", frequency: "Monthly" },
    { name: "Existing Home Sales", type: "Existing Home Sales", category: "Housing", agency: "NAR", frequency: "Monthly" },
    { name: "New Home Sales", type: "New Home Sales", category: "Housing", agency: "Census", frequency: "Monthly" },
    { name: "Home Price Index", type: "HPI", category: "Housing", agency: "FHFA", frequency: "Monthly" },
    { name: "Pending Home Sales", type: "Pending Home Sales", category: "Housing", agency: "NAR", frequency: "Monthly" },
    
    // Manufacturing & Business
    { name: "ISM Manufacturing PMI", type: "Manufacturing PMI", category: "Manufacturing", agency: "ISM", frequency: "Monthly" },
    { name: "ISM Services PMI", type: "Services PMI", category: "Manufacturing", agency: "ISM", frequency: "Monthly" },
    { name: "Factory Orders", type: "Factory Orders", category: "Manufacturing", agency: "Census", frequency: "Monthly" },
    { name: "Durable Goods Orders", type: "Durable Goods", category: "Manufacturing", agency: "Census", frequency: "Monthly" },
    { name: "Business Inventories", type: "Business Inventories", category: "Manufacturing", agency: "Census", frequency: "Monthly" },
    
    // Consumer Sentiment
    { name: "Consumer Confidence", type: "Consumer Confidence", category: "Sentiment", agency: "Conference Board", frequency: "Monthly" },
    { name: "University of Michigan Consumer Sentiment", type: "Consumer Sentiment", category: "Sentiment", agency: "University of Michigan", frequency: "Monthly" },
    
    // Trade & International
    { name: "Trade Balance", type: "Trade Balance", category: "Trade", agency: "Census", frequency: "Monthly" },
    { name: "Import Price Index", type: "Import Prices", category: "Trade", agency: "BLS", frequency: "Monthly" },
    { name: "Export Price Index", type: "Export Prices", category: "Trade", agency: "BLS", frequency: "Monthly" },
    
    // Financial & Monetary
    { name: "Federal Funds Rate", type: "Fed Funds Rate", category: "Monetary Policy", agency: "Federal Reserve", frequency: "Meeting" },
    { name: "10-Year Treasury Yield", type: "Treasury Yield", category: "Financial Markets", agency: "Treasury", frequency: "Daily" },
    { name: "Leading Economic Index", type: "LEI", category: "Composite", agency: "Conference Board", frequency: "Monthly" }
  ];

  async initializeDatabase(): Promise<void> {
    try {
      logger.info("Initializing comprehensive economic indicators database...");
      
      for (const indicator of this.majorIndicators) {
        const existing = await db
          .select()
          .from(economicIndicators)
          .where(eq(economicIndicators.indicator_name, indicator.name))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(economicIndicators).values({
            indicator_name: indicator.name,
            indicator_type: indicator.type,
            category: indicator.category,
            agency: indicator.agency,
            frequency: indicator.frequency,
            description: `${indicator.name} released by ${indicator.agency} on a ${indicator.frequency.toLowerCase()} basis`
          });
          logger.info(`Added indicator: ${indicator.name}`);
        }
      }
      
      logger.info(`Comprehensive economic indicators database initialized with ${this.majorIndicators.length} indicators`);
    } catch (error) {
      logger.error("Failed to initialize economic indicators database:", error);
      throw error;
    }
  }

  async searchForEconomicReadings(): Promise<EconomicReading[]> {
    try {
      logger.info("Searching for comprehensive economic readings...");
      
      // Check cache first
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const cachedResults = await db
        .select()
        .from(economicSearchCache)
        .where(and(
          eq(economicSearchCache.search_query, "comprehensive_economic_readings"),
          gte(economicSearchCache.cached_at, oneHourAgo)
        ))
        .limit(1);

      if (cachedResults.length > 0 && cachedResults[0].search_results) {
        logger.info("Using cached economic readings");
        return cachedResults[0].search_results as EconomicReading[];
      }

      // Perform comprehensive search
      const allReadings: EconomicReading[] = [];

      // Search for different categories of indicators
      const searchQueries = [
        "July 2025 Consumer Price Index CPI inflation United States",
        "July 2025 Producer Price Index PPI United States",
        "July 2025 Nonfarm Payrolls employment unemployment rate United States",
        "July 2025 Initial Jobless Claims unemployment benefits United States",
        "July 2025 Retail Sales consumer spending United States",
        "July 2025 Industrial Production manufacturing United States",
        "July 2025 Housing Starts Building Permits United States",
        "July 2025 ISM Manufacturing PMI Services PMI United States",
        "July 2025 Consumer Confidence sentiment United States",
        "July 2025 Trade Balance exports imports United States",
        "July 2025 Personal Income Personal Spending United States",
        "July 2025 GDP Gross Domestic Product United States",
        "July 2025 Durable Goods Orders manufacturing United States",
        "July 2025 Existing Home Sales New Home Sales United States"
      ];

      for (const query of searchQueries) {
        try {
          const searchResults = await webSearch(query);
          const economicData = this.extractEconomicData(searchResults, query);
          allReadings.push(...economicData);
          
          // Small delay to avoid overwhelming search API
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.warn(`Search failed for query: ${query}`, error);
        }
      }

      // Remove duplicates and filter valid readings
      const uniqueReadings = this.deduplicateReadings(allReadings);
      
      // Store in database
      await this.storeReadingsInDatabase(uniqueReadings);

      // Cache results
      await db.insert(economicSearchCache).values({
        search_query: "comprehensive_economic_readings",
        search_results: JSON.stringify(uniqueReadings),
        indicators_found: uniqueReadings.length,
        expires_at: new Date(Date.now() + 60 * 60 * 1000) // 1 hour cache
      });

      logger.info(`Found ${uniqueReadings.length} economic readings across all categories`);
      return uniqueReadings;

    } catch (error) {
      logger.error("Failed to search for economic readings:", error);
      return [];
    }
  }

  private extractEconomicData(searchResults: Array<{ title?: string; description?: string; content?: string; url?: string }>, query: string): EconomicReading[] {
    const readings: EconomicReading[] = [];
    
    // Extract data from search results using various patterns
    const patterns = [
      // CPI patterns
      /CPI.*?(\d+\.?\d*)%.*?forecast.*?(\d+\.?\d*)%/gi,
      /Consumer Price Index.*?(\d+\.?\d*)%/gi,
      /Core CPI.*?(\d+\.?\d*)%/gi,
      
      // Employment patterns
      /Nonfarm Payrolls.*?(\d+(?:,\d+)*).*?thousand/gi,
      /Unemployment Rate.*?(\d+\.?\d*)%/gi,
      /Initial.*?Claims.*?(\d+(?:,\d+)*)/gi,
      
      // Manufacturing patterns
      /ISM Manufacturing.*?(\d+\.?\d*)/gi,
      /ISM Services.*?(\d+\.?\d*)/gi,
      /Industrial Production.*?(\d+\.?\d*)%/gi,
      
      // Housing patterns
      /Housing Starts.*?(\d+\.?\d*(?:,\d+)*)/gi,
      /Building Permits.*?(\d+\.?\d*(?:,\d+)*)/gi,
      
      // Retail patterns
      /Retail Sales.*?(\d+\.?\d*)%/gi,
      
      // General economic data patterns
      /(\w+(?:\s+\w+)*)\s+(?:came in|rose|fell|increased|decreased|at)\s+(\d+\.?\d*(?:,\d+)*(?:%|K|M|B)?)/gi
    ];

    if (searchResults && Array.isArray(searchResults)) {
      searchResults.forEach(result => {
        if (result?.content) {
          patterns.forEach(pattern => {
            const matches = [...result.content.matchAll(pattern)];
            matches.forEach(match => {
              const indicator = this.identifyIndicator(match[0], query);
              if (indicator) {
                readings.push({
                  indicator: indicator.name,
                  category: indicator.category,
                  actual: match[1] || match[2] || null,
                  forecast: null,
                  previous: null,
                  unit: this.extractUnit(match[0]),
                  period: "July 2025",
                  releaseDate: "2025-07-22",
                  variance: null,
                  beatForecast: null,
                  source: result.url || "Web Search"
                });
              }
            });
          });
        }
      });
    }

    return readings;
  }

  private identifyIndicator(text: string, query: string): { name: string; category: string } | null {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();

    // Map text patterns to indicators
    const indicatorMap = {
      'cpi': { name: 'Consumer Price Index (CPI)', category: 'Inflation' },
      'core cpi': { name: 'Core CPI', category: 'Inflation' },
      'ppi': { name: 'Producer Price Index (PPI)', category: 'Inflation' },
      'nonfarm payrolls': { name: 'Nonfarm Payrolls', category: 'Labor Market' },
      'unemployment rate': { name: 'Unemployment Rate', category: 'Labor Market' },
      'jobless claims': { name: 'Initial Jobless Claims', category: 'Labor Market' },
      'retail sales': { name: 'Retail Sales', category: 'Growth' },
      'industrial production': { name: 'Industrial Production', category: 'Growth' },
      'housing starts': { name: 'Housing Starts', category: 'Housing' },
      'building permits': { name: 'Building Permits', category: 'Housing' },
      'ism manufacturing': { name: 'ISM Manufacturing PMI', category: 'Manufacturing' },
      'ism services': { name: 'ISM Services PMI', category: 'Manufacturing' },
      'consumer confidence': { name: 'Consumer Confidence', category: 'Sentiment' },
      'trade balance': { name: 'Trade Balance', category: 'Trade' },
      'personal income': { name: 'Personal Income', category: 'Growth' }
    };

    for (const [key, indicator] of Object.entries(indicatorMap)) {
      if (textLower.includes(key) || queryLower.includes(key)) {
        return indicator;
      }
    }

    return null;
  }

  private extractUnit(text: string): string {
    if (text.includes('%')) return '%';
    if (text.includes('K') || text.includes('thousand')) return 'K';
    if (text.includes('M') || text.includes('million')) return 'M';
    if (text.includes('B') || text.includes('billion')) return 'B';
    return 'index';
  }

  private deduplicateReadings(readings: EconomicReading[]): EconomicReading[] {
    const seen = new Set<string>();
    return readings.filter(reading => {
      const key = `${reading.indicator}_${reading.period}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return reading.actual !== null && reading.actual !== '';
    });
  }

  private async storeReadingsInDatabase(readings: EconomicReading[]): Promise<void> {
    for (const reading of readings) {
      try {
        // Find indicator ID
        const indicator = await db
          .select()
          .from(economicIndicators)
          .where(eq(economicIndicators.indicator_name, reading.indicator))
          .limit(1);

        if (indicator.length > 0) {
          // Check if reading already exists
          const existing = await db
            .select()
            .from(economicDataReadings)
            .where(and(
              eq(economicDataReadings.indicator_id, indicator[0].id),
              eq(economicDataReadings.period, reading.period)
            ))
            .limit(1);

          if (existing.length === 0) {
            await db.insert(economicDataReadings).values({
              indicator_id: indicator[0].id,
              release_date: new Date(reading.releaseDate),
              period: reading.period,
              actual_value: reading.actual,
              forecast_value: reading.forecast,
              previous_value: reading.previous,
              unit: reading.unit,
              beat_forecast: reading.beatForecast,
              variance: reading.variance,
              source: reading.source
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to store reading for ${reading.indicator}:`, error);
      }
    }
  }

  async getStoredReadings(limit: number = 20): Promise<EconomicReading[]> {
    try {
      const results = await db
        .select({
          indicator_name: economicIndicators.indicator_name,
          category: economicIndicators.category,
          actual_value: economicDataReadings.actual_value,
          forecast_value: economicDataReadings.forecast_value,
          previous_value: economicDataReadings.previous_value,
          unit: economicDataReadings.unit,
          period: economicDataReadings.period,
          release_date: economicDataReadings.release_date,
          variance: economicDataReadings.variance,
          beat_forecast: economicDataReadings.beat_forecast,
          source: economicDataReadings.source
        })
        .from(economicDataReadings)
        .innerJoin(economicIndicators, eq(economicDataReadings.indicator_id, economicIndicators.id))
        .orderBy(desc(economicDataReadings.release_date))
        .limit(limit);

      return results.map(row => ({
        indicator: row.indicator_name,
        category: row.category,
        actual: row.actual_value,
        forecast: row.forecast_value,
        previous: row.previous_value,
        unit: row.unit,
        period: row.period,
        releaseDate: row.release_date ? new Date(row.release_date).toISOString().split('T')[0] : '',
        variance: row.variance,
        beatForecast: row.beat_forecast,
        source: row.source || ''
      }));
    } catch (error) {
      logger.error("Failed to get stored readings:", error);
      return [];
    }
  }
}

export const comprehensiveEconomicService = new ComprehensiveEconomicService();