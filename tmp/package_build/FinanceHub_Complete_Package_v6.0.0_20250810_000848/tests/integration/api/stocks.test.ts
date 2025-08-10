import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { validateInput } from '../../../server/middleware/security';
import { symbolSchema } from '../../../shared/validation';

describe('Stock API Validation', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Test route with validation
    app.get('/api/stocks/:symbol', 
      validateInput(symbolSchema, 'params'),
      (req, res) => {
        res.json({ symbol: req.params.symbol, validated: true });
      }
    );
  });

  describe('Symbol Validation', () => {
    it('should accept valid stock symbols', async () => {
      const validSymbols = ['SPY', 'AAPL', 'MSFT', 'GOOGL', 'TSLA'];
      
      for (const symbol of validSymbols) {
        const response = await request(app)
          .get(`/api/stocks/${symbol}`)
          .expect(200);
        
        expect(response.body.symbol).toBe(symbol);
        expect(response.body.validated).toBe(true);
      }
    });

    it('should reject invalid stock symbols', async () => {
      const invalidSymbols = ['123', 'TOOLONG', 'abc', '!@#', 'SYMBOL1'];
      
      for (const symbol of invalidSymbols) {
        const response = await request(app)
          .get(`/api/stocks/${symbol}`)
          .expect(400);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});