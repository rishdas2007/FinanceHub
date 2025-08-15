import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Building2, TrendingUp, TrendingDown, AlertCircle, Target, Info } from 'lucide-react';

interface SectorImpact {
  sector: string;
  expectedReturn: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  historicalAccuracy: number;
  impactCoefficient: number;
  sampleSize: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface EconomicIndicatorImpact {
  indicator: string;
  indicatorChange: number;
  changeDescription: string;
  sectorImpacts: SectorImpact[];
  overallMarketImpact: number;
  analysisConfidence: number;
}

interface SectorOpportunity {
  sector: string;
  opportunity: string;
  confidence: number;
}

export function SectorImpactMatrix() {
  const [impacts, setImpacts] = useState<EconomicIndicatorImpact[]>([]);
  const [opportunities, setOpportunities] = useState<SectorOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<string>('');

  useEffect(() => {
    fetchSectorImpacts();
  }, []);

  const fetchSectorImpacts = async () => {
    try {
      setLoading(true);
      setError(null);

      const [impactsResponse, opportunitiesResponse] = await Promise.all([
        fetch('/api/economic-regime/sector-impacts'),
        fetch('/api/economic-regime/sector-opportunities?limit=8')
      ]);

      if (!impactsResponse.ok || !opportunitiesResponse.ok) {
        throw new Error('Failed to fetch sector impact data');
      }

      const impactsData = await impactsResponse.json();
      const opportunitiesData = await opportunitiesResponse.json();

      setImpacts(impactsData.impacts || []);
      setOpportunities(opportunitiesData.opportunities || []);
      
      if (impactsData.impacts?.length > 0) {
        setSelectedIndicator(impactsData.impacts[0].indicator);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sector impact data');
      console.error('Sector impact fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (expectedReturn: number): string => {
    const magnitude = Math.abs(expectedReturn);
    if (expectedReturn > 0) {
      if (magnitude > 5) return 'bg-green-600 text-white';
      if (magnitude > 2) return 'bg-green-500 text-white';
      if (magnitude > 0.5) return 'bg-green-400 text-white';
      return 'bg-green-300 text-gray-900';
    } else {
      if (magnitude > 5) return 'bg-red-600 text-white';
      if (magnitude > 2) return 'bg-red-500 text-white';
      if (magnitude > 0.5) return 'bg-red-400 text-white';
      return 'bg-red-300 text-gray-900';
    }
  };

  const getRiskBadgeColor = (risk: string): string => {
    switch (risk) {
      case 'HIGH': return 'bg-red-600 text-white';
      case 'MEDIUM': return 'bg-yellow-600 text-white';
      case 'LOW': return 'bg-green-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy > 0.8) return 'text-green-400';
    if (accuracy > 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2 text-gray-400">
            <Building2 className="w-5 h-5 animate-pulse" />
            <span>Loading sector impact analysis...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || impacts.length === 0) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error || 'No sector impact data available'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedImpact = impacts.find(impact => impact.indicator === selectedIndicator) || impacts[0];

  return (
    <div className="space-y-6">
      {/* Feature Status Banner */}
      <Card className="bg-orange-900/20 border-orange-500/30">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2 text-orange-400 text-sm">
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
            <span>Priority 3 Analytics: Economic regime detection and sector-specific impact analysis active</span>
          </div>
        </CardContent>
      </Card>

      {/* Top Opportunities */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-blue-400 flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Top Sector Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {opportunities.map((opportunity, index) => (
              <div key={index} className="bg-financial-gray p-4 rounded-lg border border-financial-border">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-white">{opportunity.sector}</h4>
                  <span className={`text-sm font-bold ${getAccuracyColor(opportunity.confidence)}`}>
                    {(opportunity.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm text-gray-300">{opportunity.opportunity}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sector Impact Matrix */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-blue-400 flex items-center">
            <Building2 className="w-5 h-5 mr-2" />
            Sector Impact Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Indicator Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Economic Indicator:
            </label>
            <select
              value={selectedIndicator}
              onChange={(e) => setSelectedIndicator(e.target.value)}
              className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white focus:border-blue-400 focus:outline-none w-full md:w-auto"
            >
              {impacts.map((impact) => (
                <option key={impact.indicator} value={impact.indicator}>
                  {impact.indicator}
                </option>
              ))}
            </select>
          </div>

          {selectedImpact && (
            <div className="space-y-4">
              {/* Impact Summary */}
              <div className="bg-financial-gray p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">Impact Summary</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">Analysis Confidence:</span>
                    <span className={`font-bold ${getAccuracyColor(selectedImpact.analysisConfidence)}`}>
                      {(selectedImpact.analysisConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <p className="text-gray-300 text-sm mb-2">{selectedImpact.changeDescription}</p>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-400 text-sm">Overall Market Impact:</span>
                    <span className={`font-bold flex items-center ${
                      selectedImpact.overallMarketImpact > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {selectedImpact.overallMarketImpact > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {selectedImpact.overallMarketImpact.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Sector Impact Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-financial-border">
                      <th className="text-left py-3 px-2 text-gray-300 font-medium">Sector</th>
                      <th className="text-center py-3 px-2 text-gray-300 font-medium">Expected Return</th>
                      <th className="text-center py-3 px-2 text-gray-300 font-medium">Confidence</th>
                      <th className="text-center py-3 px-2 text-gray-300 font-medium">Risk</th>
                      <th className="text-center py-3 px-2 text-gray-300 font-medium">
                        <div className="flex items-center justify-center space-x-1">
                          <span>Range</span>
                          <Info className="w-3 h-3" title="95% Confidence Interval" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedImpact.sectorImpacts.map((sectorImpact, index) => (
                      <tr key={index} className="border-b border-financial-border/50 hover:bg-financial-gray/30">
                        <td className="py-3 px-2">
                          <span className="text-white font-medium">{sectorImpact.sector}</span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`px-3 py-1 rounded-lg font-bold ${getImpactColor(sectorImpact.expectedReturn)}`}>
                            {sectorImpact.expectedReturn > 0 ? '+' : ''}{sectorImpact.expectedReturn.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`font-medium ${getAccuracyColor(sectorImpact.historicalAccuracy)}`}>
                            {(sectorImpact.historicalAccuracy * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskBadgeColor(sectorImpact.riskLevel)}`}>
                            {sectorImpact.riskLevel}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="text-gray-400 text-sm">
                            {sectorImpact.confidenceInterval.lower.toFixed(1)}% to {sectorImpact.confidenceInterval.upper.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Historical Context */}
              <div className="bg-financial-gray/50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Analysis Methodology</h4>
                <p className="text-xs text-gray-400">
                  Impact coefficients are based on historical correlations between economic indicators and sector performance over the past 10 years. 
                  Confidence intervals represent 95% probability ranges based on historical accuracy. Risk levels indicate volatility of sector response to indicator changes.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}