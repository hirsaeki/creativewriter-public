import { Component, OnInit, OnDestroy, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { DatabaseService, SyncStatus } from '../../core/services/database.service';


@Component({
  selector: 'app-sync-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sync-status" [ngClass]="syncStatusClass">
      <span class="sync-icon">{{ syncIcon }}</span>
      <span class="sync-text">{{ syncText }}</span>
      <div class="sync-actions" *ngIf="showActions">
        <button (click)="forcePush()" [disabled]="!canSync" title="Push local changes">
          ↗️ Push
        </button>
        <button (click)="forcePull()" [disabled]="!canSync" title="Pull remote changes">
          ↙️ Pull
        </button>
      </div>
    </div>
  `,
  styles: [`
    .sync-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.875rem;
      transition: all 0.2s ease;
      max-width: 100%;
      overflow: hidden;
      z-index: 1;
      position: relative;
    }
    
    .sync-status.online {
      background-color: rgba(40, 167, 69, 0.2);
      color: #40c463;
      border: 1px solid rgba(40, 167, 69, 0.4);
    }
    
    .sync-status.offline {
      background-color: rgba(220, 53, 69, 0.2);
      color: #ff6b7a;
      border: 1px solid rgba(220, 53, 69, 0.4);
    }
    
    .sync-status.syncing {
      background-color: rgba(255, 193, 7, 0.2);
      color: #ffc107;
      border: 1px solid rgba(255, 193, 7, 0.4);
    }
    
    .sync-status.error {
      background-color: rgba(220, 53, 69, 0.2);
      color: #ff6b7a;
      border: 1px solid rgba(220, 53, 69, 0.4);
    }
    
    .sync-icon {
      font-size: 1rem;
      flex-shrink: 0;
    }
    
    .sync-text {
      word-break: break-word;
      overflow-wrap: break-word;
      hyphens: auto;
      line-height: 1.2;
      flex: 1;
      min-width: 0;
    }
    
    .sync-actions {
      display: flex;
      gap: 0.25rem;
      margin-left: auto;
    }
    
    .sync-actions button {
      padding: 0.25rem 0.5rem;
      border: 1px solid currentColor;
      background: transparent;
      color: inherit;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.75rem;
    }
    
    .sync-actions button:hover:not(:disabled) {
      background: currentColor;
      color: white;
    }
    
    .sync-actions button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    /* Responsive styles */
    @media (max-width: 768px) {
      .sync-status {
        padding: 0.4rem;
        font-size: 0.8rem;
        gap: 0.4rem;
      }
      
      .sync-actions {
        gap: 0.2rem;
      }
      
      .sync-actions button {
        padding: 0.2rem 0.4rem;
        font-size: 0.7rem;
      }
    }
    
    /* Prevent overflow in compact areas */
    .compact-sync-status .sync-status {
      max-width: 200px;
    }
    
    /* Full status in burger menu */
    .full-sync-status .sync-status {
      max-width: 100%;
      width: 100%;
    }
  `]
})
export class SyncStatusComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  @Input() showActions = false;
  
  syncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    isSync: false
  };

  private readonly databaseService = inject(DatabaseService);

  ngOnInit() {
    this.databaseService.syncStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.syncStatus = status;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get syncStatusClass(): string {
    if (this.syncStatus.error) return 'error';
    if (this.syncStatus.isSync) return 'syncing';
    if (!this.syncStatus.isOnline) return 'offline';
    return 'online';
  }

  get syncIcon(): string {
    if (this.syncStatus.error) return '⚠️';
    if (this.syncStatus.isSync) return '🔄';
    if (!this.syncStatus.isOnline) return '🔌';
    return '☁️';
  }

  get syncText(): string {
    if (this.syncStatus.error) {
      // Truncate long error messages and provide meaningful short text
      const errorText = this.syncStatus.error;
      if (errorText.includes('not reachable') || errorText.includes('connection')) {
        return 'DB not reachable';
      }
      if (errorText.includes('timeout')) {
        return 'Connection timeout';
      }
      if (errorText.includes('auth')) {
        return 'Login failed';
      }
      // Generic truncation for other errors
      return errorText.length > 30 ? `Error: ${errorText.substring(0, 27)}...` : `Error: ${errorText}`;
    }
    if (this.syncStatus.isSync) return 'Syncing...';
    if (!this.syncStatus.isOnline) return 'Offline';
    
    const lastSync = this.syncStatus.lastSync;
    if (lastSync) {
      const timeAgo = this.getTimeAgo(lastSync);
      return `Synced (${timeAgo})`;
    }
    
    return 'Online';
  }

  get canSync(): boolean {
    return this.syncStatus.isOnline && !this.syncStatus.isSync;
  }

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  async forcePush() {
    try {
      await this.databaseService.forcePush();
    } catch (error) {
      console.error('Force push failed:', error);
    }
  }

  async forcePull() {
    try {
      await this.databaseService.forcePull();
    } catch (error) {
      console.error('Force pull failed:', error);
    }
  }
}
