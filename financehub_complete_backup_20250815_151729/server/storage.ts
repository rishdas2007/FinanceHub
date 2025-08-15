import { 
  stockData, 
  marketSentiment, 
  technicalIndicators,
  type StockData,
  type InsertStockData,
  type MarketSentiment,
  type InsertMarketSentiment,
  type TechnicalIndicators,
  type InsertTechnicalIndicators
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, and } from "drizzle-orm";

export interface IStorage {
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
  
  // Cleanup operations
  cleanupOldMarketSentiment(): Promise<void>;
  cleanupOldStockData(): Promise<void>;
  
  // Additional methods used in routes
  getAllSectorData(): Promise<any[]>;
  getLatestSectorData(): Promise<any[]>;
  createSectorData(data: any): Promise<any>;
  getLatestMarketBreadth(): Promise<any>;
  createMarketBreadth(data: any): Promise<any>;
  getLatestVixData(): Promise<any>;
  createVixData(data: any): Promise<any>;
}

export class MemStorage implements IStorage {
  private stockDataMap: Map<string, StockData[]>;
  private marketSentimentList: MarketSentiment[];
  private technicalIndicatorsMap: Map<string, TechnicalIndicators[]>;
  private currentId: number;
  private sectorDataList: any[];
  private marketBreadthList: any[];
  private vixDataList: any[];

  constructor() {
    this.stockDataMap = new Map();
    this.marketSentimentList = [];
    this.technicalIndicatorsMap = new Map();
    this.currentId = 1;
    this.sectorDataList = [];
    this.marketBreadthList = [];
    this.vixDataList = [];
  }

  async getLatestStockData(symbol: string): Promise<StockData | undefined> {
    const data = this.stockDataMap.get(symbol);
    return data ? data[data.length - 1] : undefined;
  }

  async createStockData(data: InsertStockData): Promise<StockData> {
    const id = this.currentId++;
    const stockDataEntry: StockData = {
      id,
      symbol: data.symbol,
      price: data.price,
      change: data.change,
      percentChange: data.percentChange,
      volume: data.volume,
      marketCap: data.marketCap || null,
      timestamp: data.timestamp || new Date(), // Use provided timestamp or current time as fallback
    };
    
    if (!this.stockDataMap.has(data.symbol)) {
      this.stockDataMap.set(data.symbol, []);
    }
    
    this.stockDataMap.get(data.symbol)!.push(stockDataEntry);
    
    // Keep only last 50 entries per symbol
    const symbolData = this.stockDataMap.get(data.symbol)!;
    if (symbolData.length > 50) {
      symbolData.shift();
    }
    
    return stockDataEntry;
  }

  async getStockHistory(symbol: string, limit: number = 20): Promise<StockData[]> {
    const data = this.stockDataMap.get(symbol);
    if (!data) return [];
    
    return data.slice(-limit);
  }

  async getLatestMarketSentiment(): Promise<MarketSentiment | undefined> {
    return this.marketSentimentList.length > 0 ? this.marketSentimentList[this.marketSentimentList.length - 1] : undefined;
  }

  async createMarketSentiment(sentiment: InsertMarketSentiment): Promise<MarketSentiment> {
    const id = this.currentId++;
    const sentimentEntry: MarketSentiment = {
      id,
      vix: sentiment.vix,
      vixChange: sentiment.vixChange || null,
      putCallRatio: sentiment.putCallRatio,
      putCallChange: sentiment.putCallChange || null,
      aaiiBullish: sentiment.aaiiBullish,
      aaiiBullishChange: sentiment.aaiiBullishChange || null,
      aaiiBearish: sentiment.aaiiBearish,
      aaiiBearishChange: sentiment.aaiiBearishChange || null,
      aaiiNeutral: sentiment.aaiiNeutral,
      dataSource: sentiment.dataSource || 'aaii_survey',
      timestamp: new Date(),
    };
    
    this.marketSentimentList.push(sentimentEntry);
    
    // Keep only last 20 entries
    if (this.marketSentimentList.length > 20) {
      this.marketSentimentList.shift();
    }
    
    return sentimentEntry;
  }

  async getLatestTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | undefined> {
    const indicators = this.technicalIndicatorsMap.get(symbol);
    return indicators ? indicators[indicators.length - 1] : undefined;
  }

  async createTechnicalIndicators(indicators: InsertTechnicalIndicators): Promise<TechnicalIndicators> {
    const id = this.currentId++;
    const indicatorsEntry: TechnicalIndicators = {
      id,
      symbol: indicators.symbol,
      rsi: indicators.rsi || null,
      macd: indicators.macd || null,
      macdSignal: indicators.macdSignal || null,
      macdHistogram: indicators.macdHistogram || null,
      bb_upper: indicators.bb_upper || null,
      bb_middle: indicators.bb_middle || null,
      bb_lower: indicators.bb_lower || null,
      percent_b: indicators.percent_b || null,
      adx: indicators.adx || null,
      stoch_k: indicators.stoch_k || null,
      stoch_d: indicators.stoch_d || null,
      sma_20: indicators.sma_20 || null,
      sma_50: indicators.sma_50 || null,
      ema_12: indicators.ema_12 || null,
      ema_26: indicators.ema_26 || null,
      vwap: indicators.vwap || null,
      atr: indicators.atr || null,
      willr: indicators.willr || null,
      timestamp: new Date(),
    };
    
    if (!this.technicalIndicatorsMap.has(indicators.symbol)) {
      this.technicalIndicatorsMap.set(indicators.symbol, []);
    }
    
    this.technicalIndicatorsMap.get(indicators.symbol)!.push(indicatorsEntry);
    
    // Keep only last 50 entries per symbol
    const symbolIndicators = this.technicalIndicatorsMap.get(indicators.symbol)!;
    if (symbolIndicators.length > 50) {
      symbolIndicators.shift();
    }
    
    return indicatorsEntry;
  }

  async cleanupOldMarketSentiment(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.marketSentimentList = this.marketSentimentList.filter(sentiment => 
      sentiment.timestamp > oneDayAgo
    );
  }

  async cleanupOldStockData(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [symbol, data] of this.stockDataMap.entries()) {
      this.stockDataMap.set(symbol, data.filter(stock => stock.timestamp > oneDayAgo));
    }
  }

  async getAllSectorData(): Promise<any[]> {
    return this.sectorDataList;
  }

  async getLatestSectorData(): Promise<any[]> {
    return this.sectorDataList;
  }

  async createSectorData(data: any): Promise<any> {
    const id = this.currentId++;
    const sectorData = { id, ...data, timestamp: new Date() };
    this.sectorDataList.push(sectorData);
    if (this.sectorDataList.length > 20) {
      this.sectorDataList.shift();
    }
    return sectorData;
  }

  async getLatestMarketBreadth(): Promise<any> {
    return this.marketBreadthList.length > 0 ? this.marketBreadthList[this.marketBreadthList.length - 1] : undefined;
  }

  async createMarketBreadth(data: any): Promise<any> {
    const id = this.currentId++;
    const breadthData = { id, ...data, timestamp: new Date() };
    this.marketBreadthList.push(breadthData);
    if (this.marketBreadthList.length > 20) {
      this.marketBreadthList.shift();
    }
    return breadthData;
  }

  async getLatestVixData(): Promise<any> {
    return this.vixDataList.length > 0 ? this.vixDataList[this.vixDataList.length - 1] : undefined;
  }

  async createVixData(data: any): Promise<any> {
    const id = this.currentId++;
    const vixData = { id, ...data, timestamp: new Date() };
    this.vixDataList.push(vixData);
    if (this.vixDataList.length > 20) {
      this.vixDataList.shift();
    }
    return vixData;
  }
}

export const storage = new MemStorage();