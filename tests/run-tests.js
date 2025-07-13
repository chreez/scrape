#!/usr/bin/env node

import { SmartScraper } from '../src/smart.js';
import fs from 'fs/promises';
import path from 'path';

class TestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
    this.tempDir = './test-output';
  }

  async setup() {
    // Clean up previous test outputs
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      await fs.rm('./scrape-output', { recursive: true, force: true });
    } catch (error) {
      // Directories might not exist
    }
  }

  async cleanup() {
    // Clean up test outputs
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      await fs.rm('./scrape-output', { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  async assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected "${expected}", got "${actual}"`);
    }
  }

  async assertGreaterThan(actual, expected, message) {
    if (actual <= expected) {
      throw new Error(`${message}: expected > ${expected}, got ${actual}`);
    }
  }

  async assertExists(value, message) {
    if (!value) {
      throw new Error(`${message}: value does not exist`);
    }
  }

  async runTests() {
    console.log('🧪 Running Scraper Tests...\n');
    
    await this.setup();

    for (const { name, testFn } of this.tests) {
      try {
        process.stdout.write(`  ${name}... `);
        await testFn();
        console.log('✅ PASS');
        this.passed++;
      } catch (error) {
        console.log('❌ FAIL');
        console.log(`    Error: ${error.message}\n`);
        this.failed++;
      }
    }

    await this.cleanup();

    console.log(`\n📊 Test Results:`);
    console.log(`  ✅ Passed: ${this.passed}`);
    console.log(`  ❌ Failed: ${this.failed}`);
    console.log(`  📈 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);

    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

// Test Suite
const runner = new TestRunner();

// Test 1: Basic extraction functionality
runner.test('Basic extraction returns data', async () => {
  const scraper = new SmartScraper({ 
    headless: true, 
    verbose: false,
    outputDir: runner.tempDir 
  });
  
  const result = await scraper.extract('https://example.com');
  
  await runner.assertExists(result, 'Result should exist');
  await runner.assertExists(result['metadata.json'], 'Metadata should be extracted');
  await runner.assertExists(result['content.txt'], 'Content should be extracted');
  await runner.assertExists(result['summary.md'], 'Summary should be generated');
  await runner.assertExists(result['context.md'], 'Context should be generated');
});

// Test 2: Content quality validation
runner.test('Content extraction has minimum quality', async () => {
  const scraper = new SmartScraper({ 
    headless: true, 
    verbose: false,
    outputDir: runner.tempDir 
  });
  
  const result = await scraper.extract('https://example.com');
  
  // Check content length
  const contentLength = result['content.txt']?.length || 0;
  await runner.assertGreaterThan(contentLength, 10, 'Content should have meaningful length');
  
  // Check metadata fields
  const metadata = JSON.parse(result['metadata.json'] || '{}');
  await runner.assertExists(metadata.title, 'Metadata should include title');
  await runner.assertExists(metadata.url, 'Metadata should include URL');
});

// Test 3: Output directory creation
runner.test('Creates unique output directories', async () => {
  const scraper = new SmartScraper({ 
    headless: true, 
    verbose: false,
    outputDir: 'scrape-output'
  });
  
  const result = await scraper.extract('https://example.com');
  
  // Check that output directory was created and referenced
  await runner.assertExists(result._outputDir, 'Output directory should be specified');
  
  const outputExists = await fs.access(result._outputDir).then(() => true).catch(() => false);
  await runner.assert(outputExists, 'Output directory should exist on filesystem');
});

// Test 4: Learning system functionality
runner.test('Learning system stores and retrieves patterns', async () => {
  const scraper = new SmartScraper({ 
    headless: true, 
    verbose: false,
    outputDir: runner.tempDir 
  });
  
  // First extraction - should store patterns
  await scraper.extract('https://example.com');
  
  // Check if learning file was created
  const learningPath = path.join(process.env.HOME || '/tmp', '.scrape', 'learning.json');
  const learningExists = await fs.access(learningPath).then(() => true).catch(() => false);
  await runner.assert(learningExists, 'Learning cache should be created');
  
  // Second extraction - should use learned patterns
  const result2 = await scraper.extract('https://example.com');
  await runner.assertExists(result2, 'Second extraction should succeed with learned patterns');
});

// Test 5: Error handling for invalid URLs
runner.test('Handles invalid URLs gracefully', async () => {
  const scraper = new SmartScraper({ 
    headless: true, 
    verbose: false,
    outputDir: runner.tempDir 
  });
  
  try {
    await scraper.extract('https://this-domain-definitely-does-not-exist-12345.com');
    throw new Error('Should have thrown an error for invalid URL');
  } catch (error) {
    // This is expected - we should get an error for invalid URLs
    await runner.assert(error.message.length > 0, 'Error should have a meaningful message');
  }
});

// Test 6: Content type detection
runner.test('Detects content types correctly', async () => {
  const scraper = new SmartScraper({ 
    headless: true, 
    verbose: false,
    outputDir: runner.tempDir 
  });
  
  const result = await scraper.extract('https://example.com');
  const metadata = JSON.parse(result['metadata.json'] || '{}');
  
  await runner.assertExists(metadata.contentType, 'Content type should be detected');
  await runner.assertExists(metadata.platform, 'Platform should be detected');
});

// Run all tests
runner.runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});