/**
 * Performance-optimized parallel scraper using SmartScraper with error handling
 * Follows clean architecture principles with under 300 lines
 */

import { SmartScraper } from '../smart.js';
import { ErrorHandler, Result } from '../errors/index.js';

export class ParallelScraper {
  constructor(options = {}) {
    this.options = {
      maxConcurrent: 3,
      reuseContexts: true,
      sharedBrowser: true,
      requestDelay: 1000,
      maxRetries: 3,
      verbose: false,
      ...options
    };
    
    this.semaphore = new Semaphore(this.options.maxConcurrent);
    this.sharedBrowser = null;
    this.sharedContexts = [];
    this.activeJobs = new Map();
    this.results = new Map();
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      startTime: null,
      endTime: null
    };
  }

  async extractMultiple(urls, options = {}) {
    this.stats.total = urls.length;
    this.stats.startTime = Date.now();
    
    try {
      if (this.options.sharedBrowser) {
        await this.initializeSharedBrowser();
      }

      const results = await this.processBatch(urls, options);
      
      this.stats.endTime = Date.now();
      return this.formatResults(results);
      
    } finally {
      await this.cleanup();
    }
  }

  async processBatch(urls, options) {
    this.log(`🚀 Processing ${urls.length} URLs with ${this.options.maxConcurrent} concurrent workers`);
    
    const promises = urls.map(async (url, index) => {
      await this.semaphore.acquire();
      
      try {
        const result = await this.processUrlWithRetry(url, index, options);
        this.stats.completed++;
        return result;
      } catch (error) {
        this.stats.failed++;
        return Result.fail(error);
      } finally {
        this.semaphore.release();
        
        // Add delay between requests to be respectful
        if (index < urls.length - 1) {
          await this.delay(this.options.requestDelay);
        }
      }
    });

    return await Promise.all(promises);
  }

  async processUrlWithRetry(url, index, options) {
    const jobId = `job_${index}_${Date.now()}`;
    
    this.activeJobs.set(jobId, {
      url,
      index,
      startTime: Date.now(),
      attempts: 0
    });

    try {
      const result = await ErrorHandler.withRetry(
        async (attempt) => {
          this.activeJobs.get(jobId).attempts = attempt;
          this.log(`🔍 Processing URL ${index + 1}/${this.stats.total}: ${url} (attempt ${attempt})`);
          
          return await this.extractSingle(url, options);
        },
        this.options.maxRetries,
        1000
      );

      return Result.ok({
        url,
        index,
        data: result,
        duration: Date.now() - this.activeJobs.get(jobId).startTime
      });

    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  async extractSingle(url, options) {
    if (this.options.sharedBrowser && this.sharedContexts.length > 0) {
      // Use context pooling for better performance
      return await this.extractWithSharedContext(url, options);
    } else {
      // Use individual SmartScraper instances
      const scraper = new SmartScraper({
        ...this.options,
        ...options
      });
      return await scraper.extract(url);
    }
  }

  async extractWithSharedContext(url, options) {
    // Get available context or create new one
    const context = this.sharedContexts.pop() || await this.createNewContext();
    
    try {
      const page = await context.newPage();
      
      try {
        // Manual extraction with shared browser
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: this.options.timeout || 30000 
        });
        
        await page.waitForTimeout(2000); // Shorter wait for parallel processing
        
        // Simple extraction for parallel mode
        const result = await this.fastExtraction(page, url);
        return result;
        
      } finally {
        await page.close();
      }
      
    } finally {
      // Return context to pool
      this.sharedContexts.push(context);
    }
  }

  async fastExtraction(page, url) {
    // Optimized extraction for parallel processing
    const [title, content, description] = await Promise.all([
      this.extractTitle(page),
      this.extractContent(page),
      this.extractDescription(page)
    ]);

    return {
      url,
      metadata: {
        title,
        description,
        extractedAt: new Date().toISOString()
      },
      textContent: {
        title,
        content: content?.substring(0, 5000) || '', // Limit content in parallel mode
        description
      }
    };
  }

  async extractTitle(page) {
    try {
      return await page.evaluate(() => {
        return document.title || 
               document.querySelector('h1')?.textContent?.trim() ||
               document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
               '';
      });
    } catch {
      return '';
    }
  }

  async extractContent(page) {
    try {
      return await page.evaluate(() => {
        const selectors = ['article', 'main', '.content', '.post-content', 'p'];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            return Array.from(elements)
              .map(el => el.textContent?.trim())
              .filter(text => text && text.length > 50)
              .slice(0, 10)
              .join('\n\n');
          }
        }
        
        return document.body?.textContent?.trim() || '';
      });
    } catch {
      return '';
    }
  }

  async extractDescription(page) {
    try {
      return await page.evaluate(() => {
        return document.querySelector('meta[name="description"]')?.getAttribute('content') ||
               document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
               '';
      });
    } catch {
      return '';
    }
  }

  async initializeSharedBrowser() {
    if (this.sharedBrowser) return;
    
    this.log('🔧 Initializing shared browser for performance optimization');
    
    const { chromium } = await import('playwright');
    this.sharedBrowser = await chromium.launch({
      headless: this.options.headless !== false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    // Pre-create contexts for pooling
    const contextCount = Math.min(this.options.maxConcurrent, 5);
    for (let i = 0; i < contextCount; i++) {
      const context = await this.createNewContext();
      this.sharedContexts.push(context);
    }
    
    this.log(`📋 Created ${contextCount} shared browser contexts`);
  }

  async createNewContext() {
    return await this.sharedBrowser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true
    });
  }

  formatResults(results) {
    const successful = results.filter(r => r.isOk());
    const failed = results.filter(r => r.isFail());
    
    const duration = this.stats.endTime - this.stats.startTime;
    const avgTime = duration / this.stats.total;
    
    return {
      summary: {
        total: this.stats.total,
        successful: successful.length,
        failed: failed.length,
        duration: `${(duration / 1000).toFixed(2)}s`,
        averageTime: `${avgTime.toFixed(0)}ms`,
        throughput: `${(this.stats.total / (duration / 1000)).toFixed(2)} URLs/sec`
      },
      successful: successful.map(r => r.data),
      failed: failed.map(r => ({
        error: r.error.message,
        code: r.error.code,
        context: r.error.context
      }))
    };
  }

  async cleanup() {
    this.log('🧹 Cleaning up shared resources');
    
    // Close all shared contexts
    for (const context of this.sharedContexts) {
      try {
        await context.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    this.sharedContexts = [];

    // Close shared browser
    if (this.sharedBrowser) {
      try {
        await this.sharedBrowser.close();
      } catch (error) {
        // Ignore cleanup errors
      }
      this.sharedBrowser = null;
    }
  }

  getProgress() {
    return {
      total: this.stats.total,
      completed: this.stats.completed,
      failed: this.stats.failed,
      active: this.activeJobs.size,
      percentage: this.stats.total > 0 ? 
        Math.round(((this.stats.completed + this.stats.failed) / this.stats.total) * 100) : 0
    };
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(message) {
    if (this.options.verbose) {
      console.log(message);
    }
  }
}

class Semaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.currentConcurrent = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.currentConcurrent < this.maxConcurrent) {
      this.currentConcurrent++;
      return;
    }

    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  release() {
    this.currentConcurrent--;
    
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.currentConcurrent++;
      next();
    }
  }
}