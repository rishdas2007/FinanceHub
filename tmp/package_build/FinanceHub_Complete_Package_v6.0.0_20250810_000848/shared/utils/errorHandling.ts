/**
 * Centralized error handling utilities
 * Standardizes error logging and response patterns across the application
 */

export interface ApiError {
  message: string;
  statusCode: number;
  service?: string;
  endpoint?: string;
  originalError?: Error;
}

export function createApiError(
  message: string, 
  statusCode: number = 500, 
  service?: string,
  endpoint?: string,
  originalError?: Error
): ApiError {
  return {
    message,
    statusCode,
    service,
    endpoint,
    originalError
  };
}

export function logError(error: ApiError): void {
  const context = error.service ? `[${error.service}${error.endpoint ? `:${error.endpoint}` : ''}]` : '';
  console.error(`❌ ${context} ${error.message}`, error.originalError);
}

export function handleApiError(error: ApiError, res: any): void {
  logError(error);
  res.status(error.statusCode).json({ 
    message: error.message,
    service: error.service 
  });
}

export function createFallbackError(service: string, operation: string): ApiError {
  return createApiError(
    `${service} service temporarily unavailable. Using fallback data.`,
    503,
    service,
    operation
  );
}

export function createNotFoundError(resource: string): ApiError {
  return createApiError(
    `${resource} not found`,
    404
  );
}

export function createValidationError(field: string, value?: any): ApiError {
  return createApiError(
    `Invalid ${field}${value ? `: ${value}` : ''}`,
    400
  );
}