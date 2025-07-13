/**
 * Custom error classes for the Scrape framework
 * Provides specific error types for better error handling and debugging
 */

/**
 * Base error class for all Scrape-specific errors
 */
export class ScrapeError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Navigation errors - page loading, timeouts, redirects
 */
export class NavigationError extends ScrapeError {
  constructor(message, url, details = {}) {
    super(message, 'NAVIGATION_ERROR', { url, ...details });
    this.url = url;
  }
}

/**
 * Extraction errors - content extraction failures
 */
export class ExtractionError extends ScrapeError {
  constructor(message, extractorType, details = {}) {
    super(message, 'EXTRACTION_ERROR', { extractorType, ...details });
    this.extractorType = extractorType;
  }
}

/**
 * Platform errors - platform-specific issues
 */
export class PlatformError extends ScrapeError {
  constructor(message, platform, details = {}) {
    super(message, 'PLATFORM_ERROR', { platform, ...details });
    this.platform = platform;
  }
}

/**
 * Learning system errors
 */
export class LearningError extends ScrapeError {
  constructor(message, domain, details = {}) {
    super(message, 'LEARNING_ERROR', { domain, ...details });
    this.domain = domain;
  }
}

/**
 * Context generation errors
 */
export class ContextGenerationError extends ScrapeError {
  constructor(message, fileType, details = {}) {
    super(message, 'CONTEXT_GENERATION_ERROR', { fileType, ...details });
    this.fileType = fileType;
  }
}

/**
 * Anti-detection errors - when blocked or detected
 */
export class DetectionError extends ScrapeError {
  constructor(message, url, details = {}) {
    super(message, 'DETECTION_ERROR', { url, ...details });
    this.url = url;
    this.isRecoverable = details.isRecoverable || false;
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends ScrapeError {
  constructor(message, configKey, details = {}) {
    super(message, 'CONFIGURATION_ERROR', { configKey, ...details });
    this.configKey = configKey;
  }
}

/**
 * File system errors
 */
export class FileSystemError extends ScrapeError {
  constructor(message, path, operation, details = {}) {
    super(message, 'FILESYSTEM_ERROR', { path, operation, ...details });
    this.path = path;
    this.operation = operation;
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends ScrapeError {
  constructor(message, platform, retryAfter = null, details = {}) {
    super(message, 'RATE_LIMIT_ERROR', { platform, retryAfter, ...details });
    this.platform = platform;
    this.retryAfter = retryAfter;
  }
}

/**
 * Validation errors
 */
export class ValidationError extends ScrapeError {
  constructor(message, field, value, details = {}) {
    super(message, 'VALIDATION_ERROR', { field, value, ...details });
    this.field = field;
    this.value = value;
  }
}

/**
 * Error result type for operations that can fail
 */
export class Result {
  constructor(success, data = null, error = null) {
    this.success = success;
    this.data = data;
    this.error = error;
  }

  static ok(data) {
    return new Result(true, data, null);
  }

  static fail(error) {
    return new Result(false, null, error);
  }

  isOk() {
    return this.success;
  }

  isFail() {
    return !this.success;
  }

  unwrap() {
    if (!this.success) {
      throw this.error;
    }
    return this.data;
  }

  unwrapOr(defaultValue) {
    return this.success ? this.data : defaultValue;
  }

  map(fn) {
    if (!this.success) {
      return this;
    }
    try {
      return Result.ok(fn(this.data));
    } catch (error) {
      return Result.fail(error);
    }
  }

  mapError(fn) {
    if (this.success) {
      return this;
    }
    return Result.fail(fn(this.error));
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  static handle(error, context = {}) {
    // Log error with context
    console.error(`[${error.code || 'UNKNOWN_ERROR'}] ${error.message}`, {
      ...context,
      timestamp: new Date().toISOString(),
      stack: error.stack
    });

    // Determine if error is recoverable
    const isRecoverable = this.isRecoverable(error);
    
    return {
      error,
      isRecoverable,
      context,
      suggestions: this.getSuggestions(error)
    };
  }

  static isRecoverable(error) {
    // Navigation timeouts can be retried
    if (error instanceof NavigationError && error.context.timeout) {
      return true;
    }

    // Rate limits can be retried after delay
    if (error instanceof RateLimitError) {
      return true;
    }

    // Some detection errors can be retried with different strategy
    if (error instanceof DetectionError && error.isRecoverable) {
      return true;
    }

    // Temporary extraction failures
    if (error instanceof ExtractionError && error.context.temporary) {
      return true;
    }

    return false;
  }

  static getSuggestions(error) {
    const suggestions = [];

    if (error instanceof NavigationError) {
      suggestions.push('Try increasing timeout');
      suggestions.push('Check if URL is accessible');
      suggestions.push('Verify network connectivity');
    }

    if (error instanceof ExtractionError) {
      suggestions.push('Clear learning cache for this site');
      suggestions.push('Try with --no-headless to debug');
      suggestions.push('Check if site structure changed');
    }

    if (error instanceof DetectionError) {
      suggestions.push('Try with different user agent');
      suggestions.push('Add delays between requests');
      suggestions.push('Use residential proxy if available');
    }

    if (error instanceof RateLimitError) {
      suggestions.push(`Wait ${error.retryAfter} seconds before retry`);
      suggestions.push('Reduce request frequency');
      suggestions.push('Use authenticated requests if available');
    }

    return suggestions;
  }

  static async withRetry(fn, maxRetries = 3, backoff = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;
        
        const handled = this.handle(error, { attempt, maxRetries });
        
        if (!handled.isRecoverable || attempt === maxRetries) {
          throw error;
        }
        
        // Calculate backoff delay
        const delay = backoff * Math.pow(2, attempt - 1);
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}