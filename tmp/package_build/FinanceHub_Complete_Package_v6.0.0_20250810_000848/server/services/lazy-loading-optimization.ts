import { logger } from '../utils/logger';

/**
 * WEEK 3: LAZY LOADING OPTIMIZATION
 * Intelligent component loading based on viewport and user interaction patterns
 */

export interface LazyLoadConfig {
  rootMargin: string;
  threshold: number;
  loadingDelay: number;
  preloadDistance: number;
  maxConcurrentLoads: number;
}

export interface ComponentMetrics {
  id: string;
  loadTime: number;
  renderTime: number;
  dataSize: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  cacheHit: boolean;
}

export class LazyLoadingOptimizationService {
  private loadingQueue: Map<string, () => Promise<any>> = new Map();
  private loadedComponents: Set<string> = new Set();
  private loadingPromises: Map<string, Promise<any>> = new Map();
  private metrics: Map<string, ComponentMetrics> = new Map();
  private currentLoads = 0;

  private readonly config: LazyLoadConfig = {
    rootMargin: '50px',
    threshold: 0.1,
    loadingDelay: 100,
    preloadDistance: 200,
    maxConcurrentLoads: 3
  };

  /**
   * Register component for lazy loading with priority-based scheduling
   */
  registerComponent(
    id: string,
    loadFunction: () => Promise<any>,
    priority: ComponentMetrics['priority'] = 'medium',
    dependencies: string[] = []
  ): void {
    this.loadingQueue.set(id, loadFunction);
    
    this.metrics.set(id, {
      id,
      loadTime: 0,
      renderTime: 0,
      dataSize: 0,
      priority,
      dependencies,
      cacheHit: false
    });

    logger.debug(`Component registered for lazy loading: ${id} (priority: ${priority})`);
  }

  /**
   * Load component with intelligent scheduling and dependency management
   */
  async loadComponent(id: string): Promise<any> {
    // Return immediately if already loaded
    if (this.loadedComponents.has(id)) {
      logger.debug(`Component ${id} already loaded, returning cached result`);
      return Promise.resolve();
    }

    // Return existing promise if already loading
    if (this.loadingPromises.has(id)) {
      return this.loadingPromises.get(id);
    }

    // Check if we've hit max concurrent loads
    if (this.currentLoads >= this.config.maxConcurrentLoads) {
      logger.debug(`Max concurrent loads reached, queuing ${id}`);
      await this.waitForAvailableSlot();
    }

    const loadFunction = this.loadingQueue.get(id);
    if (!loadFunction) {
      throw new Error(`Component ${id} not registered for lazy loading`);
    }

    const metrics = this.metrics.get(id)!;

    // Load dependencies first
    if (metrics.dependencies.length > 0) {
      await this.loadDependencies(metrics.dependencies);
    }

    // Start loading with metrics tracking
    const loadPromise = this.executeLoadWithMetrics(id, loadFunction, metrics);
    this.loadingPromises.set(id, loadPromise);
    this.currentLoads++;

    try {
      const result = await loadPromise;
      this.loadedComponents.add(id);
      return result;
    } finally {
      this.currentLoads--;
      this.loadingPromises.delete(id);
    }
  }

  /**
   * Execute component load with comprehensive metrics tracking
   */
  private async executeLoadWithMetrics(
    id: string,
    loadFunction: () => Promise<any>,
    metrics: ComponentMetrics
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      logger.info(`🔄 Loading component: ${id} (priority: ${metrics.priority})`);
      
      // Add artificial delay for low priority components during high load
      if (metrics.priority === 'low' && this.currentLoads > 1) {
        await new Promise(resolve => setTimeout(resolve, this.config.loadingDelay));
      }

      const result = await loadFunction();
      
      // Track metrics
      const loadTime = Date.now() - startTime;
      metrics.loadTime = loadTime;
      metrics.dataSize = this.estimateDataSize(result);
      metrics.cacheHit = loadTime < 50; // Assume cache hit if very fast

      logger.info(`✅ Component loaded: ${id} (${loadTime}ms, ${metrics.dataSize} bytes)`);
      
      return result;
    } catch (error) {
      const loadTime = Date.now() - startTime;
      metrics.loadTime = loadTime;
      
      logger.error(`❌ Component load failed: ${id} (${loadTime}ms)`, error);
      throw error;
    }
  }

  /**
   * Load component dependencies in optimal order
   */
  private async loadDependencies(dependencies: string[]): Promise<void> {
    // Sort dependencies by priority
    const sortedDeps = dependencies
      .map(dep => ({ id: dep, metrics: this.metrics.get(dep) }))
      .filter(item => item.metrics)
      .sort((a, b) => this.getPriorityWeight(a.metrics!.priority) - this.getPriorityWeight(b.metrics!.priority))
      .map(item => item.id);

    // Load critical dependencies first, then others in parallel
    const criticalDeps = sortedDeps.filter(id => this.metrics.get(id)?.priority === 'critical');
    const otherDeps = sortedDeps.filter(id => this.metrics.get(id)?.priority !== 'critical');

    // Load critical dependencies sequentially
    for (const dep of criticalDeps) {
      if (!this.loadedComponents.has(dep)) {
        await this.loadComponent(dep);
      }
    }

    // Load other dependencies in parallel
    if (otherDeps.length > 0) {
      await Promise.all(
        otherDeps.map(dep => 
          this.loadedComponents.has(dep) ? Promise.resolve() : this.loadComponent(dep)
        )
      );
    }
  }

  /**
   * Wait for an available loading slot
   */
  private async waitForAvailableSlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.currentLoads < this.config.maxConcurrentLoads) {
          resolve();
        } else {
          setTimeout(checkSlot, 50);
        }
      };
      checkSlot();
    });
  }

  /**
   * Get priority weight for sorting (lower = higher priority)
   */
  private getPriorityWeight(priority: ComponentMetrics['priority']): number {
    switch (priority) {
      case 'critical': return 1;
      case 'high': return 2;
      case 'medium': return 3;
      case 'low': return 4;
      default: return 5;
    }
  }

  /**
   * Estimate data size from response object
   */
  private estimateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  /**
   * Preload components based on user behavior patterns
   */
  async preloadComponents(componentIds: string[]): Promise<void> {
    // Filter out already loaded components
    const toPreload = componentIds.filter(id => !this.loadedComponents.has(id));
    
    if (toPreload.length === 0) return;

    logger.info(`🔮 Preloading ${toPreload.length} components based on usage patterns`);

    // Preload in priority order with staggered timing
    const sortedComponents = toPreload
      .map(id => ({ id, priority: this.metrics.get(id)?.priority || 'low' }))
      .sort((a, b) => this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority));

    for (const [index, { id }] of sortedComponents.entries()) {
      // Stagger preloads to avoid overwhelming the system
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Load in background without blocking
      this.loadComponent(id).catch(error => {
        logger.warn(`Preload failed for ${id}:`, error);
      });
    }
  }

  /**
   * Get loading recommendations based on current state
   */
  getLoadingRecommendations(): {
    shouldPreload: string[];
    canUnload: string[];
    priorityOrder: string[];
  } {
    const unloadedComponents = Array.from(this.loadingQueue.keys())
      .filter(id => !this.loadedComponents.has(id));

    const loadedComponents = Array.from(this.loadedComponents);

    // Components that should be preloaded (high priority, not loaded)
    const shouldPreload = unloadedComponents
      .filter(id => {
        const metrics = this.metrics.get(id);
        return metrics && (metrics.priority === 'critical' || metrics.priority === 'high');
      });

    // Components that can be unloaded (low priority, loaded, not recently used)
    const canUnload = loadedComponents
      .filter(id => {
        const metrics = this.metrics.get(id);
        return metrics && metrics.priority === 'low';
      });

    // Optimal loading order for remaining components
    const priorityOrder = unloadedComponents
      .sort((a, b) => {
        const aMetrics = this.metrics.get(a);
        const bMetrics = this.metrics.get(b);
        if (!aMetrics || !bMetrics) return 0;
        
        return this.getPriorityWeight(aMetrics.priority) - this.getPriorityWeight(bMetrics.priority);
      });

    return {
      shouldPreload,
      canUnload,
      priorityOrder
    };
  }

  /**
   * Get performance metrics for loaded components
   */
  getPerformanceMetrics(): {
    totalComponents: number;
    loadedComponents: number;
    averageLoadTime: number;
    cacheHitRate: number;
    performanceScore: number;
  } {
    const allMetrics = Array.from(this.metrics.values());
    const loadedMetrics = allMetrics.filter(m => this.loadedComponents.has(m.id));

    const totalLoadTime = loadedMetrics.reduce((sum, m) => sum + m.loadTime, 0);
    const averageLoadTime = loadedMetrics.length > 0 ? totalLoadTime / loadedMetrics.length : 0;
    
    const cacheHits = loadedMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = loadedMetrics.length > 0 ? (cacheHits / loadedMetrics.length) * 100 : 0;

    // Calculate performance score based on load times and cache hits
    let performanceScore = 100;
    if (averageLoadTime > 1000) performanceScore -= 30;
    else if (averageLoadTime > 500) performanceScore -= 15;
    
    performanceScore += Math.min(30, cacheHitRate * 0.3);

    return {
      totalComponents: this.loadingQueue.size,
      loadedComponents: this.loadedComponents.size,
      averageLoadTime: Math.round(averageLoadTime),
      cacheHitRate: Math.round(cacheHitRate),
      performanceScore: Math.round(Math.max(0, performanceScore))
    };
  }

  /**
   * Unload low-priority components to free memory
   */
  unloadComponents(componentIds: string[]): void {
    for (const id of componentIds) {
      if (this.loadedComponents.has(id)) {
        this.loadedComponents.delete(id);
        logger.debug(`Component unloaded: ${id}`);
      }
    }
  }

  /**
   * Reset all loading state
   */
  reset(): void {
    this.loadedComponents.clear();
    this.loadingPromises.clear();
    this.currentLoads = 0;
    logger.info('Lazy loading state reset');
  }
}

export const lazyLoadingOptimizationService = new LazyLoadingOptimizationService();