/**
 * Submission Queue Manager
 * Manages the queue for semi-automatic comment submission
 */

import type { FillData } from '../../form-handlers/auto-fill-service';

/**
 * Submission task status
 */
export type SubmissionTaskStatus = 'pending' | 'in_progress' | 'waiting_confirmation' | 'completed' | 'failed' | 'paused';

/**
 * Submission task
 */
export interface SubmissionTask {
  id: string;
  backlinkId: string;
  url: string;
  domain: string;
  comment: string;
  fillData: FillData;
  status: SubmissionTaskStatus;
  retryCount: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  lastAttemptAt?: string;
}

/**
 * Queue state
 */
interface QueueState {
  tasks: SubmissionTask[];
  currentIndex: number;
  isProcessing: boolean;
  isPaused: boolean;
  lastSubmitTime: number;
  domainLastSubmit: Map<string, number>;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  minIntervalMs: number;
  maxRetries: number;
  domainCooldownMs: number;
  randomDelayRangeMs: number;
  confirmationTimeoutMs: number;
}

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  minIntervalMs: 5000,
  maxRetries: 3,
  domainCooldownMs: 60000,
  randomDelayRangeMs: 2000,
  confirmationTimeoutMs: 120000,
};

/**
 * Queue event types
 */
export type QueueEventType = 
  | 'task_added'
  | 'task_started'
  | 'task_waiting_confirmation'
  | 'task_completed'
  | 'task_failed'
  | 'queue_paused'
  | 'queue_resumed'
  | 'queue_stopped'
  | 'queue_cleared'
  | 'progress';

/**
 * Queue event
 */
export interface QueueEvent {
  type: QueueEventType;
  data?: unknown;
  timestamp: string;
}

/**
 * Submission Queue Manager
 */
export class SubmissionQueue {
  private state: QueueState;
  private config: RateLimitConfig;
  private listeners: Set<(event: QueueEvent) => void>;
  private processingPromise?: Promise<void>;

  /**
   * Create a new submission queue
   */
  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      tasks: [],
      currentIndex: 0,
      isProcessing: false,
      isPaused: false,
      lastSubmitTime: 0,
      domainLastSubmit: new Map(),
    };
    this.listeners = new Set();
  }

  /**
   * Add a task to the queue
   */
  addTask(task: Omit<SubmissionTask, 'id' | 'status' | 'retryCount' | 'createdAt'>): string {
    const id = this.generateId();
    const newTask: SubmissionTask = {
      ...task,
      id,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.state.tasks.push(newTask);
    this.emit('task_added', { task: newTask });

    // Start processing if not already running
    if (!this.state.isProcessing) {
      this.startProcessing();
    }

    return id;
  }

  /**
   * Add multiple tasks to the queue
   */
  addTasks(tasks: Omit<SubmissionTask, 'id' | 'status' | 'retryCount' | 'createdAt'>[]): string[] {
    return tasks.map(task => this.addTask(task));
  }

  /**
   * Start processing the queue
   */
  private startProcessing(): void {
    if (this.state.isProcessing) return;

    this.state.isProcessing = true;
    this.state.isPaused = false;

    this.processingPromise = this.processQueue();
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    while (this.state.currentIndex < this.state.tasks.length) {
      // Check if paused
      if (this.state.isPaused) {
        this.state.isProcessing = false;
        return;
      }

      const task = this.state.tasks[this.state.currentIndex];

      // Skip completed or failed tasks (after max retries)
      if (task.status === 'completed' || task.status === 'failed') {
        this.state.currentIndex++;
        continue;
      }

      // Check rate limiting
      if (!this.canSubmit(task.domain)) {
        await this.waitForCooldown(task.domain);
      }

      // Execute the task
      await this.executeTask(task);

      // Wait for interval (with random delay)
      await this.waitForInterval();

      // Move to next task
      this.state.currentIndex++;
    }

    this.state.isProcessing = false;
    this.emit('queue_stopped', { reason: 'all_completed' });
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: SubmissionTask): Promise<void> {
    task.status = 'in_progress';
    task.startedAt = new Date().toISOString();
    task.lastAttemptAt = new Date().toISOString();

    this.emit('task_started', { task: this.getTaskSnapshot(task) });

    try {
      // Open URL in a new tab
      const tab = await this.openUrlInTab(task.url);

      if (!tab.id) {
        throw new Error('Failed to open tab');
      }

      // Send message to content script to fill form
      const fillResponse = await this.sendMessageToTab(tab.id, {
        type: 'FILL_AND_WAIT',
        data: {
          fillData: task.fillData,
          comment: task.comment,
        },
      });

      if (!fillResponse.success) {
        throw new Error(fillResponse.error || 'Failed to fill form');
      }

      // Task is now waiting for user confirmation
      task.status = 'waiting_confirmation';
      this.emit('task_waiting_confirmation', { task: this.getTaskSnapshot(task) });

      // Wait for user confirmation (handled by content script)
      // The content script will send a message when the user submits
      // For now, we'll use a timeout as fallback
      const confirmed = await this.waitForConfirmation(tab.id, task.id);

      if (confirmed) {
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        this.emit('task_completed', { task: this.getTaskSnapshot(task) });
      } else {
        throw new Error('Submission not confirmed within timeout');
      }
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.retryCount++;

      // Retry if under max retries
      if (task.retryCount < this.config.maxRetries) {
        task.status = 'pending';
        // Move task back in queue for retry
        this.state.tasks.push({ ...task, status: 'pending' });
      }

      this.emit('task_failed', { 
        task: this.getTaskSnapshot(task),
        willRetry: task.retryCount < this.config.maxRetries,
      });
    } finally {
      // Update timing
      this.state.lastSubmitTime = Date.now();
      this.state.domainLastSubmit.set(task.domain, Date.now());
    }
  }

  /**
   * Wait for user confirmation
   */
  private waitForConfirmation(tabId: number, taskId: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Set timeout
      const timeout = setTimeout(() => {
        resolve(false);
      }, this.config.confirmationTimeoutMs);

      // Listen for confirmation message
      const listener = (message: { type: string; data?: { taskId?: string; success?: boolean } }) => {
        if (message.type === 'SUBMISSION_CONFIRMED' && message.data?.taskId === taskId) {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);
          resolve(message.data?.success ?? false);
        }
      };

      chrome.runtime.onMessage.addListener(listener);
    });
  }

  /**
   * Open URL in a new tab
   */
  private async openUrlInTab(url: string): Promise<chrome.tabs.Tab> {
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url, active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (tab) {
          resolve(tab);
        } else {
          reject(new Error('Failed to create tab'));
        }
      });
    });
  }

  /**
   * Send message to tab
   */
  private sendMessageToTab<T>(tabId: number, message: { type: string; data?: T }): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: false, error: 'No response' });
        }
      });
    });
  }

  /**
   * Check if we can submit to this domain
   */
  private canSubmit(domain: string): boolean {
    const now = Date.now();
    const lastSubmit = this.state.lastSubmitTime;
    const domainLastSubmit = this.state.domainLastSubmit.get(domain) || 0;

    return (
      now - lastSubmit >= this.config.minIntervalMs &&
      now - domainLastSubmit >= this.config.domainCooldownMs
    );
  }

  /**
   * Wait for domain cooldown
   */
  private async waitForCooldown(domain: string): Promise<void> {
    const now = Date.now();
    const domainLastSubmit = this.state.domainLastSubmit.get(domain) || 0;
    const cooldownRemaining = this.config.domainCooldownMs - (now - domainLastSubmit);

    if (cooldownRemaining > 0) {
      await this.sleep(cooldownRemaining);
    }
  }

  /**
   * Wait for interval with random delay
   */
  private async waitForInterval(): Promise<void> {
    const baseDelay = this.config.minIntervalMs;
    const randomDelay = Math.random() * this.config.randomDelayRangeMs;
    await this.sleep(baseDelay + randomDelay);
  }

  /**
   * Pause the queue
   */
  pause(): void {
    if (this.state.isProcessing && !this.state.isPaused) {
      this.state.isPaused = true;
      this.emit('queue_paused', {});
    }
  }

  /**
   * Resume the queue
   */
  resume(): void {
    if (this.state.isPaused) {
      this.state.isPaused = false;
      this.emit('queue_resumed', {});
      this.startProcessing();
    }
  }

  /**
   * Stop the queue
   */
  stop(): void {
    this.state.isPaused = true;
    this.state.isProcessing = false;
    this.emit('queue_stopped', { reason: 'user_stopped' });
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.stop();
    this.state.tasks = [];
    this.state.currentIndex = 0;
    this.state.domainLastSubmit.clear();
    this.emit('queue_cleared', {});
  }

  /**
   * Get queue status
   */
  getStatus(): {
    total: number;
    pending: number;
    inProgress: number;
    waitingConfirmation: number;
    completed: number;
    failed: number;
    isProcessing: boolean;
    isPaused: boolean;
  } {
    const tasks = this.state.tasks;
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      waitingConfirmation: tasks.filter(t => t.status === 'waiting_confirmation').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      isProcessing: this.state.isProcessing,
      isPaused: this.state.isPaused,
    };
  }

  /**
   * Get all tasks
   */
  getTasks(): SubmissionTask[] {
    return this.state.tasks.map(t => this.getTaskSnapshot(t));
  }

  /**
   * Get current task
   */
  getCurrentTask(): SubmissionTask | null {
    const task = this.state.tasks[this.state.currentIndex];
    return task ? this.getTaskSnapshot(task) : null;
  }

  /**
   * Get task by ID
   */
  getTaskById(id: string): SubmissionTask | null {
    const task = this.state.tasks.find(t => t.id === id);
    return task ? this.getTaskSnapshot(task) : null;
  }

  /**
   * Update task status manually (for external confirmation)
   */
  confirmTask(taskId: string, success: boolean, error?: string): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (success) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      this.emit('task_completed', { task: this.getTaskSnapshot(task) });
    } else {
      task.status = 'failed';
      task.error = error;
      task.retryCount++;
      this.emit('task_failed', { task: this.getTaskSnapshot(task), willRetry: false });
    }
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: QueueEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emit(type: QueueEventType, data?: unknown): void {
    const event: QueueEvent = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    this.listeners.forEach(listener => listener(event));
  }

  /**
   * Get task snapshot (without circular references)
   */
  private getTaskSnapshot(task: SubmissionTask): SubmissionTask {
    return { ...task };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}

/**
 * Create a new submission queue
 */
export function createSubmissionQueue(config?: Partial<RateLimitConfig>): SubmissionQueue {
  return new SubmissionQueue(config);
}
