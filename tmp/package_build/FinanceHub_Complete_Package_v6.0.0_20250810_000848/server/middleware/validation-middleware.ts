import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from './standardized-error-handler';

interface ValidationSchemas {
  params?: z.ZodSchema;
  query?: z.ZodSchema;
  body?: z.ZodSchema;
}

export const validate = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        throw new HttpError(400, 'Request validation failed', 'VALIDATION_ERROR', validationErrors);
      }
      
      throw error;
    }
  };
};