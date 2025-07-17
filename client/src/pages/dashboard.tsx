

import { AIAnalysisComponent } from "@/components/ai-analysis";
import { MarketBreadth } from "@/components/market-breadth";
import { SectorTracker } from "@/components/sector-tracker";
import { AAIISentiment } from "@/components/aaii-sentiment";
import { MarketHeatMap } from "@/components/market-heatmap";
import { EconomicCalendar } from "@/components/economic-calendar";

import { TrendingUp, Settings, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-financial-dark text-gray-100">
      {/* Header */}
      <header className="bg-financial-gray border-b border-financial-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-white flex items-center">
              <TrendingUp className="text-gain-green mr-2" />
              FinanceHub Pro
            </h1>
            <div className="hidden md:flex items-center space-x-2 text-sm text-gray-400">
              <span className="w-2 h-2 bg-gain-green rounded-full animate-pulse"></span>
              <span>Connected - Live Market Data</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" className="bg-financial-card hover:bg-financial-border text-white border-financial-border">
              <Bell className="w-4 h-4 mr-2" />
              Alerts
            </Button>
            <Button size="sm" className="bg-gain-green hover:bg-green-600 text-white">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-6">


        {/* AI Market Commentary - Full Width */}
        <AIAnalysisComponent />

        {/* Market Breadth Indicators */}
        <MarketBreadth />

        {/* Sector Performance Section */}
        <SectorTracker />



        {/* Economic Calendar - Full Width */}
        <EconomicCalendar />
      </div>

      {/* Footer */}
      <footer className="bg-financial-gray border-t border-financial-border mt-12 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <h3 className="text-white font-semibold mb-3">Data Sources</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <div>Alpha Vantage API</div>
                <div>AAII Sentiment Survey</div>
                <div>CBOE VIX</div>
                <div>Real-time WebSocket</div>
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
