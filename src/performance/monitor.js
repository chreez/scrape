/**
 * Performance monitoring and optimization utilities
 */

export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.timers = new Map();
    this.startTime = Date.now();
  }

  startTimer(name) {
    this.timers.set(name, {
      start: process.hrtime(),
      startTime: Date.now()
    });
  }

  endTimer(name) {
    const timer = this.timers.get(name);
    if (!timer) {
      throw new Error(`Timer '${name}' not found`);
    }

    const [seconds, nanoseconds] = process.hrtime(timer.start);
    const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

    this.timers.delete(name);
    
    const metric = {
      name,
      duration,
      startTime: timer.startTime,
      endTime: Date.now()
    };

    this.addMetric(name, metric);
    return metric;
  }

  addMetric(name, data) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push({
      ...data,
      timestamp: Date.now()
    });
  }

  getMetrics(name) {
    return this.metrics.get(name) || [];
  }

  getAllMetrics() {
    const result = {};
    for (const [name, metrics] of this.metrics) {
      result[name] = metrics;
    }
    return result;
  }

  getAverageTime(name) {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return 0;
    
    const total = metrics.reduce((sum, metric) => sum + metric.duration, 0);
    return total / metrics.length;
  }

  getStats() {
    const stats = {
      totalRuntime: Date.now() - this.startTime,
      operationCounts: {},
      averageTimes: {},
      totalTimes: {},
      memoryUsage: process.memoryUsage()
    };

    for (const [name, metrics] of this.metrics) {
      stats.operationCounts[name] = metrics.length;
      stats.averageTimes[name] = this.getAverageTime(name);
      stats.totalTimes[name] = metrics.reduce((sum, m) => sum + m.duration, 0);
    }

    return stats;
  }

  clear() {
    this.metrics.clear();
    this.timers.clear();
    this.startTime = Date.now();
  }

  report() {
    const stats = this.getStats();
    
    console.log('\n📊 Performance Report');
    console.log('==================');
    console.log(`Total Runtime: ${(stats.totalRuntime / 1000).toFixed(2)}s`);
    console.log(`Memory Usage: ${(stats.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    
    if (Object.keys(stats.operationCounts).length > 0) {
      console.log('\nOperation Statistics:');
      Object.entries(stats.operationCounts).forEach(([name, count]) => {
        const avgTime = stats.averageTimes[name];
        const totalTime = stats.totalTimes[name];
        console.log(`  ${name}: ${count} ops, avg ${avgTime.toFixed(2)}ms, total ${totalTime.toFixed(2)}ms`);
      });
    }
  }
}

export class BrowserPool {
  constructor(options = {}) {
    this.maxBrowsers = options.maxBrowsers || 3;
    this.maxContextsPerBrowser = options.maxContextsPerBrowser || 5;
    this.browsers = [];
    this.availableContexts = [];
    this.usedContexts = new Set();
    this.monitor = new PerformanceMonitor();
  }

  async initialize() {
    this.monitor.startTimer('pool_initialization');
    
    const { chromium } = await import('playwright');
    
    for (let i = 0; i < this.maxBrowsers; i++) {
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--memory-pressure-off'
        ]
      });

      this.browsers.push(browser);

      // Pre-create contexts
      for (let j = 0; j < this.maxContextsPerBrowser; j++) {
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          viewport: { width: 1920, height: 1080 },
          ignoreHTTPSErrors: true
        });
        
        this.availableContexts.push(context);
      }
    }

    this.monitor.endTimer('pool_initialization');
    console.log(`🔧 Initialized browser pool: ${this.maxBrowsers} browsers, ${this.availableContexts.length} contexts`);
  }

  async acquireContext() {
    this.monitor.startTimer('context_acquisition');
    
    if (this.availableContexts.length === 0) {
      throw new Error('No available browser contexts');
    }

    const context = this.availableContexts.pop();
    this.usedContexts.add(context);
    
    this.monitor.endTimer('context_acquisition');
    return context;
  }

  async releaseContext(context) {
    this.monitor.startTimer('context_release');
    
    if (this.usedContexts.has(context)) {
      this.usedContexts.delete(context);
      
      // Clear cookies and storage
      await context.clearCookies();
      
      this.availableContexts.push(context);
    }
    
    this.monitor.endTimer('context_release');
  }

  async cleanup() {
    this.monitor.startTimer('pool_cleanup');
    
    // Close all contexts
    for (const context of [...this.availableContexts, ...this.usedContexts]) {
      try {
        await context.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Close all browsers
    for (const browser of this.browsers) {
      try {
        await browser.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    this.availableContexts = [];
    this.usedContexts.clear();
    this.browsers = [];
    
    this.monitor.endTimer('pool_cleanup');
  }

  getStats() {
    return {
      browsers: this.browsers.length,
      availableContexts: this.availableContexts.length,
      usedContexts: this.usedContexts.size,
      performanceMetrics: this.monitor.getStats()
    };
  }
}

export class ResourceOptimizer {
  static optimizeForParallel(options = {}) {
    return {
      ...options,
      headless: true,
      
      // Disable unnecessary features for performance
      browserOptions: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--memory-pressure-off',
          '--disable-features=TranslateUI',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images' // Skip image loading for text extraction
        ]
      },
      
      // Optimized timeouts
      timeout: 15000, // Shorter timeout for parallel
      navigationTimeout: 10000,
      
      // Reduced delays
      pageWaitTime: 1000, // Reduced from 3000ms
      
      // Simplified extraction
      extractionStrategy: 'fast'
    };
  }

  static estimateMemoryUsage(urls, concurrency) {
    // Rough estimates based on testing
    const baseMemoryPerBrowser = 50; // MB
    const memoryPerContext = 10; // MB
    const memoryPerPage = 5; // MB

    const totalMemory = baseMemoryPerBrowser + 
                       (concurrency * memoryPerContext) + 
                       (urls.length * memoryPerPage);

    return {
      estimatedMemoryMB: Math.round(totalMemory),
      recommendedConcurrency: Math.max(1, Math.min(concurrency, Math.floor(500 / memoryPerContext)))
    };
  }

  static optimizeConcurrency(urlCount, availableMemoryMB = 512) {
    // Conservative estimates
    const memoryPerWorker = 25; // MB per concurrent worker
    const maxConcurrency = Math.floor(availableMemoryMB / memoryPerWorker);
    
    // Performance-based limits
    const optimalConcurrency = Math.min(
      maxConcurrency,
      Math.max(1, Math.min(8, Math.ceil(urlCount / 10))) // Scale with URL count
    );

    return {
      recommended: optimalConcurrency,
      maximum: maxConcurrency,
      reasoning: {
        availableMemory: availableMemoryMB,
        memoryPerWorker,
        urlCount
      }
    };
  }
}