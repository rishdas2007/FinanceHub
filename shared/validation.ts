import { z } from 'zod';

// Stock symbol validation
export const stockSymbolSchema = z.string()
  .min(1, 'Stock symbol is required')
  .max(10, 'Stock symbol must be 10 characters or less')
  .regex(/^[A-Z]+$/, 'Stock symbol must contain only uppercase letters')
  .transform(s => s.toUpperCase());

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  limit: z.coerce.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20)
});

// Request validation schemas
export const apiKeySchema = z.string()
  .min(10, 'API key must be at least 10 characters')
  .regex(/^[A-Za-z0-9_-]+$/, 'API key contains invalid characters');

export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date()
}).refine(data => data.endDate >= data.startDate, {
  message: 'End date must be after start date'
});

// Monitoring data schemas
export const performanceMetricSchema = z.object({
  name: z.string().min(1, 'Metric name is required'),
  value: z.number(),
  tags: z.record(z.string()).optional(),
  timestamp: z.number()
});

export const errorReportSchema = z.object({
  message: z.string().min(1, 'Error message is required'),
  stack: z.string().optional(),
  component: z.string().optional(),
  url: z.string().url().optional(),
  userAgent: z.string().optional(),
  timestamp: z.string()
});