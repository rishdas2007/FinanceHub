import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { ConvergenceAnalysis } from '@/components/ConvergenceAnalysis';

export function ConvergenceAnalysisPage() {
  return (
    <div className="min-h-screen bg-financial-dark text-gray-100">
      {/* Header */}
      <header className="bg-financial-gray border-b border-financial-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link 
              href="/" 
              className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
              data-testid="back-to-dashboard"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Dashboard
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center">
                <TrendingUp className="text-gain-green mr-2" />
                Multi-Timeframe Convergence Analysis
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Real-time technical indicator convergence signals across major market indices
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span className="w-2 h-2 bg-gain-green rounded-full animate-pulse"></span>
            <span>Live Technical Analysis</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        <ConvergenceAnalysis />
      </div>
    </div>
  );
}

export default ConvergenceAnalysisPage;