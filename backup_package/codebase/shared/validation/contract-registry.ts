import { DataContract } from './data-contracts.js';
import { 
  ETF_METRICS_CONTRACT, 
  ETF_METRICS_ARRAY_CONTRACT,
  ETFMetric 
} from './etf-contracts.js';
import { 
  ECONOMIC_INDICATOR_CONTRACT,
  ECONOMIC_INDICATORS_ARRAY_CONTRACT,
  ECONOMIC_DATA_POINT_CONTRACT,
  EconomicIndicator,
  EconomicDataPoint
} from './economic-contracts.js';

export interface ContractRegistryEntry {
  name: string;
  contract: DataContract<any>;
  description: string;
  dataType: string;
  endpoint?: string;
}

export class ContractRegistry {
  private static contracts = new Map<string, ContractRegistryEntry>([
    ['etf-metric', {
      name: 'etf-metric',
      contract: ETF_METRICS_CONTRACT,
      description: 'Single ETF technical metric with Z-score analysis',
      dataType: 'ETFMetric',
      endpoint: '/api/etf-enhanced/features/:symbol'
    }],
    ['etf-metrics-array', {
      name: 'etf-metrics-array',
      contract: ETF_METRICS_ARRAY_CONTRACT,
      description: 'Array of ETF technical metrics for dashboard',
      dataType: 'ETFMetric[]',
      endpoint: '/api/etf-enhanced/metrics'
    }],
    ['economic-indicator', {
      name: 'economic-indicator',
      contract: ECONOMIC_INDICATOR_CONTRACT,
      description: 'Single economic indicator with statistical analysis',
      dataType: 'EconomicIndicator',
      endpoint: '/api/economic-health/indicator/:id'
    }],
    ['economic-indicators-array', {
      name: 'economic-indicators-array',
      contract: ECONOMIC_INDICATORS_ARRAY_CONTRACT,
      description: 'Array of economic indicators for dashboard',
      dataType: 'EconomicIndicator[]',
      endpoint: '/api/macroeconomic-indicators'
    }],
    ['economic-data-point', {
      name: 'economic-data-point',
      contract: ECONOMIC_DATA_POINT_CONTRACT,
      description: 'Economic data point for unit transformation',
      dataType: 'EconomicDataPoint',
      endpoint: 'internal'
    }]
  ]);

  static getContract(name: string): DataContract<any> | null {
    const entry = this.contracts.get(name);
    return entry ? entry.contract : null;
  }

  static getContractInfo(name: string): ContractRegistryEntry | null {
    return this.contracts.get(name) || null;
  }

  static getAllContracts(): ContractRegistryEntry[] {
    return Array.from(this.contracts.values());
  }

  static getContractsForEndpoint(endpoint: string): ContractRegistryEntry[] {
    return Array.from(this.contracts.values()).filter(entry => 
      entry.endpoint === endpoint
    );
  }

  static registerContract(name: string, entry: ContractRegistryEntry): void {
    this.contracts.set(name, entry);
  }

  static validateContractExists(name: string): boolean {
    return this.contracts.has(name);
  }

  static getContractMetadata(): Array<{
    name: string;
    version: string;
    description: string;
    dataType: string;
    endpoint?: string;
    lastUpdated: string;
  }> {
    return Array.from(this.contracts.values()).map(entry => ({
      name: entry.name,
      version: entry.contract.metadata.version,
      description: entry.description,
      dataType: entry.dataType,
      endpoint: entry.endpoint,
      lastUpdated: entry.contract.metadata.lastUpdated
    }));
  }
}

// Type-safe contract getters
export const getETFMetricContract = (): DataContract<ETFMetric> => ETF_METRICS_CONTRACT;
export const getETFMetricsArrayContract = (): DataContract<ETFMetric[]> => ETF_METRICS_ARRAY_CONTRACT;
export const getEconomicIndicatorContract = (): DataContract<EconomicIndicator> => ECONOMIC_INDICATOR_CONTRACT;
export const getEconomicIndicatorsArrayContract = (): DataContract<EconomicIndicator[]> => ECONOMIC_INDICATORS_ARRAY_CONTRACT;
export const getEconomicDataPointContract = (): DataContract<EconomicDataPoint> => ECONOMIC_DATA_POINT_CONTRACT;