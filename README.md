# Scrape

Agentic web automation framework for intelligent data extraction from any website.

## Overview

Scrape is a modular, intelligent web automation system built on Playwright that adapts to any website's structure and extraction requirements. It uses LLM-powered adaptability to handle dynamic UIs, anti-bot measures, and evolving web technologies.

## Features

- **Universal Platform Support**: Social media, e-commerce, news sites, forums, APIs, databases
- **Adaptive Extraction**: Self-healing selectors using AI analysis
- **Anti-Detection Suite**: Human-like behavior patterns and stealth features
- **Modular Architecture**: Platform adapters, navigation strategies, extraction engines
- **Configuration-Driven**: JSON-based platform and task configurations
- **Atomic Tool Integration**: Works seamlessly with dotfiles tool system

## Quick Start

```bash
# Install dependencies
npm install

# Extract data from any website
node src/index.js <url> <data-type> [options]

# Examples:
# Social media content
node examples/instagram-songs.js https://www.instagram.com/username/

# E-commerce product data
node examples/amazon-products.js https://www.amazon.com/s?k=laptops

# News article extraction
node examples/news-scraper.js https://news.ycombinator.com/

# Real estate listings
node examples/real-estate.js https://www.zillow.com/homes/
```

## Architecture

```
src/
├── adapters/         # Site-specific logic (social media, e-commerce, news, etc.)
├── navigation/       # Navigation strategies (list-then-detail, infinite-scroll, pagination)
├── extractors/       # Data extraction engines (multimedia, text, structured data, APIs)
├── stealth/         # Anti-detection features (fingerprinting, behavior, proxy rotation)
└── orchestrator/    # Task management (queuing, retry, progress, parallel processing)
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
# Run tests
npm test

# Lint code
npm run lint

# Start development server
npm start
```

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