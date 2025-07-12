import { chromium } from 'playwright';
import { BaseAdapter } from './adapters/base.js';
import { NavigationManager } from './navigation/manager.js';
import { ExtractorEngine } from './extractors/engine.js';
import { StealthManager } from './stealth/manager.js';
import { TaskOrchestrator } from './orchestrator/orchestrator.js';

export class Scrape {
  constructor(options = {}) {
    this.options = {
      headless: true,
      timeout: 30000,
      maxConcurrent: 3,
      retryAttempts: 3,
      ...options
    };
    
    this.stealth = new StealthManager(this.options);
    this.navigation = new NavigationManager(this.options);
    this.extractor = new ExtractorEngine(this.options);
    this.orchestrator = new TaskOrchestrator(this.options);
  }

  async extract(url, dataType, options = {}) {
    const adapter = await this.getAdapter(url, dataType);
    const config = adapter.getConfig();
    
    const browser = await this.stealth.launchBrowser();
    const context = await this.stealth.createContext(browser);
    const page = await context.newPage();
    
    try {
      console.log(`Extracting ${dataType} from ${url}...`);
      
      // Navigate to the target URL
      await this.navigation.navigateTo(page, url, config.navigation);
      
      // Extract data using the adapter's strategy
      const data = await adapter.extract(page, this.navigation, this.extractor, options);
      
      // Save results
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `${config.platform}-${dataType}-${timestamp}.json`;
      
      await import('fs').then(fs => {
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
      });
      
      console.log(`Results saved to: ${filename}`);
      return data;
      
    } finally {
      await browser.close();
    }
  }

  async getAdapter(url, dataType) {
    // Auto-detect platform from URL
    const platform = this.detectPlatform(url);
    
    // Dynamically import the appropriate adapter
    const AdapterClass = await this.loadAdapter(platform);
    return new AdapterClass(dataType, this.options);
  }

  detectPlatform(url) {
    const hostname = new URL(url).hostname.toLowerCase();
    
    if (hostname.includes('instagram.com')) return 'instagram';
    if (hostname.includes('tiktok.com')) return 'tiktok';
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';
    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('amazon.com')) return 'amazon';
    if (hostname.includes('reddit.com')) return 'reddit';
    if (hostname.includes('github.com')) return 'github';
    
    // Default to generic adapter for unknown platforms
    return 'generic';
  }

  async loadAdapter(platform) {
    try {
      const module = await import(`./adapters/${platform}.js`);
      return module.default || module[`${platform.charAt(0).toUpperCase()}${platform.slice(1)}Adapter`];
    } catch (error) {
      console.warn(`No specific adapter found for ${platform}, using generic adapter`);
      const module = await import('./adapters/generic.js');
      return module.default || module.GenericAdapter;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: node src/index.js <url> <data-type> [options]

Examples:
  node src/index.js https://www.instagram.com/username/ songs --max-items=20
  node src/index.js https://news.ycombinator.com/ articles --pages=5
  node src/index.js https://www.amazon.com/s?k=laptops products --max-items=100

Options:
  --max-items=N     Limit number of items to extract
  --headless        Run browser in headless mode (default: true)
  --timeout=N       Timeout in milliseconds (default: 30000)
  --max-concurrent=N Maximum concurrent operations (default: 3)
  --pages=N         Number of pages to process (default: 1)
    `);
    process.exit(1);
  }
  
  const [url, dataType] = args;
  const options = {};
  
  // Parse options
  args.slice(2).forEach(arg => {
    if (arg === '--headless') options.headless = true;
    if (arg === '--no-headless') options.headless = false;
    if (arg.startsWith('--max-items=')) options.maxItems = parseInt(arg.split('=')[1]);
    if (arg.startsWith('--timeout=')) options.timeout = parseInt(arg.split('=')[1]);
    if (arg.startsWith('--max-concurrent=')) options.maxConcurrent = parseInt(arg.split('=')[1]);
    if (arg.startsWith('--pages=')) options.pages = parseInt(arg.split('=')[1]);
  });
  
  try {
    const scrape = new Scrape(options);
    const results = await scrape.extract(url, dataType, options);
    
    console.log(`\n=== EXTRACTION COMPLETE ===`);
    console.log(`Extracted ${results.length} ${dataType} from ${url}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default Scrape;