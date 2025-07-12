import { chromium } from 'playwright';
import { StealthManager } from './stealth/manager.js';
import { ExtractorEngine } from './extractors/engine.js';
import { ContextGenerator } from './context/generator.js';
import { LearningStorage } from './learning/storage.js';
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
    this.learningStorage = new LearningStorage();
  }

  async extract(url) {
    const startTime = Date.now();
    const hostname = new URL(url).hostname;
    
    // Create unique subdirectory for this extraction
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const safeDomain = hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueDir = `${safeDomain}_${timestamp}`;
    const fullOutputDir = path.join(this.options.outputDir, uniqueDir);
    
    // Update options to use the unique directory
    this.currentOutputDir = fullOutputDir;
    
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
      
      // Try learned patterns first, then fallback to default extraction
      let extractedData = null;
      let usedLearning = false;
      
      try {
        extractedData = await this.tryLearnedExtraction(page, pageAnalysis, hostname);
        if (extractedData) {
          usedLearning = true;
          this.log(`🧠 Used learned patterns for ${hostname}`);
        }
      } catch (error) {
        this.log(`⚠️ Learned pattern failed: ${error.message}`);
        await this.learningStorage.recordFailure(hostname, pageAnalysis.contentType, error.message);
      }
      
      // Fallback to default extraction if learning failed or no patterns exist
      if (!extractedData) {
        extractedData = await this.extractAllData(page, pageAnalysis);
        this.log(`🔧 Used default extraction for ${hostname}`);
      }
      
      // Record successful extraction for learning
      if (extractedData && this.isValidExtraction(extractedData)) {
        const timing = {
          delay: 3000,
          timeout: this.options.timeout,
          totalTime: Date.now() - startTime
        };
        
        await this.learningStorage.recordSuccess(
          hostname, 
          pageAnalysis.contentType, 
          {
            platform: pageAnalysis.platform,
            selectors: this.getUsedSelectors(pageAnalysis.contentType),
            extractorTypes: this.getSuccessfulExtractors(extractedData),
            timing: timing
          },
          usedLearning ? 'learned' : 'default'
        );
      }
      
      // Generate context files
      const contextFiles = await this.contextGenerator.generate(extractedData, pageAnalysis);
      
      // Save to unique output directory
      await this.saveContextFiles(contextFiles);
      
      // Store the actual output directory in the result
      contextFiles._outputDir = this.currentOutputDir;
      
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

  async extractAllData(page, pageAnalysis, learnedPatterns = null) {
    this.log('📤 Extracting data...');
    
    const data = {
      url: pageAnalysis.url,
      platform: pageAnalysis.platform,
      contentType: pageAnalysis.contentType,
      timestamp: pageAnalysis.timestamp
    };
    
    try {
      // Use learned extractors if available, otherwise use default approach
      if (learnedPatterns && learnedPatterns.extractors) {
        this.log(`🧠 Using learned extractor sequence: ${learnedPatterns.extractors.join(', ')}`);
        
        for (const extractorType of learnedPatterns.extractors) {
          try {
            // Convert learned selectors to extractor-compatible format
            const config = this.buildExtractorConfig(extractorType, learnedPatterns, pageAnalysis.contentType);
            
            const result = await this.extractor.extract(page, extractorType, config);
            if (result) {
              data[this.mapExtractorToDataKey(extractorType)] = result;
              this.log(`✅ ${extractorType} extracted (learned with custom selectors)`);
            }
          } catch (error) {
            this.log(`⚠️ Learned ${extractorType} extractor failed: ${error.message}`);
          }
        }
      } else {
        // Default extraction approach
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
      }
      
      return data;
      
    } catch (error) {
      this.log(`⚠️ Extraction error: ${error.message}`);
      throw error;
    }
  }

  mapExtractorToDataKey(extractorType) {
    const mapping = {
      'metadata': 'metadata',
      'text': 'textContent',
      'articles': 'article',
      'products': 'product',
      'profiles': 'profile',
      'video': 'video',
      'structured': 'structured',
      'images': 'images',
      'links': 'links'
    };
    
    return mapping[extractorType] || extractorType;
  }

  async saveContextFiles(contextFiles) {
    // Ensure unique output directory exists
    await fs.mkdir(this.currentOutputDir, { recursive: true });
    
    const savePromises = [];
    
    for (const [filename, content] of Object.entries(contextFiles)) {
      if (content && content.length > 0) {
        const filePath = path.join(this.currentOutputDir, filename);
        savePromises.push(fs.writeFile(filePath, content, 'utf8'));
      }
    }
    
    await Promise.all(savePromises);
    this.log(`💾 Saved ${Object.keys(contextFiles).length} context files`);
  }

  async tryLearnedExtraction(page, pageAnalysis, hostname) {
    const learnedPatterns = await this.learningStorage.getLearnedPatterns(hostname, pageAnalysis.contentType);
    
    if (!learnedPatterns || learnedPatterns.confidence < 0.4) {
      return null; // No learned patterns or confidence too low
    }
    
    this.log(`🧠 Trying learned patterns for ${hostname} (confidence: ${Math.round(learnedPatterns.confidence * 100)}%)`);
    
    // Use learned timing if available
    if (learnedPatterns.timing && learnedPatterns.timing.delay) {
      await page.waitForTimeout(learnedPatterns.timing.delay);
    }
    
    // Try extraction with learned patterns
    return await this.extractAllData(page, pageAnalysis, learnedPatterns);
  }

  isValidExtraction(extractedData) {
    // Basic validation - check if we extracted meaningful data
    if (!extractedData) return false;
    
    // Check for basic metadata
    if (!extractedData.metadata || !extractedData.metadata.title) return false;
    
    // Check if we have any meaningful content (relaxed validation)
    const hasContent = extractedData.textContent || 
                      extractedData.article || 
                      extractedData.structured ||
                      extractedData.metadata.description;
    
    if (!hasContent) return false;
    
    // Looks like a valid extraction
    return true;
  }

  getUsedSelectors(contentType) {
    // Return the selectors that would typically be used for this content type
    // This is a simplified version - in practice you'd track which selectors actually worked
    const selectorMap = {
      'article': ['h1', '.title', '.article-content', '.content'],
      'product': ['.product-title', '.price', '.description'],
      'social-profile': ['.username', '.bio', '.follower-count'],
      'video': ['.video-title', '.video-description'],
      'generic': ['h1', '.content', 'article', 'main']
    };
    
    return selectorMap[contentType] || selectorMap['generic'];
  }

  buildExtractorConfig(extractorType, learnedPatterns, contentType) {
    // Convert learned selectors array to extractor-specific config
    const learnedSelectors = learnedPatterns.selectors?.[contentType] || 
                            learnedPatterns.selectors?.[extractorType] || [];
    
    if (!learnedSelectors || learnedSelectors.length === 0) {
      return {}; // No learned selectors, use defaults
    }
    
    // Convert array of selectors to extractor-specific format
    switch (extractorType) {
      case 'text':
        return {
          selectors: {
            title: learnedSelectors.find(s => s.includes('h1') || s.includes('title')) || learnedSelectors[0],
            content: learnedSelectors.find(s => s.includes('content') || s.includes('article') || s.includes('main')) || learnedSelectors.join(', '),
            description: learnedSelectors.find(s => s.includes('description')) || '',
            tags: learnedSelectors.find(s => s.includes('tag')) || ''
          }
        };
      
      case 'articles':
        return {
          selectors: {
            title: learnedSelectors[0] || 'h1',
            content: learnedSelectors.join(', '),
            author: '.author, .byline, [data-author]',
            publishDate: '.date, .publish-date, time'
          }
        };
      
      case 'metadata':
        return {}; // Metadata extractor uses meta tags, not learned selectors
      
      default:
        // For other extractors, convert first selector
        return {
          selector: learnedSelectors[0] || undefined
        };
    }
  }

  getSuccessfulExtractors(extractedData) {
    const successfulExtractors = [];
    
    if (extractedData.metadata) successfulExtractors.push('metadata');
    if (extractedData.textContent) successfulExtractors.push('text');
    if (extractedData.article) successfulExtractors.push('articles');
    if (extractedData.product) successfulExtractors.push('products');
    if (extractedData.profile) successfulExtractors.push('profiles');
    if (extractedData.video) successfulExtractors.push('video');
    if (extractedData.structured) successfulExtractors.push('structured');
    if (extractedData.images) successfulExtractors.push('images');
    
    return successfulExtractors;
  }

  log(message) {
    if (this.options.verbose) {
      console.log(message);
    }
  }
}