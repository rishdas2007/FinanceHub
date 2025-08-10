export interface IAIAnalysisService {
  generateAnalysis(): Promise<any>;
  generateMarketSummary(): Promise<any>;
}