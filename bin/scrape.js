#!/usr/bin/env node

import { Command } from 'commander';
import { SmartScraper } from '../src/smart.js';
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
      
      console.log(`✅ Context files saved to: ${options.output}/`);
      console.log(`📄 Files created:`);
      console.log(`   - summary.md (${result.summary?.length || 0} chars)`);
      console.log(`   - content.txt (${result.content?.length || 0} chars)`);
      console.log(`   - metadata.json (${Object.keys(result.metadata || {}).length} fields)`);
      console.log(`   - context.md (${result.context?.length || 0} chars)`);
      
      if (result.entities && result.entities.length > 0) {
        console.log(`   - entities.json (${result.entities.length} entities)`);
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      if (options.verbose) {
        console.error(error.stack);
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