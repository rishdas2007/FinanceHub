import { useQuery } from "@tanstack/react-query";
import { Clock, CircleDot, Moon, Sun, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMarketTime, getUserTimezone } from "@/utils/timezone";

interface MarketStatus {
  isOpen: boolean;
  isPremarket: boolean;
  isAfterHours: boolean;
  nextOpen: string;
  nextClose: string;
  session: 'open' | 'closed' | 'premarket' | 'afterhours';
}

interface MarketStatusResponse {
  success: boolean;
  marketStatus?: MarketStatus; // Legacy field  
  status?: MarketStatus; // New field from API
}

export function MarketStatusIndicator() {
  const { data: marketData, isLoading } = useQuery<MarketStatusResponse>({
    queryKey: ['/api/market-status'],
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 25000, // Consider data stale after 25 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-400">
        <span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></span>
        <span>Checking...</span>
      </div>
    );
  }

  // Handle timeout or error gracefully
  if (!marketData?.success || (!marketData?.status && !marketData?.marketStatus)) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
        <Calendar className="h-4 w-4 text-gray-400" />
        <span className="font-medium text-gray-400">Unknown</span>
        <span className="text-gray-400">•</span>
        <span className="text-gray-300 text-xs">Status unavailable</span>
      </div>
    );
  }

  // Handle both response formats (marketStatus or status)
  const marketStatus = marketData?.marketStatus || marketData?.status;
  
  const getStatusConfig = () => {
    const userTz = getUserTimezone();
    
    switch (marketStatus?.session) {
      case 'open':
        return {
          color: 'bg-gain-green',
          textColor: 'text-gain-green',
          icon: CircleDot,
          label: 'Market Open',
          description: `Closes: ${formatMarketTime(marketStatus?.nextClose || null, userTz)}`
        };
      case 'premarket':
        return {
          color: 'bg-blue-500',
          textColor: 'text-blue-400',
          icon: Sun,
          label: 'Pre-Market',
          description: `Opens: ${formatMarketTime(marketStatus?.nextOpen || null, userTz)}`
        };
      case 'afterhours':
        return {
          color: 'bg-yellow-500',
          textColor: 'text-yellow-400',
          icon: Moon,
          label: 'After Hours',
          description: `Next open: ${formatMarketTime(marketStatus?.nextOpen || null, userTz)}`
        };
      default:
        return {
          color: 'bg-loss-red',
          textColor: 'text-loss-red',
          icon: Calendar,
          label: 'Market Closed',
          description: `Next open: ${formatMarketTime(marketStatus?.nextOpen || null, userTz)}`
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className="flex items-center space-x-2">
        <span className={cn("w-2 h-2 rounded-full", config.color, marketStatus?.isOpen && "animate-pulse")}></span>
        <IconComponent className={cn("h-4 w-4", config.textColor)} />
        <span className={cn("font-medium", config.textColor)}>{config.label}</span>
      </div>
      <span className="text-gray-400">•</span>
      <span className="text-gray-300 text-xs">{config.description}</span>
    </div>
  );
}

// Compact version for mobile
export function MarketStatusIndicatorCompact() {
  const { data: marketData, isLoading } = useQuery<MarketStatusResponse>({
    queryKey: ['/api/market-status'],
    refetchInterval: 30000,
    staleTime: 25000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></span>
        <span className="text-xs text-gray-400">Checking...</span>
      </div>
    );
  }

  // Handle timeout or error gracefully
  if (!marketData?.success || (!marketData?.status && !marketData?.marketStatus)) {
    return (
      <div className="flex items-center space-x-2">
        <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
        <span className="text-xs font-medium text-gray-400">UNKNOWN</span>
      </div>
    );
  }

  // Handle both response formats (marketStatus or status)
  const marketStatus = marketData?.marketStatus || marketData?.status;
  
  const getCompactConfig = () => {
    switch (marketStatus?.session) {
      case 'open':
        return { color: 'bg-gain-green', label: 'OPEN', textColor: 'text-gain-green' };
      case 'premarket':
        return { color: 'bg-blue-500', label: 'PRE', textColor: 'text-blue-400' };
      case 'afterhours':
        return { color: 'bg-yellow-500', label: 'AH', textColor: 'text-yellow-400' };
      default:
        return { color: 'bg-loss-red', label: 'CLOSED', textColor: 'text-loss-red' };
    }
  };

  const config = getCompactConfig();

  return (
    <div className="flex items-center space-x-2">
      <span className={cn("w-2 h-2 rounded-full", config.color, marketStatus?.isOpen && "animate-pulse")}></span>
      <span className={cn("text-xs font-medium", config.textColor)}>{config.label}</span>
    </div>
  );
}