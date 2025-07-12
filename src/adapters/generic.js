import { BaseAdapter } from './base.js';

export class GenericAdapter extends BaseAdapter {
  constructor(dataType, options = {}) {
    super(dataType, options);
  }

  getConfig() {
    const baseConfig = super.getConfig();
    
    return {
      ...baseConfig,
      platform: 'generic',
      navigation: {
        strategy: 'direct',
        waitTime: 3000,
        scrollBehavior: 'auto'
      },
      selectors: this.getGenericSelectors(),
      rateLimit: {
        delay: 1000,
        maxConcurrent: 5,
        backoffMultiplier: 1.5
      }
    };
  }

  getGenericSelectors() {
    switch (this.dataType) {
      case 'articles':
      case 'news':
        return {
          itemList: 'a[href]',
          title: 'h1, .title, .headline, [data-testid*="title"]',
          content: 'article, .content, .article-content, main p',
          author: '.author, .byline, [rel="author"]',
          date: 'time, .date, .publish-date'
        };
      
      case 'products':
        return {
          itemList: 'a[href*="/product/"], a[href*="/item/"], .product-link',
          title: 'h1, .product-title, .item-title',
          price: '.price, .cost, .amount',
          description: '.description, .product-description',
          rating: '.rating, .stars, .review-score'
        };
      
      case 'links':
        return {
          itemList: 'a[href]',
          title: 'a[href]',
          url: 'a[href]'
        };
      
      case 'images':
        return {
          itemList: 'img[src]',
          src: 'img[src]',
          alt: 'img[alt]'
        };
      
      case 'text':
        return {
          itemList: 'p, .text, .content',
          content: 'p, .text, .content'
        };
      
      default:
        return {
          itemList: 'a[href], .item, .entry',
          title: 'h1, h2, h3, .title',
          content: '.content, .description, p'
        };
    }
  }

  async extract(page, navigationManager, extractorEngine, options = {}) {
    const config = this.getConfig();
    
    try {
      // For generic sites, try to detect and handle common patterns
      await this.handleCommonModals(page);
      
      if (this.dataType === 'metadata') {
        return await extractorEngine.extract(page, 'metadata');
      }
      
      if (this.dataType === 'structured') {
        return await extractorEngine.extract(page, 'structured');
      }
      
      return await this.processItems(page, navigationManager, extractorEngine, options);
      
    } catch (error) {
      console.error(`Generic extraction failed: ${error.message}`);
      throw error;
    }
  }

  async handleCommonModals(page) {
    await page.waitForTimeout(2000);
    
    // Common modal close selectors
    const modalCloseSelectors = [
      '[role="dialog"] button[aria-label*="close"]',
      '[role="dialog"] button[aria-label*="Close"]',
      '.modal button.close',
      '.popup .close',
      '.overlay .close',
      'button[data-dismiss="modal"]',
      '.modal-close',
      '.popup-close'
    ];
    
    for (const selector of modalCloseSelectors) {
      try {
        const closeButton = await page.$(selector);
        if (closeButton) {
          await closeButton.click();
          await page.waitForTimeout(1000);
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    // Handle cookie banners
    const cookieBannerSelectors = [
      'button:has-text("Accept")',
      'button:has-text("Accept All")',
      'button:has-text("OK")',
      'button:has-text("Got it")',
      '[data-testid*="cookie"] button',
      '.cookie-banner button',
      '#cookie-consent button'
    ];
    
    for (const selector of cookieBannerSelectors) {
      try {
        const acceptButton = await page.$(selector);
        if (acceptButton) {
          await acceptButton.click();
          await page.waitForTimeout(1000);
          break;
        }
      } catch (error) {
        continue;
      }
    }
  }

  async extractItemData(page, extractorEngine) {
    const config = this.getConfig();
    const selectors = config.selectors;
    
    try {
      const data = {};
      
      // Extract data based on configured selectors
      for (const [key, selector] of Object.entries(selectors)) {
        if (key === 'itemList') continue; // Skip the list selector
        
        try {
          if (key.includes('url') || key.includes('href') || key.includes('src')) {
            data[key] = await page.evaluate((sel) => {
              const element = document.querySelector(sel);
              return element ? (element.href || element.src || element.getAttribute('href') || element.getAttribute('src')) : null;
            }, selector);
          } else {
            data[key] = await page.evaluate((sel) => {
              const element = document.querySelector(sel);
              return element ? element.textContent.trim() : null;
            }, selector);
          }
        } catch (error) {
          data[key] = null;
        }
      }
      
      // Add URL and timestamp
      data.url = await page.url();
      data.extractedAt = new Date().toISOString();
      
      // Try to extract additional metadata if available
      try {
        const metadata = await extractorEngine.extract(page, 'metadata');
        if (metadata && Object.keys(metadata).length > 0) {
          data.metadata = metadata;
        }
      } catch (error) {
        // Metadata extraction is optional
      }
      
      return this.normalizeData(data);
      
    } catch (error) {
      console.warn(`Failed to extract item data: ${error.message}`);
      return null;
    }
  }

  async findItems(page, config) {
    const selector = config.selectors.itemList;
    
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
    } catch (error) {
      console.warn(`No items found with selector: ${selector}`);
      return [];
    }
    
    return await page.evaluate((sel) => {
      const elements = Array.from(document.querySelectorAll(sel));
      return elements.map((el, index) => ({
        href: el.href || el.getAttribute('href') || window.location.href + '#item-' + index,
        text: el.textContent?.trim(),
        element: el.tagName.toLowerCase()
      })).filter(item => item.href && item.href !== '#' && !item.href.includes('#item-'));
    }, selector);
  }

  validateUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

export default GenericAdapter;