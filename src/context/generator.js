export class ContextGenerator {
  constructor(options = {}) {
    this.options = options;
  }

  async generate(extractedData, pageAnalysis) {
    const contextFiles = {};
    
    // Generate summary.md
    contextFiles['summary.md'] = this.generateSummary(extractedData, pageAnalysis);
    
    // Generate content.txt
    contextFiles['content.txt'] = this.generateContent(extractedData);
    
    // Generate metadata.json
    contextFiles['metadata.json'] = this.generateMetadata(extractedData, pageAnalysis);
    
    // Generate context.md (LLM-optimized)
    contextFiles['context.md'] = this.generateContext(extractedData, pageAnalysis);
    
    // Generate entities.json (if entities detected)
    const entities = this.extractEntities(extractedData);
    if (entities && entities.length > 0) {
      contextFiles['entities.json'] = JSON.stringify(entities, null, 2);
    }
    
    return contextFiles;
  }

  generateSummary(data, analysis) {
    let summary = `# ${this.getTitle(data)}\n\n`;
    
    summary += `**Source**: ${data.url}\n`;
    summary += `**Type**: ${analysis.contentType}\n`;
    summary += `**Platform**: ${analysis.platform}\n`;
    summary += `**Extracted**: ${new Date(data.timestamp).toLocaleString()}\n\n`;
    
    // Add content-specific summary
    switch (analysis.contentType) {
      case 'article':
      case 'blog-post':
      case 'encyclopedia-article':
        summary += this.generateArticleSummary(data);
        break;
      case 'product':
        summary += this.generateProductSummary(data);
        break;
      case 'social-profile':
        summary += this.generateProfileSummary(data);
        break;
      case 'video':
      case 'social-video':
        summary += this.generateVideoSummary(data);
        break;
      case 'code-repository':
        summary += this.generateRepositorySummary(data);
        break;
      default:
        summary += this.generateGenericSummary(data);
    }
    
    return summary;
  }

  generateContent(data) {
    let content = '';
    
    // Add main title
    const title = this.getTitle(data);
    if (title) {
      content += `${title}\n${'='.repeat(title.length)}\n\n`;
    }
    
    // Add main content based on type
    if (data.article) {
      content += this.formatArticleContent(data.article);
    } else if (data.product) {
      content += this.formatProductContent(data.product);
    } else if (data.profile) {
      content += this.formatProfileContent(data.profile);
    } else if (data.repository) {
      content += this.formatRepositoryContent(data.repository);
    } else if (data.textContent) {
      content += this.formatTextContent(data.textContent);
    }
    
    // Add additional information
    if (data.structured && data.structured.length > 0) {
      content += '\n\nStructured Data:\n';
      content += this.formatStructuredData(data.structured);
    }
    
    return content.trim();
  }

  generateMetadata(data, analysis) {
    const metadata = {
      url: data.url,
      platform: data.platform,
      contentType: analysis.contentType,
      extractedAt: data.timestamp,
      stats: analysis.stats
    };
    
    // Add extracted metadata
    if (data.metadata) {
      Object.assign(metadata, data.metadata);
    }
    
    // Add content-specific metadata
    if (data.article) {
      metadata.article = {
        title: data.article.title,
        author: data.article.author,
        publishDate: data.article.publishDate,
        readTime: data.article.readTime
      };
    }
    
    if (data.product) {
      metadata.product = {
        title: data.product.title,
        price: data.product.price,
        rating: data.product.rating,
        availability: data.product.availability
      };
    }
    
    if (data.profile) {
      metadata.profile = {
        username: data.profile.username,
        displayName: data.profile.displayName,
        followerCount: data.profile.followerCount,
        followingCount: data.profile.followingCount
      };
    }
    
    if (data.repository) {
      metadata.repository = {
        name: data.repository.name,
        description: data.repository.description,
        stars: data.repository.stars,
        forks: data.repository.forks,
        primary_language: data.repository.primary_language,
        license: data.repository.license,
        topics: data.repository.topics,
        contributors: data.repository.contributors,
        last_commit: data.repository.last_commit
      };
    }
    
    return JSON.stringify(metadata, null, 2);
  }

  generateContext(data, analysis) {
    let context = `# Context: ${this.getTitle(data)}\n\n`;
    
    // Source information
    context += `**Source**: ${data.url}\n`;
    context += `**Content Type**: ${analysis.contentType}\n`;
    context += `**Platform**: ${analysis.platform}\n`;
    context += `**Extracted**: ${new Date(data.timestamp).toLocaleString()}\n\n`;
    
    // Key information summary
    context += '## Key Information\n\n';
    
    switch (analysis.contentType) {
      case 'article':
      case 'blog-post':
      case 'encyclopedia-article':
        context += this.generateArticleContext(data);
        break;
      case 'product':
        context += this.generateProductContext(data);
        break;
      case 'social-profile':
        context += this.generateProfileContext(data);
        break;
      case 'code-repository':
        context += this.generateRepositoryContext(data);
        break;
      default:
        context += this.generateGenericContext(data);
    }
    
    // Add main content (optimized for LLM)
    context += '\n## Content\n\n';
    
    if (data.article && data.article.content) {
      context += this.optimizeTextForLLM(data.article.content);
    } else if (data.repository && data.repository.readme_content) {
      context += this.optimizeTextForLLM(data.repository.readme_content);
    } else if (data.textContent && data.textContent.content) {
      context += this.optimizeTextForLLM(data.textContent.content);
    } else if (data.textContent && data.textContent.title) {
      context += this.optimizeTextForLLM(data.textContent.title);
    }
    
    // Add structured data if available
    if (data.structured && data.structured.length > 0) {
      context += '\n\n## Structured Data\n\n';
      context += this.formatStructuredDataForLLM(data.structured);
    }
    
    return context;
  }

  // Helper methods for different content types
  generateArticleSummary(data) {
    let summary = '## Article Summary\n\n';
    
    if (data.article) {
      if (data.article.author) summary += `**Author**: ${data.article.author}\n`;
      if (data.article.publishDate) summary += `**Published**: ${data.article.publishDate}\n`;
      if (data.article.readTime) summary += `**Read Time**: ${data.article.readTime}\n`;
      summary += '\n';
      
      if (data.article.content) {
        const excerpt = this.createExcerpt(data.article.content, 200);
        summary += `**Excerpt**: ${excerpt}\n\n`;
      }
    }
    
    return summary;
  }

  generateProductSummary(data) {
    let summary = '## Product Summary\n\n';
    
    if (data.product) {
      if (data.product.price) summary += `**Price**: ${data.product.price}\n`;
      if (data.product.rating) summary += `**Rating**: ${data.product.rating}\n`;
      if (data.product.availability) summary += `**Availability**: ${data.product.availability}\n`;
      summary += '\n';
      
      if (data.product.description) {
        const excerpt = this.createExcerpt(data.product.description, 200);
        summary += `**Description**: ${excerpt}\n\n`;
      }
    }
    
    return summary;
  }

  generateProfileSummary(data) {
    let summary = '## Profile Summary\n\n';
    
    if (data.profile) {
      if (data.profile.username) summary += `**Username**: ${data.profile.username}\n`;
      if (data.profile.displayName) summary += `**Name**: ${data.profile.displayName}\n`;
      if (data.profile.followerCount) summary += `**Followers**: ${data.profile.followerCount}\n`;
      if (data.profile.followingCount) summary += `**Following**: ${data.profile.followingCount}\n`;
      summary += '\n';
      
      if (data.profile.bio) {
        summary += `**Bio**: ${data.profile.bio}\n\n`;
      }
    }
    
    return summary;
  }

  generateVideoSummary(data) {
    let summary = '## Video Summary\n\n';
    
    if (data.video) {
      // Add video-specific information
      summary += 'Video content detected.\n\n';
    }
    
    return summary;
  }

  generateGenericSummary(data) {
    let summary = '## Content Summary\n\n';
    
    if (data.textContent && data.textContent.content) {
      const excerpt = this.createExcerpt(data.textContent.content, 300);
      summary += `**Content Preview**: ${excerpt}\n\n`;
    }
    
    return summary;
  }

  // Context generation helpers
  generateArticleContext(data) {
    let context = '';
    
    if (data.article) {
      if (data.article.title) context += `- **Title**: ${data.article.title}\n`;
      if (data.article.author) context += `- **Author**: ${data.article.author}\n`;
      if (data.article.publishDate) context += `- **Date**: ${data.article.publishDate}\n`;
      if (data.article.tags && data.article.tags.length > 0) {
        context += `- **Tags**: ${data.article.tags.join(', ')}\n`;
      }
    }
    
    return context;
  }

  generateProductContext(data) {
    let context = '';
    
    if (data.product) {
      if (data.product.title) context += `- **Product**: ${data.product.title}\n`;
      if (data.product.price) context += `- **Price**: ${data.product.price}\n`;
      if (data.product.rating) context += `- **Rating**: ${data.product.rating}\n`;
      if (data.product.reviews) context += `- **Reviews**: ${data.product.reviews}\n`;
    }
    
    return context;
  }

  generateProfileContext(data) {
    let context = '';
    
    if (data.profile) {
      if (data.profile.displayName) context += `- **Name**: ${data.profile.displayName}\n`;
      if (data.profile.username) context += `- **Handle**: ${data.profile.username}\n`;
      if (data.profile.followerCount) context += `- **Followers**: ${data.profile.followerCount}\n`;
    }
    
    return context;
  }

  generateGenericContext(data) {
    let context = '';
    
    if (data.metadata) {
      if (data.metadata.title) context += `- **Title**: ${data.metadata.title}\n`;
      if (data.metadata.description) context += `- **Description**: ${data.metadata.description}\n`;
      if (data.metadata.author) context += `- **Author**: ${data.metadata.author}\n`;
    }
    
    return context;
  }

  // Utility methods
  getTitle(data) {
    if (data.article && data.article.title) return data.article.title;
    if (data.product && data.product.title) return data.product.title;
    if (data.profile && data.profile.displayName) return data.profile.displayName;
    if (data.metadata && data.metadata.title) return data.metadata.title;
    if (data.textContent && data.textContent.title) return data.textContent.title;
    return 'Extracted Content';
  }

  createExcerpt(text, maxLength = 200) {
    if (!text || text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  optimizeTextForLLM(text) {
    if (!text) return '';
    
    // Clean up text for LLM consumption
    return text
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n\s*\n/g, '\n\n')  // Clean up paragraph breaks
      .trim();
  }

  formatStructuredDataForLLM(structuredData) {
    return structuredData
      .map(item => JSON.stringify(item, null, 2))
      .join('\n\n');
  }

  formatArticleContent(article) {
    let content = '';
    
    if (article.content) {
      content += article.content;
    }
    
    return content;
  }

  formatProductContent(product) {
    let content = '';
    
    if (product.title) content += `${product.title}\n\n`;
    if (product.description) content += `${product.description}\n\n`;
    if (product.price) content += `Price: ${product.price}\n`;
    if (product.rating) content += `Rating: ${product.rating}\n`;
    
    return content;
  }

  formatProfileContent(profile) {
    let content = '';
    
    if (profile.displayName) content += `${profile.displayName}\n`;
    if (profile.username) content += `@${profile.username}\n\n`;
    if (profile.bio) content += `${profile.bio}\n\n`;
    
    return content;
  }

  formatTextContent(textContent) {
    let content = '';
    
    if (textContent.title) content += `${textContent.title}\n\n`;
    if (textContent.content) content += textContent.content;
    
    return content;
  }

  formatRepositoryContent(repository) {
    let content = '';
    
    if (repository.name) content += `Repository: ${repository.name}\n`;
    if (repository.description) content += `Description: ${repository.description}\n\n`;
    
    if (repository.stars || repository.forks || repository.primary_language) {
      content += 'Statistics:\n';
      if (repository.stars) content += `- Stars: ${repository.stars}\n`;
      if (repository.forks) content += `- Forks: ${repository.forks}\n`;
      if (repository.primary_language) content += `- Language: ${repository.primary_language}\n`;
      if (repository.license) content += `- License: ${repository.license}\n`;
      content += '\n';
    }
    
    if (repository.topics && repository.topics.length > 0) {
      content += `Topics: ${repository.topics.join(', ')}\n\n`;
    }
    
    if (repository.readme_content) {
      content += 'README:\n';
      content += '--------\n';
      content += repository.readme_content;
      content += '\n\n';
    }
    
    if (repository.recent_commits && repository.recent_commits.length > 0) {
      content += 'Recent Commits:\n';
      repository.recent_commits.forEach(commit => {
        content += `- ${commit}\n`;
      });
      content += '\n';
    }
    
    return content;
  }

  generateRepositorySummary(data) {
    let summary = '## Repository Summary\n\n';
    
    if (data.repository) {
      if (data.repository.name) summary += `**Repository**: ${data.repository.name}\n`;
      if (data.repository.primary_language) summary += `**Language**: ${data.repository.primary_language}\n`;
      if (data.repository.stars) summary += `**Stars**: ${data.repository.stars}\n`;
      if (data.repository.forks) summary += `**Forks**: ${data.repository.forks}\n`;
      if (data.repository.license) summary += `**License**: ${data.repository.license}\n`;
      summary += '\n';
      
      if (data.repository.description) {
        summary += `**Description**: ${data.repository.description}\n\n`;
      }
      
      if (data.repository.topics && data.repository.topics.length > 0) {
        summary += `**Topics**: ${data.repository.topics.join(', ')}\n\n`;
      }
      
      if (data.repository.readme_content) {
        const excerpt = this.createExcerpt(data.repository.readme_content, 300);
        summary += `**README Preview**: ${excerpt}\n\n`;
      }
    }
    
    return summary;
  }

  generateRepositoryContext(data) {
    let context = '';
    
    if (data.repository) {
      if (data.repository.name) context += `- **Repository**: ${data.repository.name}\n`;
      if (data.repository.description) context += `- **Description**: ${data.repository.description}\n`;
      if (data.repository.primary_language) context += `- **Language**: ${data.repository.primary_language}\n`;
      if (data.repository.stars) context += `- **Stars**: ${data.repository.stars}\n`;
      if (data.repository.forks) context += `- **Forks**: ${data.repository.forks}\n`;
      if (data.repository.license) context += `- **License**: ${data.repository.license}\n`;
      if (data.repository.contributors) context += `- **Contributors**: ${data.repository.contributors}\n`;
      if (data.repository.last_commit) context += `- **Last Commit**: ${data.repository.last_commit}\n`;
      
      if (data.repository.topics && data.repository.topics.length > 0) {
        context += `- **Topics**: ${data.repository.topics.join(', ')}\n`;
      }
      
      if (data.repository.recent_commits && data.repository.recent_commits.length > 0) {
        context += `- **Recent Commits**: ${data.repository.recent_commits.slice(0, 3).join(', ')}\n`;
      }
      
      if (data.repository.readme_headers && data.repository.readme_headers.length > 0) {
        context += `- **README Sections**: ${data.repository.readme_headers.slice(0, 5).join(', ')}\n`;
      }
    }
    
    return context;
  }

  formatStructuredData(structured) {
    return structured
      .map(item => `- ${item.type}: ${JSON.stringify(item.data)}`)
      .join('\n');
  }

  extractEntities(data) {
    // Simple entity extraction - can be enhanced with AI
    const entities = [];
    
    // Extract from article tags
    if (data.article && data.article.tags) {
      data.article.tags.forEach(tag => {
        entities.push({ type: 'tag', value: tag, confidence: 0.8 });
      });
    }
    
    // Extract from metadata keywords
    if (data.metadata && data.metadata.keywords) {
      const keywords = data.metadata.keywords.split(',');
      keywords.forEach(keyword => {
        entities.push({ type: 'keyword', value: keyword.trim(), confidence: 0.7 });
      });
    }
    
    return entities;
  }
}