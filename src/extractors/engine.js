export class ExtractorEngine {
  constructor(options = {}) {
    this.options = options;
    this.extractors = new Map();
    this.initializeExtractors();
  }

  initializeExtractors() {
    this.extractors.set('text', new TextExtractor());
    this.extractors.set('links', new LinkExtractor());
    this.extractors.set('images', new ImageExtractor());
    this.extractors.set('audio', new AudioExtractor());
    this.extractors.set('video', new VideoExtractor());
    this.extractors.set('metadata', new MetadataExtractor());
    this.extractors.set('structured', new StructuredDataExtractor());
    this.extractors.set('profiles', new ProfileExtractor());
    this.extractors.set('products', new ProductExtractor());
    this.extractors.set('articles', new ArticleExtractor());
  }

  async extract(page, dataType, config = {}) {
    const extractor = this.extractors.get(dataType);
    
    if (!extractor) {
      throw new Error(`No extractor found for data type: ${dataType}`);
    }
    
    return await extractor.extract(page, config);
  }

  async extractMultiple(page, dataTypes, config = {}) {
    const results = {};
    
    for (const dataType of dataTypes) {
      try {
        results[dataType] = await this.extract(page, dataType, config);
      } catch (error) {
        console.warn(`Failed to extract ${dataType}: ${error.message}`);
        results[dataType] = null;
      }
    }
    
    return results;
  }

  async extractWithSelectors(page, selectors = {}) {
    const results = {};
    
    for (const [key, selector] of Object.entries(selectors)) {
      try {
        results[key] = await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          return element ? element.textContent.trim() : null;
        }, selector);
      } catch (error) {
        console.warn(`Failed to extract with selector ${key}: ${error.message}`);
        results[key] = null;
      }
    }
    
    return results;
  }
}

class BaseExtractor {
  async extract(page, config = {}) {
    throw new Error('extract() method must be implemented by subclass');
  }

  async safeExtract(page, selector, attribute = 'textContent') {
    try {
      return await page.evaluate((sel, attr) => {
        const element = document.querySelector(sel);
        if (!element) return null;
        
        if (attr === 'textContent') return element.textContent?.trim();
        if (attr === 'innerHTML') return element.innerHTML;
        if (attr === 'outerHTML') return element.outerHTML;
        
        return element.getAttribute(attr);
      }, selector, attribute);
    } catch (error) {
      return null;
    }
  }

  async extractAll(page, selector, attribute = 'textContent') {
    try {
      return await page.evaluate((sel, attr) => {
        const elements = Array.from(document.querySelectorAll(sel));
        return elements.map(el => {
          if (attr === 'textContent') return el.textContent?.trim();
          if (attr === 'innerHTML') return el.innerHTML;
          if (attr === 'outerHTML') return el.outerHTML;
          return el.getAttribute(attr);
        });
      }, selector, attribute);
    } catch (error) {
      return [];
    }
  }
}

class TextExtractor extends BaseExtractor {
  async extract(page, config = {}) {
    const selectors = config.selectors || {
      title: 'h1, .title, [data-testid*="title"]',
      description: '.description, [data-testid*="description"]',
      content: '.content, main, article, .post-content',
      tags: '.tag, .hashtag, [data-testid*="tag"]'
    };

    const results = {};
    
    for (const [key, selector] of Object.entries(selectors)) {
      if (key === 'content') {
        // For content, extract all paragraphs and text blocks
        results[key] = await this.extractFullContent(page, selector);
      } else if (key === 'tags' || Array.isArray(selector)) {
        results[key] = await this.extractAll(page, Array.isArray(selector) ? selector[0] : selector);
      } else {
        results[key] = await this.safeExtract(page, selector);
      }
    }
    
    return results;
  }

  async extractFullContent(page, contentSelector) {
    try {
      return await page.evaluate((sel) => {
        // Try multiple strategies to get comprehensive content
        const strategies = [
          // Strategy 1: Main content area + all paragraphs
          () => {
            const main = document.querySelector(sel);
            if (main) {
              const paragraphs = main.querySelectorAll('p, div.paragraph, .content-block');
              return Array.from(paragraphs).map(p => p.textContent?.trim()).filter(Boolean).join('\n\n');
            }
            return null;
          },
          
          // Strategy 2: All paragraphs in main content areas
          () => {
            const contentAreas = document.querySelectorAll(sel);
            let content = [];
            contentAreas.forEach(area => {
              const paragraphs = area.querySelectorAll('p, div.paragraph, .text-block');
              paragraphs.forEach(p => {
                const text = p.textContent?.trim();
                if (text && text.length > 20) { // Filter out short snippets
                  content.push(text);
                }
              });
            });
            return content.join('\n\n');
          },
          
          // Strategy 3: Wikipedia-specific content extraction
          () => {
            if (window.location.hostname.includes('wikipedia.org')) {
              const content = document.querySelector('#mw-content-text .mw-parser-output');
              if (content) {
                const paragraphs = content.querySelectorAll('p');
                return Array.from(paragraphs)
                  .map(p => p.textContent?.trim())
                  .filter(text => text && text.length > 50)
                  .slice(0, 10) // Limit to first 10 substantial paragraphs
                  .join('\n\n');
              }
            }
            return null;
          },
          
          // Strategy 4: Fallback - all paragraphs on page
          () => {
            const allParagraphs = document.querySelectorAll('p');
            return Array.from(allParagraphs)
              .map(p => p.textContent?.trim())
              .filter(text => text && text.length > 30)
              .slice(0, 15) // Limit to prevent overwhelming output
              .join('\n\n');
          }
        ];
        
        // Try each strategy until we get substantial content
        for (const strategy of strategies) {
          const content = strategy();
          if (content && content.length > 200) {
            return content;
          }
        }
        
        return null;
      }, contentSelector);
    } catch (error) {
      return null;
    }
  }
}

class LinkExtractor extends BaseExtractor {
  async extract(page, config = {}) {
    const selector = config.selector || 'a[href]';
    
    return await page.evaluate((sel) => {
      const links = Array.from(document.querySelectorAll(sel));
      return links.map(link => ({
        href: link.href,
        text: link.textContent?.trim(),
        title: link.title,
        target: link.target
      }));
    }, selector);
  }
}

class ImageExtractor extends BaseExtractor {
  async extract(page, config = {}) {
    const selector = config.selector || 'img[src]';
    
    return await page.evaluate((sel) => {
      const images = Array.from(document.querySelectorAll(sel));
      return images.map(img => ({
        src: img.src,
        alt: img.alt,
        title: img.title,
        width: img.width,
        height: img.height
      }));
    }, selector);
  }
}

class AudioExtractor extends BaseExtractor {
  async extract(page, config = {}) {
    const selectors = config.selectors || {
      audioLinks: 'a[href*="/audio/"], a[href*="/music/"]',
      audioElements: 'audio[src]',
      musicInfo: '.music-info, .audio-info, .song-info'
    };

    const results = {};
    
    // Extract audio links
    results.links = await page.evaluate((sel) => {
      const links = Array.from(document.querySelectorAll(sel));
      return links.map(link => ({
        href: link.href,
        text: link.textContent?.trim(),
        audioId: link.href.match(/\/audio\/(\d+)/)?.[1]
      }));
    }, selectors.audioLinks);
    
    // Extract audio elements
    results.elements = await page.evaluate((sel) => {
      const elements = Array.from(document.querySelectorAll(sel));
      return elements.map(audio => ({
        src: audio.src,
        duration: audio.duration,
        controls: audio.controls
      }));
    }, selectors.audioElements);
    
    // Extract music metadata
    results.metadata = await this.safeExtract(page, selectors.musicInfo);
    
    return results;
  }
}

class VideoExtractor extends BaseExtractor {
  async extract(page, config = {}) {
    const selectors = config.selectors || {
      videoLinks: 'a[href*="/video/"], a[href*="/reel/"]',
      videoElements: 'video[src]',
      videoInfo: '.video-info, .reel-info'
    };

    const results = {};
    
    results.links = await page.evaluate((sel) => {
      const links = Array.from(document.querySelectorAll(sel));
      return links.map(link => ({
        href: link.href,
        text: link.textContent?.trim(),
        videoId: link.href.match(/\/video\/(\w+)/)?.[1]
      }));
    }, selectors.videoLinks);
    
    results.elements = await page.evaluate((sel) => {
      const elements = Array.from(document.querySelectorAll(sel));
      return elements.map(video => ({
        src: video.src,
        poster: video.poster,
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      }));
    }, selectors.videoElements);
    
    return results;
  }
}

class MetadataExtractor extends BaseExtractor {
  async extract(page, config = {}) {
    return await page.evaluate(() => {
      const metadata = {};
      
      // Open Graph tags
      const ogTags = Array.from(document.querySelectorAll('meta[property^="og:"]'));
      ogTags.forEach(tag => {
        const property = tag.getAttribute('property').replace('og:', '');
        metadata[property] = tag.getAttribute('content');
      });
      
      // Twitter Card tags
      const twitterTags = Array.from(document.querySelectorAll('meta[name^="twitter:"]'));
      twitterTags.forEach(tag => {
        const name = tag.getAttribute('name').replace('twitter:', '');
        metadata[`twitter_${name}`] = tag.getAttribute('content');
      });
      
      // Standard meta tags
      const metaTags = ['description', 'keywords', 'author'];
      metaTags.forEach(name => {
        const tag = document.querySelector(`meta[name="${name}"]`);
        if (tag) {
          metadata[name] = tag.getAttribute('content');
        }
      });
      
      // Page title
      metadata.title = document.title;
      
      return metadata;
    });
  }
}

class StructuredDataExtractor extends BaseExtractor {
  async extract(page, config = {}) {
    return await page.evaluate(() => {
      const structuredData = [];
      
      // JSON-LD
      const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      jsonLdScripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          structuredData.push({ type: 'json-ld', data });
        } catch (error) {
          // Skip invalid JSON-LD
        }
      });
      
      // Microdata
      const microdataElements = Array.from(document.querySelectorAll('[itemscope]'));
      microdataElements.forEach(element => {
        const microdata = {
          type: 'microdata',
          itemType: element.getAttribute('itemtype'),
          properties: {}
        };
        
        const properties = Array.from(element.querySelectorAll('[itemprop]'));
        properties.forEach(prop => {
          const name = prop.getAttribute('itemprop');
          microdata.properties[name] = prop.textContent?.trim() || prop.getAttribute('content');
        });
        
        structuredData.push(microdata);
      });
      
      return structuredData;
    });
  }
}

class ProfileExtractor extends BaseExtractor {
  async extract(page, config = {}) {
    const selectors = config.selectors || {
      username: '.username, .handle, [data-testid*="username"]',
      displayName: '.display-name, .full-name, h1',
      bio: '.bio, .description, .about',
      followerCount: '[data-testid*="follower"], .follower-count',
      followingCount: '[data-testid*="following"], .following-count',
      postCount: '[data-testid*="post"], .post-count',
      avatar: 'img[alt*="profile"], .avatar img'
    };

    const results = {};
    
    for (const [key, selector] of Object.entries(selectors)) {
      if (key === 'avatar') {
        results[key] = await this.safeExtract(page, selector, 'src');
      } else {
        results[key] = await this.safeExtract(page, selector);
      }
    }
    
    return results;
  }
}

class ProductExtractor extends BaseExtractor {
  async extract(page, config = {}) {
    const selectors = config.selectors || {
      title: 'h1, .product-title, [data-testid*="title"]',
      price: '.price, .cost, [data-testid*="price"]',
      description: '.description, .product-description',
      rating: '.rating, .stars, [data-testid*="rating"]',
      reviews: '.review-count, .num-reviews',
      availability: '.availability, .stock-status',
      images: '.product-image img, .gallery img'
    };

    const results = {};
    
    for (const [key, selector] of Object.entries(selectors)) {
      if (key === 'images') {
        results[key] = await this.extractAll(page, selector, 'src');
      } else {
        results[key] = await this.safeExtract(page, selector);
      }
    }
    
    return results;
  }
}

class ArticleExtractor extends BaseExtractor {
  async extract(page, config = {}) {
    const selectors = config.selectors || {
      title: 'h1, .article-title, .entry-title',
      author: '.author, .byline, [rel="author"]',
      publishDate: '.publish-date, .date, time[datetime]',
      content: '.article-content, .entry-content, main article',
      tags: '.tag, .category, .label',
      readTime: '.read-time, .reading-time'
    };

    const results = {};
    
    for (const [key, selector] of Object.entries(selectors)) {
      if (key === 'content') {
        // Use comprehensive content extraction for articles
        results[key] = await this.extractArticleContent(page, selector);
      } else if (key === 'tags') {
        results[key] = await this.extractAll(page, selector);
      } else if (key === 'publishDate') {
        results[key] = await this.safeExtract(page, selector, 'datetime') || 
                       await this.safeExtract(page, selector);
      } else {
        results[key] = await this.safeExtract(page, selector);
      }
    }
    
    return results;
  }

  async extractArticleContent(page, contentSelector) {
    try {
      return await page.evaluate((sel) => {
        // Article-specific content extraction strategies
        const strategies = [
          // Strategy 1: Article content area
          () => {
            const article = document.querySelector(sel);
            if (article) {
              const paragraphs = article.querySelectorAll('p, .paragraph, .content-block, .text-block');
              return Array.from(paragraphs)
                .map(p => p.textContent?.trim())
                .filter(text => text && text.length > 25)
                .join('\n\n');
            }
            return null;
          },
          
          // Strategy 2: Common article selectors
          () => {
            const selectors = [
              '.post-content p', '.entry-content p', '.article-body p',
              'main article p', '.content p', '[data-testid="article-text"] p'
            ];
            
            for (const selector of selectors) {
              const paragraphs = document.querySelectorAll(selector);
              if (paragraphs.length > 2) {
                return Array.from(paragraphs)
                  .map(p => p.textContent?.trim())
                  .filter(text => text && text.length > 25)
                  .slice(0, 20)
                  .join('\n\n');
              }
            }
            return null;
          },
          
          // Strategy 3: Wikipedia articles
          () => {
            if (window.location.hostname.includes('wikipedia.org')) {
              const content = document.querySelector('#mw-content-text .mw-parser-output');
              if (content) {
                const paragraphs = content.querySelectorAll('p');
                return Array.from(paragraphs)
                  .map(p => p.textContent?.trim())
                  .filter(text => text && text.length > 50 && !text.startsWith('Coordinates:'))
                  .slice(0, 15)
                  .join('\n\n');
              }
            }
            return null;
          }
        ];
        
        for (const strategy of strategies) {
          const content = strategy();
          if (content && content.length > 500) {
            return content;
          }
        }
        
        return null;
      }, contentSelector);
    } catch (error) {
      return null;
    }
  }
}