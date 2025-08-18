import { Request, Response, NextFunction } from 'express';
import { DataContractValidator, DataQualityError } from '../../shared/validation/data-contracts.js';
import { ContractRegistry } from '../../shared/validation/contract-registry.js';
import { logger } from '../utils/logger.js';

export interface DataQualityMiddlewareOptions {
  contractName: string;
  skipOnDevelopment?: boolean;
  errorAction?: 'FAIL' | 'WARN' | 'SKIP';
  minConfidence?: number;
}

/**
 * Middleware for validating API responses against data contracts
 */
export const validateDataContract = (options: DataQualityMiddlewareOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip validation in development if configured
    if (options.skipOnDevelopment && process.env.NODE_ENV === 'development') {
      return next();
    }

    const originalSend = res.send;
    const originalJson = res.json;

    // Intercept res.send
    res.send = function(data: any): Response {
      validateAndSend.call(this, data, originalSend, options, req);
      return this;
    } as any;

    // Intercept res.json
    res.json = function(data: any): Response {
      validateAndSend.call(this, data, originalJson, options, req);
      return this;
    } as any;

    next();
  };
};

function validateAndSend(
  this: Response,
  data: any, 
  originalMethod: Function, 
  options: DataQualityMiddlewareOptions,
  req: Request
): void {
  const performValidation = async () => {
    try {
      // Skip validation for error responses
      if (this.statusCode >= 400) {
        return originalMethod.call(this, data);
      }

    // Get the contract for validation
    const contract = ContractRegistry.getContract(options.contractName);
    if (!contract) {
      logger.warn(`🔍 Data contract '${options.contractName}' not found, skipping validation`);
      return originalMethod.call(this, data);
    }

    // Parse data if it's a string
    let parsedData = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (error) {
        logger.warn(`🔍 Failed to parse response data for validation: ${error}`);
        return originalMethod.call(this, data);
      }
    }

    // Extract the actual data to validate (skip wrapper properties)
    const dataToValidate = extractValidationData(parsedData, options.contractName);

    if (!dataToValidate) {
      logger.warn(`🔍 No data found to validate for contract '${options.contractName}'`);
      return originalMethod.call(this, data);
    }

    // Perform validation
    const validator = new DataContractValidator();
    const validationResult = await validator.validate(dataToValidate, contract);

    // Log validation results
    const endpoint = req.path;
    logger.info(`🔍 Data Quality Validation - ${endpoint}`, {
      contract: options.contractName,
      valid: validationResult.valid,
      confidence: validationResult.confidence,
      errors: validationResult.errors.length,
      warnings: validationResult.warnings.length
    });

    // Handle validation failures based on configuration
    if (!validationResult.valid || validationResult.confidence < (options.minConfidence || 0.7)) {
      const errorAction = options.errorAction || 'WARN';

      switch (errorAction) {
        case 'FAIL':
          logger.error(`❌ Data quality validation failed for ${endpoint}`, validationResult.errors);
          throw new DataQualityError('Data quality validation failed', validationResult, options.contractName);

        case 'WARN':
          logger.warn(`⚠️ Data quality issues detected for ${endpoint}`, {
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            confidence: validationResult.confidence
          });
          break;

        case 'SKIP':
          logger.debug(`🔍 Data quality validation skipped for ${endpoint}`);
          break;
      }
    }

    // Add data quality metadata to response
    if (typeof parsedData === 'object' && parsedData !== null) {
      parsedData._dataQuality = {
        validated: true,
        contract: options.contractName,
        confidence: validationResult.confidence,
        errors: validationResult.errors.length,
        warnings: validationResult.warnings.length,
        timestamp: new Date().toISOString()
      };
    }

    return originalMethod.call(this, parsedData);

  } catch (error) {
    if (error instanceof DataQualityError) {
      // Return structured error response
      return this.status(422).json({
        error: 'Data Quality Validation Failed',
        details: error.validationResult.errors,
        contract: error.contractName,
        confidence: error.validationResult.confidence
      });
    }

      logger.error(`❌ Error in data quality validation middleware: ${error}`);
      return originalMethod.call(this, data);
    }
  };

  // Execute validation asynchronously
  performValidation();
}

/**
 * Extract the data that should be validated from the API response
 */
function extractValidationData(responseData: any, contractName: string): any {
  if (!responseData || typeof responseData !== 'object') {
    return responseData;
  }

  // For array contracts, look for data arrays
  if (contractName.includes('array')) {
    if (responseData.data && Array.isArray(responseData.data)) {
      return responseData.data;
    }
    if (responseData.indicators && Array.isArray(responseData.indicators)) {
      return responseData.indicators;
    }
    if (responseData.etfMovers && Array.isArray(responseData.etfMovers)) {
      return responseData.etfMovers;
    }
    if (Array.isArray(responseData)) {
      return responseData;
    }
  }

  // For single item contracts
  if (responseData.data && !Array.isArray(responseData.data)) {
    return responseData.data;
  }

  // Return the whole response if no wrapper is found
  return responseData;
}

/**
 * Express error handler for data quality errors
 */
export const dataQualityErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof DataQualityError) {
    logger.error(`❌ Data Quality Error on ${req.path}:`, {
      contract: error.contractName,
      errors: error.validationResult.errors,
      confidence: error.validationResult.confidence
    });

    return res.status(422).json({
      error: 'Data Quality Validation Failed',
      message: error.message,
      details: error.validationResult.errors,
      contract: error.contractName,
      confidence: error.validationResult.confidence,
      endpoint: req.path
    });
  }

  next(error);
};