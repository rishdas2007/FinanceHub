// FIX 2: Standardize Types & Parsing
export interface RawStockData {
  price: string;
  change: string;
  changePercent: string;
  volume: number;
  timestamp: string;
  symbol: string;
}

export interface NormalizedStockData {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
  formattedDate: string;
  symbol: string;
}

export function normalizeStockData(raw: RawStockData): NormalizedStockData {
  const timestamp = new Date(raw.timestamp);
  if (isNaN(timestamp.getTime())) {
    throw new Error(`Invalid timestamp: ${raw.timestamp}`);
  }

  return {
    price: Number(raw.price),
    change: Number(raw.change),
    changePercent: Number(raw.changePercent),
    volume: raw.volume,
    timestamp,
    formattedDate: timestamp.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    symbol: raw.symbol
  };
}

// Batch normalize function for arrays
export function normalizeStockDataArray(rawData: RawStockData[]): NormalizedStockData[] {
  return rawData
    .map((item, index) => {
      try {
        return normalizeStockData(item);
      } catch (error) {
        console.error(`Failed to normalize stock data at index ${index}:`, error, item);
        return null;
      }
    })
    .filter((item): item is NormalizedStockData => item !== null);
}

// Type guard for checking if data needs normalization
export function isRawStockData(data: any): data is RawStockData {
  return data && 
    typeof data.price === 'string' && 
    typeof data.change === 'string' && 
    typeof data.changePercent === 'string';
}