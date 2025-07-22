import { z } from 'zod';

// Stock symbol validation
export const stockSymbolSchema = z
  .string()
  .min(1, 'Symbol cannot be empty')
  .max(10, 'Symbol too long')
  .regex(/^[A-Z]+$/, 'Symbol must contain only uppercase letters');

export const validateStockSymbol = (symbol: string): boolean => {
  try {
    stockSymbolSchema.parse(symbol);
    return true;
  } catch {
    return false;
  }
};

// Pagination validation
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

// Date range validation
export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date()
}).refine(data => data.startDate <= data.endDate, {
  message: 'Start date must be before or equal to end date'
});

// API request validation schemas
export const stockHistoryRequestSchema = z.object({
  symbol: stockSymbolSchema,
  ...dateRangeSchema.shape,
  ...paginationSchema.shape
});

export const technicalIndicatorRequestSchema = z.object({
  symbol: stockSymbolSchema,
  indicators: z.array(z.enum(['RSI', 'MACD', 'BBANDS', 'SMA', 'EMA'])).optional()
});

// Environment validation schema
export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  TWELVE_DATA_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000)
});

export const createErrorResponse = (message: string, code?: string) => ({
  success: false,
  message,
  ...(code && { code })
});