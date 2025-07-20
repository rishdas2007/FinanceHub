import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, TrendingUp, Target, AlertTriangle } from "lucide-react";

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
}

export function ThematicAIAnalysis() {
  const { data: analysis, isLoading, error } = useQuery<ThematicAnalysisData>({
    queryKey: ['/api/thematic-analysis'],
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 1,
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
      <Card className="p-6 border-red-500/30">
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
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-blue-400" />
          <span>🎭 Thematic Market Analysis</span>
        </h2>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className={`${confidenceColor}/20 border-${confidenceColor.split('-')[1]}-500/30 text-${confidenceColor.split('-')[1]}-400`}>
            {Math.round(analysis.confidence * 100)}% Confidence
          </Badge>
        </div>
      </div>

      {/* Bottom Line - Hero Section */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <Target className="h-6 w-6 text-blue-400 mt-1 flex-shrink-0" />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Bottom Line</h3>
            <p className="text-lg font-medium text-white leading-relaxed">{analysis.bottomLine}</p>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <span>Theme: <span className="text-white font-medium">{analysis.dominantTheme}</span></span>
              <span>•</span>
              <span>Updated: {new Date(analysis.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Narrative Sections */}
      <div className="grid gap-6">
        <AnalysisSection 
          title="Market Setup" 
          content={analysis.setup}
          icon="📊"
          gradient="from-green-900/20 to-emerald-900/20"
          borderColor="border-green-500/30"
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

      {/* Footer */}
      <div className="text-xs text-gray-500 text-center pt-2">
        Powered by GPT-4o • Enhanced Thematic Analysis • Real-time Market Data
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