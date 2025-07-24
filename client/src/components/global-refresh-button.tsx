import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export function GlobalRefreshButton() {
  const queryClient = useQueryClient();
  const [refreshCount, setRefreshCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [isDisabled, setIsDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const refreshMutation = useMutation({
    mutationFn: async () => {
      // Refresh all dashboard components
      await Promise.all([
        apiRequest('POST', '/api/refresh'),
        // Invalidate specific caches for faster refresh
        fetch('/api/cache/invalidate?key=financial-mood'),
        fetch('/api/cache/invalidate?key=recent-economic-openai')
      ]);
    },
    onSuccess: () => {
      // Invalidate all queries to refresh all data
      queryClient.invalidateQueries({ queryKey: ['/api/financial-mood'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recent-economic-openai'] });
      queryClient.invalidateQueries({ queryKey: ['/api/momentum-analysis'] });
      
      setRefreshCount(prev => prev + 1);
      setLastRefresh(Date.now());
      
      // Disable for 30 seconds instead of 1 minute for better UX
      setIsDisabled(true);
      setCountdown(30);
    },
    onError: (error) => {
      console.error('Refresh failed:', error);
    }
  });

  useEffect(() => {
    // Check if user has exceeded 5 refreshes per session
    if (refreshCount >= 5) {
      setIsDisabled(true);
      return;
    }

    // Handle countdown timer
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isDisabled && countdown === 0 && refreshCount < 5) {
      setIsDisabled(false);
    }
  }, [countdown, refreshCount, isDisabled]);

  const handleRefresh = () => {
    if (isDisabled || refreshMutation.isPending) return;
    
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefresh;
    
    // Prevent refresh if less than 30 seconds has passed
    if (timeSinceLastRefresh < 30000 && lastRefresh > 0) {
      return;
    }
    
    refreshMutation.mutate();
  };

  const getButtonText = () => {
    if (refreshMutation.isPending) return "Refreshing...";
    if (refreshCount >= 5) return "Session Limit Reached";
    if (countdown > 0) return `Refresh (${countdown}s)`;
    return "Refresh All Data";
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        onClick={handleRefresh}
        disabled={isDisabled || refreshMutation.isPending}
        variant="outline"
        size="sm"
        className="bg-financial-card hover:bg-financial-border text-white border-financial-border text-xs"
      >
        <RefreshCw className={`w-3 h-3 mr-1 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
        {getButtonText()}
      </Button>
      
      {refreshCount > 0 && (
        <div className="text-xs text-gray-400">
          {refreshCount}/5 refreshes used
        </div>
      )}
    </div>
  );
}