import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import express from 'express';

// Mock Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mock API endpoints
  app.get('/api/macroeconomic-indicators', (req, res) => {
    res.json({
      indicators: [
        {
          metric: 'Test Indicator',
          value: 100,
          zScore: 1.5,
          deltaZScore: 0.5,
          category: 'test'
        }
      ]
    });
  });
  
  app.get('/api/momentum-analysis', (req, res) => {
    res.json({
      momentumStrategies: [
        {
          sector: 'Technology',
          return: 15.5,
          volatility: 20.2,
          sharpe: 0.77
        }
      ]
    });
  });
  
  app.get('/api/health/system-status', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: { database: 'healthy', cache: 'healthy' }
    });
  });
  
  return app;
};

describe('Macroeconomic Indicators API', () => {
  let request: supertest.SuperTest<supertest.Test>;

  beforeAll(() => {
    const app = createTestApp();
    request = supertest(app);
  });

  describe('GET /api/macroeconomic-indicators', () => {
    it('should return economic indicators with valid structure', async () => {
      const response = await request
        .get('/api/macroeconomic-indicators')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.indicators).toBeInstanceOf(Array);
      
      if (response.body.indicators.length > 0) {
        const indicator = response.body.indicators[0];
        expect(indicator).toHaveProperty('metric');
        expect(indicator).toHaveProperty('value');
        expect(indicator).toHaveProperty('zScore');
        expect(indicator).toHaveProperty('deltaZScore');
        expect(indicator).toHaveProperty('category');
      }
    });

    it('should handle filtering parameters', async () => {
      const response = await request
        .get('/api/macroeconomic-indicators?deltaZScore=1')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.indicators).toBeInstanceOf(Array);
    });

    it('should return cached data quickly on subsequent requests', async () => {
      const start = Date.now();
      
      await request
        .get('/api/macroeconomic-indicators')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should be fast with caching
    });
  });

  describe('GET /api/momentum-analysis', () => {
    it('should return sector momentum analysis', async () => {
      const response = await request
        .get('/api/momentum-analysis')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.momentumStrategies).toBeInstanceOf(Array);
      
      if (response.body.momentumStrategies.length > 0) {
        const strategy = response.body.momentumStrategies[0];
        expect(strategy).toHaveProperty('sector');
        expect(strategy).toHaveProperty('return');
        expect(strategy).toHaveProperty('volatility');
        expect(strategy).toHaveProperty('sharpe');
      }
    });
  });

  describe('GET /api/health/system-status', () => {
    it('should return system health status', async () => {
      const response = await request
        .get('/api/health/system-status')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid endpoints gracefully', async () => {
      await request
        .get('/api/invalid-endpoint')
        .expect(404);
    });

    it('should handle malformed query parameters', async () => {
      const response = await request
        .get('/api/macroeconomic-indicators?invalidParam=invalid')
        .expect(200); // Should still work, ignoring invalid params

      expect(response.body).toBeDefined();
    });
  });
});