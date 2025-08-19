import { z } from 'zod';
import { DataContract, ValidationRule, QualityGate, ValidationResult } from './data-contracts.js';

// Economic Indicator Schema
export const EconomicIndicatorSchema = z.object({
  metric: z.string().min(1),
  type: z.enum(['Leading', 'Lagging', 'Coincident']),
  category: z.string().min(1),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  period_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currentReading: z.string().min(1),
  priorReading: z.string().min(1),
  variation: z.string().min(1),
  units: z.string().min(1),
  frequency: z.string().min(1),
  source: z.string().min(1),
  seriesId: z.string().min(1),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/), // ISO datetime
  trend: z.enum(['up', 'down', 'flat']).nullable(),
  impact: z.enum(['positive', 'negative', 'neutral']).nullable(),
  zScore: z.number().finite().nullable(),
  percentileRank: z.number().min(0).max(100).nullable(),
  historicalAverage: z.number().finite().nullable(),
  standardDeviation: z.number().positive().nullable()
});

export type EconomicIndicator = z.infer<typeof EconomicIndicatorSchema>;

// Economic Data Point Schema (for transformations)
export const EconomicDataPointSchema = z.object({
  seriesId: z.string().min(1),
  value: z.number().finite(),
  originalUnit: z.string().min(1),
  targetUnit: z.string().min(1),
  transformationType: z.enum(['INDEX_TO_YOY', 'LEVEL_TO_CHANGE', 'SEASONAL_ADJUST', 'PASSTHROUGH']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence: z.number().min(0).max(1)
});

export type EconomicDataPoint = z.infer<typeof EconomicDataPointSchema>;

// Business Rules for Economic Indicators
const economicBusinessRules: ValidationRule<EconomicIndicator>[] = [
  {
    name: 'date-consistency-check',
    description: 'Release date should not be before period date',
    severity: 'ERROR',
    validate: (data: EconomicIndicator): ValidationResult => {
      const errors = [];
      const releaseDate = new Date(data.releaseDate);
      const periodDate = new Date(data.period_date);
      
      if (releaseDate < periodDate) {
        errors.push({
          field: 'releaseDate',
          message: `Release date ${data.releaseDate} cannot be before period date ${data.period_date}`,
          severity: 'ERROR' as const,
          code: 'INVALID_DATE_SEQUENCE'
        });
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings: [],
        confidence: errors.length === 0 ? 1.0 : 0.5
      };
    }
  },
  {
    name: 'current-reading-format',
    description: 'Current reading should be a valid numeric value or percentage',
    severity: 'ERROR',
    validate: (data: EconomicIndicator): ValidationResult => {
      const errors = [];
      const numericValue = parseFloat(data.currentReading.replace('%', ''));
      
      if (isNaN(numericValue)) {
        errors.push({
          field: 'currentReading',
          message: `Current reading '${data.currentReading}' is not a valid numeric value`,
          severity: 'ERROR' as const,
          code: 'INVALID_NUMERIC_FORMAT'
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
    name: 'unit-consistency-check',
    description: 'Units should be consistent with the type of economic indicator',
    severity: 'WARNING',
    validate: (data: EconomicIndicator): ValidationResult => {
      const warnings = [];
      
      // Check for mixed units that could indicate transformation issues
      if (data.metric.toLowerCase().includes('rate') && !data.units.toLowerCase().includes('percent')) {
        warnings.push({
          field: 'units',
          message: `Rate metric '${data.metric}' has units '${data.units}' instead of percentage`,
          severity: 'WARNING' as const,
          code: 'UNIT_MISMATCH'
        });
      }
      
      if (data.metric.toLowerCase().includes('cpi') && data.units.toLowerCase().includes('index') && 
          parseFloat(data.currentReading) > 50) {
        warnings.push({
          field: 'units',
          message: `CPI metric showing index value ${data.currentReading} instead of YoY percentage`,
          severity: 'WARNING' as const,
          code: 'CPI_UNIT_TRANSFORMATION_NEEDED'
        });
      }
      
      return {
        valid: true,
        errors: [],
        warnings,
        confidence: warnings.length === 0 ? 1.0 : 0.8
      };
    }
  },
  {
    name: 'z-score-bounds-check',
    description: 'Z-score should be within reasonable statistical bounds',
    severity: 'WARNING',
    validate: (data: EconomicIndicator): ValidationResult => {
      const warnings = [];
      
      if (data.zScore !== null && Math.abs(data.zScore) > 4) {
        warnings.push({
          field: 'zScore',
          message: `Z-score ${data.zScore} is extremely high, indicating potential outlier`,
          severity: 'WARNING' as const,
          code: 'EXTREME_ZSCORE'
        });
      }
      
      return {
        valid: true,
        errors: [],
        warnings,
        confidence: warnings.length === 0 ? 1.0 : 0.9
      };
    }
  }
];

// Quality Gates for Economic Indicators
const economicQualityGates: QualityGate<EconomicIndicator>[] = [
  {
    name: 'core-data-completeness',
    description: 'Core economic data fields must be present and valid',
    check: (data: EconomicIndicator): boolean => {
      return !!(data.metric && data.metric.length > 0 &&
                data.currentReading && data.currentReading.length > 0 &&
                data.priorReading && data.priorReading.length > 0 &&
                data.seriesId && data.seriesId.length > 0 &&
                data.units && data.units.length > 0);
    },
    errorMessage: 'Core economic indicator data is incomplete',
    failureAction: 'REJECT'
  },
  {
    name: 'data-freshness-check',
    description: 'Economic data should be reasonably fresh',
    check: (data: EconomicIndicator): boolean => {
      const lastUpdated = new Date(data.lastUpdated);
      const now = new Date();
      const daysSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      
      // Most economic indicators should be updated within 30 days
      return daysSinceUpdate <= 30;
    },
    errorMessage: 'Economic data is stale (older than 30 days)',
    failureAction: 'DEGRADE'
  },
  {
    name: 'statistical-data-availability',
    description: 'Statistical analysis data should be available for trend analysis',
    check: (data: EconomicIndicator): boolean => {
      // At least some statistical data should be present
      return data.zScore !== null || 
             data.percentileRank !== null || 
             data.historicalAverage !== null;
    },
    errorMessage: 'No statistical analysis data available',
    failureAction: 'LOG'
  },
  {
    name: 'variation-calculation-consistency',
    description: 'Variation should be consistent with current and prior readings',
    check: (data: EconomicIndicator): boolean => {
      try {
        const current = parseFloat(data.currentReading.replace('%', ''));
        const prior = parseFloat(data.priorReading.replace('%', ''));
        const variation = parseFloat(data.variation.replace('%', ''));
        
        if (isNaN(current) || isNaN(prior) || isNaN(variation)) return true; // Skip if not numeric
        
        // Calculate expected variation
        const expectedVariation = current - prior;
        const tolerance = Math.abs(expectedVariation) * 0.1; // 10% tolerance
        
        return Math.abs(variation - expectedVariation) <= tolerance;
      } catch (error) {
        return true; // Skip validation if calculation fails
      }
    },
    errorMessage: 'Variation calculation inconsistent with current and prior readings',
    failureAction: 'LOG'
  }
];

// Economic Indicator Data Contract
export const ECONOMIC_INDICATOR_CONTRACT: DataContract<EconomicIndicator> = {
  schema: EconomicIndicatorSchema,
  businessRules: economicBusinessRules,
  qualityGates: economicQualityGates,
  metadata: {
    version: '1.0.0',
    description: 'Data contract for economic indicators with statistical analysis',
    lastUpdated: '2025-08-13',
    owner: 'FinanceHub-DataQuality'
  }
};

// Economic Data Point Contract (for transformations)
export const ECONOMIC_DATA_POINT_CONTRACT: DataContract<EconomicDataPoint> = {
  schema: EconomicDataPointSchema,
  businessRules: [
    {
      name: 'transformation-consistency',
      description: 'Transformation type should match unit conversion',
      severity: 'ERROR',
      validate: (data: EconomicDataPoint): ValidationResult => {
        const errors = [];
        
        if (data.transformationType === 'INDEX_TO_YOY' && 
            !data.targetUnit.toLowerCase().includes('percent')) {
          errors.push({
            field: 'transformationType',
            message: 'INDEX_TO_YOY transformation should target percentage units',
            severity: 'ERROR' as const,
            code: 'TRANSFORMATION_UNIT_MISMATCH'
          });
        }
        
        return {
          valid: errors.length === 0,
          errors,
          warnings: [],
          confidence: errors.length === 0 ? 1.0 : 0.7
        };
      }
    }
  ],
  qualityGates: [
    {
      name: 'confidence-threshold',
      description: 'Data point should meet minimum confidence threshold',
      check: (data: EconomicDataPoint): boolean => {
        return data.confidence >= 0.7;
      },
      errorMessage: 'Data point confidence below acceptable threshold (0.7)',
      failureAction: 'DEGRADE'
    }
  ],
  metadata: {
    version: '1.0.0',
    description: 'Data contract for economic data transformation points',
    lastUpdated: '2025-08-13',
    owner: 'FinanceHub-DataQuality'
  }
};

// Economic Indicators Array Contract
export const ECONOMIC_INDICATORS_ARRAY_CONTRACT: DataContract<EconomicIndicator[]> = {
  schema: z.array(EconomicIndicatorSchema),
  businessRules: [
    {
      name: 'minimum-indicator-coverage',
      description: 'Should have core economic indicators for comprehensive analysis',
      severity: 'WARNING',
      validate: (data: EconomicIndicator[]): ValidationResult => {
        const warnings = [];
        const coreIndicators = ['Unemployment Rate', 'CPI', 'GDP', 'Federal Funds Rate'];
        const presentMetrics = data.map(indicator => indicator.metric);
        
        const missingCore = coreIndicators.filter(core => 
          !presentMetrics.some(metric => metric.toLowerCase().includes(core.toLowerCase()))
        );
        
        if (missingCore.length > 0) {
          warnings.push({
            field: 'indicator_coverage',
            message: `Missing core indicators: ${missingCore.join(', ')}`,
            severity: 'WARNING' as const,
            code: 'INSUFFICIENT_CORE_COVERAGE'
          });
        }
        
        return {
          valid: true,
          errors: [],
          warnings,
          confidence: Math.max(0.6, 1 - (missingCore.length / coreIndicators.length) * 0.4)
        };
      }
    }
  ],
  qualityGates: [
    {
      name: 'minimum-data-points',
      description: 'Should have at least 20 economic indicators for comprehensive dashboard',
      check: (data: EconomicIndicator[]): boolean => {
        return data.length >= 20;
      },
      errorMessage: 'Insufficient economic indicators for comprehensive analysis',
      failureAction: 'DEGRADE'
    }
  ],
  metadata: {
    version: '1.0.0',
    description: 'Data contract for array of economic indicators',
    lastUpdated: '2025-08-13',
    owner: 'FinanceHub-DataQuality'
  }
};