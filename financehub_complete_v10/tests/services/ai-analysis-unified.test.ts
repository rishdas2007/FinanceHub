/**
 * AI Analysis Unified Service Test Suite
 * Comprehensive tests for AI-powered market analysis functionality
 * 
 * @author AI Agent Test Enhancement
 * @version 1.0.0
 * @since 2025-07-25
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AIAnalysisService } from '../../server/services/ai-analysis-unified';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    }))
  };
});

describe('AIAnalysisService', () => {
  let aiService: AIAnalysisService;
  let mockOpenAI: any;

  beforeEach(() => {
    // Reset singleton instance for clean testing
    (AIAnalysisService as any).instance = undefined;
    aiService = AIAnalysisService.getInstance();
    
    // Get the mock OpenAI instance
    mockOpenAI = (aiService as any).openai;
    
    // Mock timers for cache testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Singleton Implementation', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = AIAnalysisService.getInstance();
      const instance2 = AIAnalysisService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = AIAnalysisService.getInstance();
      // Cache something to test state persistence
      (instance1 as any).setCache('test-key', { data: 'test' }, 60000);
      
      const instance2 = AIAnalysisService.getInstance();
      const cached = (instance2 as any).getCached('test-key');
      
      expect(cached).toEqual({ data: 'test' });
    });
  });

  describe('Cache Management', () => {
    it('should cache analysis results correctly', () => {
      const testData = { analysis: 'test result' };
      const ttl = 60000;
      
      (aiService as any).setCache('test-analysis', testData, ttl);
      const cached = (aiService as any).getCached('test-analysis');
      
      expect(cached).toEqual(testData);
    });

    it('should return null for expired cache entries', () => {
      const testData = { analysis: 'test result' };
      const shortTTL = 1000;
      
      (aiService as any).setCache('expiring-analysis', testData, shortTTL);
      
      // Advance time beyond TTL
      vi.advanceTimersByTime(1500);
      
      const cached = (aiService as any).getCached('expiring-analysis');
      expect(cached).toBeNull();
    });

    it('should handle cache hits and misses', () => {
      // Cache miss
      const missed = (aiService as any).getCached('non-existent');
      expect(missed).toBeNull();
      
      // Cache hit
      (aiService as any).setCache('existing', { data: 'exists' }, 60000);
      const hit = (aiService as any).getCached('existing');
      expect(hit).toEqual({ data: 'exists' });
    });
  });

  describe('Standard Analysis', () => {
    const mockAnalysisInput = {
      stockData: { SPY: { price: '428.50', change: '+1.25' } },
      sentiment: { bullish: 45, bearish: 30, neutral: 25 },
      technical: { rsi: 65, macd: 0.5 },
      sectors: [
        { name: 'Technology', performance: '2.1%' },
        { name: 'Healthcare', performance: '-0.8%' }
      ],
      economicEvents: [
        { event: 'CPI Report', impact: 'High' },
        { event: 'Fed Meeting', impact: 'High' }
      ]
    };

    it('should generate standard analysis with all components', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'Market shows bullish momentum',
              technicalAnalysis: 'RSI at 65 indicates strength',
              economicAnalysis: 'CPI data supportive',
              sectorAnalysis: 'Tech leading gains',
              marketSetup: 'Bullish bias continues',
              keyLevels: ['430 resistance', '425 support'],
              riskFactors: ['Fed policy uncertainty'],
              timeframe: '1-2 weeks',
              confidence: 85
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const analysis = await aiService.generateStandardAnalysis(mockAnalysisInput);

      expect(analysis).toBeDefined();
      expect(analysis.summary).toBe('Market shows bullish momentum');
      expect(analysis.confidence).toBe(85);
      expect(analysis.keyLevels).toContain('430 resistance');
      expect(analysis.timestamp).toBeDefined();
    });

    it('should handle OpenAI API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const analysis = await aiService.generateStandardAnalysis(mockAnalysisInput);

      expect(analysis).toBeDefined();
      expect(analysis.summary).toContain('analysis temporarily unavailable');
      expect(analysis.confidence).toBe(0);
    });

    it('should use cached results when available', async () => {
      const cachedAnalysis = {
        summary: 'Cached analysis',
        confidence: 90,
        timestamp: new Date().toISOString()
      };

      // Set up cache
      (aiService as any).setCache('standard-analysis', cachedAnalysis, 60000);

      const analysis = await aiService.generateStandardAnalysis(mockAnalysisInput);

      expect(analysis.summary).toBe('Cached analysis');
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should handle malformed OpenAI responses', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const analysis = await aiService.generateStandardAnalysis(mockAnalysisInput);

      expect(analysis).toBeDefined();
      expect(analysis.summary).toContain('analysis temporarily unavailable');
    });
  });

  describe('Thematic Analysis', () => {
    const mockInput = {
      sectors: [
        { name: 'Technology', performance: '3.2%' },
        { name: 'Energy', performance: '-1.5%' }
      ],
      economicEvents: [
        { event: 'GDP Growth', impact: 'Medium' }
      ]
    };

    it('should generate thematic analysis correctly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              bottomLine: 'Tech rotation continues',
              dominantTheme: 'Growth over value',
              setup: 'Momentum favors tech',
              evidence: 'Strong earnings, low rates',
              implications: 'Continue tech overweight',
              confidence: 80
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const analysis = await aiService.generateThematicAnalysis(mockInput);

      expect(analysis).toBeDefined();
      expect(analysis.bottomLine).toBe('Tech rotation continues');
      expect(analysis.dominantTheme).toBe('Growth over value');
      expect(analysis.confidence).toBe(80);
    });

    it('should provide fallback thematic analysis on API failure', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const analysis = await aiService.generateThematicAnalysis(mockInput);

      expect(analysis).toBeDefined();
      expect(analysis.bottomLine).toContain('Market analysis temporarily unavailable');
      expect(analysis.confidence).toBe(0);
    });
  });

  describe('Quick Summary Generation', () => {
    it('should generate analysis with valid input types', async () => {
      const mockData = {
        stockData: { SPY: { price: '428.50', change: '+1.25' } },
        sectors: [{ name: 'Technology', performance: '2.1%' }]
      };

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({ summary: 'Markets showing strength' })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const analysis = await aiService.generateStandardAnalysis(mockData);

      expect(analysis.summary).toBe('Markets showing strength');
    });

    it('should handle analysis API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const analysis = await aiService.generateStandardAnalysis({ 
        stockData: { SPY: { price: '428.50' } }
      });

      expect(analysis.summary).toContain('analysis temporarily unavailable');
    });
  });

  describe('Prompt Engineering', () => {
    it('should format prompts correctly for standard analysis', async () => {
      const input = {
        stockData: { SPY: { price: '428.50' } },
        sentiment: { bullish: 50 }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{}' } }]
      });

      await aiService.generateStandardAnalysis(input);

      const call = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(call.messages).toBeDefined();
      expect(call.messages[0].role).toBe('system');
      expect(call.temperature).toBeDefined();
      expect(call.max_tokens).toBeDefined();
    });

    it('should use appropriate temperature settings', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{}' } }]
      });

      await aiService.generateStandardAnalysis({});

      const call = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(call.temperature).toBeGreaterThanOrEqual(0);
      expect(call.temperature).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      
      mockOpenAI.chat.completions.create.mockRejectedValue(timeoutError);

      const analysis = await aiService.generateStandardAnalysis({});

      expect(analysis).toBeDefined();
      expect(analysis.confidence).toBe(0);
    });

    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      
      mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError);

      const analysis = await aiService.generateStandardAnalysis({});

      expect(analysis).toBeDefined();
      expect(analysis.summary).toContain('temporarily unavailable');
    });

    it('should handle empty or null responses', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: []
      });

      const analysis = await aiService.generateStandardAnalysis({});

      expect(analysis).toBeDefined();
      expect(analysis.summary).toContain('analysis temporarily unavailable');
    });
  });

  describe('Performance and Optimization', () => {
    it('should respect cache TTL for performance', () => {
      const shortTTL = 1000;
      const testData = { cached: true };
      
      (aiService as any).setCache('perf-test', testData, shortTTL);
      
      // Should be cached
      expect((aiService as any).getCached('perf-test')).toEqual(testData);
      
      // Advance time
      vi.advanceTimersByTime(500);
      expect((aiService as any).getCached('perf-test')).toEqual(testData);
      
      // Should expire
      vi.advanceTimersByTime(600);
      expect((aiService as any).getCached('perf-test')).toBeNull();
    });

    it('should limit API call frequency through caching', async () => {
      const mockResponse = {
        choices: [{ message: { content: '{"summary": "test"}' } }]
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      // Make multiple calls with same input
      const testInput = { stockData: { SPY: { price: '428.50' } } };
      await aiService.generateStandardAnalysis(testInput);
      await aiService.generateStandardAnalysis(testInput);
      await aiService.generateStandardAnalysis(testInput);

      // Should only call OpenAI once due to caching
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input gracefully', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{}' } }]
      });

      const analysis = await aiService.generateStandardAnalysis({});

      expect(analysis).toBeDefined();
      expect(typeof analysis.summary).toBe('string');
    });

    it('should handle null and undefined inputs', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{}' } }]
      });

      const analysisNull = await aiService.generateStandardAnalysis(null as any);
      const analysisUndefined = await aiService.generateStandardAnalysis(undefined as any);

      expect(analysisNull).toBeDefined();
      expect(analysisUndefined).toBeDefined();
    });

    it('should handle very large input data', async () => {
      const largeInput = {
        sectors: Array(1000).fill({ name: 'Test', performance: '1%' }),
        economicEvents: Array(500).fill({ event: 'Test Event', impact: 'Low' })
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{"summary": "large data processed"}' } }]
      });

      const analysis = await aiService.generateStandardAnalysis(largeInput);

      expect(analysis).toBeDefined();
      expect(analysis.summary).toBeDefined();
    });
  });
});