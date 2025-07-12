import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class LearningStorage {
  constructor() {
    this.cacheDir = path.join(os.homedir(), '.scrape');
    this.learningFile = path.join(this.cacheDir, 'learning.json');
    this.cacheMaxAge = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in milliseconds
  }

  async ensureDirectoryExists() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  async loadLearningData() {
    try {
      await this.ensureDirectoryExists();
      const data = await fs.readFile(this.learningFile, 'utf8');
      const parsed = JSON.parse(data);
      
      // Clean up old entries on load
      await this.cleanupOldEntries(parsed);
      
      return parsed;
    } catch (error) {
      // File doesn't exist or is invalid, return empty structure
      return { domains: {}, version: "1.0.0" };
    }
  }

  async saveLearningData(data) {
    await this.ensureDirectoryExists();
    await fs.writeFile(this.learningFile, JSON.stringify(data, null, 2), 'utf8');
  }

  async cleanupOldEntries(data) {
    const now = Date.now();
    let hasChanges = false;

    for (const [domain, domainData] of Object.entries(data.domains || {})) {
      if (domainData.lastSuccess) {
        const lastSuccessTime = new Date(domainData.lastSuccess).getTime();
        if (now - lastSuccessTime > this.cacheMaxAge) {
          delete data.domains[domain];
          hasChanges = true;
          console.log(`🧹 Cleaned up old learning data for ${domain}`);
        }
      }
    }

    if (hasChanges) {
      await this.saveLearningData(data);
    }
  }

  async recordSuccess(hostname, contentType, extractionData, strategy = 'unknown') {
    try {
      const data = await this.loadLearningData();
      
      if (!data.domains) {
        data.domains = {};
      }

      if (!data.domains[hostname]) {
        data.domains[hostname] = {};
      }

      const domainData = data.domains[hostname];
      
      // Update success timestamp
      domainData.lastSuccess = new Date().toISOString();
      domainData.platform = extractionData.platform || 'unknown';
      domainData.contentType = contentType;
      domainData.strategy = strategy;
      
      // Store working selectors if available
      if (extractionData.selectors) {
        if (!domainData.workingSelectors) {
          domainData.workingSelectors = {};
        }
        domainData.workingSelectors[contentType] = extractionData.selectors;
      }
      
      // Store extraction patterns that worked
      if (extractionData.extractorTypes) {
        domainData.successfulExtractors = extractionData.extractorTypes;
      }
      
      // Store timing information for rate limiting
      if (extractionData.timing) {
        domainData.optimalTiming = {
          delay: extractionData.timing.delay || 3000,
          timeout: extractionData.timing.timeout || 30000,
          lastUpdated: new Date().toISOString()
        };
      }

      await this.saveLearningData(data);
      console.log(`📚 Learned successful pattern for ${hostname} (${contentType})`);
      
    } catch (error) {
      console.warn(`Failed to record learning data: ${error.message}`);
    }
  }

  async getLearnedPatterns(hostname, contentType) {
    try {
      const data = await this.loadLearningData();
      const domainData = data.domains?.[hostname];
      
      if (!domainData) {
        return null;
      }

      // Check if data is still fresh (within cache period)
      const lastSuccess = new Date(domainData.lastSuccess).getTime();
      const now = Date.now();
      
      if (now - lastSuccess > this.cacheMaxAge) {
        // Data is stale, bust the cache
        await this.bustCache(hostname, 'Cache expired');
        return null;
      }

      return {
        selectors: domainData.workingSelectors?.[contentType],
        platform: domainData.platform,
        strategy: domainData.strategy,
        extractors: domainData.successfulExtractors,
        timing: domainData.optimalTiming,
        lastSuccess: domainData.lastSuccess,
        confidence: this.calculateConfidence(domainData)
      };

    } catch (error) {
      console.warn(`Failed to load learning data: ${error.message}`);
      return null;
    }
  }

  async bustCache(hostname, reason = 'Extraction failed') {
    try {
      const data = await this.loadLearningData();
      
      if (data.domains?.[hostname]) {
        delete data.domains[hostname];
        await this.saveLearningData(data);
        console.log(`💥 Busted learning cache for ${hostname}: ${reason}`);
      }
      
    } catch (error) {
      console.warn(`Failed to bust cache: ${error.message}`);
    }
  }

  async recordFailure(hostname, contentType, reason = 'Unknown') {
    try {
      // Bust the cache when extraction fails
      await this.bustCache(hostname, `Extraction failed: ${reason}`);
      
    } catch (error) {
      console.warn(`Failed to record failure: ${error.message}`);
    }
  }

  calculateConfidence(domainData) {
    if (!domainData.lastSuccess) return 0;
    
    const daysSinceSuccess = (Date.now() - new Date(domainData.lastSuccess).getTime()) / (1000 * 60 * 60 * 24);
    
    // Confidence decreases over time
    // 100% confidence for patterns used within last week
    // 80% confidence for patterns used within last month  
    // 60% confidence for patterns used within 3 months
    // 40% confidence for patterns older than 3 months
    
    if (daysSinceSuccess <= 7) return 1.0;
    if (daysSinceSuccess <= 30) return 0.8;
    if (daysSinceSuccess <= 90) return 0.6;
    return 0.4;
  }

  async getStats() {
    try {
      const data = await this.loadLearningData();
      const domains = Object.keys(data.domains || {});
      
      let totalPatterns = 0;
      let recentlyUsed = 0;
      const now = Date.now();
      
      for (const domain of domains) {
        const domainData = data.domains[domain];
        if (domainData.workingSelectors) {
          totalPatterns += Object.keys(domainData.workingSelectors).length;
        }
        
        if (domainData.lastSuccess) {
          const daysSince = (now - new Date(domainData.lastSuccess).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince <= 30) {
            recentlyUsed++;
          }
        }
      }
      
      return {
        totalDomains: domains.length,
        totalPatterns,
        recentlyUsed,
        cacheFile: this.learningFile,
        maxAge: `${Math.round(this.cacheMaxAge / (1000 * 60 * 60 * 24))} days`
      };
      
    } catch (error) {
      return {
        totalDomains: 0,
        totalPatterns: 0,
        recentlyUsed: 0,
        error: error.message
      };
    }
  }

  async clearAllCache() {
    try {
      await fs.unlink(this.learningFile);
      console.log('🗑️ Cleared all learning cache');
    } catch (error) {
      // File might not exist
    }
  }
}