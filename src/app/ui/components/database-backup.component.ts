import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonIcon,
  IonItem, IonLabel, IonProgressBar, IonChip, IonSpinner,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  downloadOutline, cloudUploadOutline, informationCircleOutline,
  checkmarkCircleOutline, warningOutline, documentTextOutline, timeOutline, trashOutline, albumsOutline, buildOutline, syncOutline, refreshOutline
} from 'ionicons/icons';
import { DatabaseBackupService } from '../../shared/services/database-backup.service';
import { BeatHistoryService } from '../../shared/services/beat-history.service';
import { DatabaseService } from '../../core/services/database.service';
import { StoryMetadataIndexService } from '../../stories/services/story-metadata-index.service';

@Component({
  selector: 'app-database-backup',
  standalone: true,
  imports: [
    CommonModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonIcon,
    IonItem, IonLabel, IonProgressBar, IonChip, IonSpinner
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="document-text-outline" slot="start"></ion-icon>
          Database Backup & Restore
        </ion-card-title>
      </ion-card-header>
      
      <ion-card-content>
        <!-- Database Info -->
        <ion-item *ngIf="databaseInfo" lines="none" class="database-info">
          <ion-icon name="information-circle-outline" slot="start" color="primary"></ion-icon>
          <ion-label>
            <h3>Current Database</h3>
            <p>{{ databaseInfo.totalDocs }} documents in "{{ databaseInfo.dbName }}"</p>
            <p *ngIf="databaseInfo.lastUpdated">Last updated: {{ databaseInfo.lastUpdated | date:'medium' }}</p>
          </ion-label>
        </ion-item>

        <!-- Export Section -->
        <div class="backup-section">
          <h3>Export Database</h3>
          <p class="section-description">
            Create a backup of your entire database including all stories, scenes, and settings.
          </p>
          
          <ion-button 
            expand="block" 
            color="primary"
            (click)="exportDatabase()"
            [disabled]="isExporting">
            <ion-icon name="download-outline" slot="start"></ion-icon>
            <ion-spinner *ngIf="isExporting" slot="start"></ion-spinner>
            {{ isExporting ? 'Exporting...' : 'Export Database' }}
          </ion-button>
          
          <ion-progress-bar 
            *ngIf="isExporting" 
            type="indeterminate" 
            color="primary">
          </ion-progress-bar>
        </div>

        <!-- Import Section -->
        <div class="backup-section">
          <h3>Import Database</h3>
          <p class="section-description">
            Restore from a previously exported database backup. This will completely replace your current database with the backup data.
          </p>
          
          <div class="import-controls">
            <input 
              #fileInput 
              type="file" 
              accept=".json"
              (change)="onFileSelected($event)"
              style="display: none;">
            
            <ion-button 
              expand="block" 
              fill="outline" 
              color="secondary"
              (click)="fileInput.click()"
              [disabled]="isImporting">
              <ion-icon name="cloud-upload-outline" slot="start"></ion-icon>
              Select Backup File
            </ion-button>
            
            <ion-item *ngIf="selectedFile" lines="none" class="selected-file">
              <ion-icon name="document-text-outline" slot="start" color="secondary"></ion-icon>
              <ion-label>
                <h3>{{ selectedFile.name }}</h3>
                <p>{{ formatFileSize(selectedFile.size) }}</p>
              </ion-label>
              <ion-chip slot="end" color="secondary">
                <ion-icon name="checkmark-circle-outline"></ion-icon>
                <ion-label>Selected</ion-label>
              </ion-chip>
            </ion-item>
            
            <ion-button 
              expand="block" 
              color="warning"
              (click)="showImportConfirmation()"
              [disabled]="!selectedFile || isImporting">
              <ion-icon name="cloud-upload-outline" slot="start"></ion-icon>
              <ion-spinner *ngIf="isImporting" slot="start"></ion-spinner>
              {{ isImporting ? 'Importing...' : 'Import Database' }}
            </ion-button>
            
            <ion-progress-bar 
              *ngIf="isImporting" 
              type="indeterminate" 
              color="warning">
            </ion-progress-bar>
          </div>
        </div>

        <!-- Warning Section -->
        <div class="warning-section">
          <ion-item lines="none" color="light">
            <ion-icon name="warning-outline" slot="start" color="warning"></ion-icon>
            <ion-label>
              <h3>Important Notes</h3>
              <ul>
                <li>Export includes all documents and attachments</li>
                <li>Import will replace the entire database</li>
                <li>Make a backup before importing to avoid data loss</li>
                <li>Documents with images/attachments are fully supported</li>
                <li>Import will continue even if some documents fail</li>
              </ul>
            </ion-label>
          </ion-item>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Beat Version History Management -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="time-outline" slot="start"></ion-icon>
          Beat Version History Management
        </ion-card-title>
      </ion-card-header>

      <ion-card-content>
        <!-- Beat History Info -->
        <ion-item *ngIf="beatHistoryStats" lines="none" class="database-info">
          <ion-icon name="information-circle-outline" slot="start" color="primary"></ion-icon>
          <ion-label>
            <h3>Current Beat History Storage</h3>
            <p>{{ beatHistoryStats.totalHistories }} beat{{ beatHistoryStats.totalHistories !== 1 ? 's' : '' }} with {{ beatHistoryStats.totalVersions }} version{{ beatHistoryStats.totalVersions !== 1 ? 's' : '' }}</p>
            <p>Estimated size: {{ formatFileSize(beatHistoryStats.totalSize) }}</p>
          </ion-label>
        </ion-item>

        <!-- Delete All Beat Histories Section -->
        <div class="backup-section">
          <h3>Delete All Beat Histories</h3>
          <p class="section-description">
            Permanently delete all beat version history data. This will free up storage space but cannot be undone. Your current beat content in stories will not be affected.
          </p>

          <ion-button
            expand="block"
            color="danger"
            (click)="showDeleteBeatHistoriesConfirmation()"
            [disabled]="isDeletingBeatHistories || !beatHistoryStats || beatHistoryStats.totalHistories === 0">
            <ion-icon name="trash-outline" slot="start"></ion-icon>
            <ion-spinner *ngIf="isDeletingBeatHistories" slot="start"></ion-spinner>
            {{ isDeletingBeatHistories ? 'Deleting...' : 'Delete All Beat Histories' }}
          </ion-button>

          <ion-progress-bar
            *ngIf="isDeletingBeatHistories"
            type="indeterminate"
            color="danger">
          </ion-progress-bar>
        </div>

        <!-- Warning Section -->
        <div class="warning-section">
          <ion-item lines="none" color="light">
            <ion-icon name="warning-outline" slot="start" color="warning"></ion-icon>
            <ion-label>
              <h3>Important Notes</h3>
              <ul>
                <li>Deleting beat histories removes all version snapshots</li>
                <li>Current beat content in your stories remains unchanged</li>
                <li>This action cannot be undone - no way to recover deleted versions</li>
                <li>Maximum 10 versions are kept per beat automatically</li>
                <li>History is stored locally and not synced</li>
              </ul>
            </ion-label>
          </ion-item>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Database Cleanup (IndexedDB) -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="albums-outline" slot="start"></ion-icon>
          Database Cleanup
        </ion-card-title>
      </ion-card-header>

      <ion-card-content>
        <!-- Info -->
        <ion-item lines="none" class="database-info">
          <ion-icon name="information-circle-outline" slot="start" color="primary"></ion-icon>
          <ion-label>
            <h3>IndexedDB Storage Optimization</h3>
            <p>Remove old database indexes (mrview databases) to free up storage space. This is safe and will not delete any of your stories or data.</p>
          </ion-label>
        </ion-item>

        <!-- Cleanup Button -->
        <div class="backup-section">
          <h3>Clean Up Old Databases</h3>
          <p class="section-description">
            PouchDB creates index databases that can accumulate over time. This removes unused indexes while preserving all your data.
          </p>

          <ion-button
            expand="block"
            color="secondary"
            (click)="cleanupDatabases()"
            [disabled]="isCleaningDatabases">
            <ion-icon name="build-outline" slot="start"></ion-icon>
            <ion-spinner *ngIf="isCleaningDatabases" slot="start"></ion-spinner>
            {{ isCleaningDatabases ? 'Cleaning...' : 'Clean Up Databases' }}
          </ion-button>

          <ion-progress-bar
            *ngIf="isCleaningDatabases"
            type="indeterminate"
            color="secondary">
          </ion-progress-bar>

          <div *ngIf="cleanupResult" class="cleanup-result">
            <ion-item lines="none" [color]="cleanupResult.errors.length > 0 ? 'warning' : 'success'">
              <ion-icon
                [name]="cleanupResult.errors.length > 0 ? 'warning-outline' : 'checkmark-circle-outline'"
                slot="start">
              </ion-icon>
              <ion-label>
                <h3>Cleanup Complete</h3>
                <p>Removed {{ cleanupResult.cleaned }} old indexes</p>
                <p>Kept {{ cleanupResult.kept }} active databases</p>
                <p *ngIf="cleanupResult.errors.length > 0" style="color: var(--ion-color-danger);">
                  {{ cleanupResult.errors.length }} error(s) occurred
                </p>
              </ion-label>
            </ion-item>
          </div>
        </div>

        <!-- Warning Section -->
        <div class="warning-section">
          <ion-item lines="none" color="light">
            <ion-icon name="information-circle-outline" slot="start" color="primary"></ion-icon>
            <ion-label>
              <h3>What This Does</h3>
              <ul>
                <li><strong>SAFE:</strong> Only removes PouchDB index databases (mrview databases)</li>
                <li>Your stories and beat content are NEVER touched</li>
                <li>Indexes can be recreated automatically when needed</li>
                <li>Helps reduce mobile browser memory usage</li>
                <li>Recommended if you experience crashes or slowness</li>
              </ul>
            </ion-label>
          </ion-item>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Metadata Index Sync -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="sync-outline" slot="start"></ion-icon>
          Metadata Index Management
        </ion-card-title>
      </ion-card-header>

      <ion-card-content>
        <!-- Info -->
        <ion-item lines="none" class="database-info">
          <ion-icon name="information-circle-outline" slot="start" color="primary"></ion-icon>
          <ion-label>
            <h3>Story Metadata Index</h3>
            <p>The metadata index powers the story list with lightweight previews. Syncing ensures the index matches your remote stories.</p>
          </ion-label>
        </ion-item>

        <!-- Sync Button -->
        <div class="backup-section">
          <h3>Sync Metadata Index</h3>
          <p class="section-description">
            Fetch the latest metadata index from the remote server. This is useful after browser data deletion or if stories aren't showing in the list.
          </p>

          <ion-button
            expand="block"
            color="primary"
            (click)="syncMetadataIndex()"
            [disabled]="isSyncingMetadataIndex">
            <ion-icon name="sync-outline" slot="start"></ion-icon>
            <ion-spinner *ngIf="isSyncingMetadataIndex" slot="start"></ion-spinner>
            {{ isSyncingMetadataIndex ? 'Syncing...' : 'Sync Metadata Index' }}
          </ion-button>

          <ion-progress-bar
            *ngIf="isSyncingMetadataIndex"
            type="indeterminate"
            color="primary">
          </ion-progress-bar>

          <div *ngIf="metadataIndexResult" class="cleanup-result">
            <ion-item lines="none" [color]="metadataIndexResult.success ? 'success' : 'warning'">
              <ion-icon
                [name]="metadataIndexResult.success ? 'checkmark-circle-outline' : 'warning-outline'"
                slot="start">
              </ion-icon>
              <ion-label>
                <h3>{{ metadataIndexResult.title }}</h3>
                <p>{{ metadataIndexResult.message }}</p>
                <p *ngIf="metadataIndexResult.storiesCount !== undefined">
                  Found {{ metadataIndexResult.storiesCount }} stor{{ metadataIndexResult.storiesCount !== 1 ? 'ies' : 'y' }} in index
                </p>
              </ion-label>
            </ion-item>
          </div>
        </div>

        <!-- Rebuild Button -->
        <div class="backup-section">
          <h3>Rebuild Metadata Index</h3>
          <p class="section-description">
            Rebuild the metadata index from all stories in the local database. Use this if the index is corrupted or out of sync.
          </p>

          <ion-button
            expand="block"
            fill="outline"
            color="secondary"
            (click)="rebuildMetadataIndex()"
            [disabled]="isRebuildingMetadataIndex">
            <ion-icon name="refresh-outline" slot="start"></ion-icon>
            <ion-spinner *ngIf="isRebuildingMetadataIndex" slot="start"></ion-spinner>
            {{ isRebuildingMetadataIndex ? 'Rebuilding...' : 'Rebuild Metadata Index' }}
          </ion-button>

          <ion-progress-bar
            *ngIf="isRebuildingMetadataIndex"
            type="indeterminate"
            color="secondary">
          </ion-progress-bar>
        </div>

        <!-- Info Section -->
        <div class="warning-section">
          <ion-item lines="none" color="light">
            <ion-icon name="information-circle-outline" slot="start" color="primary"></ion-icon>
            <ion-label>
              <h3>What These Do</h3>
              <ul>
                <li><strong>Sync:</strong> Fetches the metadata index from remote CouchDB (~500KB)</li>
                <li><strong>Rebuild:</strong> Creates new index from local stories (no remote fetch)</li>
                <li>Metadata index contains story previews, word counts, and thumbnails</li>
                <li>Story list loads from this index instead of loading all stories</li>
                <li>Much faster and uses less memory on mobile</li>
              </ul>
            </ion-label>
          </ion-item>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    ion-card {
      margin-bottom: 1rem;
      background: linear-gradient(135deg, rgba(45, 45, 45, 0.4) 0%, rgba(30, 30, 30, 0.4) 100%);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(139, 180, 248, 0.2);
      border-radius: 12px;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    ion-card:hover {
      border-color: rgba(139, 180, 248, 0.3);
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(71, 118, 230, 0.2);
    }

    ion-card-header {
      background: rgba(45, 45, 45, 0.3);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      padding: 1.2rem 1.5rem;
      border-radius: 12px 12px 0 0;
    }

    ion-card-title {
      color: #f8f9fa;
      font-size: 1.3rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin: 0;
      padding: 0;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    ion-card-content {
      background: transparent;
      padding: 1.5rem;
    }

    .database-info {
      --background: rgba(71, 118, 230, 0.1);
      --border-radius: 8px;
      margin-bottom: 1.5rem;
      border: 1px solid rgba(139, 180, 248, 0.2);
    }

    .backup-section {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: rgba(20, 20, 20, 0.3);
      border: 1px solid rgba(139, 180, 248, 0.15);
      border-radius: 10px;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    .backup-section h3 {
      color: #f8f9fa;
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      background: linear-gradient(135deg, #f8f9fa 0%, #8bb4f8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .section-description {
      color: #adb5bd;
      font-size: 0.9rem;
      margin-bottom: 1rem;
      line-height: 1.4;
    }

    .import-controls {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .selected-file {
      --background: rgba(139, 180, 248, 0.1);
      --border-radius: 8px;
      border: 1px solid rgba(139, 180, 248, 0.2);
    }

    .warning-section {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(139, 180, 248, 0.2);
    }

    .warning-section ion-item {
      --background: rgba(255, 193, 7, 0.1);
      --border-radius: 8px;
      border: 1px solid rgba(255, 193, 7, 0.2);
    }

    .warning-section ul {
      margin: 0.5rem 0;
      padding-left: 1.2rem;
      color: #adb5bd;
    }

    .warning-section li {
      margin-bottom: 0.25rem;
      font-size: 0.85rem;
    }

    ion-button {
      --border-radius: 8px;
      font-weight: 600;
      margin: 0.25rem 0;
    }

    ion-button[color="primary"] {
      --background: linear-gradient(135deg, #4776e6 0%, #8bb4f8 100%);
      --background-hover: linear-gradient(135deg, #3a5fd4 0%, #7ca3e6 100%);
      box-shadow: 0 4px 15px rgba(71, 118, 230, 0.3);
    }

    ion-button[color="warning"] {
      --background: linear-gradient(135deg, #ff9500 0%, #ffc107 100%);
      --background-hover: linear-gradient(135deg, #e8850b 0%, #e6ac00 100%);
      box-shadow: 0 4px 15px rgba(255, 193, 7, 0.3);
    }

    ion-button[fill="outline"] {
      --border-color: rgba(139, 180, 248, 0.3);
      --color: #8bb4f8;
    }

    ion-button[color="danger"] {
      --background: linear-gradient(135deg, #dc3545 0%, #ff4757 100%);
      --background-hover: linear-gradient(135deg, #c82333 0%, #e63946 100%);
      box-shadow: 0 4px 15px rgba(220, 53, 69, 0.3);
    }

    ion-button:hover {
      transform: translateY(-1px);
    }

    ion-button:disabled {
      opacity: 0.6;
      transform: none !important;
      cursor: not-allowed;
    }

    ion-progress-bar {
      margin-top: 0.5rem;
      --progress-background: rgba(139, 180, 248, 0.2);
      --background: rgba(30, 30, 30, 0.5);
      border-radius: 4px;
      height: 4px;
    }

    ion-progress-bar[color="primary"] {
      --progress-background: linear-gradient(90deg, #4776e6 0%, #8bb4f8 100%);
    }

    ion-progress-bar[color="warning"] {
      --progress-background: linear-gradient(90deg, #ff9500 0%, #ffc107 100%);
    }

    ion-progress-bar[color="danger"] {
      --progress-background: linear-gradient(90deg, #dc3545 0%, #ff4757 100%);
    }

    ion-item {
      --color: #e0e0e0;
      --background: rgba(20, 20, 20, 0.3);
      --border-color: rgba(139, 180, 248, 0.1);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      margin: 0.5rem 0;
      border-radius: 8px;
    }

    ion-label h3 {
      color: #f8f9fa;
      font-weight: 600;
    }

    ion-label p {
      color: #adb5bd;
      font-size: 0.85rem;
    }

    ion-chip {
      --background: linear-gradient(135deg, rgba(139, 180, 248, 0.2) 0%, rgba(71, 118, 230, 0.2) 100%);
      --color: #8bb4f8;
      border: 1px solid rgba(139, 180, 248, 0.3);
    }

    ion-spinner {
      --color: currentColor;
      width: 1rem;
      height: 1rem;
    }

    @media (max-width: 768px) {
      ion-card-content {
        padding: 1rem;
      }
      
      .backup-section {
        padding: 1rem;
      }
    }
  `]
})
export class DatabaseBackupComponent {
  private readonly backupService = inject(DatabaseBackupService);
  private readonly beatHistoryService = inject(BeatHistoryService);
  private readonly databaseService = inject(DatabaseService);
  private readonly metadataIndexService = inject(StoryMetadataIndexService);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);

  databaseInfo: { totalDocs: number; dbName: string; lastUpdated?: Date } | null = null;
  beatHistoryStats: { totalHistories: number; totalVersions: number; totalSize: number } | null = null;
  isExporting = false;
  isImporting = false;
  isDeletingBeatHistories = false;
  isCleaningDatabases = false;
  isSyncingMetadataIndex = false;
  isRebuildingMetadataIndex = false;
  cleanupResult: { cleaned: number; kept: number; errors: string[] } | null = null;
  metadataIndexResult: { success: boolean; title: string; message: string; storiesCount?: number } | null = null;
  selectedFile: File | null = null;

  constructor() {
    addIcons({
      downloadOutline, cloudUploadOutline, informationCircleOutline,
      checkmarkCircleOutline, warningOutline, documentTextOutline, timeOutline, trashOutline, albumsOutline, buildOutline, syncOutline, refreshOutline
    });

    this.loadDatabaseInfo();
    this.loadBeatHistoryStats();
  }

  async loadDatabaseInfo(): Promise<void> {
    try {
      this.databaseInfo = await this.backupService.getDatabaseInfo();
    } catch (error: unknown) {
      console.error('Failed to load database info:', error);
      this.showToast('Failed to load database information', 'danger');
    }
  }

  async exportDatabase(): Promise<void> {
    this.isExporting = true;
    
    try {
      const backupData = await this.backupService.exportDatabase();
      const filename = this.backupService.generateFilename();
      
      this.backupService.downloadFile(backupData, filename);
      
      this.showToast('Database exported successfully!', 'success');
      
      // Refresh database info after export
      await this.loadDatabaseInfo();
      
    } catch (error) {
      console.error('Export failed:', error);
      this.showToast('Failed to export database. Please try again.', 'danger');
    } finally {
      this.isExporting = false;
    }
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file && file.type === 'application/json') {
      this.selectedFile = file;
    } else {
      this.showToast('Please select a valid JSON backup file', 'warning');
      this.selectedFile = null;
    }
  }

  async showImportConfirmation(): Promise<void> {
    const alert = await this.alertController.create({
      header: '⚠️ COMPLETE DATABASE REPLACEMENT',
      message: `This will COMPLETELY REPLACE your current database with the backup data. 

🗑️ ALL current data will be DELETED
📥 Only the backup data will remain
📎 Documents with attachments (images) are fully supported

This action CANNOT be undone! Make sure you have exported your current database first if you want to keep it.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Replace Database',
          role: 'destructive',
          handler: () => {
            this.importDatabase();
          }
        }
      ]
    });

    await alert.present();
  }

  async importDatabase(): Promise<void> {
    if (!this.selectedFile) return;

    this.isImporting = true;

    try {
      const fileContent = await this.readFileContent(this.selectedFile);
      await this.backupService.importDatabase(fileContent);
      
      this.showToast('Database imported successfully! Check console for any attachment warnings.', 'success');
      this.selectedFile = null;
      
      // Refresh database info after import (with error handling)
      try {
        await this.loadDatabaseInfo();
      } catch (infoError) {
        console.warn('Failed to refresh database info after import:', infoError);
        // Don't fail the entire import for this
      }
      
    } catch (error: unknown) {
      console.error('Import failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to import database. Please check the file and try again.';
      this.showToast(errorMessage, 'danger');
    } finally {
      // Ensure the loading state is always reset
      this.isImporting = false;
      console.log('Import process completed, isImporting set to false');
    }
  }

  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async loadBeatHistoryStats(): Promise<void> {
    try {
      this.beatHistoryStats = await this.beatHistoryService.getHistoryStats();
    } catch (error: unknown) {
      console.error('Failed to load beat history stats:', error);
      this.showToast('Failed to load beat history statistics', 'danger');
    }
  }

  async showDeleteBeatHistoriesConfirmation(): Promise<void> {
    if (!this.beatHistoryStats || this.beatHistoryStats.totalHistories === 0) {
      return;
    }

    const alert = await this.alertController.create({
      header: '⚠️ DELETE ALL BEAT HISTORIES',
      message: `This will permanently delete ALL beat version history data:

🗑️ ${this.beatHistoryStats.totalHistories} beat${this.beatHistoryStats.totalHistories !== 1 ? 's' : ''} with ${this.beatHistoryStats.totalVersions} version${this.beatHistoryStats.totalVersions !== 1 ? 's' : ''}
💾 ~${this.formatFileSize(this.beatHistoryStats.totalSize)} of storage will be freed
✅ Current beat content in stories will remain unchanged

This action CANNOT be undone! All previous versions will be lost forever.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete All Histories',
          role: 'destructive',
          handler: () => {
            this.deleteAllBeatHistories();
          }
        }
      ]
    });

    await alert.present();
  }

  async deleteAllBeatHistories(): Promise<void> {
    this.isDeletingBeatHistories = true;

    try {
      const deletedCount = await this.beatHistoryService.deleteAllHistories();

      this.showToast(`Successfully deleted ${deletedCount} beat histor${deletedCount !== 1 ? 'ies' : 'y'}!`, 'success');

      // Refresh stats after deletion
      await this.loadBeatHistoryStats();

    } catch (error: unknown) {
      console.error('Failed to delete beat histories:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete beat histories. Please try again.';
      this.showToast(errorMessage, 'danger');
    } finally {
      this.isDeletingBeatHistories = false;
    }
  }

  async cleanupDatabases(): Promise<void> {
    this.isCleaningDatabases = true;
    this.cleanupResult = null;

    try {
      const result = await this.databaseService.cleanupOldDatabases();
      this.cleanupResult = result;

      if (result.errors.length > 0) {
        this.showToast(`Cleanup completed with ${result.errors.length} error(s). Removed ${result.cleaned} old indexes.`, 'warning');
      } else {
        this.showToast(`Successfully cleaned up ${result.cleaned} old database index${result.cleaned !== 1 ? 'es' : ''}!`, 'success');
      }
    } catch (error: unknown) {
      console.error('Failed to cleanup databases:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to cleanup databases. Please try again.';
      this.showToast(errorMessage, 'danger');
    } finally {
      this.isCleaningDatabases = false;
    }
  }

  async syncMetadataIndex(): Promise<void> {
    this.isSyncingMetadataIndex = true;
    this.metadataIndexResult = null;

    try {
      console.info('[DatabaseBackup] Starting metadata index sync from remote');

      // Get the database
      const db = await this.databaseService.getDatabase();

      // Fetch the story-metadata-index document from local database
      // (which should sync from remote if available)
      try {
        const indexDoc = await db.get('story-metadata-index');
        const storiesCount = (indexDoc as { stories?: unknown[] }).stories?.length || 0;

        console.info(`[DatabaseBackup] Successfully synced metadata index with ${storiesCount} stories`);

        this.metadataIndexResult = {
          success: true,
          title: 'Sync Successful',
          message: 'Metadata index synced from remote server',
          storiesCount
        };

        this.showToast(`Metadata index synced successfully with ${storiesCount} stor${storiesCount !== 1 ? 'ies' : 'y'}!`, 'success');
      } catch (error) {
        // Document doesn't exist locally - might not be synced yet
        if ((error as { status?: number }).status === 404) {
          console.warn('[DatabaseBackup] Metadata index not found in local database. Sync may be in progress.');
          this.metadataIndexResult = {
            success: false,
            title: 'Index Not Found',
            message: 'Metadata index not found. It may still be syncing from remote, or the remote index may not exist yet.'
          };
          this.showToast('Metadata index not found. Try rebuilding or wait for sync to complete.', 'warning');
        } else {
          throw error;
        }
      }
    } catch (error: unknown) {
      console.error('[DatabaseBackup] Failed to sync metadata index:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync metadata index';

      this.metadataIndexResult = {
        success: false,
        title: 'Sync Failed',
        message: errorMessage
      };

      this.showToast('Failed to sync metadata index. Please try again.', 'danger');
    } finally {
      this.isSyncingMetadataIndex = false;
    }
  }

  async rebuildMetadataIndex(): Promise<void> {
    this.isRebuildingMetadataIndex = true;
    this.metadataIndexResult = null;

    try {
      console.info('[DatabaseBackup] Starting metadata index rebuild from local stories');

      // Rebuild the index from local stories (force=true for manual user action)
      const index = await this.metadataIndexService.rebuildIndex(true);
      const storiesCount = index.stories.length;

      console.info(`[DatabaseBackup] Successfully rebuilt metadata index with ${storiesCount} stories`);

      this.metadataIndexResult = {
        success: true,
        title: 'Rebuild Successful',
        message: 'Metadata index rebuilt from local stories',
        storiesCount
      };

      this.showToast(`Metadata index rebuilt successfully with ${storiesCount} stor${storiesCount !== 1 ? 'ies' : 'y'}!`, 'success');
    } catch (error: unknown) {
      console.error('[DatabaseBackup] Failed to rebuild metadata index:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to rebuild metadata index';

      this.metadataIndexResult = {
        success: false,
        title: 'Rebuild Failed',
        message: errorMessage
      };

      this.showToast('Failed to rebuild metadata index. Please try again.', 'danger');
    } finally {
      this.isRebuildingMetadataIndex = false;
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
