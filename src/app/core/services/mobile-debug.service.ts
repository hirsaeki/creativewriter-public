import { Injectable } from '@angular/core';

export interface PerformanceMetrics {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    usedPercentage: number;
  };
  timing: {
    navigationStart: number;
    loadEventEnd: number;
    domContentLoadedEventEnd: number;
  };
  userAgent: string;
  platform: string;
  viewport: {
    width: number;
    height: number;
  };
  orientation: string;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
}

export interface CrashLog {
  timestamp: string;
  error: string;
  stack?: string;
  url: string;
  userAgent: string;
  metrics: PerformanceMetrics;
  localStorage: {
    itemCount: number;
    estimatedSize: number;
  };
  indexedDB: {
    databases?: string[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class MobileDebugService {
  private readonly CRASH_LOG_KEY = 'mobile_crash_logs';
  private readonly MAX_CRASH_LOGS = 50;
  private memoryWarningThreshold = 0.9; // 90% memory usage
  private memoryCheckInterval: number | null = null;

  constructor() {
    this.setupGlobalErrorHandlers();
    this.startMemoryMonitoring();
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const performance = window.performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };

    const metrics: PerformanceMetrics = {
      timing: {
        navigationStart: performance.timing.navigationStart,
        loadEventEnd: performance.timing.loadEventEnd,
        domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd
      },
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      orientation: screen.orientation?.type || 'unknown'
    };

    // Memory info (Chrome/Edge only)
    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize;
      const limit = performance.memory.jsHeapSizeLimit;
      metrics.memory = {
        usedJSHeapSize: used,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: limit,
        usedPercentage: (used / limit) * 100
      };
    }

    // Network info
    const connection = (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      };
    }).connection;

    if (connection) {
      metrics.connection = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      };
    }

    return metrics;
  }

  /**
   * Log a crash with detailed context
   */
  logCrash(error: Error | string): void {
    const crashLog: CrashLog = {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      url: window.location.href,
      userAgent: navigator.userAgent,
      metrics: this.getPerformanceMetrics(),
      localStorage: this.getLocalStorageInfo(),
      indexedDB: {
        databases: [] // Will be populated if available
      }
    };

    // Try to get IndexedDB info
    this.getIndexedDBInfo().then(dbInfo => {
      crashLog.indexedDB = dbInfo;
      this.saveCrashLog(crashLog);
    }).catch(() => {
      this.saveCrashLog(crashLog);
    });
  }

  /**
   * Get all stored crash logs
   */
  getCrashLogs(): CrashLog[] {
    try {
      const logs = localStorage.getItem(this.CRASH_LOG_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear all crash logs
   */
  clearCrashLogs(): void {
    localStorage.removeItem(this.CRASH_LOG_KEY);
  }

  /**
   * Export crash logs as JSON string for debugging
   */
  exportCrashLogs(): string {
    const logs = this.getCrashLogs();
    const metrics = this.getPerformanceMetrics();
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      currentMetrics: metrics,
      crashLogs: logs
    }, null, 2);
  }

  /**
   * Check if memory usage is high
   */
  isMemoryHigh(): boolean {
    const metrics = this.getPerformanceMetrics();
    return metrics.memory ? metrics.memory.usedPercentage > this.memoryWarningThreshold * 100 : false;
  }

  /**
   * Get memory usage percentage
   */
  getMemoryUsagePercentage(): number | null {
    const metrics = this.getPerformanceMetrics();
    return metrics.memory ? metrics.memory.usedPercentage : null;
  }

  private setupGlobalErrorHandlers(): void {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      console.error('[MobileDebug] Unhandled error:', event.error);
      this.logCrash(event.error || event.message);
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[MobileDebug] Unhandled rejection:', event.reason);
      this.logCrash(event.reason);
    });
  }

  private startMemoryMonitoring(): void {
    // Check memory every 30 seconds
    this.memoryCheckInterval = window.setInterval(() => {
      if (this.isMemoryHigh()) {
        console.warn('[MobileDebug] High memory usage detected!', this.getMemoryUsagePercentage());
        // You could trigger cleanup here or show a warning to the user
      }
    }, 30000);
  }

  private saveCrashLog(log: CrashLog): void {
    try {
      const logs = this.getCrashLogs();
      logs.unshift(log); // Add to beginning

      // Keep only the most recent logs
      if (logs.length > this.MAX_CRASH_LOGS) {
        logs.splice(this.MAX_CRASH_LOGS);
      }

      localStorage.setItem(this.CRASH_LOG_KEY, JSON.stringify(logs));
      console.log('[MobileDebug] Crash log saved:', log);
    } catch (error) {
      console.error('[MobileDebug] Failed to save crash log:', error);
    }
  }

  private getLocalStorageInfo(): { itemCount: number; estimatedSize: number } {
    let itemCount = 0;
    let estimatedSize = 0;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          itemCount++;
          const value = localStorage.getItem(key);
          if (value) {
            estimatedSize += key.length + value.length;
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return { itemCount, estimatedSize };
  }

  private async getIndexedDBInfo(): Promise<{ databases?: string[] }> {
    if (!('indexedDB' in window)) {
      return {};
    }

    try {
      // Modern browsers support databases() method
      if ('databases' in indexedDB) {
        const dbs = await (indexedDB as IDBFactory & {
          databases: () => Promise<{ name?: string; version?: number }[]>;
        }).databases();
        return {
          databases: dbs.map(db => `${db.name} (v${db.version})`)
        };
      }
    } catch {
      // Fall back to known database names
      return {
        databases: ['Unable to enumerate - check manually']
      };
    }

    return {};
  }

  /**
   * Stop memory monitoring (cleanup)
   */
  destroy(): void {
    if (this.memoryCheckInterval !== null) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }
}
