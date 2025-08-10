import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  rows?: number;
  variant?: 'card' | 'table' | 'chart' | 'list';
}

export function LoadingSkeleton({ 
  className = "", 
  rows = 3, 
  variant = 'card' 
}: LoadingSkeletonProps) {
  
  if (variant === 'card') {
    return (
      <div className={cn("bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-6", className)}>
        <div className="space-y-3">
          <div className="h-6 bg-gray-800 rounded w-1/3 animate-pulse" />
          <div className="h-4 bg-gray-800 rounded w-full animate-pulse" />
          <div className="h-4 bg-gray-800 rounded w-2/3 animate-pulse" />
          {Array.from({ length: rows - 3 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-800 rounded animate-pulse" 
                 style={{ width: `${60 + Math.random() * 30}%` }} />
          ))}
        </div>
      </div>
    );
  }
  
  if (variant === 'table') {
    return (
      <div className={cn("bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700", className)}>
        <div className="p-6">
          <div className="h-6 bg-gray-800 rounded w-1/4 animate-pulse mb-4" />
          <div className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="h-4 bg-gray-800 rounded animate-pulse w-1/4" />
                <div className="h-4 bg-gray-800 rounded animate-pulse w-1/6" />
                <div className="h-4 bg-gray-800 rounded animate-pulse w-1/6" />
                <div className="h-4 bg-gray-800 rounded animate-pulse w-1/4" />
                <div className="h-4 bg-gray-800 rounded animate-pulse w-1/6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (variant === 'chart') {
    return (
      <div className={cn("bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-6", className)}>
        <div className="h-6 bg-gray-800 rounded w-1/3 animate-pulse mb-4" />
        <div className="h-64 bg-gray-800 rounded animate-pulse mb-4" />
        <div className="flex justify-between">
          <div className="h-4 bg-gray-800 rounded w-20 animate-pulse" />
          <div className="h-4 bg-gray-800 rounded w-20 animate-pulse" />
          <div className="h-4 bg-gray-800 rounded w-20 animate-pulse" />
        </div>
      </div>
    );
  }
  
  if (variant === 'list') {
    return (
      <div className={cn("bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-6", className)}>
        <div className="space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gray-800 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-gray-800 rounded w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return null;
}