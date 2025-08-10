export interface IFinancialDataService {
  getStockQuote(symbol: string): Promise<any>;
  getTechnicalIndicators(symbol: string): Promise<any>;
  getSectorETFs(): Promise<any>;
}