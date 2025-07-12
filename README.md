# Scrape

🤖 Agentic web automation framework with AI-powered content extraction and adaptive learning.

**Smart by Default** - Just provide a URL and get LLM-optimized context files with zero configuration.

## Overview

Scrape is an intelligent web automation system that learns from successful extractions to improve over time. Built on Playwright with a sophisticated learning engine, it automatically adapts to any website's structure and handles evolving web technologies through pattern recognition and self-healing extraction strategies.

## Features

- **🧠 Adaptive Learning**: 6-month cache of successful patterns with confidence scoring
- **🔍 Smart Detection**: Auto-identifies content types (articles, products, profiles, videos)
- **🛡️ Anti-Detection**: Human-like behavior simulation and stealth browsing
- **📊 Context Generation**: Creates LLM-optimized output files for any content
- **🚀 Zero Configuration**: Works out-of-the-box with any URL
- **🔧 Self-Healing**: Automatically adapts when page structures change

## Installation

**Quick Setup (Recommended):**
```bash
# Clone and install
git clone https://github.com/chreez/scrape.git
cd scrape
npm install

# Make globally available (optional)
npm link
```

**Usage After Installation:**
```bash
# If you ran npm link
scrape <url>

# Or direct execution
node bin/scrape.js <url>

# Examples:
scrape https://en.wikipedia.org/wiki/Artificial_intelligence
scrape https://news.ycombinator.com/
scrape https://github.com/microsoft/playwright

# Custom output directory
scrape https://example.com --output ./my-data

# Verbose mode for debugging
scrape https://example.com --verbose

# Show browser during extraction
scrape https://example.com --no-headless
```

## Output Files

Every extraction creates context files optimized for LLM consumption:

```
scrape-output/
├── summary.md          # Executive summary with key information
├── content.txt         # Full text content, cleaned and formatted
├── metadata.json       # Structured metadata (title, author, date, etc.)
├── context.md          # LLM-optimized context file
└── entities.json       # Extracted entities and concepts (when detected)
```

## How It Works

**Intelligent Extraction Flow:**
```
URL → Platform Detection → Learned Patterns (if available) → Smart Extraction → Context Generation
```

**Learning System:**
- Successful extractions are cached for 6 months in `~/.scrape/learning.json`
- Patterns include working selectors, timing, and extraction strategies
- Confidence scoring decreases over time (100% → 40% over 3 months)
- Failed extractions trigger cache invalidation and pattern updates

**Content Type Detection:**
- Articles, blog posts, news, documentation
- Products, e-commerce pages, reviews
- Social profiles, posts, videos
- Code repositories, technical docs
- Academic papers, research content

## For Lore Integration

**Option 1: Git Clone (Recommended for Development)**
```bash
# In your Lore project
git clone https://github.com/chreez/scrape.git tools/scrape
cd tools/scrape
npm install

# Use from Lore
node tools/scrape/bin/scrape.js <url>
```

**Option 2: Global Install**
```bash
# One-time setup
git clone https://github.com/chreez/scrape.git
cd scrape
npm install
npm link

# Now available globally
scrape <url>
```

**Option 3: Direct Node Execution**
```bash
# Clone anywhere
git clone https://github.com/chreez/scrape.git
cd scrape
npm install

# Direct usage (no global install)
node /full/path/to/scrape/bin/scrape.js <url>
```

## Architecture

**Smart Scraper (Primary):**
- AI-powered content analysis and extraction
- Adaptive learning with pattern caching
- Context file generation for LLM consumption

**Legacy Platform Adapters (Fallback):**
- Site-specific extraction logic
- Targeted social media, e-commerce support
- Configuration-driven extraction patterns

```
src/
├── smart.js              # Main smart extraction engine
├── context/generator.js  # LLM-optimized context files
├── learning/storage.js   # Pattern learning and caching
├── extractors/engine.js  # Content type extraction
├── stealth/manager.js    # Anti-detection and browser management
├── adapters/             # Platform-specific logic (fallback)
└── navigation/           # Page navigation strategies
```

## Configuration

Platform configurations are JSON-based and define:
- DOM selectors and patterns
- Navigation strategies
- Rate limiting parameters
- Anti-detection settings

Example Instagram configuration:
```json
{
  "platform": "instagram",
  "dataType": "audio",
  "selectors": {
    "itemList": "a[href*='/reel/']",
    "audioLink": "a[href*='/reels/audio/']",
    "artistSong": "text-content"
  },
  "navigation": "list-then-detail",
  "rateLimit": { "delay": 2000, "maxConcurrent": 3 }
}
```

## Examples

See the `examples/` directory for platform-specific usage:
- `instagram-songs.js` - Extract music from Instagram reels
- `tiktok-videos.js` - Extract video metadata from TikTok
- `youtube-playlists.js` - Extract playlist data from YouTube

## Development

```bash
# Test smart extraction
node bin/scrape.js <url> --verbose

# Legacy direct usage
node src/index.js <url> <data-type> [options]

# Lint code
npm run lint

# Test with various content types
scrape https://en.wikipedia.org/wiki/AI --verbose
scrape https://news.ycombinator.com/ --verbose
scrape https://github.com/microsoft/playwright --verbose
```

## Learning Cache

**View cache statistics:**
```javascript
import { LearningStorage } from './src/learning/storage.js';
const storage = new LearningStorage();
console.log(await storage.getStats());
```

**Clear cache:**
```javascript
await storage.clearAllCache();
```

**Cache location:** `~/.scrape/learning.json`

## Atomic Tool Integration

Scrape integrates with the dotfiles atomic tool system:

```bash
# Future atomic tool command
~/.dotfiles/bin/extract_social_data <url> <type> [options]

# Examples:
extract_social_data instagram.com/user songs --limit=50
extract_social_data tiktok.com/@user videos --metadata-only
```

## License

MIT