export class BaseAdapter {
  constructor(dataType, options = {}) {
    this.dataType = dataType;
    this.options = options;
    this.config = this.getConfig();
  }

  getConfig() {
    return {
      platform: 'base',
      dataType: this.dataType,
      selectors: {},
      navigation: {
        strategy: 'direct',
        waitTime: 3000,
        scrollBehavior: 'auto'
      },
      extraction: {
        batchSize: 10,
        maxRetries: 3,
        timeout: 30000
      },
      rateLimit: {
        delay: 1000,
        maxConcurrent: 3,
        backoffMultiplier: 1.5
      }
    };
  }

  async extract(page, navigationManager, extractorEngine, options = {}) {
    throw new Error('extract() method must be implemented by subclass');
  }

  async findItems(page, config) {
    const selector = config.selectors.itemList;
    if (!selector) {
      throw new Error(`No itemList selector defined for ${this.config.platform}`);
    }

    await page.waitForSelector(selector, { timeout: this.config.extraction.timeout });
    
    return await page.evaluate((sel) => {
      const elements = Array.from(document.querySelectorAll(sel));
      return elements.map(el => ({
        href: el.href || el.getAttribute('href'),
        text: el.textContent?.trim(),
        element: el.outerHTML
      }));
    }, selector);
  }

  async extractFromItem(page, itemUrl, extractorEngine) {
    try {
      await page.goto(itemUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(this.config.navigation.waitTime);
      
      return await this.extractItemData(page, extractorEngine);
    } catch (error) {
      console.warn(`Failed to extract from ${itemUrl}: ${error.message}`);
      return null;
    }
  }

  async extractItemData(page, extractorEngine) {
    throw new Error('extractItemData() method must be implemented by subclass');
  }

  async processItems(page, navigationManager, extractorEngine, options = {}) {
    const config = this.getConfig();
    const maxItems = options.maxItems || config.extraction.batchSize;
    
    const items = await this.findItems(page, config);
    const limitedItems = items.slice(0, maxItems);
    
    console.log(`Found ${items.length} items, processing ${limitedItems.length}`);
    
    const results = [];
    
    for (let i = 0; i < limitedItems.length; i++) {
      const item = limitedItems[i];
      console.log(`Processing item ${i + 1}/${limitedItems.length}: ${item.href}`);
      
      if (item.href) {
        const data = await this.extractFromItem(page, item.href, extractorEngine);
        if (data) {
          results.push(data);
        }
      }
      
      // Rate limiting
      if (i < limitedItems.length - 1) {
        await page.waitForTimeout(config.rateLimit.delay);
      }
    }
    
    return results;
  }

  validateUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  normalizeData(rawData) {
    return {
      extractedAt: new Date().toISOString(),
      platform: this.config.platform,
      dataType: this.dataType,
      ...rawData
    };
  }

  async handlePagination(page, navigationManager, options = {}) {
    const pages = options.pages || 1;
    let allResults = [];
    
    for (let pageNum = 1; pageNum <= pages; pageNum++) {
      console.log(`Processing page ${pageNum}/${pages}`);
      
      const pageResults = await this.processItems(page, navigationManager, null, options);
      allResults = allResults.concat(pageResults);
      
      if (pageNum < pages) {
        const hasNextPage = await this.navigateToNextPage(page, navigationManager);
        if (!hasNextPage) {
          console.log('No more pages available');
          break;
        }
      }
    }
    
    return allResults;
  }

  async navigateToNextPage(page, navigationManager) {
    // Default implementation - look for common pagination patterns
    const nextSelectors = [
      'a[aria-label*="Next"]',
      'a[aria-label*="next"]', 
      '.next',
      '.pagination-next',
      '[data-testid*="next"]'
    ];
    
    for (const selector of nextSelectors) {
      try {
        const nextButton = await page.$(selector);
        if (nextButton) {
          await nextButton.click();
          await page.waitForTimeout(this.config.navigation.waitTime);
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    
    return false;
  }
}