#!/usr/bin/env node

import { Command } from 'commander';
import { SmartScraper } from '../src/smart.js';
import { 
  ScrapeError,
  NavigationError,
  ExtractionError,
  DetectionError 
} from '../src/errors/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const program = new Command();

program
  .name('scrape')
  .description('Agentic web automation framework - extract context from any URL')
  .version(packageJson.version);

program
  .argument('<url>', 'URL to scrape')
  .option('-o, --output <dir>', 'Output directory for context files', 'scrape-output')
  .option('--headless', 'Run browser in headless mode', true)
  .option('--no-headless', 'Show browser during scraping')
  .option('-v, --verbose', 'Verbose output')
  .action(async (url, options) => {
    try {
      console.log(`🔍 Analyzing ${url}...`);
      
      const scraper = new SmartScraper({
        headless: options.headless,
        verbose: options.verbose,
        outputDir: options.output
      });
      
      const result = await scraper.extract(url);
      
      const outputDir = result._outputDir || options.output;
      console.log(`✅ Context files saved to: ${outputDir}/`);
      console.log(`📄 Files created:`);
      console.log(`   - summary.md (${result['summary.md']?.length || 0} chars)`);
      console.log(`   - content.txt (${result['content.txt']?.length || 0} chars)`);
      
      // Handle metadata.json (it's a JSON string, so count parsed object keys)
      const metadataCount = result['metadata.json'] ? 
        Object.keys(JSON.parse(result['metadata.json'])).length : 0;
      console.log(`   - metadata.json (${metadataCount} fields)`);
      console.log(`   - context.md (${result['context.md']?.length || 0} chars)`);
      
      if (result['entities.json']) {
        const entities = JSON.parse(result['entities.json']);
        console.log(`   - entities.json (${entities.length} entities)`);
      }
      
    } catch (error) {
      console.error('❌ Extraction failed');
      
      if (error instanceof ScrapeError) {
        // Handle known error types with helpful messages
        console.error(`\n🔍 Error Type: ${error.constructor.name}`);
        console.error(`📋 Message: ${error.message}`);
        
        if (error.code) {
          console.error(`🏷️  Code: ${error.code}`);
        }
        
        // Show context if available
        if (error.context && Object.keys(error.context).length > 0) {
          console.error(`📍 Context:`);
          Object.entries(error.context).forEach(([key, value]) => {
            if (key !== 'originalError') {
              console.error(`   ${key}: ${value}`);
            }
          });
        }
        
        // Show suggestions for common errors
        if (error instanceof NavigationError) {
          console.error(`\n💡 Suggestions:`);
          console.error(`   • Check if the URL is accessible in a browser`);
          console.error(`   • Try increasing timeout with longer wait`);
          console.error(`   • Verify your network connection`);
          if (error.context?.timeout) {
            console.error(`   • Current timeout: ${error.context.timeout}ms`);
          }
        } else if (error instanceof ExtractionError) {
          console.error(`\n💡 Suggestions:`);
          console.error(`   • Try running with --verbose to see detailed output`);
          console.error(`   • The site structure may have changed`);
          console.error(`   • Try clearing learning cache: rm ~/.scrape/learning.json`);
        } else if (error instanceof DetectionError) {
          console.error(`\n💡 Suggestions:`);
          console.error(`   • Run with --no-headless to see what's happening`);
          console.error(`   • The site may be blocking automated access`);
          console.error(`   • Try again later - temporary blocks are common`);
        }
        
      } else {
        // Handle unknown errors
        console.error(`\n📋 Unexpected error: ${error.message}`);
      }
      
      if (options.verbose) {
        console.error(`\n🔧 Stack trace:`);
        console.error(error.stack);
      } else {
        console.error(`\nℹ️  Use --verbose for detailed error information`);
      }
      
      process.exit(1);
    }
  });

// Add help examples
program.addHelpText('after', `
Examples:
  $ scrape https://example.com/article
  $ scrape https://news.ycombinator.com/ --output ./hn-data
  $ scrape https://github.com/user/repo --verbose
  $ scrape https://wikipedia.org/wiki/Topic --no-headless

  # Or with direct execution:
  $ node bin/scrape.js https://example.com/article

Output Files:
  summary.md    - Executive summary of extracted content
  content.txt   - Full text content, cleaned and formatted
  metadata.json - Structured metadata (title, author, date, etc.)
  context.md    - LLM-optimized context file
  entities.json - Extracted entities and concepts (when detected)
`);

program.parse();