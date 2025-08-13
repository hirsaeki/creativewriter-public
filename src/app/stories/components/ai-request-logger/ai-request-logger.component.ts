import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonBadge, IonChip, IonCard,
  IonCardContent, IonText, IonAccordion, IonAccordionGroup
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBack, trash, chevronForward, chevronDown, checkmarkCircle,
  closeCircle, timeOutline, pauseCircle, documentTextOutline,
  codeSlashOutline, warningOutline, informationCircleOutline,
  settingsOutline, cloudOutline, bugOutline, speedometerOutline,
  playCircleOutline, radioOutline, globeOutline, cogOutline,
  checkmarkCircleOutline, refreshOutline
} from 'ionicons/icons';
import { AIRequestLoggerService, AIRequestLog } from '../../../core/services/ai-request-logger.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-ai-request-logger',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonBadge, IonChip, IonCard,
    IonCardContent, IonText, IonAccordion, IonAccordionGroup
  ],
  templateUrl: './ai-request-logger.component.html',
  styleUrls: ['./ai-request-logger.component.scss']
})
export class AIRequestLoggerComponent implements OnInit, OnDestroy {
  private loggerService = inject(AIRequestLoggerService);
  private router = inject(Router);

  logs: AIRequestLog[] = [];
  expandedLogs = new Set<string>();
  private subscription = new Subscription();

  constructor() {
    addIcons({ 
      arrowBack, trash, chevronForward, chevronDown, checkmarkCircle,
      closeCircle, timeOutline, pauseCircle, documentTextOutline,
      codeSlashOutline, warningOutline, informationCircleOutline,
      settingsOutline, cloudOutline, bugOutline, speedometerOutline,
      playCircleOutline, radioOutline, globeOutline, cogOutline,
      checkmarkCircleOutline, refreshOutline
    });
  }

  ngOnInit(): void {
    this.subscription.add(
      this.loggerService.logs$.subscribe(logs => {
        this.logs = logs;
      })
    );
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
    if (confirm('Do you really want to delete all logs?')) {
      this.loggerService.clearLogs();
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

  goBack(): void {
    this.router.navigate(['/']);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'close-circle';
      case 'pending': return 'time-outline';
      case 'aborted': return 'pause-circle';
      default: return 'help-circle';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'success': return 'success';
      case 'error': return 'danger';
      case 'pending': return 'warning';
      case 'aborted': return 'warning';
      default: return 'medium';
    }
  }

  getProviderColor(provider: string): string {
    switch (provider) {
      case 'gemini': return 'tertiary';
      case 'openrouter': return 'secondary';
      case 'replicate': return 'primary';
      default: return 'medium';
    }
  }

  getHttpStatusColor(status: number): string {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 400 && status < 500) return 'warning';
    if (status >= 500) return 'danger';
    return 'medium';
  }

  getWordCount(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  formatJson(obj: unknown): string {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  hasNetworkInfo(log: AIRequestLog): boolean {
    return !!(log.networkInfo && (
      log.networkInfo.connectionType !== 'unknown' ||
      log.networkInfo.effectiveType !== 'unknown' ||
      (log.networkInfo.downlink && log.networkInfo.downlink > 0) ||
      (log.networkInfo.rtt && log.networkInfo.rtt > 0)
    ));
  }

  hasTechnicalDetails(log: AIRequestLog): boolean {
    return !!(log.id || log.timestamp || log.requestDetails?.requestId || log.httpStatus);
  }
}