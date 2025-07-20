import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AlertCircle, TrendingUp, Target, AlertTriangle, ToggleLeft, ToggleRight } from "lucide-react";

interface ThematicAnalysisData {
  bottomLine: string;
  dominantTheme: string;
  setup: string;
  evidence: string;
  implications: string;
  catalysts: string;
  contrarianView: string;
  confidence: number;
  timestamp: string;
  historicalContext?: string;
  narrativeEvolution?: string;
  percentileInsights?: string;
}

export function ThematicAIAnalysis() {
  const [isStandardMode, setIsStandardMode] = useState(true);
  
  const { data: analysis, isLoading, error } = useQuery<ThematicAnalysisData>({
    queryKey: ['/api/thematic-analysis'],
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const { data: patterns } = useQuery<{patterns: any[]}>({
    queryKey: ['/api/pattern-recognition'],
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !isStandardMode,
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-3 bg-gray-700 rounded w-full"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error || !analysis) {
    return (
      <Card className="p-6 border-red-500/30 bg-gray-900 text-white">
        <div className="flex items-center space-x-2 text-red-400">
          <AlertCircle size={20} />
          <span>Enhanced analysis temporarily unavailable</span>
        </div>
      </Card>
    );
  }

  const confidenceColor = analysis.confidence >= 0.8 ? 'bg-green-500' : 
                         analysis.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <Card className="bg-financial-gray border-financial-border">
      <div className="flex items-center justify-between p-6 border-b border-financial-border">
        <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-blue-400" />
          <span>🎭 Thematic Market Analysis</span>
        </h2>
        <div className="flex items-center space-x-2">
          <Button 
            variant={isStandardMode ? "default" : "secondary"}
            size="sm" 
            onClick={() => setIsStandardMode(!isStandardMode)}
            className={`text-xs font-medium ${
              isStandardMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500' 
                : 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500'
            }`}
          >
            {isStandardMode ? <ToggleLeft className="h-4 w-4 mr-1" /> : <ToggleRight className="h-4 w-4 mr-1" />}
            {isStandardMode ? 'Standard' : 'Enhanced'}
          </Button>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-warning-yellow rounded-full animate-pulse"></span>
            <span className="text-xs text-gray-400">{Math.round(analysis.confidence * 100)}% Confidence</span>
          </div>
        </div>
      </div>

      <div className="bg-financial-card rounded-lg p-6 overflow-y-auto max-h-[800px]">
        {/* Bottom Line - Hero Section */}
        <div className="border-l-4 border-gain-green pl-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-gain-green" />
            <h4 className="font-semibold text-white text-lg">Bottom Line</h4>
          </div>
          <p className="text-gray-300 leading-relaxed mb-4">{analysis.bottomLine}</p>
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <span>Theme: <span className="text-white font-medium">{analysis.dominantTheme}</span></span>
            <span>•</span>
            <span>Updated: {new Date(analysis.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Narrative Sections */}
        <div className="grid gap-4">
          <AnalysisSection 
            title="Market Setup" 
            content={analysis.setup}
            icon="📊"
            gradient="from-green-900/10 to-emerald-900/10"
            borderColor="border-green-500/20"
          />
        
        <AnalysisSection 
          title="Evidence" 
          content={analysis.evidence}
          icon="🔍"
          gradient="from-blue-900/20 to-cyan-900/20"
          borderColor="border-blue-500/30"
        />
        
        <AnalysisSection 
          title="Implications" 
          content={analysis.implications}
          icon="💡"
          gradient="from-yellow-900/20 to-amber-900/20"
          borderColor="border-yellow-500/30"
        />
        
        <AnalysisSection 
          title="Key Catalysts" 
          content={analysis.catalysts}
          icon="⚡"
          gradient="from-purple-900/20 to-violet-900/20"
          borderColor="border-purple-500/30"
        />
      </div>

      <Separator className="bg-gray-700" />

      {/* Contrarian View */}
      <div className="bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-500/30 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-red-400 uppercase tracking-wide">Contrarian View</h4>
            <p className="text-gray-100 text-sm leading-relaxed">{analysis.contrarianView}</p>
          </div>
        </div>
      </div>

      {/* Historical Context (if available) */}
      {analysis.historicalContext && (
        <div className="bg-gradient-to-r from-gray-900/20 to-slate-900/20 border border-gray-500/30 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-lg">📊</span>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Historical Context</h4>
              <p className="text-gray-200 text-sm leading-relaxed">{analysis.historicalContext}</p>
            </div>
          </div>
        </div>
      )}

      {/* Percentile Insights (if available) */}
      {analysis.percentileInsights && !isStandardMode && (
        <div className="bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-lg">📈</span>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-indigo-400 uppercase tracking-wide">Percentile Rankings</h4>
              <p className="text-gray-200 text-sm leading-relaxed">{analysis.percentileInsights}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pattern Recognition (Enhanced Mode Only) */}
      {!isStandardMode && patterns?.patterns && patterns.patterns.length > 0 && (
        <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-lg">🔍</span>
            <div className="space-y-3 w-full">
              <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wide">Pattern Recognition</h4>
              <div className="space-y-2">
                {patterns.patterns.slice(0, 3).map((pattern: any, index: number) => (
                  <div key={index} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-sm font-semibold text-white">{pattern.name}</h5>
                      <Badge className={`text-xs ${
                        pattern.confidence >= 0.8 ? 'bg-green-500/20 text-green-400' :
                        pattern.confidence >= 0.6 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {Math.round(pattern.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    <p className="text-gray-300 text-xs mb-2">{pattern.description}</p>
                    <div className="text-xs text-gray-400">
                      <strong>Expected:</strong> {pattern.historicalOutcome}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Footer */}
        <div className="text-xs text-gray-400 text-center pt-2">
          Powered by GPT-4o • Enhanced Thematic Analysis • Historical Context • Real-time Market Data
        </div>
      </div>
    </Card>
  );
}

interface AnalysisSectionProps {
  title: string;
  content: string;
  icon: string;
  gradient: string;
  borderColor: string;
}

function AnalysisSection({ title, content, icon, gradient, borderColor }: AnalysisSectionProps) {
  return (
    <div className={`bg-gradient-to-r ${gradient} border ${borderColor} rounded-lg p-4`}>
      <div className="flex items-start space-x-3">
        <span className="text-lg">{icon}</span>
        <div className="space-y-1 flex-1">
          <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">{title}</h4>
          <p className="text-gray-100 text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
}