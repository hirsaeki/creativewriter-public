import { Injectable, inject, OnDestroy } from '@angular/core';
import { ToastController, Platform } from '@ionic/angular';
import { MobileDebugService } from '../../core/services/mobile-debug.service';
import { I18nService } from '../i18n/i18n.service';

interface MemoryWarningConfig {
  warningThreshold: number;
  criticalThreshold: number;
  checkInterval: number;
  showToasts: boolean;
}

@Injectable()
export class CustomMemoryWarningService implements OnDestroy {
  private readonly toastController = inject(ToastController);
  private readonly mobileDebug = inject(MobileDebugService);
  private readonly platform = inject(Platform);
  private readonly i18n = inject(I18nService);

  private config: MemoryWarningConfig = {
    warningThreshold: 80,
    criticalThreshold: 90,
    checkInterval: 30000,
    showToasts: true
  };

  private checkIntervalId: number | null = null;
  private lastWarningLevel: 'none' | 'warning' | 'critical' = 'none';
  private warningToast: HTMLIonToastElement | null = null;

  constructor() {
    if (this.shouldMonitor()) {
      this.startMonitoring();
    }
  }

  private shouldMonitor(): boolean {
    const metrics = this.mobileDebug.getPerformanceMetrics();
    if (!metrics.memory) {
      return false;
    }
    return this.platform.is('mobile') || this.platform.is('mobileweb') ||
           this.platform.is('ios') || this.platform.is('android');
  }

  startMonitoring(): void {
    if (this.checkIntervalId !== null) {
      return;
    }
    this.checkIntervalId = window.setInterval(() => {
      this.checkMemoryUsage();
    }, this.config.checkInterval);
    console.log('[CustomMemoryWarning] Started monitoring memory usage');
  }

  stopMonitoring(): void {
    if (this.checkIntervalId !== null) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
      console.log('[CustomMemoryWarning] Stopped monitoring memory usage');
    }
  }

  updateConfig(config: Partial<MemoryWarningConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.checkInterval && this.checkIntervalId !== null) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  private async checkMemoryUsage(): Promise<void> {
    const memoryUsage = this.mobileDebug.getMemoryUsagePercentage();
    if (!memoryUsage) {
      return;
    }
    const currentLevel = this.getWarningLevel(memoryUsage);
    if (currentLevel !== this.lastWarningLevel || currentLevel === 'critical') {
      await this.showWarning(currentLevel, memoryUsage);
      this.lastWarningLevel = currentLevel;
    }
  }

  private getWarningLevel(usage: number): 'none' | 'warning' | 'critical' {
    if (usage >= this.config.criticalThreshold) {
      return 'critical';
    } else if (usage >= this.config.warningThreshold) {
      return 'warning';
    }
    return 'none';
  }

  private async showWarning(level: 'none' | 'warning' | 'critical', usage: number): Promise<void> {
    if (!this.config.showToasts) {
      return;
    }
    if (this.warningToast) {
      await this.warningToast.dismiss();
      this.warningToast = null;
    }
    if (level === 'none') {
      return;
    }

    const usageStr = usage.toFixed(0);
    const config = level === 'warning'
      ? {
          header: this.i18n.t('memory.warning.header'),
          message: this.i18n.t('memory.warning.message', { usage: usageStr }),
          color: 'warning' as const,
          duration: 5000
        }
      : {
          header: this.i18n.t('memory.critical.header'),
          message: this.i18n.t('memory.critical.message', { usage: usageStr }),
          color: 'danger' as const,
          duration: 8000
        };

    this.warningToast = await this.toastController.create({
      header: config.header,
      message: config.message,
      color: config.color,
      duration: config.duration,
      position: 'top',
      buttons: [
        {
          text: this.i18n.t('common.tips'),
          handler: () => {
            this.showMemoryTips();
          }
        },
        {
          text: this.i18n.t('common.debug'),
          handler: () => {
            window.location.href = '/mobile-debug';
          }
        },
        {
          text: this.i18n.t('common.dismiss'),
          role: 'cancel'
        }
      ]
    });

    await this.warningToast.present();
  }

  private async showMemoryTips(): Promise<void> {
    const toast = await this.toastController.create({
      header: this.i18n.t('memory.tips.header'),
      message: this.i18n.t('memory.tips.message'),
      color: 'primary',
      duration: 10000,
      position: 'bottom',
      buttons: [
        {
          text: this.i18n.t('common.goToSettings'),
          handler: () => {
            window.location.href = '/settings';
          }
        },
        {
          text: this.i18n.t('common.ok'),
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  async checkNow(): Promise<void> {
    await this.checkMemoryUsage();
  }

  getMemoryStatus(): {
    usage: number | null;
    level: 'none' | 'warning' | 'critical';
    isMonitoring: boolean;
  } {
    const usage = this.mobileDebug.getMemoryUsagePercentage();
    return {
      usage,
      level: usage ? this.getWarningLevel(usage) : 'none',
      isMonitoring: this.checkIntervalId !== null
    };
  }

  async testWarning(level: 'warning' | 'critical' = 'warning'): Promise<void> {
    const testUsage = level === 'warning' ? 85 : 95;
    await this.showWarning(level, testUsage);
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
    if (this.warningToast) {
      this.warningToast.dismiss();
      this.warningToast = null;
    }
  }
}
