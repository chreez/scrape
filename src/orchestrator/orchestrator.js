export class TaskOrchestrator {
  constructor(options = {}) {
    this.options = {
      maxConcurrent: 3,
      retryAttempts: 3,
      retryDelay: 5000,
      backoffMultiplier: 2,
      timeout: 300000, // 5 minutes
      ...options
    };
    
    this.activeJobs = new Map();
    this.queue = [];
    this.results = new Map();
    this.errors = new Map();
  }

  async processTask(task) {
    const taskId = this.generateTaskId();
    
    try {
      console.log(`Starting task ${taskId}: ${task.type} from ${task.url}`);
      
      const result = await this.executeWithRetry(task, taskId);
      this.results.set(taskId, result);
      
      console.log(`Task ${taskId} completed successfully`);
      return result;
      
    } catch (error) {
      console.error(`Task ${taskId} failed: ${error.message}`);
      this.errors.set(taskId, error);
      throw error;
    } finally {
      this.activeJobs.delete(taskId);
    }
  }

  async executeWithRetry(task, taskId) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        console.log(`Task ${taskId} attempt ${attempt}/${this.options.retryAttempts}`);
        
        const result = await this.executeTask(task, taskId);
        return result;
        
      } catch (error) {
        lastError = error;
        console.warn(`Task ${taskId} attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < this.options.retryAttempts) {
          const delay = this.options.retryDelay * Math.pow(this.options.backoffMultiplier, attempt - 1);
          console.log(`Retrying task ${taskId} in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }
    
    throw lastError;
  }

  async executeTask(task, taskId) {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Task timeout')), this.options.timeout);
    });
    
    const execution = this.runTask(task, taskId);
    
    return await Promise.race([execution, timeout]);
  }

  async runTask(task, taskId) {
    this.activeJobs.set(taskId, {
      task,
      startTime: Date.now(),
      status: 'running'
    });
    
    const { Scrape } = await import('../index.js');
    const scrape = new Scrape(task.options);
    
    return await scrape.extract(task.url, task.dataType, task.extractOptions);
  }

  async processBatch(tasks) {
    console.log(`Processing batch of ${tasks.length} tasks with max concurrency ${this.options.maxConcurrent}`);
    
    const results = [];
    const semaphore = new Semaphore(this.options.maxConcurrent);
    
    const promises = tasks.map(async (task, index) => {
      await semaphore.acquire();
      
      try {
        const result = await this.processTask(task);
        results[index] = { success: true, data: result };
      } catch (error) {
        results[index] = { success: false, error: error.message };
      } finally {
        semaphore.release();
      }
    });
    
    await Promise.all(promises);
    return results;
  }

  async processQueue() {
    if (this.queue.length === 0) {
      console.log('Queue is empty');
      return [];
    }
    
    console.log(`Processing queue with ${this.queue.length} tasks`);
    
    const tasks = [...this.queue];
    this.queue = [];
    
    return await this.processBatch(tasks);
  }

  addToQueue(task) {
    const taskWithId = {
      ...task,
      id: this.generateTaskId(),
      addedAt: Date.now()
    };
    
    this.queue.push(taskWithId);
    console.log(`Added task ${taskWithId.id} to queue (${this.queue.length} total)`);
    
    return taskWithId.id;
  }

  removeFromQueue(taskId) {
    const index = this.queue.findIndex(task => task.id === taskId);
    if (index > -1) {
      this.queue.splice(index, 1);
      console.log(`Removed task ${taskId} from queue`);
      return true;
    }
    return false;
  }

  getQueueStatus() {
    return {
      queued: this.queue.length,
      active: this.activeJobs.size,
      completed: this.results.size,
      failed: this.errors.size,
      total: this.queue.length + this.activeJobs.size + this.results.size + this.errors.size
    };
  }

  getTaskStatus(taskId) {
    if (this.activeJobs.has(taskId)) {
      const job = this.activeJobs.get(taskId);
      return {
        status: 'running',
        startTime: job.startTime,
        duration: Date.now() - job.startTime
      };
    }
    
    if (this.results.has(taskId)) {
      return { status: 'completed', result: this.results.get(taskId) };
    }
    
    if (this.errors.has(taskId)) {
      return { status: 'failed', error: this.errors.get(taskId).message };
    }
    
    const queuedTask = this.queue.find(task => task.id === taskId);
    if (queuedTask) {
      return { status: 'queued', position: this.queue.indexOf(queuedTask) + 1 };
    }
    
    return { status: 'not_found' };
  }

  async processUrlList(urls, dataType, options = {}) {
    const tasks = urls.map(url => ({
      url,
      dataType,
      options: options.taskOptions || {},
      extractOptions: options.extractOptions || {}
    }));
    
    return await this.processBatch(tasks);
  }

  async processMultipleDataTypes(url, dataTypes, options = {}) {
    const tasks = dataTypes.map(dataType => ({
      url,
      dataType,
      options: options.taskOptions || {},
      extractOptions: options.extractOptions || {}
    }));
    
    return await this.processBatch(tasks);
  }

  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearResults() {
    this.results.clear();
    this.errors.clear();
    console.log('Cleared all results and errors');
  }

  getResults() {
    const results = {};
    
    for (const [taskId, result] of this.results) {
      results[taskId] = result;
    }
    
    return results;
  }

  getErrors() {
    const errors = {};
    
    for (const [taskId, error] of this.errors) {
      errors[taskId] = {
        message: error.message,
        stack: error.stack,
        timestamp: error.timestamp || Date.now()
      };
    }
    
    return errors;
  }

  exportResults(format = 'json') {
    const data = {
      results: this.getResults(),
      errors: this.getErrors(),
      stats: this.getQueueStatus(),
      exportedAt: new Date().toISOString()
    };
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data.results);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  convertToCSV(results) {
    if (Object.keys(results).length === 0) {
      return '';
    }
    
    const firstResult = Object.values(results)[0];
    if (!Array.isArray(firstResult) || firstResult.length === 0) {
      return '';
    }
    
    const headers = Object.keys(firstResult[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = [];
    
    for (const [taskId, resultArray] of Object.entries(results)) {
      for (const item of resultArray) {
        const row = headers.map(header => {
          const value = item[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        });
        csvRows.push(row.join(','));
      }
    }
    
    return [csvHeaders, ...csvRows].join('\n');
  }
}

class Semaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.currentConcurrent = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.currentConcurrent < this.maxConcurrent) {
      this.currentConcurrent++;
      return;
    }

    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  release() {
    this.currentConcurrent--;
    
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.currentConcurrent++;
      next();
    }
  }
}