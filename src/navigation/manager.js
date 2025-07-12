export class NavigationManager {
  constructor(options = {}) {
    this.options = options;
    this.strategies = new Map();
    this.initializeStrategies();
  }

  initializeStrategies() {
    this.strategies.set('direct', new DirectNavigationStrategy());
    this.strategies.set('list-then-detail', new ListThenDetailStrategy());
    this.strategies.set('infinite-scroll', new InfiniteScrollStrategy());
    this.strategies.set('paginated', new PaginatedStrategy());
    this.strategies.set('modal-overlay', new ModalOverlayStrategy());
  }

  async navigateTo(page, url, config = {}) {
    const strategy = config.strategy || 'direct';
    const navigationStrategy = this.strategies.get(strategy);
    
    if (!navigationStrategy) {
      throw new Error(`Unknown navigation strategy: ${strategy}`);
    }
    
    return await navigationStrategy.navigate(page, url, config);
  }

  async waitForContent(page, config = {}) {
    const waitTime = config.waitTime || 3000;
    const selector = config.contentSelector;
    
    if (selector) {
      await page.waitForSelector(selector, { timeout: waitTime });
    } else {
      await page.waitForTimeout(waitTime);
    }
  }

  async scrollToLoadContent(page, config = {}) {
    const scrollBehavior = config.scrollBehavior || 'auto';
    const maxScrolls = config.maxScrolls || 3;
    
    if (scrollBehavior === 'infinite') {
      return await this.infiniteScroll(page, maxScrolls);
    } else if (scrollBehavior === 'pagination') {
      return await this.handlePagination(page, config);
    }
    
    // Default: scroll to bottom once
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await page.waitForTimeout(2000);
  }

  async infiniteScroll(page, maxScrolls = 5) {
    let scrollCount = 0;
    let previousHeight = 0;
    
    while (scrollCount < maxScrolls) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      
      if (currentHeight === previousHeight) {
        break; // No more content loading
      }
      
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await page.waitForTimeout(2000);
      
      previousHeight = currentHeight;
      scrollCount++;
    }
    
    return scrollCount;
  }

  async handlePagination(page, config = {}) {
    const nextSelector = config.nextSelector || 'a[aria-label*="next"], .pagination-next';
    const maxPages = config.maxPages || 5;
    
    for (let pageNum = 1; pageNum < maxPages; pageNum++) {
      const nextButton = await page.$(nextSelector);
      
      if (!nextButton) {
        break;
      }
      
      await nextButton.click();
      await this.waitForContent(page, config);
    }
  }
}

class DirectNavigationStrategy {
  async navigate(page, url, config = {}) {
    await page.goto(url, { 
      waitUntil: config.waitUntil || 'domcontentloaded',
      timeout: config.timeout || 30000
    });
    
    await page.waitForTimeout(config.waitTime || 3000);
    return true;
  }
}

class ListThenDetailStrategy {
  async navigate(page, url, config = {}) {
    // First navigate to the list page
    await page.goto(url, { 
      waitUntil: config.waitUntil || 'domcontentloaded',
      timeout: config.timeout || 30000
    });
    
    await page.waitForTimeout(config.waitTime || 3000);
    
    // Find items on the list page
    if (config.itemSelector) {
      await page.waitForSelector(config.itemSelector, { timeout: 10000 });
    }
    
    return true;
  }
}

class InfiniteScrollStrategy {
  async navigate(page, url, config = {}) {
    await page.goto(url, { 
      waitUntil: config.waitUntil || 'domcontentloaded',
      timeout: config.timeout || 30000
    });
    
    await page.waitForTimeout(config.waitTime || 3000);
    
    // Perform infinite scroll to load more content
    const scrollManager = new NavigationManager();
    await scrollManager.infiniteScroll(page, config.maxScrolls || 5);
    
    return true;
  }
}

class PaginatedStrategy {
  async navigate(page, url, config = {}) {
    await page.goto(url, { 
      waitUntil: config.waitUntil || 'domcontentloaded',
      timeout: config.timeout || 30000
    });
    
    await page.waitForTimeout(config.waitTime || 3000);
    
    // Handle pagination if specified
    if (config.enablePagination) {
      const scrollManager = new NavigationManager();
      await scrollManager.handlePagination(page, config);
    }
    
    return true;
  }
}

class ModalOverlayStrategy {
  async navigate(page, url, config = {}) {
    await page.goto(url, { 
      waitUntil: config.waitUntil || 'domcontentloaded',
      timeout: config.timeout || 30000
    });
    
    await page.waitForTimeout(config.waitTime || 3000);
    
    // Handle modal overlays (common in social media)
    await this.dismissModals(page, config);
    
    return true;
  }
  
  async dismissModals(page, config = {}) {
    const modalSelectors = [
      '[role="dialog"] button[aria-label*="close"]',
      '[role="dialog"] button[aria-label*="Close"]',
      '.modal button.close',
      '[data-testid*="close"]',
      '.close-button'
    ];
    
    for (const selector of modalSelectors) {
      try {
        const closeButton = await page.$(selector);
        if (closeButton) {
          await closeButton.click();
          await page.waitForTimeout(1000);
        }
      } catch (error) {
        // Continue if modal dismiss fails
        continue;
      }
    }
  }
}