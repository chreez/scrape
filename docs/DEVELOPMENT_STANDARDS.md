# Development Standards for Scrape

## TypeScript Migration Guidelines

### Migration Strategy
- **Incremental Migration**: Convert files one at a time, starting with core modules
- **Type Safety First**: Add types for all function parameters and return values
- **Preserve Functionality**: Ensure all tests pass after each file conversion
- **No Big Bang**: Avoid massive refactors that break existing functionality

### TypeScript Best Practices

#### 1. File Size Limits
- **Maximum Lines**: 300 lines per file (excluding imports and comments)
- **Single Responsibility**: Each file should have one primary export
- **Split Large Classes**: Break into smaller, focused modules
- **Example Structure**:
  ```typescript
  // ❌ Bad: 1000+ line file
  export class SmartScraper {
    // 50+ methods...
  }
  
  // ✅ Good: Split into focused modules
  export class SmartScraper {
    constructor(
      private extractor: ExtractorService,
      private learner: LearningService,
      private navigator: NavigationService
    ) {}
  }
  ```

#### 2. Data Encapsulation
- **Private by Default**: Make class members private unless needed externally
- **Interfaces for Contracts**: Define interfaces for all public APIs
- **DTOs for Data Transfer**: Use Data Transfer Objects for API boundaries
- **Example**:
  ```typescript
  // Define clear interfaces
  interface ExtractedData {
    content: ContentDTO;
    metadata: MetadataDTO;
    repository?: RepositoryDTO;
  }
  
  // Use DTOs for data structures
  interface RepositoryDTO {
    name: string;
    stars: number;
    forks: number;
    readme?: string;
  }
  ```

#### 3. Module Organization
```
src/
├── core/               # Core business logic
│   ├── scraper/       # Main scraping engine
│   ├── extraction/    # Data extraction logic
│   └── learning/      # Adaptive learning system
├── adapters/          # Platform-specific adapters
├── services/          # Reusable services
├── models/            # TypeScript interfaces and types
├── utils/             # Utility functions
└── config/            # Configuration management
```

#### 4. Type Safety Rules
- **No `any` Type**: Use `unknown` if type is truly unknown
- **Strict Mode**: Enable all TypeScript strict flags
- **Null Safety**: Use optional chaining and nullish coalescing
- **Example tsconfig.json**:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noImplicitAny": true,
      "strictNullChecks": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true
    }
  }
  ```

#### 5. Error Handling
- **Custom Error Classes**: Create specific error types
- **Result Types**: Use Result<T, E> pattern for operations that can fail
- **Example**:
  ```typescript
  class ExtractionError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly context?: unknown
    ) {
      super(message);
    }
  }
  
  type Result<T, E = Error> = 
    | { success: true; data: T }
    | { success: false; error: E };
  ```

#### 6. Dependency Injection
- **Constructor Injection**: Inject dependencies via constructor
- **Interfaces Over Implementations**: Depend on interfaces, not concrete classes
- **Service Locator Pattern**: For complex dependency graphs
- **Example**:
  ```typescript
  interface IExtractorEngine {
    extract(page: Page, type: string): Promise<ExtractedData>;
  }
  
  class SmartScraper {
    constructor(
      private readonly extractor: IExtractorEngine,
      private readonly logger: ILogger
    ) {}
  }
  ```

#### 7. Testing Standards
- **Unit Tests**: One test file per source file
- **Integration Tests**: Test module boundaries
- **Type Testing**: Validate TypeScript types compile correctly
- **Coverage Target**: 80% code coverage minimum

#### 8. Code Style
- **Naming Conventions**:
  - Interfaces: `IExtractorEngine` or `ExtractorEngine` (team choice)
  - Types: `PascalCase`
  - Enums: `PascalCase` with `UPPER_CASE` values
  - Files: `kebab-case.ts`
- **Import Organization**:
  1. Node.js built-ins
  2. External dependencies
  3. Internal modules (absolute paths)
  4. Relative imports
  5. Type imports

#### 9. Documentation
- **JSDoc for Public APIs**: Document all public methods and classes
- **Type Documentation**: Explain complex types with comments
- **Example**:
  ```typescript
  /**
   * Extracts structured data from web pages using AI-powered analysis
   * @param url - The URL to scrape
   * @param options - Configuration options
   * @returns Extracted data with metadata
   * @throws {ExtractionError} When extraction fails
   */
  async extract(url: string, options?: ExtractOptions): Promise<ExtractedData> {
    // Implementation
  }
  ```

#### 10. Performance Considerations
- **Lazy Loading**: Load modules only when needed
- **Memory Management**: Clean up resources properly
- **Async Best Practices**: Use Promise.all() for parallel operations
- **Streaming**: Use streams for large data processing

## Migration Priority

### Phase 1: Core Infrastructure (Week 1)
1. `src/models/` - Define all TypeScript interfaces
2. `src/utils/` - Convert utility functions
3. `src/config/` - Type configuration system

### Phase 2: Services (Week 2)
1. `src/extractors/engine.ts` - Core extraction engine
2. `src/learning/storage.ts` - Learning system
3. `src/stealth/manager.ts` - Anti-detection

### Phase 3: Main Application (Week 3)
1. `src/smart.ts` - Main scraper class (split into smaller modules)
2. `src/context/generator.ts` - Context generation
3. `bin/scrape.ts` - CLI entry point

### Phase 4: Adapters & Tests (Week 4)
1. Platform adapters
2. Integration tests
3. Documentation updates

## Refactoring Checklist

Before converting a file to TypeScript:
- [ ] File is under 300 lines (split if needed)
- [ ] Clear module boundaries defined
- [ ] Interfaces extracted for public APIs
- [ ] Dependencies identified for injection
- [ ] Tests exist and pass
- [ ] Documentation updated

## Example Migration

### Before (JavaScript):
```javascript
// src/extractors/engine.js
export class ExtractorEngine {
  constructor(options = {}) {
    this.options = options;
    this.extractors = new Map();
    this.initializeExtractors();
  }
  
  async extract(page, dataType, config = {}) {
    // 50+ lines of extraction logic...
  }
}
```

### After (TypeScript):
```typescript
// src/models/extractor.types.ts
export interface IExtractorEngine {
  extract(page: Page, dataType: ExtractorType, config?: ExtractorConfig): Promise<ExtractedData>;
}

export interface ExtractorConfig {
  selectors?: SelectorMap;
  timeout?: number;
}

// src/services/extractor/extractor-engine.ts
export class ExtractorEngine implements IExtractorEngine {
  constructor(
    private readonly options: ExtractorOptions,
    private readonly extractorFactory: IExtractorFactory,
    private readonly logger: ILogger
  ) {}
  
  async extract(
    page: Page, 
    dataType: ExtractorType, 
    config?: ExtractorConfig
  ): Promise<ExtractedData> {
    // Focused extraction logic
  }
}
```

## Benefits of Migration

1. **Type Safety**: Catch errors at compile time
2. **Better IDE Support**: Autocomplete and refactoring tools
3. **Self-Documenting**: Types serve as documentation
4. **Maintainability**: Easier to understand and modify
5. **Scalability**: Better architecture for growth
6. **Testing**: Easier to mock and test with interfaces

## Gradual Adoption

Start applying these principles to new code immediately:
- Write new features in TypeScript
- Add types when modifying existing files
- Refactor large files when touching them
- Convert critical path modules first