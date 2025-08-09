import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerHealthRoutes } from '../../../server/routes/health';

describe('Health API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    registerHealthRoutes(app);
  });

  describe('GET /ping', () => {
    it('should return basic ping response', async () => {
      const response = await request(app)
        .get('/ping')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
    });
  });

  describe('GET /live', () => {
    it('should return liveness probe response', async () => {
      const response = await request(app)
        .get('/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
    });
  });

  describe('GET /health', () => {
    it('should return comprehensive health status', async () => {
      const response = await request(app)
        .get('/health');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      
      if (response.body.success) {
        const healthData = response.body.data;
        expect(healthData).toHaveProperty('overall');
        expect(healthData).toHaveProperty('database');
        expect(healthData).toHaveProperty('external_apis');
        expect(healthData).toHaveProperty('memory');
        expect(healthData).toHaveProperty('uptime');
        expect(healthData).toHaveProperty('version');
        
        expect(['healthy', 'degraded', 'unhealthy']).toContain(healthData.overall);
      }
    });
  });
});