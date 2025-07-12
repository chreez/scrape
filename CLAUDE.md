# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Commands

**NPX Usage (Primary Interface):**
```bash
npx @chreez/scrape <url>                    # Extract context from any URL
npx @chreez/scrape <url> --output ./data    # Custom output directory
npx @chreez/scrape <url> --verbose          # Debug mode
npx @chreez/scrape <url> --no-headless      # Show browser
```

**Development Commands:**
```bash
node src/index.js <url> <data-type>         # Direct usage
npm start                                   # Same as above
npm run lint                                # Code linting (ESLint)
npm test                                    # Run tests (placeholder)
```

**Output Structure:** All extractions create context files in `scrape-output/`:
- `summary.md` - Executive summary
- `content.txt` - Cleaned text content  
- `metadata.json` - Structured metadata
- `context.md` - LLM-optimized context
- `entities.json` - Extracted entities (when detected)

## Architecture Overview

**Two-Track System:**
1. **Smart Mode** (`SmartScraper`): Default NPX interface with AI-powered adaptability
2. **Legacy Mode** (`Scrape`): Platform-specific adapters for targeted extraction

**Smart Extraction Flow:**
```
URL → Page Analysis → Learned Patterns (if available) → Default Extraction → Context Generation
```

**Core Components:**
- **`SmartScraper`**: Main extraction engine with learning capabilities
- **`LearningStorage`**: 6-month persistent cache of successful extraction patterns in `~/.scrape/learning.json`
- **`ContextGenerator`**: Creates LLM-optimized output files
- **`ExtractorEngine`**: Handles different content types (articles, products, profiles, etc.)
- **`StealthManager`**: Anti-detection and browser management

**Platform Detection:** Auto-detects content type from URL patterns and DOM structure:
- Social media (Instagram, Twitter, TikTok)
- Video platforms (YouTube)
- E-commerce (Amazon) 
- Code repositories (GitHub)
- News/articles (generic detection)
- Documentation sites

## Learning System

**Adaptive Learning:** Successfully extracted patterns are cached for 6 months with confidence scoring:
- Stores working selectors, extractor sequences, and optimal timing
- Cache auto-expires and self-repairs on failures
- Confidence decreases over time (100% → 40% over 3 months)
- Failed extractions trigger cache invalidation

**Learning File:** `~/.scrape/learning.json` contains domain-specific patterns with:
- Platform detection results
- Successful extractor types
- Optimal timing parameters
- Working DOM selectors

## File Organization
```
src/
├── smart.js              # Smart extraction with learning
├── index.js              # Legacy platform-specific extraction
├── adapters/             # Platform-specific logic (Instagram, etc.)
├── context/generator.js  # Context file creation
├── extractors/engine.js  # Content type extraction
├── learning/storage.js   # Pattern learning and caching
├── navigation/manager.js # Page navigation strategies
├── stealth/manager.js    # Anti-detection features
└── orchestrator/         # Task management

bin/scrape.js             # NPX CLI interface
config/platforms.json     # Platform configurations
```

## Development Patterns

**Content Type Strategy:** Different extraction logic based on detected content:
- `article/blog-post/encyclopedia-article` → Article extractor
- `product` → Product extractor  
- `social-profile` → Profile extractor
- `video/social-video` → Video extractor
- `generic` → Fallback text extraction

**Error Handling:** Graceful degradation with learning cache invalidation on failures

**Browser Management:** Playwright-based with stealth features and human-like behavior patterns

## Testing Strategy

**Manual Testing:**
```bash
# Test different content types
npx @chreez/scrape https://en.wikipedia.org/wiki/AI
npx @chreez/scrape https://news.ycombinator.com/
npx @chreez/scrape https://github.com/microsoft/playwright
```

**Cleanup:** Always remove test output files (`scrape-output/`) before commits

## Git Workflow

**Commit Format:**
```
type(scope): description

🤖 Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

**Prohibited in Commits:**
- Test output files (`*.json` in root, `scrape-output/`)
- Temporary directories
- Debug console.log statements
- Package lock files

**Quality Gates:**
- Keep commits under 300 lines
- Clean workspace before commits
- Push immediately after commit