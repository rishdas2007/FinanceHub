import { 
  users, 
  stockData, 
  marketSentiment, 
  technicalIndicators, 
  aiAnalysis, 
  economicEvents,
  marketBreadth,
  vixData,
  type User, 
  type InsertUser,
  type StockData,
  type InsertStockData,
  type MarketSentiment,
  type InsertMarketSentiment,
  type TechnicalIndicators,
  type InsertTechnicalIndicators,
  type AiAnalysis,
  type InsertAiAnalysis,
  type EconomicEvent,
  type InsertEconomicEvent,
  type MarketBreadth,
  type InsertMarketBreadth,
  type VixData,
  type InsertVixData
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Stock data operations
  getLatestStockData(symbol: string): Promise<StockData | undefined>;
  createStockData(data: InsertStockData): Promise<StockData>;
  getStockHistory(symbol: string, limit?: number): Promise<StockData[]>;
  
  // Market sentiment operations
  getLatestMarketSentiment(): Promise<MarketSentiment | undefined>;
  createMarketSentiment(sentiment: InsertMarketSentiment): Promise<MarketSentiment>;
  
  // Technical indicators
  getLatestTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | undefined>;
  createTechnicalIndicators(indicators: InsertTechnicalIndicators): Promise<TechnicalIndicators>;
  
  // AI Analysis
  getLatestAiAnalysis(): Promise<AiAnalysis | undefined>;
  createAiAnalysis(analysis: InsertAiAnalysis): Promise<AiAnalysis>;
  
  // Economic events
  getUpcomingEconomicEvents(): Promise<EconomicEvent[]>;
  createEconomicEvent(event: InsertEconomicEvent): Promise<EconomicEvent>;
  
  // Market breadth operations
  getLatestMarketBreadth(): Promise<MarketBreadth | undefined>;
  createMarketBreadth(breadth: InsertMarketBreadth): Promise<MarketBreadth>;
  
  // VIX data operations
  getLatestVixData(): Promise<VixData | undefined>;
  createVixData(vix: InsertVixData): Promise<VixData>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private stockData: Map<string, StockData[]>;
  private marketSentiment: MarketSentiment[];
  private technicalIndicators: Map<string, TechnicalIndicators[]>;
  private aiAnalysis: AiAnalysis[];
  private economicEvents: EconomicEvent[];
  private marketBreadth: MarketBreadth[];
  private vixData: VixData[];
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.stockData = new Map();
    this.marketSentiment = [];
    this.technicalIndicators = new Map();
    this.aiAnalysis = [];
    this.economicEvents = [];
    this.marketBreadth = [];
    this.vixData = [];
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getLatestStockData(symbol: string): Promise<StockData | undefined> {
    const data = this.stockData.get(symbol);
    return data ? data[data.length - 1] : undefined;
  }

  async createStockData(data: InsertStockData): Promise<StockData> {
    const id = this.currentId++;
    const stockDataEntry: StockData = {
      ...data,
      id,
      timestamp: new Date(),
    };
    
    if (!this.stockData.has(data.symbol)) {
      this.stockData.set(data.symbol, []);
    }
    
    this.stockData.get(data.symbol)!.push(stockDataEntry);
    
    // Keep only last 100 entries per symbol
    const symbolData = this.stockData.get(data.symbol)!;
    if (symbolData.length > 100) {
      symbolData.shift();
    }
    
    return stockDataEntry;
  }

  async getStockHistory(symbol: string, limit: number = 30): Promise<StockData[]> {
    const data = this.stockData.get(symbol) || [];
    return data.slice(-limit);
  }

  async getLatestMarketSentiment(): Promise<MarketSentiment | undefined> {
    return this.marketSentiment[this.marketSentiment.length - 1];
  }

  async createMarketSentiment(sentiment: InsertMarketSentiment): Promise<MarketSentiment> {
    const id = this.currentId++;
    const sentimentEntry: MarketSentiment = {
      ...sentiment,
      id,
      timestamp: new Date(),
    };
    
    this.marketSentiment.push(sentimentEntry);
    
    // Keep only last 50 entries
    if (this.marketSentiment.length > 50) {
      this.marketSentiment.shift();
    }
    
    return sentimentEntry;
  }

  async getLatestTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | undefined> {
    const indicators = this.technicalIndicators.get(symbol);
    return indicators ? indicators[indicators.length - 1] : undefined;
  }

  async createTechnicalIndicators(indicators: InsertTechnicalIndicators): Promise<TechnicalIndicators> {
    const id = this.currentId++;
    const indicatorsEntry: TechnicalIndicators = {
      symbol: indicators.symbol,
      rsi: indicators.rsi ?? null,
      macd: indicators.macd ?? null,
      macdSignal: indicators.macdSignal ?? null,
      bb_upper: indicators.bb_upper ?? null,
      bb_lower: indicators.bb_lower ?? null,
      sma_20: indicators.sma_20 ?? null,
      sma_50: indicators.sma_50 ?? null,
      id,
      timestamp: new Date(),
    };
    
    if (!this.technicalIndicators.has(indicators.symbol)) {
      this.technicalIndicators.set(indicators.symbol, []);
    }
    
    this.technicalIndicators.get(indicators.symbol)!.push(indicatorsEntry);
    
    // Keep only last 50 entries per symbol
    const symbolIndicators = this.technicalIndicators.get(indicators.symbol)!;
    if (symbolIndicators.length > 50) {
      symbolIndicators.shift();
    }
    
    return indicatorsEntry;
  }

  async getLatestAiAnalysis(): Promise<AiAnalysis | undefined> {
    return this.aiAnalysis[this.aiAnalysis.length - 1];
  }

  async createAiAnalysis(analysis: InsertAiAnalysis): Promise<AiAnalysis> {
    const id = this.currentId++;
    const analysisEntry: AiAnalysis = {
      ...analysis,
      id,
      timestamp: new Date(),
    };
    
    this.aiAnalysis.push(analysisEntry);
    
    // Keep only last 20 entries
    if (this.aiAnalysis.length > 20) {
      this.aiAnalysis.shift();
    }
    
    return analysisEntry;
  }

  async getUpcomingEconomicEvents(): Promise<EconomicEvent[]> {
    const now = new Date();
    return this.economicEvents
      .filter(event => event.eventDate > now)
      .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())
      .slice(0, 10);
  }

  async createEconomicEvent(event: InsertEconomicEvent): Promise<EconomicEvent> {
    const id = this.currentId++;
    const eventEntry: EconomicEvent = {
      title: event.title,
      description: event.description,
      importance: event.importance,
      eventDate: event.eventDate,
      actual: event.actual ?? null,
      forecast: event.forecast ?? null,
      previous: event.previous ?? null,
      id,
      timestamp: new Date(),
    };
    
    this.economicEvents.push(eventEntry);
    return eventEntry;
  }

  async getLatestMarketBreadth(): Promise<MarketBreadth | undefined> {
    return this.marketBreadth.length > 0 ? this.marketBreadth[this.marketBreadth.length - 1] : undefined;
  }

  async createMarketBreadth(breadth: InsertMarketBreadth): Promise<MarketBreadth> {
    const newBreadth: MarketBreadth = {
      ...breadth,
      mcclellanOscillator: breadth.mcclellanOscillator ?? null,
      id: this.currentId++,
      timestamp: new Date(),
    };
    this.marketBreadth.push(newBreadth);
    return newBreadth;
  }

  async getLatestVixData(): Promise<VixData | undefined> {
    return this.vixData.length > 0 ? this.vixData[this.vixData.length - 1] : undefined;
  }

  async createVixData(vix: InsertVixData): Promise<VixData> {
    const newVix = {
      ...vix,
      id: this.currentId++,
      timestamp: new Date(),
    };
    this.vixData.push(newVix);
    return newVix;
  }
}

export const storage = new MemStorage();
