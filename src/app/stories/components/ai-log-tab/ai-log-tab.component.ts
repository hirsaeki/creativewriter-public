import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonList, IonItem, IonLabel, IonBadge, IonChip, IonCard,
  IonCardContent, IonText, IonButton, IonIcon,
  IonButtons, IonToolbar, IonAccordion, IonAccordionGroup
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  trash, chevronForward, chevronDown, checkmarkCircle,
  closeCircle, timeOutline, pauseCircle, documentTextOutline,
  codeSlashOutline, warningOutline, informationCircleOutline,
  settingsOutline, cloudOutline, bugOutline, speedometerOutline,
  playCircleOutline, radioOutline, globeOutline, cogOutline,
  checkmarkCircleOutline, refreshOutline, copyOutline, shieldCheckmarkOutline,
  shieldOutline, stopCircleOutline, codeOutline
} from 'ionicons/icons';
import { AIRequestLoggerService, AIRequestLog } from '../../../core/services/ai-request-logger.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-ai-log-tab',
  standalone: true,
  imports: [
    CommonModule,
    IonList, IonItem, IonLabel, IonBadge, IonChip, IonCard,
    IonCardContent, IonText, IonButton, IonIcon,
    IonButtons, IonToolbar, IonAccordion, IonAccordionGroup
  ],
  templateUrl: './ai-log-tab.component.html',
  styleUrls: ['./ai-log-tab.component.scss']
})
export class AILogTabComponent implements OnInit, OnDestroy {
  private loggerService = inject(AIRequestLoggerService);

  logs: AIRequestLog[] = [];
  expandedLogs = new Set<string>();
  private subscription = new Subscription();

  constructor() {
    addIcons({ 
      trash, chevronForward, chevronDown, checkmarkCircle,
      closeCircle, timeOutline, pauseCircle, documentTextOutline,
      codeSlashOutline, warningOutline, informationCircleOutline,
      settingsOutline, cloudOutline, bugOutline, speedometerOutline,
      playCircleOutline, radioOutline, globeOutline, cogOutline,
      checkmarkCircleOutline, refreshOutline, copyOutline, shieldCheckmarkOutline,
      shieldOutline, stopCircleOutline, codeOutline
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
    if (confirm('Do you really want to delete all AI logs?')) {
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

  hasPromptFeedback(log: AIRequestLog): boolean {
    // Show safety section if we have any safety-related information at all
    return !!(this.getPromptFeedback(log)) || 
           !!(this.getCandidateSafetyRatings(log)?.length) ||
           !!(log.apiProvider === 'gemini' && log.status === 'success');
  }

  getPromptFeedback(log: AIRequestLog): { blockReason?: string; safetyRatings?: { category: string; probability: string }[]; synthetic?: boolean; note?: string } | undefined {
    // Check in the new safetyRatings field first (highest priority)
    if (log.safetyRatings?.promptFeedback) {
      return log.safetyRatings.promptFeedback;
    }
    
    // Check in debug info
    if (log.requestDetails?.debugInfo?.['promptFeedback']) {
      return log.requestDetails.debugInfo['promptFeedback'];
    }
    
    // Check in request details
    if (log.requestDetails?.['promptFeedback']) {
      return log.requestDetails['promptFeedback'];
    }
    
    // Check for streaming prompt feedback
    if (log.requestDetails?.debugInfo?.['streamingPromptFeedback']) {
      return log.requestDetails.debugInfo['streamingPromptFeedback'];
    }
    
    // For logs that have candidate safety ratings, create a synthetic prompt feedback
    const candidateRatings = this.getCandidateSafetyRatings(log);
    if (candidateRatings && candidateRatings.length > 0) {
      return {
        safetyRatings: candidateRatings,
        blockReason: log.safetyRatings?.finishReason === 'SAFETY' ? 'SAFETY' : undefined,
        synthetic: true
      };
    }
    
    // For successful Gemini requests, create default safety feedback to show the section
    if (log.apiProvider === 'gemini' && log.status === 'success') {
      return {
        safetyRatings: [
          { category: 'HARM_CATEGORY_HARASSMENT', probability: 'NEGLIGIBLE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', probability: 'NEGLIGIBLE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'NEGLIGIBLE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'NEGLIGIBLE' },
          { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', probability: 'NEGLIGIBLE' }
        ],
        synthetic: true,
        note: 'Default safety ratings (no specific safety data available)'
      };
    }
    
    return undefined;
  }

  formatSafetyCategory(category: string): string {
    return category
      .replace('HARM_CATEGORY_', '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getSafetyColor(probability: string): string {
    switch (probability?.toUpperCase()) {
      case 'HIGH': return 'danger';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'success';
      case 'NEGLIGIBLE': return 'success';
      default: return 'medium';
    }
  }

  hasCandidateSafetyRatings(log: AIRequestLog): boolean {
    return !!(this.getCandidateSafetyRatings(log)?.length || this.getCandidateFinishReason(log));
  }

  getCandidateSafetyRatings(log: AIRequestLog): { category: string; probability: string }[] {
    // Check in the new safetyRatings field first
    if (log.safetyRatings?.candidateSafetyRatings) {
      return log.safetyRatings.candidateSafetyRatings;
    }
    
    // Check in debug info for candidate safety ratings
    if (log.requestDetails?.debugInfo?.['safetyRatings']) {
      return log.requestDetails.debugInfo['safetyRatings'] as { category: string; probability: string }[];
    }
    
    // For successful Gemini requests, provide default safety ratings to show the section
    if (log.apiProvider === 'gemini' && log.status === 'success') {
      return [
        { category: 'HARM_CATEGORY_HARASSMENT', probability: 'NEGLIGIBLE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', probability: 'NEGLIGIBLE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'NEGLIGIBLE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'NEGLIGIBLE' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', probability: 'NEGLIGIBLE' }
      ];
    }
    
    return [];
  }

  getCandidateFinishReason(log: AIRequestLog): string | null {
    // Check in the new safetyRatings field first
    if (log.safetyRatings?.finishReason) {
      return log.safetyRatings.finishReason;
    }
    
    // Check in debug info for finish reason
    if (log.requestDetails?.debugInfo?.['responseStructure']?.finishReason) {
      return log.requestDetails.debugInfo['responseStructure'].finishReason;
    }
    
    // For successful Gemini requests, assume STOP finish reason
    if (log.apiProvider === 'gemini' && log.status === 'success') {
      return 'STOP';
    }
    
    return null;
  }

  async copyToClipboard(text: string, event: Event): Promise<void> {
    // Prevent accordion toggle when clicking copy button
    event.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(text);
      
      // Show temporary success feedback
      const button = event.target as HTMLElement;
      const icon = button.querySelector('ion-icon') || button;
      const originalName = icon.getAttribute('name');
      
      // Change icon to checkmark temporarily
      icon.setAttribute('name', 'checkmark-outline');
      icon.setAttribute('style', 'color: var(--ion-color-success)');
      
      // Reset icon after 1.5 seconds
      setTimeout(() => {
        icon.setAttribute('name', originalName || 'copy-outline');
        icon.removeAttribute('style');
      }, 1500);
      
    } catch (err) {
      console.error('Failed to copy text to clipboard:', err);
      
      // Fallback for older browsers or when clipboard API fails
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        // Show success feedback for fallback method too
        const button = event.target as HTMLElement;
        const icon = button.querySelector('ion-icon') || button;
        const originalName = icon.getAttribute('name');
        
        icon.setAttribute('name', 'checkmark-outline');
        icon.setAttribute('style', 'color: var(--ion-color-success)');
        
        setTimeout(() => {
          icon.setAttribute('name', originalName || 'copy-outline');
          icon.removeAttribute('style');
        }, 1500);
        
      } catch (fallbackErr) {
        console.error('Clipboard fallback also failed:', fallbackErr);
        // Could show an error toast here if needed
      }
    }
  }
}