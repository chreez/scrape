#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

class IntegrationTestRunner {
  constructor() {
    this.testResults = [];
    this.tempDir = './test-integration-output';
  }

  async setup() {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      await fs.rm('./scrape-output', { recursive: true, force: true });
      // Clear learning cache for clean tests
      const learningPath = path.join(process.env.HOME || '/tmp', '.scrape', 'learning.json');
      await fs.rm(learningPath, { force: true });
    } catch (error) {
      // Files might not exist
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

  async runCommand(command, args = [], timeout = 60000) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout 
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
      
      child.on('error', (error) => {
        reject(error);
      });
      
      // Timeout handling
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  async testCliCommand(testName, url, expectedPatterns = []) {
    console.log(`🧪 ${testName}...`);
    
    try {
      const result = await this.runCommand('node', ['bin/scrape.js', url, '--output', this.tempDir]);
      
      const success = result.code === 0;
      const output = result.stdout;
      
      // Check for expected patterns in output
      const patternResults = expectedPatterns.map(pattern => {
        const found = output.includes(pattern);
        return { pattern, found };
      });
      
      // Check if output files were created
      const outputDirs = await fs.readdir(this.tempDir).catch(() => []);
      const hasOutputDir = outputDirs.length > 0;
      
      let outputFiles = [];
      if (hasOutputDir) {
        const outputDir = path.join(this.tempDir, outputDirs[0]);
        outputFiles = await fs.readdir(outputDir).catch(() => []);
      }
      
      const testResult = {
        testName,
        success,
        hasOutputDir,
        outputFiles,
        patternResults,
        stdout: output,
        stderr: result.stderr
      };
      
      this.testResults.push(testResult);
      
      if (success && hasOutputDir && outputFiles.length >= 3) {
        console.log(`  ✅ PASS - Generated ${outputFiles.length} files`);
      } else {
        console.log(`  ❌ FAIL - Exit code: ${result.code}, Files: ${outputFiles.length}`);
        if (result.stderr) {
          console.log(`     Error: ${result.stderr.substring(0, 100)}...`);
        }
      }
      
      return testResult;
      
    } catch (error) {
      console.log(`  ❌ FAIL - ${error.message}`);
      const testResult = {
        testName,
        success: false,
        error: error.message
      };
      this.testResults.push(testResult);
      return testResult;
    }
  }

  async testLearningPersistence() {
    console.log(`🧪 Testing learning system persistence...`);
    
    try {
      // First extraction
      await this.runCommand('node', ['bin/scrape.js', 'https://example.com', '--output', this.tempDir]);
      
      // Check if learning file was created
      const learningPath = path.join(process.env.HOME || '/tmp', '.scrape', 'learning.json');
      const learningExists = await fs.access(learningPath).then(() => true).catch(() => false);
      
      if (!learningExists) {
        console.log(`  ❌ FAIL - Learning file not created`);
        return false;
      }
      
      // Read learning content
      const learningData = JSON.parse(await fs.readFile(learningPath, 'utf8'));
      const hasExampleDomain = learningData.domains && learningData.domains['example.com'];
      
      if (!hasExampleDomain) {
        console.log(`  ❌ FAIL - example.com not stored in learning cache`);
        return false;
      }
      
      // Second extraction - should use learned patterns
      const result = await this.runCommand('node', ['bin/scrape.js', 'https://example.com', '--output', this.tempDir, '--verbose']);
      
      const usedLearning = result.stdout.includes('learned with custom selectors') || 
                          result.stdout.includes('Using learned extractor sequence');
      
      if (usedLearning) {
        console.log(`  ✅ PASS - Learning system working`);
        return true;
      } else {
        console.log(`  ❌ FAIL - Learning patterns not applied`);
        console.log(`     Output: ${result.stdout.substring(0, 200)}...`);
        return false;
      }
      
    } catch (error) {
      console.log(`  ❌ FAIL - ${error.message}`);
      return false;
    }
  }

  generateReport() {
    console.log('\n📊 Integration Test Report');
    console.log('=' .repeat(50));
    
    const successful = this.testResults.filter(r => r.success);
    const failed = this.testResults.filter(r => !r.success);
    
    console.log(`\n🎯 Overall Results:`);
    console.log(`  ✅ Successful tests: ${successful.length}/${this.testResults.length}`);
    console.log(`  ❌ Failed tests: ${failed.length}/${this.testResults.length}`);
    console.log(`  📈 Success rate: ${Math.round((successful.length / this.testResults.length) * 100)}%`);
    
    console.log(`\n📋 Test Details:`);
    this.testResults.forEach(result => {
      if (result.success) {
        console.log(`  ✅ ${result.testName}`);
        console.log(`     📁 Files: ${result.outputFiles?.join(', ') || 'N/A'}`);
      } else {
        console.log(`  ❌ ${result.testName}`);
        console.log(`     💥 Error: ${result.error || 'Command failed'}`);
      }
    });
  }

  async runIntegrationTests() {
    console.log('🧪 Running Integration Tests...\n');
    
    await this.setup();

    // Test CLI commands with different URLs
    await this.testCliCommand(
      'Basic CLI extraction', 
      'https://example.com',
      ['Context files saved to:', 'Files created:']
    );
    
    await this.testCliCommand(
      'Verbose mode output',
      'https://example.com',
      ['Analyzing page structure', 'Extracting data']
    );
    
    // Test learning system
    await this.testLearningPersistence();
    
    await this.cleanup();
    
    this.generateReport();
    
    // Determine overall success
    const successRate = this.testResults.filter(r => r.success).length / this.testResults.length;
    if (successRate < 0.8) {
      console.log('\n❌ Integration tests failed: Success rate below 80%');
      process.exit(1);
    } else {
      console.log('\n✅ Integration tests passed!');
    }
  }
}

// Run integration tests
const runner = new IntegrationTestRunner();
runner.runIntegrationTests().catch(error => {
  console.error('Integration test runner failed:', error);
  process.exit(1);
});