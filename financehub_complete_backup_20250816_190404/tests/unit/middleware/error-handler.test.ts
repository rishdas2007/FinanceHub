import { describe, it, expect, vi } from 'vitest';
import { HttpError, asyncHandler } from '../../../server/middleware/error-handler';

describe('Error Handler Middleware', () => {
  describe('HttpError', () => {
    it('should create error with correct properties', () => {
      const error = new HttpError(404, 'Not found', 'NOT_FOUND');
      
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('HttpError');
    });
  });

  describe('asyncHandler', () => {
    it('should catch async errors and pass to next', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('Async error'));
      const next = vi.fn();
      const req = {} as any;
      const res = {} as any;

      const wrappedFn = asyncHandler(asyncFn);
      await wrappedFn(req, res, next);

      expect(asyncFn).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should not call next for successful async operations', async () => {
      const asyncFn = vi.fn().mockResolvedValue(undefined);
      const next = vi.fn();
      const req = {} as any;
      const res = {} as any;

      const wrappedFn = asyncHandler(asyncFn);
      await wrappedFn(req, res, next);

      expect(asyncFn).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });
});