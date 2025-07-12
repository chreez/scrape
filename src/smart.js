import { chromium } from 'playwright';
import { StealthManager } from './stealth/manager.js';
import { ExtractorEngine } from './extractors/engine.js';
import { ContextGenerator } from './context/generator.js';
import fs from 'fs/promises';
import path from 'path';

export class SmartScraper {
  constructor(options = {}) {
    this.options = {
      headless: true,
      verbose: false,
      outputDir: 'scrape-output',
      timeout: 30000,
      ...options
    };
    
    this.stealth = new StealthManager(this.options);
    this.extractor = new ExtractorEngine(this.options);
    this.contextGenerator = new ContextGenerator(this.options);
  }

  async extract(url) {
    const browser = await this.stealth.launchBrowser();
    const context = await this.stealth.createContext(browser);
    const page = await context.newPage();
    
    try {
      this.log(`🌐 Navigating to ${url}...`);
      
      // Navigate with intelligent timeout handling
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.options.timeout 
      });
      
      // Wait for content to stabilize
      await page.waitForTimeout(3000);
      
      // Analyze page and determine content type
      const pageAnalysis = await this.analyzePage(page);
      this.log(`📊 Detected content type: ${pageAnalysis.contentType}`);
      
      // Extract all relevant data
      const extractedData = await this.extractAllData(page, pageAnalysis);
      
      // Generate context files
      const contextFiles = await this.contextGenerator.generate(extractedData, pageAnalysis);
      
      // Save to output directory
      await this.saveContextFiles(contextFiles);
      
      return contextFiles;
      
    } finally {
      await browser.close();
    }
  }

  async analyzePage(page) {
    this.log('🔍 Analyzing page structure...');
    
    const analysis = await page.evaluate(() => {
      const url = window.location.href;
      const hostname = window.location.hostname.toLowerCase();
      const title = document.title;
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      
      // Detect content type based on URL patterns and page structure
      let contentType = 'generic';
      let platform = 'unknown';
      
      // Platform detection
      if (hostname.includes('instagram.com')) {
        platform = 'instagram';
        if (url.includes('/reel/')) contentType = 'social-video';
        else if (url.includes('/p/')) contentType = 'social-post';
        else contentType = 'social-profile';
      } else if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        platform = 'youtube';
        contentType = 'video';
      } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        platform = 'twitter';
        contentType = 'social-post';
      } else if (hostname.includes('reddit.com')) {
        platform = 'reddit';
        contentType = 'forum-discussion';
      } else if (hostname.includes('github.com')) {
        platform = 'github';
        contentType = 'code-repository';
      } else if (hostname.includes('wikipedia.org')) {
        platform = 'wikipedia';
        contentType = 'encyclopedia-article';
      } else if (hostname.includes('amazon.com')) {
        platform = 'amazon';
        contentType = 'product';
      } else if (hostname.includes('news.ycombinator.com')) {
        platform = 'hackernews';
        contentType = 'news-aggregator';
      }
      
      // Content type detection by structure
      if (contentType === 'generic') {
        // Article detection
        if (document.querySelector('article') || 
            document.querySelector('[role="article"]') ||
            document.querySelector('.article-content, .post-content, .entry-content')) {
          contentType = 'article';
        }
        // Blog detection
        else if (document.querySelector('.blog-post, .post, .entry') ||
                 title.toLowerCase().includes('blog') ||
                 metaDescription.toLowerCase().includes('blog')) {
          contentType = 'blog-post';
        }
        // Product page detection
        else if (document.querySelector('.price, .product-price, .cost') ||
                 document.querySelector('.add-to-cart, .buy-now') ||
                 metaDescription.toLowerCase().includes('price')) {
          contentType = 'product';
        }
        // Documentation detection
        else if (hostname.includes('docs.') || 
                 title.toLowerCase().includes('documentation') ||
                 document.querySelector('.documentation, .docs')) {
          contentType = 'documentation';
        }
      }
      
      // Count different content elements
      const stats = {
        paragraphs: document.querySelectorAll('p').length,
        headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
        links: document.querySelectorAll('a[href]').length,
        images: document.querySelectorAll('img').length,
        videos: document.querySelectorAll('video').length,
        codeBlocks: document.querySelectorAll('pre, code').length,
        forms: document.querySelectorAll('form').length,
        tables: document.querySelectorAll('table').length
      };
      
      return {
        url,
        hostname,
        title,
        metaDescription,
        contentType,
        platform,
        stats,
        timestamp: new Date().toISOString()
      };
    });
    
    this.log(`📈 Page stats: ${analysis.stats.paragraphs}p, ${analysis.stats.headings}h, ${analysis.stats.links}l`);
    return analysis;
  }

  async extractAllData(page, pageAnalysis) {
    this.log('📤 Extracting data...');
    
    const data = {
      url: pageAnalysis.url,
      platform: pageAnalysis.platform,
      contentType: pageAnalysis.contentType,
      timestamp: pageAnalysis.timestamp
    };
    
    try {
      // Always extract basic metadata
      data.metadata = await this.extractor.extract(page, 'metadata');
      this.log('✅ Metadata extracted');
      
      // Extract text content
      data.textContent = await this.extractor.extract(page, 'text');
      this.log('✅ Text content extracted');
      
      // Extract based on content type
      switch (pageAnalysis.contentType) {
        case 'article':
        case 'blog-post':
        case 'encyclopedia-article':
          data.article = await this.extractor.extract(page, 'articles');
          break;
          
        case 'product':
          data.product = await this.extractor.extract(page, 'products');
          break;
          
        case 'social-profile':
          data.profile = await this.extractor.extract(page, 'profiles');
          break;
          
        case 'social-video':
        case 'video':
          data.video = await this.extractor.extract(page, 'video');
          break;
          
        case 'social-post':
        case 'forum-discussion':
          // Extract links and text for discussions
          data.links = await this.extractor.extract(page, 'links');
          break;
      }
      
      // Always try to extract structured data
      try {
        data.structured = await this.extractor.extract(page, 'structured');
        if (data.structured && data.structured.length > 0) {
          this.log('✅ Structured data extracted');
        }
      } catch (error) {
        // Structured data is optional
      }
      
      // Extract images if significant
      if (pageAnalysis.stats.images > 5) {
        data.images = await this.extractor.extract(page, 'images');
        this.log(`✅ ${data.images?.length || 0} images extracted`);
      }
      
      return data;
      
    } catch (error) {
      this.log(`⚠️ Extraction error: ${error.message}`);
      throw error;
    }
  }

  async saveContextFiles(contextFiles) {
    // Ensure output directory exists
    await fs.mkdir(this.options.outputDir, { recursive: true });
    
    const savePromises = [];
    
    for (const [filename, content] of Object.entries(contextFiles)) {
      if (content && content.length > 0) {
        const filePath = path.join(this.options.outputDir, filename);
        savePromises.push(fs.writeFile(filePath, content, 'utf8'));
      }
    }
    
    await Promise.all(savePromises);
    this.log(`💾 Saved ${Object.keys(contextFiles).length} context files`);
  }

  log(message) {
    if (this.options.verbose) {
      console.log(message);
    }
  }
}