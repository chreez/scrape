#!/usr/bin/env node

import { Command } from 'commander';
import { ParallelScraper } from '../src/performance/parallel-scraper.js';
import { ResourceOptimizer, PerformanceMonitor } from '../src/performance/monitor.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '../package.json');
const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));

const program = new Command();

program
  .name('scrape-batch')
  .description('High-performance batch scraping with parallel processing')
  .version(packageJson.version);

program
  .command('urls')
  .description('Scrape multiple URLs in parallel')
  .argument('<urls...>', 'URLs to scrape (space-separated)')
  .option('-c, --concurrency <number>', 'Maximum concurrent workers', '3')
  .option('-o, --output <dir>', 'Output directory', 'scrape-output-batch')
  .option('-d, --delay <ms>', 'Delay between requests in ms', '1000')
  .option('--shared-browser', 'Use shared browser for performance', true)
  .option('--no-shared-browser', 'Use individual browsers')
  .option('-v, --verbose', 'Verbose output')
  .option('--report', 'Show performance report')
  .action(async (urls, options) => {
    const monitor = new PerformanceMonitor();
    monitor.startTimer('total_batch');
    
    try {
      console.log(`🚀 Starting batch extraction of ${urls.length} URLs`);
      
      // Optimize settings for parallel processing
      const concurrency = parseInt(options.concurrency);
      const optimized = ResourceOptimizer.optimizeConcurrency(urls.length);
      
      if (concurrency > optimized.recommended) {
        console.log(`⚠️  Warning: Recommended concurrency is ${optimized.recommended}, you specified ${concurrency}`);
        console.log(`   Reason: ${JSON.stringify(optimized.reasoning)}`);
      }

      const scraperOptions = ResourceOptimizer.optimizeForParallel({
        maxConcurrent: concurrency,
        sharedBrowser: options.sharedBrowser,
        requestDelay: parseInt(options.delay),
        verbose: options.verbose,
        outputDir: options.output
      });

      const scraper = new ParallelScraper(scraperOptions);
      
      // Show progress during extraction
      if (options.verbose) {
        const progressInterval = setInterval(() => {
          const progress = scraper.getProgress();
          console.log(`📊 Progress: ${progress.completed}/${progress.total} completed, ${progress.failed} failed, ${progress.active} active (${progress.percentage}%)`);
        }, 2000);
        
        setTimeout(() => clearInterval(progressInterval), 300000); // Stop after 5 minutes
      }

      const results = await scraper.extractMultiple(urls);
      
      monitor.endTimer('total_batch');
      
      // Save results
      const outputPath = join(options.output, `batch-results-${Date.now()}.json`);
      await fs.mkdir(options.output, { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
      
      // Show summary
      console.log('\n✅ Batch extraction completed');
      console.log('📊 Summary:');
      console.log(`   Total URLs: ${results.summary.total}`);
      console.log(`   Successful: ${results.summary.successful}`);
      console.log(`   Failed: ${results.summary.failed}`);
      console.log(`   Duration: ${results.summary.duration}`);
      console.log(`   Average time: ${results.summary.averageTime}`);
      console.log(`   Throughput: ${results.summary.throughput}`);
      console.log(`\n📄 Results saved to: ${outputPath}`);
      
      if (options.report) {
        monitor.report();
      }
      
      // Show failed URLs if any
      if (results.failed.length > 0) {
        console.log(`\n❌ Failed URLs (${results.failed.length}):`);
        results.failed.forEach((failure, index) => {
          console.log(`   ${index + 1}. Error: ${failure.error}`);
          if (failure.context?.url) {
            console.log(`      URL: ${failure.context.url}`);
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Batch extraction failed:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('file')
  .description('Scrape URLs from a file (one URL per line)')
  .argument('<file>', 'File containing URLs to scrape')
  .option('-c, --concurrency <number>', 'Maximum concurrent workers', '3')
  .option('-o, --output <dir>', 'Output directory', 'scrape-output-batch')
  .option('-d, --delay <ms>', 'Delay between requests in ms', '1000')
  .option('--shared-browser', 'Use shared browser for performance', true)
  .option('--no-shared-browser', 'Use individual browsers')
  .option('-v, --verbose', 'Verbose output')
  .option('--report', 'Show performance report')
  .action(async (file, options) => {
    try {
      console.log(`📖 Reading URLs from ${file}`);
      
      const content = await fs.readFile(file, 'utf8');
      const urls = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.startsWith('http'));
      
      if (urls.length === 0) {
        console.error('❌ No valid URLs found in file');
        process.exit(1);
      }
      
      console.log(`Found ${urls.length} URLs to process`);
      
      // Use the urls command with the loaded URLs
      const urlsCommand = program.commands.find(cmd => cmd.name() === 'urls');
      await urlsCommand.action(urls, options);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`❌ File not found: ${file}`);
      } else {
        console.error(`❌ Error reading file: ${error.message}`);
      }
      process.exit(1);
    }
  });

program
  .command('benchmark')
  .description('Run performance benchmark tests')
  .option('-u, --urls <number>', 'Number of test URLs to generate', '10')
  .option('-c, --concurrency <number>', 'Test different concurrency levels', '1,2,3,5')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    console.log('🏃‍♂️ Running performance benchmarks...');
    
    // Generate test URLs (using httpbin for consistent testing)
    const testUrls = [];
    const urlCount = parseInt(options.urls);
    
    for (let i = 0; i < urlCount; i++) {
      testUrls.push(`https://httpbin.org/delay/${Math.floor(Math.random() * 3) + 1}`);
    }
    
    const concurrencyLevels = options.concurrency.split(',').map(c => parseInt(c.trim()));
    
    console.log(`Testing ${urlCount} URLs with concurrency levels: ${concurrencyLevels.join(', ')}`);
    
    for (const concurrency of concurrencyLevels) {
      console.log(`\n📊 Testing concurrency level: ${concurrency}`);
      
      const monitor = new PerformanceMonitor();
      monitor.startTimer(`benchmark_${concurrency}`);
      
      try {
        const scraper = new ParallelScraper({
          maxConcurrent: concurrency,
          sharedBrowser: true,
          requestDelay: 500,
          verbose: options.verbose
        });
        
        const results = await scraper.extractMultiple(testUrls);
        monitor.endTimer(`benchmark_${concurrency}`);
        
        console.log(`   Duration: ${results.summary.duration}`);
        console.log(`   Throughput: ${results.summary.throughput}`);
        console.log(`   Success rate: ${(results.summary.successful / results.summary.total * 100).toFixed(1)}%`);
        
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      }
    }
    
    console.log('\n✅ Benchmark completed');
  });

// Add help examples
program.addHelpText('after', `
Examples:
  # Scrape multiple URLs
  $ scrape-batch urls https://example.com https://github.com/user/repo --concurrency 5

  # Scrape URLs from file
  $ scrape-batch file urls.txt --verbose --report

  # Performance benchmark
  $ scrape-batch benchmark --urls 20 --concurrency "1,3,5,8"

  # High-performance batch with optimization
  $ scrape-batch urls https://site1.com https://site2.com \\
    --concurrency 8 --delay 500 --shared-browser --verbose

File Format (for 'file' command):
  https://example.com/page1
  https://github.com/user/repo
  https://wikipedia.org/wiki/Topic
  # Comments and empty lines are ignored

Performance Tips:
  • Use --shared-browser for better performance with many URLs
  • Increase --concurrency carefully (recommended: 3-8)
  • Add --delay to be respectful to target servers
  • Use --report to analyze performance bottlenecks
`);

program.parse();