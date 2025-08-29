import { z, ZodSchema } from 'zod';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  confidence: number; // 0-1 scale
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  code: string;
}

export interface DataContract<T> {
  schema: ZodSchema<T>;
  businessRules: ValidationRule<T>[];
  qualityGates: QualityGate<T>[];
  metadata: ContractMetadata;
}

export interface ValidationRule<T> {
  name: string;
  validate: (data: T) => ValidationResult;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  description: string;
}

export interface QualityGate<T> {
  name: string;
  check: (data: T) => boolean;
  errorMessage: string;
  failureAction: 'REJECT' | 'DEGRADE' | 'LOG';
  description: string;
}

export interface ContractMetadata {
  version: string;
  description: string;
  lastUpdated: string;
  owner: string;
}

export class DataContractValidator {
  async validate<T>(data: T, contract: DataContract<T>): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    let confidence = 1.0;

    // Step 1: Schema validation
    const schemaResult = contract.schema.safeParse(data);
    if (!schemaResult.success) {
      schemaResult.error.errors.forEach(err => {
        errors.push({
          field: err.path.join('.'),
          message: err.message,
          severity: 'ERROR',
          code: 'SCHEMA_VALIDATION'
        });
      });
      confidence -= 0.3;
    }

    // Step 2: Business rules validation
    for (const rule of contract.businessRules) {
      try {
        const ruleResult = rule.validate(data);
        if (!ruleResult.valid) {
          ruleResult.errors.forEach(err => {
            if (rule.severity === 'ERROR') {
              errors.push(err);
              confidence -= 0.2;
            } else {
              warnings.push(err);
              confidence -= 0.1;
            }
          });
        }
      } catch (error) {
        errors.push({
          field: 'business_rule',
          message: `Business rule '${rule.name}' failed: ${error}`,
          severity: 'ERROR',
          code: 'RULE_EXECUTION_ERROR'
        });
        confidence -= 0.15;
      }
    }

    // Step 3: Quality gates validation
    for (const gate of contract.qualityGates) {
      try {
        const gateResult = gate.check(data);
        if (!gateResult) {
          const error: ValidationError = {
            field: 'quality_gate',
            message: gate.errorMessage,
            severity: gate.failureAction === 'REJECT' ? 'ERROR' : 'WARNING',
            code: `QUALITY_GATE_${gate.name.toUpperCase()}`
          };

          if (gate.failureAction === 'REJECT') {
            errors.push(error);
            confidence -= 0.3;
          } else {
            warnings.push(error);
            confidence -= 0.1;
          }
        }
      } catch (error) {
        errors.push({
          field: 'quality_gate',
          message: `Quality gate '${gate.name}' failed: ${error}`,
          severity: 'ERROR',
          code: 'GATE_EXECUTION_ERROR'
        });
        confidence -= 0.2;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      confidence: Math.max(0, confidence)
    };
  }
}

export class DataQualityError extends Error {
  constructor(
    message: string,
    public validationResult: ValidationResult,
    public contractName?: string
  ) {
    super(message);
    this.name = 'DataQualityError';
  }
}