import { ConvergenceAnalysisDashboard } from "@/components/ConvergenceAnalysisDashboard";

export default function ConvergenceAnalysisPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Multi-Timeframe Technical Convergence Analysis
          </h1>
          <p className="text-slate-300 text-lg">
            Real-time signal detection across multiple timeframes with historical backtesting and probability scoring
          </p>
        </div>

        <ConvergenceAnalysisDashboard />
      </div>
    </div>
  );
}