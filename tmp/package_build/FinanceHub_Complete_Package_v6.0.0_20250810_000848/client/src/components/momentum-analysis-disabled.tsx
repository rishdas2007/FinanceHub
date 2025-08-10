import { AlertTriangle } from 'lucide-react';

const MomentumAnalysis = () => {
  return (
    <div className="bg-gray-900/95 backdrop-blur rounded-lg border border-yellow-500/20 p-6">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="h-6 w-6 text-yellow-400" />
        <h3 className="text-xl font-semibold text-yellow-400">Momentum Analysis Temporarily Disabled</h3>
      </div>
      <div className="space-y-3">
        <p className="text-gray-300">
          The momentum strategies table has been temporarily removed to preserve API quota for core functionality.
        </p>
        <p className="text-gray-400 text-sm">
          This table was consuming excessive API calls for 1-day, 5-day, and 1-month percentage changes, 
          which was causing rate limit issues and potentially corrupted data.
        </p>
        <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg">
          <p className="text-blue-300 text-sm">
            <strong>Core features still available:</strong> ETF metrics, technical indicators, economic health score, 
            and sector analysis continue to work with authentic data.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MomentumAnalysis;