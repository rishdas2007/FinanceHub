// Service Startup Orchestrator - Fixes race conditions and ensures proper dependency ordering
import { log } from "../vite";

export interface ServiceConfig {
  name: string;
  dependencies?: string[];
  timeout: number;
  initializer: () => Promise<void>;
}

export class ServiceStartupOrchestrator {
  private services: Map<string, ServiceConfig> = new Map();
  private completed: Set<string> = new Set();
  private failed: Set<string> = new Set();

  constructor(services: ServiceConfig[]) {
    services.forEach(service => {
      this.services.set(service.name, service);
    });
  }

  async startAll(): Promise<void> {
    log('🔄 Starting service orchestration...');
    
    const startPromises: Promise<void>[] = [];
    
    for (const [name, config] of this.services.entries()) {
      startPromises.push(this.startService(name, config));
    }
    
    await Promise.allSettled(startPromises);
    
    const successCount = this.completed.size;
    const failCount = this.failed.size;
    const totalCount = this.services.size;
    
    log(`✅ Service orchestration complete: ${successCount}/${totalCount} services started successfully`);
    
    if (failCount > 0) {
      log(`⚠️ ${failCount} services failed to start: ${Array.from(this.failed).join(', ')}`);
    }
  }

  private async startService(name: string, config: ServiceConfig): Promise<void> {
    try {
      // Wait for dependencies
      if (config.dependencies && config.dependencies.length > 0) {
        await this.waitForDependencies(config.dependencies);
      }
      
      log(`🚀 Starting service: ${name}`);
      
      // Start service with timeout
      await Promise.race([
        config.initializer(),
        this.createTimeout(config.timeout, `Service ${name} timed out after ${config.timeout}ms`)
      ]);
      
      this.completed.add(name);
      log(`✅ Service started successfully: ${name}`);
      
    } catch (error) {
      this.failed.add(name);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`❌ Service failed to start: ${name} - ${errorMessage}`);
    }
  }

  private async waitForDependencies(dependencies: string[]): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds max wait
    const checkInterval = 100; // Check every 100ms
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const allDependenciesReady = dependencies.every(dep => 
        this.completed.has(dep) || this.failed.has(dep)
      );
      
      if (allDependenciesReady) {
        // Check if any required dependencies failed
        const failedDependencies = dependencies.filter(dep => this.failed.has(dep));
        if (failedDependencies.length > 0) {
          throw new Error(`Required dependencies failed: ${failedDependencies.join(', ')}`);
        }
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error(`Timeout waiting for dependencies: ${dependencies.join(', ')}`);
  }

  private createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }
}