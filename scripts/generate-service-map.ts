#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

interface ServiceInfo {
  name: string;
  path: string;
  exports: string[];
  imports: string[];
  dependencies: string[];
  description?: string;
  category: 'historical' | 'calculation' | 'api' | 'utility' | 'cache' | 'configuration';
  complexity: 'low' | 'medium' | 'high';
  lastModified: Date;
}

interface DependencyGraph {
  nodes: ServiceInfo[];
  edges: Array<{ from: string; to: string; type: 'import' | 'dependency' }>;
}

/**
 * Service mapping and documentation generator for FinanceHub
 * Automatically discovers services and generates comprehensive documentation
 */
class ServiceMapGenerator {
  private services: ServiceInfo[] = [];
  private dependencyGraph: DependencyGraph = { nodes: [], edges: [] };
  
  async generateServiceMap(): Promise<ServiceInfo[]> {
    console.log('🔍 Discovering services...');
    
    // Discover all service files
    const serviceFiles = await glob('server/services/**/*.ts');
    const utilFiles = await glob('server/utils/**/*.ts');
    const routeFiles = await glob('server/routes/**/*.ts');
    
    // Analyze each file
    for (const file of [...serviceFiles, ...utilFiles, ...routeFiles]) {
      const serviceInfo = await this.analyzeService(file);
      this.services.push(serviceInfo);
    }
    
    // Build dependency graph
    this.buildDependencyGraph();
    
    // Generate documentation
    await this.generateMarkdownDocs();
    await this.generateMermaidDiagrams();
    await this.generateApiDocs();
    
    console.log(`✅ Analyzed ${this.services.length} services`);
    return this.services;
  }
  
  private async analyzeService(filePath: string): Promise<ServiceInfo> {
    const content = await fs.readFile(filePath, 'utf8');
    const stats = await fs.stat(filePath);
    
    // Extract exports
    const exports = this.extractExports(content);
    
    // Extract imports
    const imports = this.extractImports(content);
    
    // Extract dependencies
    const dependencies = this.extractDependencies(content);
    
    // Determine category
    const category = this.categorizeService(filePath, content);
    
    // Determine complexity
    const complexity = this.assessComplexity(content);
    
    // Extract description from comments
    const description = this.extractDescription(content);
    
    return {
      name: path.basename(filePath, '.ts'),
      path: filePath,
      exports,
      imports,
      dependencies,
      description,
      category,
      complexity,
      lastModified: stats.mtime
    };
  }
  
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // Match export statements
    const exportMatches = content.matchAll(/export\s+(?:class|function|const|interface|type)\s+(\w+)/g);
    for (const match of exportMatches) {
      exports.push(match[1]);
    }
    
    // Match default exports
    const defaultExportMatch = content.match(/export\s+default\s+(?:class\s+)?(\w+)/);
    if (defaultExportMatch) {
      exports.push(defaultExportMatch[1]);
    }
    
    return exports;
  }
  
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    
    // Match import statements
    const importMatches = content.matchAll(/import\s+.*?from\s+['"](.+?)['"]/g);
    for (const match of importMatches) {
      imports.push(match[1]);
    }
    
    return imports;
  }
  
  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    // Look for service instantiations and method calls
    const serviceMatches = content.matchAll(/(\w+Service|\w+Manager|\w+Helper)\.(\w+)/g);
    for (const match of serviceMatches) {
      if (!dependencies.includes(match[1])) {
        dependencies.push(match[1]);
      }
    }
    
    return dependencies;
  }
  
  private categorizeService(filePath: string, content: string): ServiceInfo['category'] {
    if (filePath.includes('historical')) return 'historical';
    if (filePath.includes('config') || content.includes('ConfigManager')) return 'configuration';
    if (filePath.includes('cache')) return 'cache';
    if (filePath.includes('routes')) return 'api';
    if (filePath.includes('utils')) return 'utility';
    if (content.includes('calculateZ') || content.includes('technicalIndicator')) return 'calculation';
    
    return 'utility';
  }
  
  private assessComplexity(content: string): ServiceInfo['complexity'] {
    const lines = content.split('\n').length;
    const functions = (content.match(/function|async\s+\w+/g) || []).length;
    const classes = (content.match(/class\s+\w+/g) || []).length;
    
    const complexityScore = lines / 50 + functions * 2 + classes * 3;
    
    if (complexityScore > 20) return 'high';
    if (complexityScore > 10) return 'medium';
    return 'low';
  }
  
  private extractDescription(content: string): string | undefined {
    // Look for class or file-level JSDoc comments
    const docMatch = content.match(/\/\*\*\s*\n\s*\*\s*([^*]+)/);
    return docMatch ? docMatch[1].trim() : undefined;
  }
  
  private buildDependencyGraph(): void {
    this.dependencyGraph.nodes = this.services;
    
    for (const service of this.services) {
      // Create edges for imports
      for (const importPath of service.imports) {
        const targetService = this.services.find(s => 
          importPath.includes(s.name) || s.path.includes(importPath)
        );
        
        if (targetService) {
          this.dependencyGraph.edges.push({
            from: service.name,
            to: targetService.name,
            type: 'import'
          });
        }
      }
      
      // Create edges for dependencies
      for (const dep of service.dependencies) {
        const targetService = this.services.find(s => s.name === dep);
        if (targetService) {
          this.dependencyGraph.edges.push({
            from: service.name,
            to: targetService.name,
            type: 'dependency'
          });
        }
      }
    }
  }
  
  private async generateMarkdownDocs(): Promise<void> {
    const categorizedServices = this.groupServicesByCategory();
    
    const docs = `# FinanceHub Service Architecture Documentation

Generated: ${new Date().toISOString()}

## Service Categories

${Object.entries(categorizedServices).map(([category, services]) => `
### 📊 ${this.categoryEmoji(category)} ${this.capitalizeCategory(category)} Services

${services.map(service => `
- **${service.name}** (${service.complexity} complexity)
  - Path: \`${service.path}\`
  - Exports: ${service.exports.join(', ') || 'None'}
  - Dependencies: ${service.dependencies.join(', ') || 'None'}
  - Description: ${service.description || 'No description available'}
  - Last Modified: ${service.lastModified.toDateString()}
`).join('')}
`).join('\n')}

## Service Dependencies

### High-Level Architecture

\`\`\`mermaid
graph TB
${this.generateMermaidGraph()}
\`\`\`

## Service Statistics

- **Total Services**: ${this.services.length}
- **High Complexity**: ${this.services.filter(s => s.complexity === 'high').length}
- **Medium Complexity**: ${this.services.filter(s => s.complexity === 'medium').length}
- **Low Complexity**: ${this.services.filter(s => s.complexity === 'low').length}

### By Category:
${Object.entries(categorizedServices).map(([category, services]) => 
  `- **${this.capitalizeCategory(category)}**: ${services.length} services`
).join('\n')}

## Recommendations

### Consolidation Opportunities
${this.identifyConsolidationOpportunities()}

### Performance Optimization
${this.identifyPerformanceOpportunities()}

---
*Documentation auto-generated by FinanceHub Service Map Generator*
`;
    
    await fs.writeFile('docs/SERVICE_ARCHITECTURE.md', docs);
    console.log('📝 Generated SERVICE_ARCHITECTURE.md');
  }
  
  private groupServicesByCategory(): Record<string, ServiceInfo[]> {
    const grouped: Record<string, ServiceInfo[]> = {};
    
    for (const service of this.services) {
      if (!grouped[service.category]) {
        grouped[service.category] = [];
      }
      grouped[service.category].push(service);
    }
    
    return grouped;
  }
  
  private categoryEmoji(category: string): string {
    const emojis = {
      historical: '📊',
      calculation: '🧮',
      api: '🚀',
      utility: '🔧',
      cache: '💾',
      configuration: '⚙️'
    };
    return emojis[category as keyof typeof emojis] || '📦';
  }
  
  private capitalizeCategory(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }
  
  private generateMermaidGraph(): string {
    const nodes = this.services.slice(0, 15); // Limit for readability
    const edges = this.dependencyGraph.edges.filter(edge => 
      nodes.some(n => n.name === edge.from) && nodes.some(n => n.name === edge.to)
    );
    
    const mermaidNodes = nodes.map(service => 
      `    ${service.name}[${service.name}]`
    ).join('\n');
    
    const mermaidEdges = edges.map(edge => 
      `    ${edge.from} --> ${edge.to}`
    ).join('\n');
    
    return `${mermaidNodes}\n${mermaidEdges}`;
  }
  
  private identifyConsolidationOpportunities(): string {
    const duplicatePatterns = this.services.filter(s => 
      s.name.includes('historical') || s.name.includes('cache')
    );
    
    if (duplicatePatterns.length > 1) {
      return `
- Consider consolidating historical data services: ${duplicatePatterns.map(s => s.name).join(', ')}
- Unified service pattern implemented in v33 upgrade`;
    }
    
    return '- No immediate consolidation opportunities identified';
  }
  
  private identifyPerformanceOpportunities(): string {
    const highComplexityServices = this.services.filter(s => s.complexity === 'high');
    
    return `
- Review high-complexity services: ${highComplexityServices.map(s => s.name).join(', ')}
- Consider breaking down services with >500 lines of code
- Implement caching for calculation-intensive services`;
  }
  
  private async generateMermaidDiagrams(): Promise<void> {
    const fullDiagram = `
graph TB
    subgraph "API Layer"
        ${this.services.filter(s => s.category === 'api').map(s => `${s.name}[${s.name}]`).join('\n        ')}
    end
    
    subgraph "Service Layer"
        ${this.services.filter(s => s.category === 'historical' || s.category === 'calculation').map(s => `${s.name}[${s.name}]`).join('\n        ')}
    end
    
    subgraph "Utility Layer"
        ${this.services.filter(s => s.category === 'utility' || s.category === 'configuration').map(s => `${s.name}[${s.name}]`).join('\n        ')}
    end
    
    subgraph "Data Layer"
        DB[(Database)]
        Cache[(Cache)]
    end
    
    ${this.dependencyGraph.edges.slice(0, 20).map(edge => `${edge.from} --> ${edge.to}`).join('\n    ')}
`;
    
    await fs.writeFile('docs/service-dependency-diagram.mmd', fullDiagram);
    console.log('📊 Generated service-dependency-diagram.mmd');
  }
  
  private async generateApiDocs(): Promise<void> {
    const apiServices = this.services.filter(s => s.category === 'api');
    
    const apiDocs = `# FinanceHub API Documentation

${apiServices.map(service => `
## ${service.name}

**Path**: \`${service.path}\`  
**Complexity**: ${service.complexity}  
**Last Modified**: ${service.lastModified.toDateString()}

${service.description || 'No description available'}

### Exports
${service.exports.map(exp => `- \`${exp}\``).join('\n') || 'None'}

### Dependencies
${service.dependencies.map(dep => `- \`${dep}\``).join('\n') || 'None'}

---
`).join('')}

*Auto-generated API documentation*
`;
    
    await fs.writeFile('docs/API_DOCUMENTATION.md', apiDocs);
    console.log('📚 Generated API_DOCUMENTATION.md');
  }
}

// Run the generator
async function main() {
  const generator = new ServiceMapGenerator();
  await generator.generateServiceMap();
}

if (require.main === module) {
  main().catch(console.error);
}

export { ServiceMapGenerator };