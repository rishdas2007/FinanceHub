import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock FredService class for testing
class FredService {
  async getSeriesData(seriesId: string) {
    const response = await fetch(`/api/fred/${seriesId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${seriesId}`);
    }
    return response.json();
  }

  parseIndicatorValue(value: string): number | null {
    if (!value || value === '.' || value === 'N/A' || value === '') {
      return null;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  formatIndicatorValue(value: number | null, seriesId: string): string {
    if (value === null) return 'N/A';
    
    // Format based on typical values for different indicators
    if (seriesId === 'PAYEMS') {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(2);
  }
}

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('FredService', () => {
  let fredService: FredService;

  beforeEach(() => {
    vi.clearAllMocks();
    fredService = new FredService();
  });

  describe('getSeriesData', () => {
    it('should fetch economic indicator data successfully', async () => {
      const mockResponse = {
        observations: [
          {
            date: '2025-06-01',
            value: '321.5',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fredService.getSeriesData('CPIAUCSL');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('CPIAUCSL'),
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(fredService.getSeriesData('INVALID')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fredService.getSeriesData('CPIAUCSL')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('parseIndicatorValue', () => {
    it('should parse numeric values correctly', () => {
      expect(fredService.parseIndicatorValue('321.5')).toBe(321.5);
      expect(fredService.parseIndicatorValue('4.1')).toBe(4.1);
    });

    it('should handle invalid values', () => {
      expect(fredService.parseIndicatorValue('.')).toBeNull();
      expect(fredService.parseIndicatorValue('')).toBeNull();
      expect(fredService.parseIndicatorValue('N/A')).toBeNull();
    });
  });

  describe('formatIndicatorValue', () => {
    it('should format values based on indicator type', () => {
      expect(fredService.formatIndicatorValue(321.5, 'CPIAUCSL')).toBe('321.50');
      expect(fredService.formatIndicatorValue(4.1, 'UNRATE')).toBe('4.10');
      expect(fredService.formatIndicatorValue(159700, 'PAYEMS')).toBe('159.7K');
    });

    it('should handle null values', () => {
      expect(fredService.formatIndicatorValue(null, 'CPIAUCSL')).toBe('N/A');
    });
  });
});