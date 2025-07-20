/**
 * Input validation schemas using Zod
 * Centralizes all request validation logic
 */

import { z } from 'zod';

// Stock symbol validation
export const symbolSchema = z.object({
  symbol: z.string()
    .regex(/^[A-Z]{1,5}$/, "Invalid stock symbol - must be 1-5 uppercase letters")
    .min(1)
    .max(5)
});

// Query parameters validation
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).max(1000).default(1),
  limit: z.coerce.number().min(1).max(100).default(30)
});

export const timeRangeSchema = z.object({
  timeframe: z.enum(['1D', '5D', '1M', '3M', '6M', '1Y']).default('1D')
});

// Environment validation
export const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  TWELVE_DATA_API_KEY: z.string().min(1, "TWELVE_DATA_API_KEY is required"),
  SENDGRID_API_KEY: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1000).max(65535).default(5000)
});

// Email validation
export const emailSchema = z.object({
  email: z.string().email("Invalid email address").max(255)
});

// Request ID validation
export const requestIdSchema = z.object({
  'x-request-id': z.string().uuid().optional()
});

// API response validation helpers
export const createApiResponse = <T>(data: T, success = true) => ({
  success,
  data,
  timestamp: new Date().toISOString()
});

export const createErrorResponse = (message: string, code?: string, requestId?: string) => ({
  success: false,
  error: {
    message,
    code,
    requestId,
    timestamp: new Date().toISOString()
  }
});