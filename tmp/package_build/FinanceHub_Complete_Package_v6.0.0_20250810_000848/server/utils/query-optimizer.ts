import { logger } from './logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface QueryAnalysis {
  query: string;
  executionTime: number;
  planSteps: number;
  cost: number;
  suggestion?: string;
}

export class QueryOptimizer {
  private slowQueries: Map<string, QueryAnalysis> = new Map();
  private readonly SLOW_QUERY_THRESHOLD = 100; // 100ms

  async analyzeQuery(queryText: string): Promise<QueryAnalysis> {
    try {
      const startTime = process.hrtime.bigint();
      
      // Get query execution plan
      const planResult = await db.execute(sql.raw(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${queryText}`));
      
      const executionTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      const plan = planResult[0] as any;
      const planData = Array.isArray(plan) ? plan[0] : plan;
      
      const analysis: QueryAnalysis = {
        query: queryText,
        executionTime,
        planSteps: this.countPlanSteps(planData),
        cost: this.extractCost(planData),
        suggestion: this.generateSuggestion(planData, executionTime)
      };

      // Track slow queries
      if (executionTime > this.SLOW_QUERY_THRESHOLD) {
        this.slowQueries.set(queryText, analysis);
        logger.warn('Slow query detected', {
          query: queryText.substring(0, 100) + '...',
          executionTime: `${executionTime.toFixed(2)}ms`,
          cost: analysis.cost
        });
      }

      return analysis;
    } catch (error) {
      logger.error('Query analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        query: queryText.substring(0, 100) + '...'
      });
      
      return {
        query: queryText,
        executionTime: 0,
        planSteps: 0,
        cost: 0,
        suggestion: 'Query analysis failed - check syntax and permissions'
      };
    }
  }

  private countPlanSteps(plan: any): number {
    if (!plan || !plan.Plan) return 0;
    
    let steps = 1;
    if (plan.Plan.Plans && Array.isArray(plan.Plan.Plans)) {
      for (const subPlan of plan.Plan.Plans) {
        steps += this.countPlanSteps({ Plan: subPlan });
      }
    }
    return steps;
  }

  private extractCost(plan: any): number {
    if (!plan || !plan.Plan) return 0;
    return plan.Plan['Total Cost'] || 0;
  }

  private generateSuggestion(plan: any, executionTime: number): string | undefined {
    if (!plan || !plan.Plan) return undefined;

    const planType = plan.Plan['Node Type'];
    
    // Common optimization suggestions
    if (planType === 'Seq Scan' && executionTime > 50) {
      return 'Consider adding an index to avoid sequential scan';
    }
    
    if (planType === 'Sort' && executionTime > 100) {
      return 'Large sort operation detected - consider adding ORDER BY index or reducing result set';
    }
    
    if (planType === 'Hash Join' && plan.Plan['Total Cost'] > 1000) {
      return 'Expensive hash join - verify join conditions and consider index optimization';
    }
    
    if (planType === 'Nested Loop' && plan.Plan.Plans?.length > 2) {
      return 'Complex nested loop - consider restructuring query or adding compound indexes';
    }

    if (executionTime > 500) {
      return 'Query execution time is high - consider query restructuring or result caching';
    }

    return undefined;
  }

  getSlowQueries(): QueryAnalysis[] {
    return Array.from(this.slowQueries.values())
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10); // Top 10 slowest
  }

  async generateOptimizationReport(): Promise<string> {
    const slowQueries = this.getSlowQueries();
    
    let report = `# Database Query Optimization Report\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    if (slowQueries.length === 0) {
      report += `## ✅ Query Performance Status\n`;
      report += `No slow queries detected (threshold: ${this.SLOW_QUERY_THRESHOLD}ms)\n\n`;
      report += `All database queries are performing within acceptable limits.\n`;
      return report;
    }

    report += `## 🔴 Slow Queries Detected (${slowQueries.length})\n\n`;

    for (let i = 0; i < slowQueries.length; i++) {
      const query = slowQueries[i];
      report += `### Query ${i + 1}\n`;
      report += `- **Execution Time**: ${query.executionTime.toFixed(2)}ms\n`;
      report += `- **Cost**: ${query.cost.toFixed(2)}\n`;
      report += `- **Plan Steps**: ${query.planSteps}\n`;
      
      if (query.suggestion) {
        report += `- **Suggestion**: ${query.suggestion}\n`;
      }
      
      report += `- **Query**: \`${query.query.substring(0, 200)}${query.query.length > 200 ? '...' : ''}\`\n\n`;
    }

    // General recommendations
    report += `## 📋 General Recommendations\n\n`;
    report += `### Immediate Actions\n`;
    report += `1. Review and optimize the slowest queries above\n`;
    report += `2. Consider adding indexes for frequently scanned columns\n`;
    report += `3. Implement query result caching for expensive operations\n\n`;
    
    report += `### Long-term Improvements\n`;
    report += `1. Set up query performance monitoring alerts\n`;
    report += `2. Regular index maintenance and statistics updates\n`;
    report += `3. Consider read replicas for heavy analytical queries\n`;
    report += `4. Implement connection pooling optimization\n`;

    return report;
  }

  clearSlowQueries(): void {
    this.slowQueries.clear();
    logger.info('Slow query cache cleared');
  }
}

export const queryOptimizer = new QueryOptimizer();