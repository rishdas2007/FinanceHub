import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';

describe('ETF API Endpoints Integration Tests', () => {
  let server: any;
  
  beforeAll(async () => {
    // Start the server for testing
    server = app.listen(0); // Use random port for testing
  });
  
  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('ETF Technical Endpoints', () => {
    it('should return valid z-scores in technical-clean endpoint', async () => {
      const response = await request(app)
        .get('/api/etf/technical-clean')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      const etfData = response.body.data;
      
      // Validate each ETF has required fields
      etfData.forEach((etf: any) => {
        expect(etf).toHaveProperty('symbol');
        expect(etf).toHaveProperty('price');
        expect(etf).toHaveProperty('rsi');
        
        // Validate Z-scores are within reasonable bounds
        if (etf.rsiZScore !== null) {
          expect(Math.abs(etf.rsiZScore)).toBeLessThan(10); // No extreme z-scores
          expect(Number.isFinite(etf.rsiZScore)).toBe(true);
        }
        
        if (etf.macdZScore !== null) {
          expect(Math.abs(etf.macdZScore)).toBeLessThan(10);
          expect(Number.isFinite(etf.macdZScore)).toBe(true);
        }
        
        if (etf.percentBZScore !== null) {
          expect(Math.abs(etf.percentBZScore)).toBeLessThan(10);
          expect(Number.isFinite(etf.percentBZScore)).toBe(true);
        }
        
        // Validate RSI is within valid range
        if (etf.rsi !== null) {
          expect(etf.rsi).toBeGreaterThanOrEqual(0);
          expect(etf.rsi).toBeLessThanOrEqual(100);
        }
        
        // Validate %B is within valid range
        if (etf.bollingerPercentB !== null) {
          expect(etf.bollingerPercentB).toBeGreaterThanOrEqual(0);
          expect(etf.bollingerPercentB).toBeLessThanOrEqual(1);
        }
      });
    }, 30000); // Longer timeout for API calls
    
    it('should return market status information', async () => {
      const response = await request(app)
        .get('/api/market-status')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status');
      
      const status = response.body.status;
      expect(status).toHaveProperty('isOpen');
      expect(status).toHaveProperty('session');
      expect(typeof status.isOpen).toBe('boolean');
    });
    
    it('should return economic health dashboard data', async () => {
      const response = await request(app)
        .get('/api/economic-health/dashboard')
        .expect(200);
      
      expect(response.body).toHaveProperty('economicHealthScore');
      expect(response.body).toHaveProperty('confidence');
      
      // Validate score is within expected range
      if (response.body.economicHealthScore !== null) {
        expect(response.body.economicHealthScore).toBeGreaterThanOrEqual(0);
        expect(response.body.economicHealthScore).toBeLessThanOrEqual(100);
      }
    });
    
    it('should handle invalid endpoints gracefully', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });
    
    it('should validate API response structure', async () => {
      const response = await request(app)
        .get('/api/etf/technical-clean')
        .expect(200);
      
      // Check response structure
      expect(response.body).toMatchObject({
        success: expect.any(Boolean),
        data: expect.any(Array)
      });
      
      // Check data structure for first ETF
      if (response.body.data.length > 0) {
        const firstEtf = response.body.data[0];
        expect(firstEtf).toMatchObject({
          symbol: expect.any(String),
          name: expect.any(String),
          price: expect.any(Number)
        });
      }
    });
  });

  describe('Performance Tests', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/market-status')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });
    
    it('should handle concurrent requests', async () => {
      const promises = Array(5).fill(null).map(() => 
        request(app)
          .get('/api/market-status')
          .expect(200)
      );
      
      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      // This test would need to mock a service failure
      // For now, we'll test that the endpoint exists and handles requests
      const response = await request(app)
        .get('/api/etf/technical-clean')
        .timeout(35000); // Allow time for API calls
      
      // Should either succeed or fail gracefully
      expect([200, 500, 503]).toContain(response.status);
      
      if (response.status !== 200) {
        expect(response.body).toHaveProperty('error');
      }
    });
    
    it('should validate request parameters', async () => {
      // Test with invalid parameters if endpoint supports them
      const response = await request(app)
        .get('/api/market-status?invalid=parameter')
        .expect(200); // Should ignore invalid parameters
      
      expect(response.body.success).toBe(true);
    });
  });

  describe('Data Quality Validation', () => {
    it('should not return corrupted z-score data', async () => {
      const response = await request(app)
        .get('/api/etf/technical-clean')
        .expect(200);
      
      const etfData = response.body.data;
      
      // Check that we don't have the corruption patterns that caused -13.84 Z-scores
      etfData.forEach((etf: any) => {
        if (etf.rsiZScore !== null) {
          // Should not have extreme impossible values
          expect(etf.rsiZScore).toBeGreaterThan(-10);
          expect(etf.rsiZScore).toBeLessThan(10);
          
          // Should not be NaN or infinite
          expect(Number.isFinite(etf.rsiZScore)).toBe(true);
        }
      });
    });
    
    it('should maintain data consistency across multiple calls', async () => {
      // Make two calls close together
      const [response1, response2] = await Promise.all([
        request(app).get('/api/market-status'),
        request(app).get('/api/market-status')
      ]);
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // Market status should be consistent
      expect(response1.body.status.isOpen).toBe(response2.body.status.isOpen);
    });
  });
});