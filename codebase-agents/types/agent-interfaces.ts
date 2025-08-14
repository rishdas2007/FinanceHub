// FinanceHub Pro v26 - Codebase Agent Framework
// Core interfaces and types for all agents

export interface AgentResult {
  success: boolean;
  findings: Finding[];
  metrics: AgentMetrics;
  suggestions: Suggestion[];
  timestamp: string;
  executionTime: number;
}

export interface Finding {
  id: string;
  type: 'error' | 'warning' | 'info' | 'suggestion';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  file: string;
  line?: number;
  column?: number;
  rule?: string;
  fix?: AutoFix;
}

export interface AutoFix {
  type: 'replace' | 'insert' | 'delete' | 'rename';
  description: string;
  oldCode?: string;
  newCode?: string;
  automated: boolean;
  confidence: number; // 0-100
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  category: string;
  files?: string[];
  implementation?: string;
}

export interface AgentMetrics {
  filesAnalyzed: number;
  linesOfCode: number;
  issuesFound: number;
  issuesFixed: number;
  coverage: number; // 0-100
  score: number; // 0-100
}

export interface AgentConfig {
  enabled: boolean;
  rules: Record<string, any>;
  autoFix: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  excludePatterns: string[];
  includePatterns: string[];
}

export abstract class BaseAgent {
  abstract name: string;
  abstract version: string;
  abstract description: string;
  abstract capabilities: string[];
  abstract supportedFileTypes: string[];
  abstract dependencies: string[];

  abstract analyze(files: string[], config: AgentConfig): Promise<AgentResult>;
  
  protected createFinding(
    type: Finding['type'],
    severity: Finding['severity'],
    category: string,
    title: string,
    description: string,
    file: string,
    line?: number,
    column?: number,
    rule?: string,
    fix?: AutoFix
  ): Finding {
    return {
      id: `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      category,
      title,
      description,
      file,
      line,
      column,
      rule,
      fix
    };
  }

  protected createSuggestion(
    title: string,
    description: string,
    impact: Suggestion['impact'],
    effort: Suggestion['effort'],
    category: string,
    files?: string[],
    implementation?: string
  ): Suggestion {
    return {
      id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      impact,
      effort,
      category,
      files,
      implementation
    };
  }
}

export interface FinancialDataValidation {
  validatePrecision: (value: number, field: string) => boolean;
  validateRange: (value: number, min?: number, max?: number) => boolean;
  validateFormat: (data: any, schema: any) => boolean;
  checkCalculationAccuracy: (input: any, output: any, method: string) => boolean;
}

export interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  databaseQueries: number;
  cacheHitRate: number;
  apiCalls: number;
}