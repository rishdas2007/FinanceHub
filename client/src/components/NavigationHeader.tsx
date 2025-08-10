import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Bell, 
  Settings, 
  Menu, 
  X 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MarketStatusIndicator, MarketStatusIndicatorCompact } from "./MarketStatusIndicator";

const navigationItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: BarChart3,
    description: "Overview and key metrics"
  },
  {
    name: "ETFs",
    href: "/etfs",
    icon: TrendingUp,
    description: "Deep technical analysis"
  },
  {
    name: "Economy",
    href: "/economy",
    icon: Activity,
    description: "Macro indicators focus"
  },
  {
    name: "Alerts",
    href: "/alerts",
    icon: Bell,
    description: "Notification management"
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    description: "User preferences"
  }
];

export function NavigationHeader() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <nav className="bg-financial-gray border-b border-financial-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-8 w-8 text-gain-green" />
                <div>
                  <h1 className="text-xl font-bold text-white">FinanceHub Pro</h1>
                  <p className="text-xs text-gray-400 hidden sm:block">Advanced Market Analytics</p>
                </div>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                
                return (
                  <Link key={item.name} href={item.href}>
                    <a
                      className={cn(
                        "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-gain-green/10 text-gain-green border border-gain-green/20"
                          : "text-gray-300 hover:text-white hover:bg-financial-card border border-transparent"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </a>
                  </Link>
                );
              })}
            </div>

            {/* Market Status and Mobile Menu */}
            <div className="flex items-center space-x-4">
              {/* Market Status - Desktop */}
              <div className="hidden md:block">
                <MarketStatusIndicator />
              </div>
              
              {/* Market Status - Mobile */}
              <div className="md:hidden">
                <MarketStatusIndicatorCompact />
              </div>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden text-gray-400 hover:text-white"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-financial-border bg-financial-dark">
            <div className="px-4 py-2 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                
                return (
                  <Link key={item.name} href={item.href}>
                    <a
                      className={cn(
                        "flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-gain-green/10 text-gain-green border border-gain-green/20"
                          : "text-gray-300 hover:text-white hover:bg-financial-card border border-transparent"
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon className="h-5 w-5" />
                      <div>
                        <div>{item.name}</div>
                        <div className="text-xs text-gray-400">{item.description}</div>
                      </div>
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}

// Quick scan metrics component with independent loading states
export function QuickScanMetrics() {
  const { data: topMovers, isLoading: topMoversLoading } = useQuery({ 
    queryKey: ['/api/top-movers'],
    staleTime: 30_000,
    refetchInterval: 60_000
  });
  const { data: economicHealth, isLoading: econLoading } = useQuery({ 
    queryKey: ['/api/economic-health/dashboard'],
    staleTime: 60_000,
    refetchInterval: 120_000
  });

  return (
    <div className="bg-gradient-to-r from-financial-card to-financial-gray border border-financial-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center">
          <Activity className="h-5 w-5 text-blue-400 mr-2" />
          5-Second Market Scan
        </h2>
        <div className="text-xs text-gray-400">
          Live • Updates every 30s
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Market Status - Independent loading */}
        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
          <span className="text-sm text-gray-300">Market</span>
          <MarketStatusIndicatorCompact />
        </div>
        
        {/* Top ETF Mover - Independent loading */}
        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
          <span className="text-sm text-gray-300">Top Mover</span>
          <div className="text-right">
            {topMovers?.etfMovers?.gainers?.[0] ? (
              <>
                <div className="text-sm font-medium text-white">{topMovers.etfMovers.gainers[0].symbol}</div>
                <div className={`text-xs ${topMovers.etfMovers.gainers[0].changePercent >= 0 ? 'text-gain-green' : 'text-loss-red'}`}>
                  {topMovers.etfMovers.gainers[0].changePercent >= 0 ? '+' : ''}{topMovers.etfMovers.gainers[0].changePercent?.toFixed(1)}%
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-gray-400">---</div>
                <div className="text-xs text-gray-500">Loading...</div>
              </>
            )}
          </div>
        </div>
        
        {/* Economic Health - Independent loading */}
        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
          <span className="text-sm text-gray-300">Econ Health</span>
          <div className="text-right">
            {economicHealth?.economicHealthScore ? (
              <>
                <div className="text-sm font-medium text-blue-400">{Math.round(economicHealth.economicHealthScore)}</div>
                <div className="text-xs text-gray-400">
                  {economicHealth.economicHealthScore >= 75 ? 'Strong' : 
                   economicHealth.economicHealthScore >= 50 ? 'Moderate' : 'Weak'}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-gray-400">--</div>
                <div className="text-xs text-gray-500">Loading...</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}