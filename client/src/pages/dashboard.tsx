

import MomentumAnalysis from "@/components/momentum-analysis";
import { SPYBaseline } from "@/components/SPYBaseline";
import MacroeconomicIndicators from "@/components/MacroeconomicIndicators";
import { AIEconomicAnalysis } from "@/components/AIEconomicAnalysis";
import { StatisticalAlertSystem } from "@/components/StatisticalAlertSystem";
import { EconomicPulseCheck } from "@/components/EconomicPulseCheck";
import { BreakoutAnalysis } from "@/components/BreakoutAnalysis";

import { MoodDataSources } from "@/components/MoodDataSources";
import { AAIISentiment } from "@/components/aaii-sentiment";
import { GlobalRefreshButton } from "@/components/global-refresh-button";




import { TrendingUp, MessageSquare } from "lucide-react";
import { useApiTracker } from "@/hooks/useApiTracker";

export default function Dashboard() {
  const apiTracker = useApiTracker();
  
  return (
    <div className="min-h-screen bg-financial-dark text-gray-100">
      {/* Header */}
      <header className="bg-financial-gray border-b border-financial-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center">
                <TrendingUp className="text-gain-green mr-2" />
                Rishabh's Market Dashboard
              </h1>
              <a 
                href="https://rishabhdas.substack.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline transition-colors text-sm mt-1 block"
              >
                Follow my market insights on Substack
              </a>
            </div>
            <div className="hidden md:flex items-center space-x-2 text-sm text-gray-400">
              <span className="w-2 h-2 bg-gain-green rounded-full animate-pulse"></span>
              <span>Connected - Live Market Data</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <a 
              href="/data-quality" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Data Quality Pipeline
            </a>
            <a 
              href="/convergence-analysis" 
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg"
              data-testid="convergence-analysis-link"
            >
              📊 Convergence Analysis
            </a>
            <GlobalRefreshButton />
            <div className="bg-financial-card rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-gain-green rounded-full animate-pulse"></span>
                <span className="text-gray-300">Twelve Data API</span>
              </div>
              <div className="text-xs text-gray-400 mt-1 space-y-1">
                <div>Avg: <span id="api-calls-avg">21</span>/min</div>
                <div>Max: <span id="api-calls-max">106</span>/min</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-6">

        {/* Technical Analysis - moved to top */}
        <MoodDataSources />

        {/* Breakout Analysis - Real-time squeeze and breakout monitoring */}
        <BreakoutAnalysis />

        {/* Economic Analysis - 2x5 grid above Momentum Analysis */}
        <EconomicPulseCheck />

        {/* Simplified Momentum Analysis with Verified Calculations */}
        <MomentumAnalysis />

        {/* Macroeconomic Indicators Module - now includes AI Economic Analysis */}
        <MacroeconomicIndicators />




      </div>

      {/* Footer */}
      <footer className="bg-financial-gray border-t border-financial-border mt-12 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <h3 className="text-white font-semibold mb-3">Data Sources</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <div><a href="https://www.twelvedata.com/" target="_blank" rel="noopener noreferrer" className="hover:text-gain-green">Twelve Data API</a></div>
                <div><a href="https://openai.com/" target="_blank" rel="noopener noreferrer" className="hover:text-gain-green">OpenAI GPT-4o</a></div>
                <div><a href="https://www.aaii.com/sentimentsurvey" target="_blank" rel="noopener noreferrer" className="hover:text-gain-green">AAII Sentiment Survey</a></div>
                <div><a href="https://www.cboe.com/tradable_products/vix/" target="_blank" rel="noopener noreferrer" className="hover:text-gain-green">CBOE VIX Index</a></div>
                <div><a href="https://www.marketwatch.com/economy-politics/calendar" target="_blank" rel="noopener noreferrer" className="hover:text-gain-green">MarketWatch Economic Calendar</a></div>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-3">Market Status</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gain-green rounded-full mr-2"></span>
                  API Status: Active
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gain-green rounded-full mr-2"></span>
                  WebSocket: Connected
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-3">Disclaimer</h3>
              <p className="text-xs text-gray-400">
                This dashboard is for informational purposes only. Not financial advice. 
                Past performance does not guarantee future results.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-3">Last Updated</h3>
              <p className="text-sm text-gray-400">
                {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
