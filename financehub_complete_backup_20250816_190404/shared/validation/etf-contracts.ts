import { z } from 'zod';
import { DataContract, ValidationRule, QualityGate, ValidationResult } from './data-contracts.js';

// ETF Metric Schema
export const ETFMetricSchema = z.object({
  symbol: z.string().min(1).max(5).regex(/^[A-Z]+$/),
  price: z.number().positive().finite(),
  pctChange: z.number().finite(),
  compositeZ: z.number().finite().nullable(),
  dz1: z.number().finite().nullable(),
  dz5: z.number().finite().nullable(),
  signal: z.enum(['BUY', 'SELL', 'HOLD']).nullable(),
  components: z.object({
    macdZ: z.number().finite().nullable(),
    rsi14: z.number().min(0).max(100).nullable(),
    rsiZ: z.number().finite().nullable(),
    bbPctB: z.number().min(0).max(2).nullable(), // Real %B, not fake 50%
    bbZ: z.number().finite().nullable(),
    maGapPct: z.number().finite().nullable(),
    maGapZ: z.number().finite().nullable(),
    mom5dZ: z.number().finite().nullable()
  }),
  ma: z.object({
    ma50: z.number().positive().nullable(),
    ma200: z.number().positive().nullable(),
    gapPct: z.number().finite().nullable()
  }),
  atr14: z.number().positive().nullable(),
  rs: z.object({
    rs30: z.number().finite().nullable(),
    rs90: z.number().finite().nullable(),
    beta252: z.number().finite().nullable(),
    corr252: z.number().finite().nullable()
  }),
  liq: z.object({
    avgDollarVol20d: z.number().positive().nullable()
  })
});

export type ETFMetric = z.infer<typeof ETFMetricSchema>;

// Business Rules for ETF Metrics
const etfBusinessRules: ValidationRule<ETFMetric>[] = [
  {
    name: 'composite-z-score-range',
    description: 'Composite Z-score should be within reasonable bounds (-5 to +5)',
    severity: 'ERROR',
    validate: (data: ETFMetric): ValidationResult => {
      const errors = [];
      if (data.compositeZ !== null && Math.abs(data.compositeZ) > 5) {
        errors.push({
          field: 'compositeZ',
          message: `Composite Z-score ${data.compositeZ} exceeds reasonable bounds (-5 to +5)`,
          severity: 'ERROR' as const,
          code: 'ZSCORE_OUT_OF_BOUNDS'
        });
      }
      return {
        valid: errors.length === 0,
        errors,
        warnings: [],
        confidence: errors.length === 0 ? 1.0 : 0.7
      };
    }
  },
  {
    name: 'rsi-bounds-check',
    description: 'RSI should be between 0 and 100',
    severity: 'ERROR',
    validate: (data: ETFMetric): ValidationResult => {
      const errors = [];
      if (data.components.rsi14 !== null && (data.components.rsi14 < 0 || data.components.rsi14 > 100)) {
        errors.push({
          field: 'components.rsi14',
          message: `RSI ${data.components.rsi14} is outside valid bounds (0-100)`,
          severity: 'ERROR' as const,
          code: 'RSI_OUT_OF_BOUNDS'
        });
      }
      return {
        valid: errors.length === 0,
        errors,
        warnings: [],
        confidence: errors.length === 0 ? 1.0 : 0.6
      };
    }
  },
  {
    name: 'bollinger-band-percentage-check',
    description: 'Bollinger Band %B should be between 0 and 2 (occasionally beyond for extreme conditions)',
    severity: 'WARNING',
    validate: (data: ETFMetric): ValidationResult => {
      const warnings = [];
      if (data.components.bbPctB !== null && (data.components.bbPctB < -0.5 || data.components.bbPctB > 2.5)) {
        warnings.push({
          field: 'components.bbPctB',
          message: `Bollinger Band %B ${data.components.bbPctB} is in extreme territory`,
          severity: 'WARNING' as const,
          code: 'BB_EXTREME_VALUE'
        });
      }
      return {
        valid: true,
        errors: [],
        warnings,
        confidence: warnings.length === 0 ? 1.0 : 0.9
      };
    }
  },
  {
    name: 'price-consistency-check',
    description: 'Price should be consistent with percentage change calculation',
    severity: 'WARNING',
    validate: (data: ETFMetric): ValidationResult => {
      const warnings = [];
      // Check if price is reasonable for an ETF (typically $10-$500)
      if (data.price < 5 || data.price > 1000) {
        warnings.push({
          field: 'price',
          message: `ETF price ${data.price} seems unusual for a major ETF`,
          severity: 'WARNING' as const,
          code: 'UNUSUAL_PRICE'
        });
      }
      return {
        valid: true,
        errors: [],
        warnings,
        confidence: warnings.length === 0 ? 1.0 : 0.95
      };
    }
  }
];

// Quality Gates for ETF Metrics
const etfQualityGates: QualityGate<ETFMetric>[] = [
  {
    name: 'sufficient-components',
    description: 'ETF metric requires at least 2 valid technical components for reliable analysis',
    check: (data: ETFMetric): boolean => {
      const components = [
        data.components.macdZ,
        data.components.rsi14,
        data.components.bbPctB,
        data.components.rsiZ,
        data.components.bbZ
      ];
      const validComponents = components.filter(c => c !== null && !isNaN(c as number));
      return validComponents.length >= 2;
    },
    errorMessage: 'ETF metric requires at least 2 valid technical components',
    failureAction: 'REJECT'
  },
  {
    name: 'core-data-present',
    description: 'Core ETF data (symbol, price) must be present',
    check: (data: ETFMetric): boolean => {
      return !!(data.symbol && data.symbol.length > 0 && 
                data.price && data.price > 0 && 
                !isNaN(data.price));
    },
    errorMessage: 'Core ETF data (symbol, price) is missing or invalid',
    failureAction: 'REJECT'
  },
  {
    name: 'z-score-calculation-readiness',
    description: 'Sufficient data for Z-score calculations',
    check: (data: ETFMetric): boolean => {
      // At least one Z-score component should be available
      const zScores = [
        data.compositeZ,
        data.components.macdZ,
        data.components.rsiZ,
        data.components.bbZ,
        data.components.maGapZ,
        data.components.mom5dZ
      ];
      const validZScores = zScores.filter(z => z !== null && !isNaN(z as number));
      return validZScores.length >= 1;
    },
    errorMessage: 'Insufficient data for Z-score calculations',
    failureAction: 'DEGRADE'
  },
  {
    name: 'signal-consistency',
    description: 'Trading signal should be consistent with composite Z-score',
    check: (data: ETFMetric): boolean => {
      if (data.compositeZ === null || data.signal === null) return true; // Skip if missing data
      
      // Basic consistency check
      if (data.compositeZ > 1.5 && data.signal !== 'SELL') return false;
      if (data.compositeZ < -1.5 && data.signal !== 'BUY') return false;
      if (Math.abs(data.compositeZ) <= 1.0 && data.signal !== 'HOLD') return false;
      
      return true;
    },
    errorMessage: 'Trading signal inconsistent with composite Z-score',
    failureAction: 'LOG'
  }
];

// ETF Metrics Data Contract
export const ETF_METRICS_CONTRACT: DataContract<ETFMetric> = {
  schema: ETFMetricSchema,
  businessRules: etfBusinessRules,
  qualityGates: etfQualityGates,
  metadata: {
    version: '1.0.0',
    description: 'Data contract for ETF technical metrics with Z-score analysis',
    lastUpdated: '2025-08-13',
    owner: 'FinanceHub-DataQuality'
  }
};

// ETF Metrics Array Contract
export const ETF_METRICS_ARRAY_CONTRACT: DataContract<ETFMetric[]> = {
  schema: z.array(ETFMetricSchema),
  businessRules: [
    {
      name: 'minimum-etf-count',
      description: 'Should have data for at least 8 major sector ETFs',
      severity: 'WARNING',
      validate: (data: ETFMetric[]): ValidationResult => {
        const warnings = [];
        if (data.length < 8) {
          warnings.push({
            field: 'array_length',
            message: `Only ${data.length} ETFs present, expected at least 8 major sector ETFs`,
            severity: 'WARNING' as const,
            code: 'INSUFFICIENT_ETF_COVERAGE'
          });
        }
        return {
          valid: true,
          errors: [],
          warnings,
          confidence: data.length >= 8 ? 1.0 : Math.max(0.5, data.length / 8)
        };
      }
    }
  ],
  qualityGates: [
    {
      name: 'major-etfs-present',
      description: 'Major sector ETFs (SPY, XLK, XLF, XLV) should be present',
      check: (data: ETFMetric[]): boolean => {
        const majorETFs = ['SPY', 'XLK', 'XLF', 'XLV'];
        const presentSymbols = data.map(etf => etf.symbol);
        const missingMajor = majorETFs.filter(symbol => !presentSymbols.includes(symbol));
        return missingMajor.length === 0;
      },
      errorMessage: 'Missing major sector ETFs (SPY, XLK, XLF, XLV)',
      failureAction: 'DEGRADE'
    }
  ],
  metadata: {
    version: '1.0.0',
    description: 'Data contract for array of ETF technical metrics',
    lastUpdated: '2025-08-13',
    owner: 'FinanceHub-DataQuality'
  }
};