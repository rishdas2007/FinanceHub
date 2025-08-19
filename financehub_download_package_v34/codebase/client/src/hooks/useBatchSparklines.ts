import { useQuery } from '@tanstack/react-query';

interface SparklineData {
  t: number;
  date: string;
  value: number;
}

interface BatchSparklinesResponse {
  success: boolean;
  data: Record<string, SparklineData[]>;
  cached: boolean;
}

export function useBatchSparklines(seriesIds: string[], months = 12, transform = 'YOY') {
  return useQuery<BatchSparklinesResponse>({
    queryKey: ['sparklines-batch', seriesIds.sort().join(','), months, transform],
    queryFn: async () => {
      const response = await fetch('/api/econ/sparklines/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesIds,
          months,
          transform
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch batch sparklines: ${response.status}`);
      }
      
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: seriesIds.length > 0,
    retry: 2
  });
}

export function useSparklineData(seriesId: string, batchData?: Record<string, SparklineData[]>) {
  if (batchData && batchData[seriesId]) {
    return {
      data: batchData[seriesId],
      isLoading: false,
      error: null
    };
  }
  
  return {
    data: [],
    isLoading: !batchData,
    error: batchData ? new Error(`No data for series ${seriesId}`) : null
  };
}