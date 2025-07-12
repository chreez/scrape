import { chromium } from 'playwright';

export class StealthManager {
  constructor(options = {}) {
    this.options = {
      headless: true,
      enableJavaScript: true,
      enableImages: false,
      enableCSS: false,
      viewport: { width: 1920, height: 1080 },
      userAgent: this.getRandomUserAgent(),
      locale: 'en-US',
      timezone: 'America/New_York',
      ...options
    };
  }

  async launchBrowser() {
    const launchOptions = {
      headless: this.options.headless,
      args: this.getBrowserArgs(),
      ignoreDefaultArgs: ['--enable-blink-features=AutomationControlled'],
      devtools: false
    };

    const browser = await chromium.launch(launchOptions);
    return browser;
  }

  async createContext(browser) {
    const contextOptions = {
      userAgent: this.options.userAgent,
      viewport: this.options.viewport,
      locale: this.options.locale,
      timezoneId: this.options.timezone,
      permissions: [],
      hasTouch: false,
      isMobile: false,
      deviceScaleFactor: 1,
      javaScriptEnabled: this.options.enableJavaScript
    };

    const context = await browser.newContext(contextOptions);
    
    // Add stealth scripts
    await this.injectStealthScripts(context);
    
    // Configure request interception
    await this.setupRequestInterception(context);
    
    return context;
  }

  getBrowserArgs() {
    return [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-dev-shm-usage',
      '--disable-domain-reliability',
      '--disable-extensions',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-translate',
      '--disable-web-security',
      '--metrics-recording-only',
      '--no-first-run',
      '--no-default-browser-check',
      '--password-store=basic',
      '--use-mock-keychain',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ];
  }

  getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  async injectStealthScripts(context) {
    // Remove webdriver property
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    // Override plugins array
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    // Override languages
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    // Override permissions
    await context.addInitScript(() => {
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    // Override chrome property
    await context.addInitScript(() => {
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
    });

    // Add realistic hardware concurrency
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 4,
      });
    });
  }

  async setupRequestInterception(context) {
    await context.route('**/*', async (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      
      // Block images, stylesheets, fonts for faster loading (if configured)
      if (!this.options.enableImages && resourceType === 'image') {
        return route.abort();
      }
      
      if (!this.options.enableCSS && (resourceType === 'stylesheet' || resourceType === 'font')) {
        return route.abort();
      }
      
      // Block ads and tracking
      const url = request.url().toLowerCase();
      if (this.isAdOrTracking(url)) {
        return route.abort();
      }
      
      // Add realistic headers
      const headers = {
        ...request.headers(),
        'Accept': this.getAcceptHeader(resourceType),
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': this.getSecFetchDest(resourceType),
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      };
      
      route.continue({ headers });
    });
  }

  isAdOrTracking(url) {
    const adPatterns = [
      'doubleclick.net',
      'googleadservices.com',
      'googlesyndication.com',
      'amazon-adsystem.com',
      'facebook.com/tr',
      'google-analytics.com',
      'googletagmanager.com',
      'hotjar.com',
      'mixpanel.com',
      'segment.com',
      'amplitude.com'
    ];
    
    return adPatterns.some(pattern => url.includes(pattern));
  }

  getAcceptHeader(resourceType) {
    switch (resourceType) {
      case 'document':
        return 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8';
      case 'stylesheet':
        return 'text/css,*/*;q=0.1';
      case 'script':
        return '*/*';
      case 'image':
        return 'image/webp,image/apng,image/*,*/*;q=0.8';
      default:
        return '*/*';
    }
  }

  getSecFetchDest(resourceType) {
    switch (resourceType) {
      case 'document':
        return 'document';
      case 'stylesheet':
        return 'style';
      case 'script':
        return 'script';
      case 'image':
        return 'image';
      default:
        return 'empty';
    }
  }

  async addHumanBehavior(page) {
    // Random mouse movements
    await this.simulateMouseMovement(page);
    
    // Random scrolling
    await this.simulateScrolling(page);
    
    // Random delays
    await this.randomDelay(1000, 3000);
  }

  async simulateMouseMovement(page) {
    const viewport = page.viewportSize();
    if (!viewport) return;
    
    const moves = Math.floor(Math.random() * 5) + 1;
    
    for (let i = 0; i < moves; i++) {
      const x = Math.floor(Math.random() * viewport.width);
      const y = Math.floor(Math.random() * viewport.height);
      
      await page.mouse.move(x, y, { steps: 10 });
      await this.randomDelay(100, 500);
    }
  }

  async simulateScrolling(page) {
    const scrolls = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < scrolls; i++) {
      const deltaY = Math.floor(Math.random() * 500) + 100;
      
      await page.mouse.wheel(0, deltaY);
      await this.randomDelay(200, 800);
    }
  }

  async randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async detectCaptcha(page) {
    const captchaSelectors = [
      '[data-testid*="captcha"]',
      '.captcha',
      '.recaptcha',
      '#captcha',
      'iframe[src*="recaptcha"]',
      'iframe[src*="hcaptcha"]'
    ];
    
    for (const selector of captchaSelectors) {
      const element = await page.$(selector);
      if (element) {
        return true;
      }
    }
    
    return false;
  }

  async detectBlocking(page) {
    const blockingIndicators = [
      'Access Denied',
      'Blocked',
      'Bot detected',
      'Please verify',
      'Suspicious activity',
      'Rate limited',
      'Too many requests'
    ];
    
    const pageText = await page.textContent('body').catch(() => '');
    
    return blockingIndicators.some(indicator => 
      pageText.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  async handleBlocking(page) {
    const isCaptcha = await this.detectCaptcha(page);
    const isBlocked = await this.detectBlocking(page);
    
    if (isCaptcha) {
      console.warn('CAPTCHA detected - manual intervention may be required');
      return 'captcha';
    }
    
    if (isBlocked) {
      console.warn('Access blocked - may need to retry with different approach');
      return 'blocked';
    }
    
    return 'clear';
  }
}