import { logger } from './logger';

interface LoadTestConfig {
  endpoint: string;
  concurrentUsers: number;
  duration: number; // seconds
  requestsPerSecond?: number;
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  requestsPerSecond: number;
  errors: { [key: string]: number };
}

export class LoadTester {
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const startTime = Date.now();
    const results: number[] = [];
    const errors: { [key: string]: number } = {};
    let successfulRequests = 0;
    let failedRequests = 0;

    logger.info('Starting load test', {
      endpoint: config.endpoint,
      concurrentUsers: config.concurrentUsers,
      duration: config.duration
    });

    const promises: Promise<void>[] = [];

    // Create concurrent users
    for (let i = 0; i < config.concurrentUsers; i++) {
      promises.push(this.simulateUser(config, results, errors, startTime));
    }

    // Wait for all users to complete or timeout
    await Promise.allSettled(promises);

    // Calculate results
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    
    successfulRequests = results.length;
    failedRequests = Object.values(errors).reduce((sum, count) => sum + count, 0);
    
    const averageResponseTime = results.length > 0 
      ? results.reduce((sum, time) => sum + time, 0) / results.length 
      : 0;

    const result: LoadTestResult = {
      totalRequests: successfulRequests + failedRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      maxResponseTime: results.length > 0 ? Math.max(...results) : 0,
      minResponseTime: results.length > 0 ? Math.min(...results) : 0,
      requestsPerSecond: Math.round((successfulRequests / totalTime) * 100) / 100,
      errors
    };

    logger.info('Load test completed', result);
    return result;
  }

  private async simulateUser(
    config: LoadTestConfig,
    results: number[],
    errors: { [key: string]: number },
    startTime: number
  ): Promise<void> {
    const endTime = startTime + (config.duration * 1000);
    
    while (Date.now() < endTime) {
      try {
        const requestStart = process.hrtime.bigint();
        
        // Make HTTP request
        const response = await fetch(`http://localhost:5000${config.endpoint}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'FinanceHub-LoadTester/1.0'
          }
        });

        const responseTime = Number(process.hrtime.bigint() - requestStart) / 1000000;

        if (response.ok) {
          results.push(responseTime);
        } else {
          const errorKey = `HTTP_${response.status}`;
          errors[errorKey] = (errors[errorKey] || 0) + 1;
        }

        // Rate limiting
        if (config.requestsPerSecond) {
          const delay = 1000 / config.requestsPerSecond;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 10));
        }

      } catch (error) {
        const errorKey = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
        errors[errorKey] = (errors[errorKey] || 0) + 1;
      }
    }
  }

  async generateLoadTestReport(results: LoadTestResult[], config: LoadTestConfig): Promise<string> {
    let report = `# Load Testing Report\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += `## Test Configuration\n`;
    report += `- **Endpoint**: ${config.endpoint}\n`;
    report += `- **Concurrent Users**: ${config.concurrentUsers}\n`;
    report += `- **Duration**: ${config.duration} seconds\n`;
    if (config.requestsPerSecond) {
      report += `- **Target RPS**: ${config.requestsPerSecond}\n`;
    }
    report += `\n`;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      report += `## Test Run ${i + 1}\n`;
      report += `- **Total Requests**: ${result.totalRequests}\n`;
      report += `- **Successful**: ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%)\n`;
      report += `- **Failed**: ${result.failedRequests} (${((result.failedRequests / result.totalRequests) * 100).toFixed(1)}%)\n`;
      report += `- **Average Response Time**: ${result.averageResponseTime}ms\n`;
      report += `- **Max Response Time**: ${result.maxResponseTime}ms\n`;
      report += `- **Min Response Time**: ${result.minResponseTime}ms\n`;
      report += `- **Requests Per Second**: ${result.requestsPerSecond}\n`;

      if (Object.keys(result.errors).length > 0) {
        report += `- **Errors**:\n`;
        for (const [error, count] of Object.entries(result.errors)) {
          report += `  - ${error}: ${count}\n`;
        }
      }
      report += `\n`;
    }

    // Performance analysis
    const avgResponseTime = results.reduce((sum, r) => sum + r.averageResponseTime, 0) / results.length;
    const avgRPS = results.reduce((sum, r) => sum + r.requestsPerSecond, 0) / results.length;
    const successRate = results.reduce((sum, r) => sum + (r.successfulRequests / r.totalRequests), 0) / results.length;

    report += `## Performance Analysis\n`;
    report += `- **Average Response Time**: ${avgResponseTime.toFixed(2)}ms\n`;
    report += `- **Average RPS**: ${avgRPS.toFixed(2)}\n`;
    report += `- **Success Rate**: ${(successRate * 100).toFixed(1)}%\n\n`;

    // Recommendations
    report += `## Recommendations\n`;
    if (avgResponseTime > 1000) {
      report += `- 🔴 **High response times** (${avgResponseTime.toFixed(0)}ms avg) - investigate performance bottlenecks\n`;
    } else if (avgResponseTime > 500) {
      report += `- 🟡 **Moderate response times** (${avgResponseTime.toFixed(0)}ms avg) - monitor for optimization opportunities\n`;
    } else {
      report += `- ✅ **Good response times** (${avgResponseTime.toFixed(0)}ms avg)\n`;
    }

    if (successRate < 0.95) {
      report += `- 🔴 **Low success rate** (${(successRate * 100).toFixed(1)}%) - investigate error causes\n`;
    } else if (successRate < 0.99) {
      report += `- 🟡 **Moderate success rate** (${(successRate * 100).toFixed(1)}%) - monitor error patterns\n`;
    } else {
      report += `- ✅ **High success rate** (${(successRate * 100).toFixed(1)}%)\n`;
    }

    return report;
  }
}

export const loadTester = new LoadTester();