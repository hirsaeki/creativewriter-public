import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonList, IonItem, IonLabel, IonChip, IonCard,
  IonCardContent, IonText, IonButton, IonIcon,
  IonButtons, IonToolbar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  trash, chevronForward, chevronDown, cloudUploadOutline,
  cloudDownloadOutline, warningOutline, informationCircleOutline,
  alertCircleOutline, timeOutline, personOutline, syncOutline
} from 'ionicons/icons';
import { SyncLoggerService, SyncLog } from '../../../core/services/sync-logger.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sync-log-tab',
  standalone: true,
  imports: [
    CommonModule,
    IonList, IonItem, IonLabel, IonChip, IonCard,
    IonCardContent, IonText, IonButton, IonIcon,
    IonButtons, IonToolbar
  ],
  templateUrl: './sync-log-tab.component.html',
  styleUrls: ['./sync-log-tab.component.scss']
})
export class SyncLogTabComponent implements OnInit, OnDestroy {
  private syncLoggerService = inject(SyncLoggerService);

  logs: SyncLog[] = [];
  expandedLogs = new Set<string>();
  private subscription = new Subscription();

  constructor() {
    addIcons({ 
      trash, chevronForward, chevronDown, cloudUploadOutline,
      cloudDownloadOutline, warningOutline, informationCircleOutline,
      alertCircleOutline, timeOutline, personOutline, syncOutline
    });
  }

  ngOnInit(): void {
    this.subscription.add(
      this.syncLoggerService.logs$.subscribe(logs => {
        this.logs = logs;
      })
    );

    // Demo-Logs zum Testen (später entfernen)
    if (this.logs.length === 0) {
      this.addDemoLogs();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  toggleExpand(logId: string): void {
    if (this.expandedLogs.has(logId)) {
      this.expandedLogs.delete(logId);
    } else {
      this.expandedLogs.add(logId);
    }
  }

  clearLogs(): void {
    if (confirm('Do you really want to delete all synchronization logs?')) {
      this.syncLoggerService.clearLogs();
      this.expandedLogs.clear();
    }
  }

  formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diff < 86400000) { // Less than 1 day
      const hours = Math.floor(diff / 3600000);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      return date.toLocaleString('en-US');
    }
  }

  getTypeIcon(type: SyncLog['type']): string {
    switch (type) {
      case 'upload': return 'cloud-upload-outline';
      case 'download': return 'cloud-download-outline';
      case 'conflict': return 'warning-outline';
      case 'error': return 'alert-circle-outline';
      case 'info': return 'information-circle-outline';
      default: return 'sync-outline';
    }
  }

  getStatusColor(status: SyncLog['status']): string {
    switch (status) {
      case 'success': return 'success';
      case 'error': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'primary';
      default: return 'medium';
    }
  }

  private addDemoLogs(): void {
    // Beispiel-Logs für Demonstrationszwecke
    this.syncLoggerService.logUpload(5, 'user123', 1234);
    this.syncLoggerService.logDownload(3, 'user123', 567);
    this.syncLoggerService.logConflict('Konflikt bei Story "Meine Geschichte": Lokale und Remote-Version unterscheiden sich', 'user123');
    this.syncLoggerService.logError('Netzwerkfehler: Verbindung zum Server unterbrochen', 'user123');
    this.syncLoggerService.logInfo('Synchronisation gestartet', 'Automatische Synchronisation alle 5 Minuten', 'user123');
  }
}