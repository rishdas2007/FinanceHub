/**
 * Database operation helpers
 * Consolidates common database patterns and error handling
 */

import { createApiError, logError } from './errorHandling';

export interface DatabaseOperation<T> {
  operation: string;
  table: string;
  data?: any;
  result?: T;
  error?: Error;
}

export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    const dbError = createApiError(
      `Database operation failed: ${context}`,
      500,
      'Database',
      context,
      error as Error
    );
    logError(dbError);
    return fallback;
  }
}

export async function batchInsert<T>(
  insertFn: (item: T) => Promise<any>,
  items: T[],
  batchSize: number = 10
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const promises = batch.map(async (item) => {
      try {
        await insertFn(item);
        return true;
      } catch (error) {
        console.error('Batch insert failed for item:', item, error);
        return false;
      }
    });
    
    const results = await Promise.all(promises);
    success += results.filter(Boolean).length;
    failed += results.filter(r => !r).length;
  }
  
  return { success, failed };
}

export function createRetryWrapper<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): () => Promise<T> {
  return async (): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        console.log(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
    
    throw lastError!;
  };
}