/**
 * Tier 1 Quality Tests - Research-Grade Use Cases
 * 
 * These tests validate high-quality extraction for critical research use cases:
 * - Wikipedia articles (encyclopedia-article content type)
 * - GitHub repositories (code-repository content type)
 * 
 * Quality criteria:
 * - Content completeness (>5000 chars for substantial articles)
 * - Metadata richness (key fields present)
 * - Research-grade information extraction
 */

import { SmartScraper } from '../src/smart.js';
import fs from 'fs/promises';
import path from 'path';

class Tier1QualityTests {
  constructor() {
    this.scraper = new SmartScraper({ verbose: false, timeout: 45000 });
    this.results = [];
  }

  async runAllTests() {
    console.log('🧪 Running Tier 1 Quality Tests...\n');
    
    const testSuites = [
      { name: 'Wikipedia Articles', tests: this.getWikipediaTests() },
      { name: 'GitHub Repositories', tests: this.getGitHubTests() }
    ];

    for (const suite of testSuites) {
      console.log(`📚 Testing ${suite.name}:`);
      await this.runTestSuite(suite.tests);
      console.log('');
    }

    await this.generateReport();
  }

  getWikipediaTests() {
    return [
      {
        name: 'Complex Wikipedia Article',
        url: 'https://en.wikipedia.org/wiki/Machine_learning',
        criteria: {
          minContentLength: 8000,
          requiredMetadata: ['title', 'description', 'wikipedia_categories', 'wikipedia_references_count'],
          requiredSections: ['article'],
          contentQuality: {
            minParagraphs: 20,
            expectCategories: true,
            expectReferences: true
          }
        }
      },
      {
        name: 'Technical Wikipedia Article',
        url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
        criteria: {
          minContentLength: 6000,
          requiredMetadata: ['title', 'description', 'wikipedia_categories'],
          requiredSections: ['article'],
          contentQuality: {
            minParagraphs: 15,
            expectCategories: true
          }
        }
      }
    ];
  }

  getGitHubTests() {
    return [
      {
        name: 'Popular Open Source Repository',
        url: 'https://github.com/microsoft/vscode',
        criteria: {
          minContentLength: 2000,
          requiredMetadata: ['title', 'description'],
          requiredSections: ['repository'],
          repositoryQuality: {
            requireStars: true,
            requireForks: true,
            requireTopics: true,
            requireDescription: true
          }
        }
      },
      {
        name: 'Technical Framework Repository',
        url: 'https://github.com/facebook/react',
        criteria: {
          minContentLength: 1500,
          requiredMetadata: ['title', 'description'],
          requiredSections: ['repository'],
          repositoryQuality: {
            requireStars: true,
            requireForks: true,
            requireTopics: true
          }
        }
      }
    ];
  }

  async runTestSuite(tests) {
    for (const test of tests) {
      try {
        console.log(`  🔍 ${test.name}...`);
        const result = await this.runSingleTest(test);
        this.results.push(result);
        
        if (result.passed) {
          console.log(`    ✅ PASSED (${result.score}/100)`);
        } else {
          console.log(`    ❌ FAILED (${result.score}/100)`);
          console.log(`    📋 Issues: ${result.failures.join(', ')}`);
        }
      } catch (error) {
        console.log(`    💥 ERROR: ${error.message}`);
        this.results.push({
          testName: test.name,
          url: test.url,
          passed: false,
          score: 0,
          failures: [`Extraction failed: ${error.message}`],
          extractedData: null
        });
      }
    }
  }

  async runSingleTest(test) {
    const startTime = Date.now();
    
    // Extract data using SmartScraper
    const extractedData = await this.scraper.extract(test.url);
    
    const endTime = Date.now();
    const extractionTime = endTime - startTime;

    // Load the generated files for analysis
    const outputDir = extractedData._outputDir;
    const files = await this.loadGeneratedFiles(outputDir);
    
    // Validate against criteria
    const validation = this.validateExtraction(files, test.criteria, test.url);
    
    return {
      testName: test.name,
      url: test.url,
      extractionTime,
      passed: validation.passed,
      score: validation.score,
      failures: validation.failures,
      extractedData: files,
      outputDir
    };
  }

  async loadGeneratedFiles(outputDir) {
    const files = {};
    
    try {
      // Load all generated files
      const fileList = await fs.readdir(outputDir);
      
      for (const filename of fileList) {
        const filePath = path.join(outputDir, filename);
        const content = await fs.readFile(filePath, 'utf8');
        
        if (filename.endsWith('.json')) {
          files[filename] = JSON.parse(content);
        } else {
          files[filename] = content;
        }
      }
    } catch (error) {
      throw new Error(`Failed to load files from ${outputDir}: ${error.message}`);
    }
    
    return files;
  }

  validateExtraction(files, criteria, url) {
    const failures = [];
    let score = 0;
    const maxScore = 100;

    // Check content length
    if (criteria.minContentLength) {
      const content = files['content.txt'] || '';
      if (content.length >= criteria.minContentLength) {
        score += 25;
      } else {
        failures.push(`Content too short: ${content.length} < ${criteria.minContentLength} chars`);
      }
    }

    // Check required metadata fields
    if (criteria.requiredMetadata) {
      const metadata = files['metadata.json'] || {};
      let metadataScore = 0;
      
      for (const field of criteria.requiredMetadata) {
        if (this.hasNestedField(metadata, field)) {
          metadataScore += 15 / criteria.requiredMetadata.length;
        } else {
          failures.push(`Missing metadata field: ${field}`);
        }
      }
      score += metadataScore;
    }

    // Check required sections
    if (criteria.requiredSections) {
      const metadata = files['metadata.json'] || {};
      let sectionScore = 0;
      
      for (const section of criteria.requiredSections) {
        if (metadata[section] && Object.keys(metadata[section]).length > 0) {
          sectionScore += 20 / criteria.requiredSections.length;
        } else {
          failures.push(`Missing or empty section: ${section}`);
        }
      }
      score += sectionScore;
    }

    // Wikipedia-specific quality checks
    if (criteria.contentQuality) {
      score += this.validateWikipediaQuality(files, criteria.contentQuality, failures);
    }

    // GitHub repository-specific quality checks
    if (criteria.repositoryQuality) {
      score += this.validateRepositoryQuality(files, criteria.repositoryQuality, failures);
    }

    // File generation check
    const expectedFiles = ['summary.md', 'content.txt', 'metadata.json', 'context.md'];
    const actualFiles = Object.keys(files);
    let fileScore = 0;
    
    for (const expectedFile of expectedFiles) {
      if (actualFiles.includes(expectedFile)) {
        fileScore += 10 / expectedFiles.length;
      } else {
        failures.push(`Missing file: ${expectedFile}`);
      }
    }
    score += fileScore;

    return {
      passed: failures.length === 0 && score >= 80,
      score: Math.round(score),
      failures
    };
  }

  validateWikipediaQuality(files, criteria, failures) {
    let score = 0;
    const metadata = files['metadata.json'] || {};

    if (criteria.expectCategories) {
      if (metadata.wikipedia_categories && metadata.wikipedia_categories.length > 0) {
        score += 10;
      } else {
        failures.push('Missing Wikipedia categories');
      }
    }

    if (criteria.expectReferences) {
      if (metadata.wikipedia_references_count && metadata.wikipedia_references_count > 10) {
        score += 10;
      } else {
        failures.push('Insufficient Wikipedia references');
      }
    }

    if (criteria.minParagraphs) {
      const stats = metadata.stats || {};
      if (stats.paragraphs >= criteria.minParagraphs) {
        score += 10;
      } else {
        failures.push(`Insufficient paragraphs: ${stats.paragraphs} < ${criteria.minParagraphs}`);
      }
    }

    return score;
  }

  validateRepositoryQuality(files, criteria, failures) {
    let score = 0;
    const metadata = files['metadata.json'] || {};
    const repository = metadata.repository || {};

    if (criteria.requireStars) {
      if (repository.stars) {
        score += 7.5;
      } else {
        failures.push('Missing repository stars');
      }
    }

    if (criteria.requireForks) {
      if (repository.forks) {
        score += 7.5;
      } else {
        failures.push('Missing repository forks');
      }
    }

    if (criteria.requireTopics) {
      if (repository.topics && repository.topics.length > 0) {
        score += 7.5;
      } else {
        failures.push('Missing repository topics');
      }
    }

    if (criteria.requireDescription) {
      if (repository.description && repository.description.length > 20) {
        score += 7.5;
      } else {
        failures.push('Missing or insufficient repository description');
      }
    }

    return score;
  }

  hasNestedField(obj, fieldPath) {
    const parts = fieldPath.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }
    
    return current !== null && current !== undefined;
  }

  async generateReport() {
    console.log('📊 Test Results Summary:');
    console.log('========================\n');

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const avgScore = Math.round(this.results.reduce((sum, r) => sum + r.score, 0) / total);

    console.log(`Overall: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
    console.log(`Average Score: ${avgScore}/100\n`);

    // Group by test suite
    const suites = {};
    this.results.forEach(result => {
      const suite = result.testName.includes('Wikipedia') ? 'Wikipedia' : 'GitHub';
      if (!suites[suite]) suites[suite] = [];
      suites[suite].push(result);
    });

    for (const [suiteName, results] of Object.entries(suites)) {
      const suitePassed = results.filter(r => r.passed).length;
      const suiteAvg = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
      
      console.log(`${suiteName}: ${suitePassed}/${results.length} passed, avg score ${suiteAvg}/100`);
      
      results.forEach(result => {
        const status = result.passed ? '✅' : '❌';
        const timing = result.extractionTime ? ` (${(result.extractionTime/1000).toFixed(1)}s)` : '';
        console.log(`  ${status} ${result.testName} - ${result.score}/100${timing}`);
        
        if (!result.passed && result.failures.length > 0) {
          result.failures.forEach(failure => {
            console.log(`    📋 ${failure}`);
          });
        }
      });
      console.log('');
    }

    // Save detailed report
    const reportPath = `test-report-tier1-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run tests if called directly
async function main() {
  const tester = new Tier1QualityTests();
  await tester.runAllTests();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { Tier1QualityTests };