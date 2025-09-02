import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonPopover, IonContent } from '@ionic/angular/standalone';
import { VersionService, VersionInfo } from '../../core/services/version.service';


@Component({
  selector: 'app-version-tooltip',
  standalone: true,
  imports: [CommonModule, IonPopover, IonContent],
  template: `
    <div #triggerElement 
         id="version-tooltip-trigger"
         (click)="togglePopover()"
         style="cursor: pointer;"
         role="button"
         aria-label="Show version information"
         [attr.aria-expanded]="isOpen"
         aria-haspopup="dialog"
         tabindex="0"
         (keydown.enter)="togglePopover()"
         (keydown.space)="togglePopover()">
      <ng-content></ng-content>
    </div>
    
    <ion-popover 
      #popover
      trigger="version-tooltip-trigger"
      side="bottom"
      alignment="center" 
      reference="trigger"
      [showBackdrop]="true"
      [keepContentsMounted]="false"
      size="auto"
      class="version-popover"
      (ionPopoverWillDismiss)="onPopoverDismiss()">
      
      <ng-template>
        <ion-content class="version-tooltip-content" role="dialog" aria-label="Version information">
          <div class="tooltip-content" *ngIf="versionInfo">
            <div class="tooltip-header">
              <strong>Version Info</strong>
            </div>
            <div class="tooltip-row">
              <span class="label">Version:</span>
              <span class="value">{{ versionInfo.version }}</span>
            </div>
            <div class="tooltip-row">
              <span class="label">Build:</span>
              <span class="value">{{ versionInfo.buildNumber }}</span>
            </div>
            <div class="tooltip-row">
              <span class="label">Branch:</span>
              <span class="value">{{ versionInfo.branch }}</span>
            </div>
            <div class="tooltip-row">
              <span class="label">Commit:</span>
              <span class="value commit-hash">{{ versionInfo.commitHash.substring(0, 8) }}...</span>
            </div>
            <div class="tooltip-row commit-message">
              <span class="label">Message:</span>
              <span class="value">{{ versionInfo.commitMessage }}</span>
            </div>
            <div class="tooltip-row">
              <span class="label">Built:</span>
              <span class="value">{{ formatBuildDate(versionInfo.buildDate) }}</span>
            </div>
          </div>
        </ion-content>
      </ng-template>
    </ion-popover>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    
    .version-popover::part(content) {
      --background: linear-gradient(135deg, rgba(15, 15, 25, 0.98) 0%, rgba(25, 25, 40, 0.98) 100%);
      --box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 8px 16px rgba(139, 180, 248, 0.1);
      --border-radius: 12px;
      --border-color: rgba(139, 180, 248, 0.3);
      --border-width: 1px;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      min-width: 280px;
      max-width: 350px;
    }
    
    .version-tooltip-content {
      --background: transparent;
      --padding-start: 0;
      --padding-end: 0;
      --padding-top: 0;
      --padding-bottom: 0;
    }
    
    .tooltip-content {
      padding: 16px;
    }
    
    .tooltip-header {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(139, 180, 248, 0.2);
      background: linear-gradient(135deg, #ffffff 0%, #8bb4f8 50%, #4776e6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    
    .tooltip-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
      font-size: 0.8rem;
      line-height: 1.3;
    }
    
    .tooltip-row:last-child {
      margin-bottom: 0;
    }
    
    .tooltip-row.commit-message {
      flex-direction: column;
      align-items: flex-start;
      margin-top: 4px;
    }
    
    .tooltip-row.commit-message .value {
      margin-top: 4px;
      font-style: italic;
      opacity: 0.9;
      line-height: 1.4;
      word-break: break-word;
      hyphens: auto;
    }
    
    .label {
      color: rgba(139, 180, 248, 0.8);
      font-weight: 600;
      flex-shrink: 0;
      margin-right: 12px;
      min-width: 60px;
    }
    
    .value {
      color: #e0e0e0;
      text-align: right;
      flex: 1;
      word-break: break-word;
    }
    
    .commit-hash {
      font-family: 'Courier New', monospace;
      font-size: 0.75rem;
      background: rgba(139, 180, 248, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid rgba(139, 180, 248, 0.2);
    }
    
    /* Responsive styles */
    @media (max-width: 768px) {
      .version-popover::part(content) {
        min-width: 260px;
        max-width: 300px;
      }
      
      .tooltip-content {
        padding: 12px;
      }
      
      .tooltip-row {
        font-size: 0.75rem;
        margin-bottom: 6px;
      }
      
      .label {
        min-width: 50px;
        margin-right: 8px;
      }
    }
    
    @media (max-width: 400px) {
      .version-popover::part(content) {
        min-width: 240px;
        max-width: 280px;
      }
    }
  `]
})
export class VersionTooltipComponent implements OnInit {
  private versionService = inject(VersionService);

  @ViewChild('popover') popover!: IonPopover;
  
  versionInfo: VersionInfo | null = null;
  isOpen = false;

  ngOnInit() {
    this.versionService.version$.subscribe(version => {
      this.versionInfo = version;
    });
  }

  togglePopover(event?: KeyboardEvent) {
    if (event && (event.key !== 'Enter' && event.key !== ' ')) return;
    if (event) event.preventDefault();
    
    if (!this.versionInfo || !this.popover) return;
    
    if (this.isOpen) {
      this.popover.dismiss();
    } else {
      this.popover.present();
    }
    this.isOpen = !this.isOpen;
  }

  onPopoverDismiss() {
    this.isOpen = false;
  }

  formatBuildDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString('en-US', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch {
      return dateString;
    }
  }
}
