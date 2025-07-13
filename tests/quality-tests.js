#!/usr/bin/env node

import { SmartScraper } from '../src/smart.js';
import fs from 'fs/promises';

class QualityTestRunner {
  constructor() {
    this.results = [];
    this.tempDir = './test-quality-output';
  }

  async setup() {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      await fs.rm('./scrape-output', { recursive: true, force: true });
    } catch (error) {
      // Directories might not exist
    }
  }

  async cleanup() {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      await fs.rm('./scrape-output', { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async testSite(url, expectedMinContent = 100, expectedContentType = null) {
    const scraper = new SmartScraper({ 
      headless: true, 
      verbose: false,
      outputDir: this.tempDir 
    });

    try {
      console.log(`🔍 Testing ${url}...`);
      const startTime = Date.now();
      
      const result = await scraper.extract(url);
      const extractionTime = Date.now() - startTime;
      
      // Parse results
      const metadata = JSON.parse(result['metadata.json'] || '{}');
      const contentLength = result['content.txt']?.length || 0;
      const summaryLength = result['summary.md']?.length || 0;
      const contextLength = result['context.md']?.length || 0;
      
      const quality = {
        url,
        success: true,
        extractionTime,
        contentLength,
        summaryLength,
        contextLength,
        contentType: metadata.contentType || 'unknown',
        platform: metadata.platform || 'unknown',
        title: metadata.title || 'No title',
        hasDescription: !!metadata.description,
        meetsSizeRequirement: contentLength >= expectedMinContent,
        correctContentType: expectedContentType ? metadata.contentType === expectedContentType : true
      };

      this.results.push(quality);
      
      console.log(`  ✅ Success: ${contentLength} chars in ${extractionTime}ms`);
      console.log(`  📊 Type: ${quality.contentType}, Platform: ${quality.platform}`);
      
      return quality;
      
    } catch (error) {
      const quality = {
        url,
        success: false,
        error: error.message,
        extractionTime: 0,
        contentLength: 0,
        summaryLength: 0,
        contextLength: 0
      };
      
      this.results.push(quality);
      console.log(`  ❌ Failed: ${error.message}`);
      
      return quality;
    }
  }

  generateReport() {
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    
    console.log('\n📊 Quality Test Report');
    console.log('=' .repeat(50));
    
    console.log(`\n🎯 Overall Results:`);
    console.log(`  ✅ Successful extractions: ${successful.length}/${this.results.length}`);
    console.log(`  ❌ Failed extractions: ${failed.length}/${this.results.length}`);
    console.log(`  📈 Success rate: ${Math.round((successful.length / this.results.length) * 100)}%`);
    
    if (successful.length > 0) {
      const avgContentLength = Math.round(successful.reduce((sum, r) => sum + r.contentLength, 0) / successful.length);
      const avgExtractionTime = Math.round(successful.reduce((sum, r) => sum + r.extractionTime, 0) / successful.length);
      const maxContentLength = Math.max(...successful.map(r => r.contentLength));
      const minContentLength = Math.min(...successful.map(r => r.contentLength));
      
      console.log(`\n📏 Content Quality:`);
      console.log(`  📝 Average content length: ${avgContentLength} chars`);
      console.log(`  📝 Content range: ${minContentLength} - ${maxContentLength} chars`);
      console.log(`  ⏱️  Average extraction time: ${avgExtractionTime}ms`);
      
      // Content type breakdown
      const contentTypes = {};
      successful.forEach(r => {
        contentTypes[r.contentType] = (contentTypes[r.contentType] || 0) + 1;
      });
      
      console.log(`\n🏷️  Content Types Detected:`);
      Object.entries(contentTypes).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} sites`);
      });
    }
    
    if (failed.length > 0) {
      console.log(`\n❌ Failed Extractions:`);
      failed.forEach(r => {
        console.log(`  - ${r.url}: ${r.error}`);
      });
    }
    
    // Detailed results
    console.log(`\n📋 Detailed Results:`);
    this.results.forEach(r => {
      if (r.success) {
        console.log(`  ✅ ${r.url}`);
        console.log(`     📊 ${r.contentLength} chars, ${r.extractionTime}ms, ${r.contentType}`);
        console.log(`     📄 "${r.title.substring(0, 50)}${r.title.length > 50 ? '...' : ''}"`);
      } else {
        console.log(`  ❌ ${r.url}: ${r.error}`);
      }
    });
  }

  async runQualityTests() {
    console.log('🧪 Running Quality Tests...\n');
    
    await this.setup();

    // Test different content types and sites
    const testSites = [
      { url: 'https://example.com', minContent: 20, type: 'generic' },
      { url: 'https://en.wikipedia.org/wiki/Web_scraping', minContent: 1000, type: 'encyclopedia-article' },
      { url: 'https://news.ycombinator.com/', minContent: 20, type: 'news-aggregator' }
    ];

    // Run tests
    for (const site of testSites) {
      await this.testSite(site.url, site.minContent, site.type);
    }

    await this.cleanup();
    
    this.generateReport();
    
    // Determine if tests passed overall
    const successRate = this.results.filter(r => r.success).length / this.results.length;
    if (successRate < 0.8) {
      console.log('\n❌ Quality tests failed: Success rate below 80%');
      process.exit(1);
    } else {
      console.log('\n✅ Quality tests passed!');
    }
  }
}

// Run quality tests
const runner = new QualityTestRunner();
runner.runQualityTests().catch(error => {
  console.error('Quality test runner failed:', error);
  process.exit(1);
});