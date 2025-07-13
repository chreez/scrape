/**
 * Error recovery strategies for different failure scenarios
 */

import { 
  NavigationError, 
  ExtractionError, 
  DetectionError, 
  RateLimitError 
} from './index.js';

export class ErrorRecovery {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.strategies = new Map();
    
    this.initializeStrategies();
  }

  initializeStrategies() {
    // Navigation error recovery
    this.strategies.set(NavigationError, [
      this.retryWithIncreasedTimeout.bind(this),
      this.retryWithDifferentWaitCondition.bind(this),
      this.retryWithPageReload.bind(this)
    ]);

    // Extraction error recovery
    this.strategies.set(ExtractionError, [
      this.clearLearningCache.bind(this),
      this.tryAlternativeSelectors.bind(this),
      this.fallbackToGenericExtraction.bind(this)
    ]);

    // Detection error recovery
    this.strategies.set(DetectionError, [
      this.rotateUserAgent.bind(this),
      this.addHumanLikeDelays.bind(this),
      this.enableStealthMode.bind(this)
    ]);

    // Rate limit error recovery
    this.strategies.set(RateLimitError, [
      this.waitForRateLimitReset.bind(this),
      this.reduceRequestFrequency.bind(this),
      this.switchToAuthenticatedMode.bind(this)
    ]);
  }

  async recover(error, context) {
    const strategies = this.strategies.get(error.constructor);
    
    if (!strategies) {
      return { success: false, error, message: 'No recovery strategy available' };
    }

    for (const strategy of strategies) {
      try {
        const result = await strategy(error, context);
        if (result.success) {
          return result;
        }
      } catch (strategyError) {
        console.warn(`Recovery strategy failed: ${strategyError.message}`);
      }
    }

    return { 
      success: false, 
      error, 
      message: 'All recovery strategies exhausted' 
    };
  }

  // Navigation recovery strategies
  async retryWithIncreasedTimeout(error, context) {
    if (!context.page || !context.url) {
      return { success: false };
    }

    const newTimeout = (context.timeout || 30000) * 2;
    console.log(`Retrying with increased timeout: ${newTimeout}ms`);

    try {
      await context.page.goto(context.url, { 
        waitUntil: 'domcontentloaded',
        timeout: newTimeout 
      });
      return { 
        success: true, 
        recovered: true,
        strategy: 'increased-timeout',
        newTimeout 
      };
    } catch (retryError) {
      return { success: false };
    }
  }

  async retryWithDifferentWaitCondition(error, context) {
    if (!context.page || !context.url) {
      return { success: false };
    }

    const waitConditions = ['load', 'domcontentloaded', 'networkidle'];
    
    for (const condition of waitConditions) {
      try {
        console.log(`Trying with waitUntil: ${condition}`);
        await context.page.goto(context.url, { 
          waitUntil: condition,
          timeout: context.timeout || 30000
        });
        return { 
          success: true, 
          recovered: true,
          strategy: 'wait-condition',
          condition 
        };
      } catch (retryError) {
        continue;
      }
    }

    return { success: false };
  }

  async retryWithPageReload(error, context) {
    if (!context.page) {
      return { success: false };
    }

    try {
      console.log('Attempting page reload...');
      await context.page.reload({ 
        waitUntil: 'domcontentloaded',
        timeout: context.timeout || 30000 
      });
      return { 
        success: true, 
        recovered: true,
        strategy: 'page-reload' 
      };
    } catch (reloadError) {
      return { success: false };
    }
  }

  // Extraction recovery strategies
  async clearLearningCache(error, context) {
    if (!context.learningStorage || !context.hostname) {
      return { success: false };
    }

    try {
      console.log(`Clearing learning cache for ${context.hostname}`);
      await context.learningStorage.invalidateCache(
        context.hostname, 
        context.contentType
      );
      return { 
        success: true, 
        recovered: true,
        strategy: 'clear-cache',
        clearedDomain: context.hostname 
      };
    } catch (cacheError) {
      return { success: false };
    }
  }

  async tryAlternativeSelectors(error, context) {
    if (!context.page || !context.extractorType) {
      return { success: false };
    }

    const alternativeSelectors = {
      title: ['h1', '.title', '[data-testid*="title"]', 'meta[property="og:title"]'],
      content: ['article', 'main', '.content', '[role="main"]'],
      description: ['.description', '.summary', 'meta[name="description"]']
    };

    const selectors = alternativeSelectors[context.extractorType];
    if (!selectors) {
      return { success: false };
    }

    for (const selector of selectors) {
      try {
        const element = await context.page.$(selector);
        if (element) {
          const text = await element.textContent();
          if (text && text.trim().length > 0) {
            return { 
              success: true, 
              recovered: true,
              strategy: 'alternative-selector',
              selector,
              data: text.trim()
            };
          }
        }
      } catch (selectorError) {
        continue;
      }
    }

    return { success: false };
  }

  async fallbackToGenericExtraction(error, context) {
    if (!context.page) {
      return { success: false };
    }

    try {
      console.log('Falling back to generic text extraction');
      const text = await context.page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        // Get all text content
        return document.body.innerText || document.body.textContent || '';
      });

      if (text && text.trim().length > 100) {
        return { 
          success: true, 
          recovered: true,
          strategy: 'generic-fallback',
          data: { textContent: text.trim() }
        };
      }
    } catch (fallbackError) {
      // Continue to next strategy
    }

    return { success: false };
  }

  // Detection recovery strategies
  async rotateUserAgent(error, context) {
    if (!context.browser) {
      return { success: false };
    }

    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    ];

    const newUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    try {
      console.log('Creating new context with different user agent');
      const newContext = await context.browser.newContext({
        userAgent: newUserAgent
      });
      
      return { 
        success: true, 
        recovered: true,
        strategy: 'rotate-user-agent',
        newContext,
        userAgent: newUserAgent
      };
    } catch (uaError) {
      return { success: false };
    }
  }

  async addHumanLikeDelays(error, context) {
    console.log('Adding human-like delays to actions');
    
    const delays = {
      beforeClick: () => 500 + Math.random() * 1500,
      beforeType: () => 100 + Math.random() * 300,
      betweenActions: () => 1000 + Math.random() * 2000,
      scrollDelay: () => 300 + Math.random() * 700
    };

    return { 
      success: true, 
      recovered: true,
      strategy: 'human-delays',
      delays 
    };
  }

  async enableStealthMode(error, context) {
    console.log('Enabling enhanced stealth mode');
    
    const stealthConfig = {
      hideWebdriver: true,
      mockPermissions: true,
      randomizeViewport: true,
      emulateTimezone: true,
      spoofCanvas: true
    };

    return { 
      success: true, 
      recovered: true,
      strategy: 'stealth-mode',
      config: stealthConfig 
    };
  }

  // Rate limit recovery strategies
  async waitForRateLimitReset(error, context) {
    const retryAfter = error.retryAfter || 60;
    
    console.log(`Waiting ${retryAfter} seconds for rate limit reset...`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));

    return { 
      success: true, 
      recovered: true,
      strategy: 'rate-limit-wait',
      waitedSeconds: retryAfter 
    };
  }

  async reduceRequestFrequency(error, context) {
    const currentDelay = context.requestDelay || 1000;
    const newDelay = currentDelay * 2;

    console.log(`Reducing request frequency: ${newDelay}ms between requests`);

    return { 
      success: true, 
      recovered: true,
      strategy: 'reduce-frequency',
      newDelay 
    };
  }

  async switchToAuthenticatedMode(error, context) {
    // This would require API keys or cookies
    console.log('Authentication not implemented yet');
    return { success: false };
  }
}

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.halfOpenRetries = options.halfOpenRetries || 3;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(fn, fallback = null) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        if (fallback) {
          return await fallback();
        }
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.halfOpenRetries) {
        this.state = 'CLOSED';
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}