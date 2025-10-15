import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { MobileDebugService, CrashLog, PerformanceMetrics } from '../../../core/services/mobile-debug.service';

@Component({
  selector: 'app-mobile-debug',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
  templateUrl: './mobile-debug.component.html',
  styleUrls: ['./mobile-debug.component.css']
})
export class MobileDebugComponent implements OnInit, OnDestroy {
  private readonly mobileDebug = inject(MobileDebugService);

  crashLogs: CrashLog[] = [];
  currentMetrics: PerformanceMetrics | null = null;
  activeTab: 'crashes' | 'metrics' | 'storage' = 'crashes';
  memoryUsage: number | null = null;
  metricsInterval: number | null = null;

  ngOnInit(): void {
    this.loadData();
    this.startMetricsRefresh();
  }

  ngOnDestroy(): void {
    if (this.metricsInterval !== null) {
      clearInterval(this.metricsInterval);
    }
  }

  loadData(): void {
    this.crashLogs = this.mobileDebug.getCrashLogs();
    this.currentMetrics = this.mobileDebug.getPerformanceMetrics();
    this.memoryUsage = this.mobileDebug.getMemoryUsagePercentage();
  }

  startMetricsRefresh(): void {
    // Refresh metrics every 3 seconds
    this.metricsInterval = window.setInterval(() => {
      this.currentMetrics = this.mobileDebug.getPerformanceMetrics();
      this.memoryUsage = this.mobileDebug.getMemoryUsagePercentage();
    }, 3000);
  }

  clearLogs(): void {
    if (confirm('Clear all crash logs?')) {
      this.mobileDebug.clearCrashLogs();
      this.loadData();
    }
  }

  exportLogs(): void {
    const data = this.mobileDebug.exportCrashLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crash-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  copyToClipboard(): void {
    const data = this.mobileDebug.exportCrashLogs();
    navigator.clipboard.writeText(data).then(() => {
      alert('Debug data copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy. Try export instead.');
    });
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  getMemoryColor(): string {
    if (!this.memoryUsage) return 'success';
    if (this.memoryUsage > 90) return 'danger';
    if (this.memoryUsage > 70) return 'warning';
    return 'success';
  }

  isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  isAndroid(): boolean {
    return /Android/.test(navigator.userAgent);
  }

  triggerTestCrash(): void {
    if (confirm('Trigger a test crash for debugging?')) {
      throw new Error('Test crash triggered from mobile debug panel');
    }
  }
}
