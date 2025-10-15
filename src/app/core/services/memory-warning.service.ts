import { Injectable, inject } from '@angular/core';
import { ToastController, Platform } from '@ionic/angular';
import { MobileDebugService } from './mobile-debug.service';

export interface MemoryWarningConfig {
  warningThreshold: number; // Percentage (default 80%)
  criticalThreshold: number; // Percentage (default 90%)
  checkInterval: number; // Milliseconds (default 30000 = 30 seconds)
  showToasts: boolean; // Show toast notifications
}

@Injectable({
  providedIn: 'root'
})
export class MemoryWarningService {
  private toastController = inject(ToastController);
  private mobileDebug = inject(MobileDebugService);
  private platform = inject(Platform);

  private config: MemoryWarningConfig = {
    warningThreshold: 80,
    criticalThreshold: 90,
    checkInterval: 30000,
    showToasts: true
  };

  private checkInterval: number | null = null;
  private lastWarningLevel: 'none' | 'warning' | 'critical' = 'none';
  private warningToast: HTMLIonToastElement | null = null;

  constructor() {
    // Start monitoring only on mobile devices or when memory API is available
    if (this.shouldMonitor()) {
      this.startMonitoring();
    }
  }

  /**
   * Check if memory monitoring should be enabled
   */
  private shouldMonitor(): boolean {
    // Check if memory API is available
    const metrics = this.mobileDebug.getPerformanceMetrics();
    if (!metrics.memory) {
      return false;
    }

    // Monitor on mobile or if explicitly enabled
    return this.platform.is('mobile') || this.platform.is('mobileweb') ||
           this.platform.is('ios') || this.platform.is('android');
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(): void {
    if (this.checkInterval !== null) {
      return; // Already monitoring
    }

    this.checkInterval = window.setInterval(() => {
      this.checkMemoryUsage();
    }, this.config.checkInterval);

    console.log('[MemoryWarning] Started monitoring memory usage');
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[MemoryWarning] Stopped monitoring memory usage');
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MemoryWarningConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart monitoring with new interval if it changed
    if (config.checkInterval && this.checkInterval !== null) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * Check current memory usage and show warnings if needed
   */
  private async checkMemoryUsage(): Promise<void> {
    const memoryUsage = this.mobileDebug.getMemoryUsagePercentage();

    if (!memoryUsage) {
      return;
    }

    const currentLevel = this.getWarningLevel(memoryUsage);

    // Only show toast if level changed or if it's critical (show repeatedly)
    if (currentLevel !== this.lastWarningLevel || currentLevel === 'critical') {
      await this.showWarning(currentLevel, memoryUsage);
      this.lastWarningLevel = currentLevel;
    }
  }

  /**
   * Get warning level based on memory usage percentage
   */
  private getWarningLevel(usage: number): 'none' | 'warning' | 'critical' {
    if (usage >= this.config.criticalThreshold) {
      return 'critical';
    } else if (usage >= this.config.warningThreshold) {
      return 'warning';
    }
    return 'none';
  }

  /**
   * Show warning toast based on memory level
   */
  private async showWarning(level: 'none' | 'warning' | 'critical', usage: number): Promise<void> {
    if (!this.config.showToasts) {
      return;
    }

    // Dismiss previous warning toast
    if (this.warningToast) {
      await this.warningToast.dismiss();
      this.warningToast = null;
    }

    if (level === 'none') {
      return;
    }

    const messages = {
      warning: {
        header: 'Memory Usage High',
        message: `Memory usage is at ${usage.toFixed(0)}%. Consider closing some stories or clearing old data.`,
        color: 'warning',
        duration: 5000
      },
      critical: {
        header: 'Critical Memory Usage!',
        message: `Memory usage is at ${usage.toFixed(0)}%! The app may become unstable. Please close stories or refresh the page.`,
        color: 'danger',
        duration: 8000
      }
    };

    const config = messages[level];

    this.warningToast = await this.toastController.create({
      header: config.header,
      message: config.message,
      color: config.color,
      duration: config.duration,
      position: 'top',
      buttons: [
        {
          text: 'Tips',
          handler: () => {
            this.showMemoryTips();
          }
        },
        {
          text: 'Debug',
          handler: () => {
            window.location.href = '/mobile-debug';
          }
        },
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });

    await this.warningToast.present();
  }

  /**
   * Show memory optimization tips
   */
  private async showMemoryTips(): Promise<void> {
    const toast = await this.toastController.create({
      header: 'Memory Optimization Tips',
      message: `
        • Close stories you're not working on
        • Export and archive old stories
        • Clear browser cache and reload
        • Reduce the number of open scenes
        • Check mobile-debug for details
      `,
      color: 'primary',
      duration: 10000,
      position: 'bottom',
      buttons: [
        {
          text: 'Go to Settings',
          handler: () => {
            window.location.href = '/settings';
          }
        },
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }

  /**
   * Manually trigger a memory check (useful for testing)
   */
  async checkNow(): Promise<void> {
    await this.checkMemoryUsage();
  }

  /**
   * Get current memory status
   */
  getMemoryStatus(): {
    usage: number | null;
    level: 'none' | 'warning' | 'critical';
    isMonitoring: boolean;
  } {
    const usage = this.mobileDebug.getMemoryUsagePercentage();
    return {
      usage,
      level: usage ? this.getWarningLevel(usage) : 'none',
      isMonitoring: this.checkInterval !== null
    };
  }

  /**
   * Force show a warning (useful for testing)
   */
  async testWarning(level: 'warning' | 'critical' = 'warning'): Promise<void> {
    const testUsage = level === 'warning' ? 85 : 95;
    await this.showWarning(level, testUsage);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopMonitoring();
    if (this.warningToast) {
      this.warningToast.dismiss();
      this.warningToast = null;
    }
  }
}
