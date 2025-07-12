import { BaseAdapter } from './base.js';

export class InstagramAdapter extends BaseAdapter {
  constructor(dataType, options = {}) {
    super(dataType, options);
  }

  getConfig() {
    const baseConfig = super.getConfig();
    
    return {
      ...baseConfig,
      platform: 'instagram',
      navigation: {
        strategy: 'list-then-detail',
        waitTime: 3000,
        scrollBehavior: 'auto'
      },
      selectors: this.getSelectors(),
      rateLimit: {
        delay: 2000,
        maxConcurrent: 2,
        backoffMultiplier: 2
      }
    };
  }

  getSelectors() {
    switch (this.dataType) {
      case 'songs':
      case 'audio':
        return {
          itemList: 'a[href*="/reel/"]',
          audioLink: 'a[href*="/reels/audio/"]',
          audioText: 'a[href*="/reels/audio/"] span',
          profileLink: 'a[href*="/reels/audio/"]'
        };
      
      case 'reels':
      case 'videos':
        return {
          itemList: 'a[href*="/reel/"]',
          videoInfo: '.video-info, .reel-info',
          caption: '[data-testid="caption"]',
          likes: '[data-testid="like-count"]'
        };
      
      case 'posts':
        return {
          itemList: 'a[href*="/p/"]',
          postContent: '[data-testid="post-content"]',
          caption: '[data-testid="caption"]',
          likes: '[data-testid="like-count"]'
        };
      
      case 'profile':
        return {
          username: 'h2, .username, [data-testid="username"]',
          displayName: 'h1, .display-name',
          bio: '.bio, [data-testid="bio"]',
          followerCount: 'a[href*="/followers/"] span',
          followingCount: 'a[href*="/following/"] span',
          postCount: '[data-testid="post-count"]'
        };
      
      default:
        return {
          itemList: 'a[href*="/p/"], a[href*="/reel/"]',
          content: '.content, .caption'
        };
    }
  }

  async extract(page, navigationManager, extractorEngine, options = {}) {
    const config = this.getConfig();
    
    try {
      // Handle Instagram login prompts/modals
      await this.handleInstagramModals(page);
      
      if (this.dataType === 'profile') {
        return await this.extractProfile(page, extractorEngine);
      }
      
      return await this.processItems(page, navigationManager, extractorEngine, options);
      
    } catch (error) {
      console.error(`Instagram extraction failed: ${error.message}`);
      throw error;
    }
  }

  async handleInstagramModals(page) {
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Dismiss login modal if present
    const loginModalSelectors = [
      '[role="dialog"] button[aria-label*="close"]',
      '[role="dialog"] button[aria-label*="Close"]',
      'button[aria-label="Close"]',
      '[data-testid="loginForm"] button[type="button"]'
    ];
    
    for (const selector of loginModalSelectors) {
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
    
    // Dismiss notification prompt if present
    const notificationSelectors = [
      'button[aria-label*="Not Now"]',
      'button:has-text("Not Now")',
      'button:has-text("Not now")'
    ];
    
    for (const selector of notificationSelectors) {
      try {
        const notNowButton = await page.$(selector);
        if (notNowButton) {
          await notNowButton.click();
          await page.waitForTimeout(1000);
          break;
        }
      } catch (error) {
        continue;
      }
    }
  }

  async extractProfile(page, extractorEngine) {
    const config = this.getConfig();
    const selectors = config.selectors;
    
    const profileData = {};
    
    // Extract basic profile info
    for (const [key, selector] of Object.entries(selectors)) {
      try {
        profileData[key] = await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          return element ? element.textContent.trim() : null;
        }, selector);
      } catch (error) {
        profileData[key] = null;
      }
    }
    
    // Extract profile image
    try {
      profileData.profileImage = await page.evaluate(() => {
        const img = document.querySelector('img[alt*="profile picture"], img[alt*="Profile picture"]');
        return img ? img.src : null;
      });
    } catch (error) {
      profileData.profileImage = null;
    }
    
    return this.normalizeData(profileData);
  }

  async extractItemData(page, extractorEngine) {
    const config = this.getConfig();
    
    if (this.dataType === 'songs' || this.dataType === 'audio') {
      return await this.extractAudioData(page, config);
    } else if (this.dataType === 'reels' || this.dataType === 'videos') {
      return await this.extractVideoData(page, config);
    } else if (this.dataType === 'posts') {
      return await this.extractPostData(page, config);
    }
    
    return null;
  }

  async extractAudioData(page, config) {
    try {
      const audioData = await page.evaluate((selectors) => {
        // Look for audio links
        const audioLinks = Array.from(document.querySelectorAll(selectors.audioLink));
        
        if (audioLinks.length > 0) {
          const audioLink = audioLinks[0];
          const textContent = audioLink.textContent || audioLink.innerText || '';
          
          // Parse artist and song from text content
          // Pattern: "Artist • Song Title" or variations
          const parts = textContent.split('•').map(s => s.trim());
          
          let artist = '';
          let song = '';
          
          if (parts.length >= 2) {
            artist = parts[0];
            song = parts[1];
          } else if (textContent) {
            song = textContent;
          }
          
          // Extract audio ID from URL
          const audioId = audioLink.href.match(/\/reels\/audio\/(\d+)/)?.[1];
          
          return {
            artist,
            song,
            audioId,
            audioUrl: audioLink.href,
            fullText: textContent,
            reelUrl: window.location.href
          };
        }
        
        return null;
      }, config.selectors);
      
      return audioData ? this.normalizeData(audioData) : null;
      
    } catch (error) {
      console.warn(`Failed to extract audio data: ${error.message}`);
      return null;
    }
  }

  async extractVideoData(page, config) {
    try {
      const videoData = await page.evaluate(() => {
        const data = {
          url: window.location.href,
          caption: null,
          likes: null,
          comments: null,
          shares: null
        };
        
        // Extract caption
        const captionSelectors = ['[data-testid="caption"]', '.caption', 'h1'];
        for (const selector of captionSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            data.caption = element.textContent.trim();
            break;
          }
        }
        
        // Extract engagement metrics
        const likeSelectors = ['[aria-label*="like"]', '[data-testid*="like"]'];
        for (const selector of likeSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent || element.getAttribute('aria-label') || '';
            const match = text.match(/(\d+(?:,\d+)*)/);
            if (match) {
              data.likes = match[1].replace(/,/g, '');
            }
            break;
          }
        }
        
        return data;
      });
      
      return this.normalizeData(videoData);
      
    } catch (error) {
      console.warn(`Failed to extract video data: ${error.message}`);
      return null;
    }
  }

  async extractPostData(page, config) {
    try {
      const postData = await page.evaluate(() => {
        return {
          url: window.location.href,
          caption: document.querySelector('[data-testid="caption"]')?.textContent?.trim(),
          likes: document.querySelector('[aria-label*="like"]')?.textContent?.trim(),
          timestamp: document.querySelector('time')?.getAttribute('datetime')
        };
      });
      
      return this.normalizeData(postData);
      
    } catch (error) {
      console.warn(`Failed to extract post data: ${error.message}`);
      return null;
    }
  }

  validateUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('instagram.com');
    } catch {
      return false;
    }
  }
}

export default InstagramAdapter;