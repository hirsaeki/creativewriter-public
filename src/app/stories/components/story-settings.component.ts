import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel,
  IonTextarea, IonCheckbox, IonRadio, IonRadioGroup, IonChip, IonNote,
  IonText, IonGrid, IonRow, IonCol, IonProgressBar, IonList, IonThumbnail,
  IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBack, saveOutline, refreshOutline, checkmarkCircleOutline,
  warningOutline, informationCircleOutline, codeSlashOutline,
  settingsOutline, chatboxOutline, documentTextOutline, serverOutline,
  scanOutline, trashOutline, downloadOutline, statsChartOutline,
  copyOutline, searchOutline, closeCircleOutline, checkboxOutline,
  squareOutline, imageOutline
} from 'ionicons/icons';
import { StoryService } from '../services/story.service';
import { Story, StorySettings, DEFAULT_STORY_SETTINGS } from '../models/story.interface';
import { SettingsTabsComponent, TabItem } from '../../shared/components/settings-tabs.component';
import { SettingsContentComponent } from '../../shared/components/settings-content.component';
import { DbMaintenanceService, OrphanedImage, DatabaseStats, DuplicateImage, IntegrityIssue } from '../../shared/services/db-maintenance.service';
import { ImageUploadComponent, ImageUploadResult } from '../../shared/components/image-upload.component';

@Component({
  selector: 'app-story-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel,
    IonTextarea, IonCheckbox, IonRadio, IonRadioGroup, IonChip, IonNote,
    IonText, IonGrid, IonRow, IonCol, IonProgressBar, IonList, IonThumbnail,
    IonBadge,
    SettingsTabsComponent, SettingsContentComponent, ImageUploadComponent
  ],
  template: `
    <div class="ion-page">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button (click)="goBack()">
              <ion-icon name="arrow-back" slot="icon-only"></ion-icon>
            </ion-button>
          </ion-buttons>
          <ion-title>Story Settings</ion-title>
          <ion-buttons slot="end">
            <ion-chip [color]="hasUnsavedChanges ? 'warning' : 'success'">
              <ion-icon [name]="hasUnsavedChanges ? 'warning-outline' : 'checkmark-circle-outline'"></ion-icon>
              <ion-label>{{ hasUnsavedChanges ? 'Not saved' : 'Saved' }}</ion-label>
            </ion-chip>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>

      <ion-content *ngIf="story">
        <!-- Tab Navigation -->
        <app-settings-tabs 
          [tabs]="tabItems" 
          [(selectedTab)]="selectedTab">
        </app-settings-tabs>

        <app-settings-content>
          <!-- Tab Content -->
          <div [ngSwitch]="selectedTab">
            
            <!-- General Tab -->
            <div *ngSwitchCase="'general'">
            <ion-card class="story-info-card">
              <ion-card-header>
                <ion-card-title>{{ story.title || 'Untitled Story' }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-note>
                  Created: {{ story.createdAt | date:'short' }} | Last edited: {{ story.updatedAt | date:'short' }}
                </ion-note>
              </ion-card-content>
            </ion-card>
          </div>

          <!-- Cover Image Tab -->
          <div *ngSwitchCase="'cover-image'">
            <ion-card class="settings-section">
              <ion-card-header>
                <ion-card-title>Cover Image</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-text color="medium">
                  <p>Set a cover image for your story. The image will be displayed in the story list and editor header.</p>
                </ion-text>
                
                <app-image-upload
                  [currentImage]="getCoverImageDataUrl()"
                  [fileName]="getCoverImageFileName()"
                  [fileSize]="getCoverImageFileSize()"
                  (imageSelected)="onCoverImageSelected($event)"
                  (imageRemoved)="onCoverImageRemoved()">
                </app-image-upload>
              </ion-card-content>
            </ion-card>
          </div>
          
          <!-- AI System Tab -->
          <div *ngSwitchCase="'ai-system'">
            <ion-card class="settings-section">
              <ion-card-header>
                <ion-card-title>AI System Message</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-text color="medium">
                  <p>This message defines the context and personality of the AI assistant for this story.</p>
                </ion-text>
                <ion-textarea
                  [(ngModel)]="settings.systemMessage"
                  (ionInput)="onSettingsChange()"
                  placeholder="Geben Sie die System-Nachricht ein..."
                  rows="6"
                  class="settings-textarea"
                  auto-grow="true">
                </ion-textarea>
                <ion-note class="char-count">{{ settings.systemMessage.length }} Zeichen</ion-note>
              </ion-card-content>
            </ion-card>
            
            <ion-card class="settings-section">
              <ion-card-header>
                <ion-card-title>Beat Generation Template</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-text color="medium">
                  <p>XML template for beat generation in messages format. Available placeholders:</p>
                </ion-text>
                
                <div class="template-placeholders">
                  <ion-grid>
                    <ion-row>
                      <ion-col size="12" size-md="6" size-lg="4" *ngFor="let placeholder of placeholders">
                        <ion-chip color="warning" class="placeholder-chip">
                          <ion-icon name="code-slash-outline"></ion-icon>
                          <ion-label>{{ placeholder }}</ion-label>
                        </ion-chip>
                      </ion-col>
                    </ion-row>
                  </ion-grid>
                </div>
                
                <ion-textarea
                  [(ngModel)]="settings.beatGenerationTemplate"
                  (ionInput)="onSettingsChange()"
                  placeholder="Geben Sie das Beat-Template ein..."
                  rows="12"
                  class="settings-textarea large"
                  auto-grow="true">
                </ion-textarea>
                
                <ion-note class="char-count">{{ settings.beatGenerationTemplate.length }} Zeichen</ion-note>
                
                <ion-item *ngIf="!settings.beatGenerationTemplate.includes('{prompt}')" class="template-warning">
                  <ion-icon name="warning-outline" color="warning" slot="start"></ion-icon>
                  <ion-label color="warning">
                    The template should contain {{ '{prompt}' }} to insert the user prompt.
                  </ion-label>
                </ion-item>
              </ion-card-content>
            </ion-card>
          </div>
          
          <!-- Beat Config Tab -->
          <div *ngSwitchCase="'beat-config'">
            <ion-card class="settings-section">
              <ion-card-header>
                <ion-card-title>Beat AI Configuration</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-text color="medium">
                  <p>Configuration for Beat AI generation.</p>
                </ion-text>
                
                <ion-item class="setting-item">
                  <ion-checkbox
                    [(ngModel)]="settings.useFullStoryContext"
                    (ionChange)="onSettingsChange()"
                    slot="start">
                  </ion-checkbox>
                  <ion-label>
                    <h3>Use Complete Story Context</h3>
                    <p>When enabled, the complete text of all scenes is used as context. Otherwise, only summaries are used (if available).</p>
                  </ion-label>
                </ion-item>

                <ion-item class="radio-section">
                  <ion-label>
                    <h3>Beat Instruction</h3>
                    <p>Default instruction for Beat AI generation.</p>
                  </ion-label>
                </ion-item>
                
                <ion-radio-group
                  [(ngModel)]="settings.beatInstruction"
                  (ionChange)="onSettingsChange()">
                  <ion-item>
                    <ion-radio slot="start" value="continue"></ion-radio>
                    <ion-label>Continue the story</ion-label>
                  </ion-item>
                  <ion-item>
                    <ion-radio slot="start" value="stay"></ion-radio>
                    <ion-label>Stay in the moment</ion-label>
                  </ion-item>
                </ion-radio-group>
              </ion-card-content>
            </ion-card>
          </div>

          <!-- DB Maintenance Tab -->
          <div *ngSwitchCase="'db-maintenance'">
            <!-- Database Statistics -->
            <ion-card class="settings-section">
              <ion-card-header>
                <ion-card-title>Database Statistics</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-button
                  fill="outline"
                  size="small"
                  (click)="loadDatabaseStats()"
                  [disabled]="isScanning">
                  <ion-icon name="stats-chart-outline" slot="start"></ion-icon>
                  Load Statistics
                </ion-button>

                <div *ngIf="databaseStats" class="stats-grid">
                  <ion-grid>
                    <ion-row>
                      <ion-col size="6" size-md="3">
                        <div class="stat-item">
                          <ion-text color="primary">
                            <h3>{{ databaseStats.totalStories }}</h3>
                          </ion-text>
                          <ion-note>Stories</ion-note>
                        </div>
                      </ion-col>
                      <ion-col size="6" size-md="3">
                        <div class="stat-item">
                          <ion-text color="primary">
                            <h3>{{ databaseStats.totalImages }}</h3>
                          </ion-text>
                          <ion-note>Images</ion-note>
                        </div>
                      </ion-col>
                      <ion-col size="6" size-md="3">
                        <div class="stat-item">
                          <ion-text color="warning">
                            <h3>{{ databaseStats.orphanedImages }}</h3>
                          </ion-text>
                          <ion-note>Orphaned Images</ion-note>
                        </div>
                      </ion-col>
                      <ion-col size="6" size-md="3">
                        <div class="stat-item">
                          <ion-text color="medium">
                            <h3>{{ formatBytes(databaseStats.databaseSizeEstimate) }}</h3>
                          </ion-text>
                          <ion-note>Total size (approx.)</ion-note>
                        </div>
                      </ion-col>
                    </ion-row>
                  </ion-grid>
                </div>
              </ion-card-content>
            </ion-card>

            <!-- Progress Display -->
            <ion-card *ngIf="isScanning" class="settings-section progress-card">
              <ion-card-content>
                <div class="progress-container">
                  <ion-text color="primary">
                    <h4>{{ scanProgress.operation }}</h4>
                  </ion-text>
                  <ion-progress-bar [value]="scanProgress.progress / 100"></ion-progress-bar>
                  <ion-note>{{ scanProgress.message }}</ion-note>
                </div>
              </ion-card-content>
            </ion-card>

            <!-- Orphaned Images -->
            <ion-card class="settings-section">
              <ion-card-header>
                <ion-card-title>Orphaned Images</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-text color="medium">
                  <p>Images that are no longer used in stories.</p>
                </ion-text>

                <div class="action-buttons">
                  <ion-button
                    fill="outline"
                    size="small"
                    (click)="scanOrphanedImages()"
                    [disabled]="isScanning">
                    <ion-icon name="scan-outline" slot="start"></ion-icon>
                    Scan
                  </ion-button>

                  <ion-button
                    fill="outline"
                    size="small"
                    color="secondary"
                    (click)="selectAllOrphanedImages()"
                    [disabled]="orphanedImages.length === 0">
                    <ion-icon name="checkbox-outline" slot="start"></ion-icon>
                    Select All
                  </ion-button>

                  <ion-button
                    fill="outline"
                    size="small"
                    color="medium"
                    (click)="deselectAllOrphanedImages()"
                    [disabled]="selectedOrphanedImages.size === 0">
                    <ion-icon name="square-outline" slot="start"></ion-icon>
                    Deselect All
                  </ion-button>

                  <ion-button
                    fill="solid"
                    size="small"
                    color="danger"
                    (click)="deleteSelectedOrphanedImages()"
                    [disabled]="selectedOrphanedImages.size === 0 || isScanning">
                    <ion-icon name="trash-outline" slot="start"></ion-icon>
                    Delete ({{ selectedOrphanedImages.size }})
                  </ion-button>
                </div>

                <ion-list *ngIf="orphanedImages.length > 0" class="media-list">
                  <ion-item
                    *ngFor="let image of orphanedImages"
                    button
                    (click)="toggleOrphanedImageSelection(image.id)">
                    <ion-checkbox
                      slot="start"
                      [checked]="selectedOrphanedImages.has(image.id)">
                    </ion-checkbox>
                    <ion-thumbnail slot="start">
                      <img [src]="'data:' + image.mimeType + ';base64,' + image.base64Data" [alt]="image.name">
                    </ion-thumbnail>
                    <ion-label>
                      <h3>{{ image.name }}</h3>
                      <p>{{ formatBytes(image.size) }} • {{ image.createdAt | date:'short' }}</p>
                    </ion-label>
                  </ion-item>
                </ion-list>

                <div *ngIf="orphanedImages.length === 0 && !isScanning" class="empty-state">
                  <ion-text color="medium">
                    <p>No orphaned images found or not yet scanned.</p>
                  </ion-text>
                </div>
              </ion-card-content>
            </ion-card>

            <!-- Duplicate Images -->
            <ion-card class="settings-section">
              <ion-card-header>
                <ion-card-title>Duplicate Images</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-text color="medium">
                  <p>Identical images with different IDs.</p>
                </ion-text>

                <div class="action-buttons">
                  <ion-button
                    fill="outline"
                    size="small"
                    (click)="scanDuplicateImages()"
                    [disabled]="isScanning">
                    <ion-icon name="copy-outline" slot="start"></ion-icon>
                    Duplikate suchen
                  </ion-button>

                  <ion-button
                    fill="outline"
                    size="small"
                    color="secondary"
                    (click)="selectAllDuplicates()"
                    [disabled]="duplicateImages.length === 0">
                    <ion-icon name="checkbox-outline" slot="start"></ion-icon>
                    Select All
                  </ion-button>

                  <ion-button
                    fill="outline"
                    size="small"
                    color="medium"
                    (click)="deselectAllDuplicates()"
                    [disabled]="selectedDuplicates.size === 0">
                    <ion-icon name="square-outline" slot="start"></ion-icon>
                    Deselect All
                  </ion-button>

                  <ion-button
                    fill="solid"
                    size="small"
                    color="danger"
                    (click)="deleteSelectedDuplicates()"
                    [disabled]="selectedDuplicates.size === 0 || isScanning">
                    <ion-icon name="trash-outline" slot="start"></ion-icon>
                    Delete Duplicates ({{ selectedDuplicates.size }})
                  </ion-button>
                </div>

                <ion-list *ngIf="duplicateImages.length > 0" class="media-list">
                  <ion-item
                    *ngFor="let duplicate of duplicateImages"
                    button
                    (click)="toggleDuplicateSelection(duplicate.originalId)">
                    <ion-checkbox
                      slot="start"
                      [checked]="selectedDuplicates.has(duplicate.originalId)">
                    </ion-checkbox>
                    <ion-thumbnail slot="start">
                      <img [src]="'data:image/jpeg;base64,' + duplicate.base64Data" [alt]="duplicate.name">
                    </ion-thumbnail>
                    <ion-label>
                      <h3>{{ duplicate.name }}</h3>
                      <p>
                        {{ formatBytes(duplicate.size) }} •
                        <ion-badge color="warning">{{ duplicate.duplicateIds.length }} Duplikate</ion-badge>
                      </p>
                    </ion-label>
                  </ion-item>
                </ion-list>

                <div *ngIf="duplicateImages.length === 0 && !isScanning" class="empty-state">
                  <ion-text color="medium">
                    <p>No duplicates found or not yet scanned.</p>
                  </ion-text>
                </div>
              </ion-card-content>
            </ion-card>

            <!-- Story Integrity -->
            <ion-card class="settings-section">
              <ion-card-header>
                <ion-card-title>Story Integrity</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-text color="medium">
                  <p>Check for damaged or incomplete stories.</p>
                </ion-text>

                <ion-button
                  fill="outline"
                  size="small"
                  (click)="checkIntegrity()"
                  [disabled]="isScanning">
                  <ion-icon name="search-outline" slot="start"></ion-icon>
                  Check Integrity
                </ion-button>

                <ion-list *ngIf="integrityIssues.length > 0" class="integrity-list">
                  <ion-item *ngFor="let issue of integrityIssues">
                    <ion-icon
                      [name]="issue.severity === 'high' ? 'close-circle-outline' : 'warning-outline'"
                      [color]="issue.severity === 'high' ? 'danger' : 'warning'"
                      slot="start">
                    </ion-icon>
                    <ion-label>
                      <h3>{{ issue.storyTitle }}</h3>
                      <p>{{ issue.description }}</p>
                      <ion-note>Schweregrad: {{ issue.severity }}</ion-note>
                    </ion-label>
                  </ion-item>
                </ion-list>

                <div *ngIf="integrityIssues.length === 0 && !isScanning" class="empty-state">
                  <ion-text color="success">
                    <p>All stories are intact or not yet checked.</p>
                  </ion-text>
                </div>
              </ion-card-content>
            </ion-card>

            <!-- Database Operations -->
            <ion-card class="settings-section">
              <ion-card-header>
                <ion-card-title>Database Operations</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div class="db-operations">
                  <ion-button
                    fill="outline"
                    expand="block"
                    (click)="compactDatabase()"
                    [disabled]="isScanning"
                    class="operation-button">
                    <ion-icon name="refresh-outline" slot="start"></ion-icon>
                    Datenbank komprimieren
                  </ion-button>

                  <ion-button
                    fill="outline"
                    expand="block"
                    color="secondary"
                    (click)="exportDatabase()"
                    [disabled]="isScanning"
                    class="operation-button">
                    <ion-icon name="download-outline" slot="start"></ion-icon>
                    Create Complete Export
                  </ion-button>
                </div>

                <ion-text color="medium">
                  <p>
                    <strong>Compress:</strong> Removes deleted data and reduces database size.<br>
                    <strong>Export:</strong> Creates a JSON file with all stories and images.
                  </p>
                </ion-text>
              </ion-card-content>
            </ion-card>
          </div>
        </div>
        </app-settings-content>

        <div class="settings-actions">
        <ion-button 
          expand="block" 
          color="primary" 
          (click)="saveSettings()" 
          [disabled]="!hasUnsavedChanges"
          class="save-button">
          <ion-icon name="save-outline" slot="start"></ion-icon>
          Save Settings
        </ion-button>
        
        <ion-button 
          expand="block" 
          fill="outline" 
          color="medium" 
          (click)="resetToDefaults()"
          class="reset-button">
          <ion-icon name="refresh-outline" slot="start"></ion-icon>
          Reset to Default
        </ion-button>
        </div>
      </ion-content>

      <ion-content *ngIf="!story">
        <div class="no-story">
          <ion-text color="medium">
            <p>Story not found.</p>
          </ion-text>
        </div>
      </ion-content>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      min-height: 100vh;
      background: transparent;
    }
    
    .ion-page {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: transparent;
    }
    
    ion-header {
      backdrop-filter: blur(15px);
      background: rgba(45, 45, 45, 0.85);
      box-shadow: 0 2px 20px rgba(0, 0, 0, 0.4);
      position: relative;
      z-index: 100;
    }
    
    ion-toolbar {
      --background: transparent;
      --color: #f8f9fa;
    }
    
    ion-title {
      background: linear-gradient(135deg, #f8f9fa 0%, #8bb4f8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    ion-content {
      --background: transparent !important;
      background: transparent !important;
      --padding-start: 16px;
      --padding-end: 16px;
      --padding-top: 16px;
      --padding-bottom: 16px;
      flex: 1;
    }
    
    ion-content::part(background) {
      background: transparent !important;
    }


    .story-info-card {
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.3) 0%, rgba(15, 15, 15, 0.3) 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      backdrop-filter: blur(8px) saturate(120%);
      -webkit-backdrop-filter: blur(8px) saturate(120%);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
      margin-bottom: 1rem;
      --color: #f8f9fa;
    }
    
    .story-info-card:hover {
      background: linear-gradient(135deg, rgba(25, 25, 25, 0.4) 0%, rgba(20, 20, 20, 0.4) 100%);
      border-color: rgba(71, 118, 230, 0.3);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      transform: translateY(-2px);
    }

    .settings-section {
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.3) 0%, rgba(15, 15, 15, 0.3) 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      backdrop-filter: blur(8px) saturate(120%);
      -webkit-backdrop-filter: blur(8px) saturate(120%);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
      margin-bottom: 1rem;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
      --color: #f8f9fa;
    }
    
    .settings-section:hover {
      background: linear-gradient(135deg, rgba(25, 25, 25, 0.4) 0%, rgba(20, 20, 20, 0.4) 100%);
      border-color: rgba(71, 118, 230, 0.3);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      transform: translateY(-2px);
    }
    
    /* Card Header Styling */
    ion-card-header {
      background: rgba(45, 45, 45, 0.3);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      padding: 1.2rem 1.5rem;
      border-radius: 12px 12px 0 0;
      position: relative;
      overflow: hidden;
      box-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
    }
    
    ion-card-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(139, 180, 248, 0.1), transparent);
      transition: left 0.6s ease;
    }
    
    ion-card:hover ion-card-header::before {
      left: 100%;
    }
    
    ion-card-title {
      color: #f8f9fa;
      font-size: 1.3rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin: 0;
      padding: 0;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      position: relative;
      display: inline-block;
    }
    
    ion-card-title::after {
      content: '';
      position: absolute;
      bottom: -5px;
      left: 0;
      width: 50px;
      height: 3px;
      background: linear-gradient(90deg, #4776e6 0%, #8bb4f8 100%);
      border-radius: 2px;
    }
    
    ion-card-content {
      background: transparent;
      padding: 1.5rem;
    }

    .setting-item {
      --background: transparent;
      --padding-start: 0;
      --padding-end: 0;
      margin: 1rem 0;
    }
    
    /* Make textareas transparent */
    ion-textarea {
      --background: rgba(30, 30, 30, 0.3);
      --color: #f8f9fa;
      --placeholder-color: #adb5bd;
      --placeholder-opacity: 0.8;
      backdrop-filter: blur(5px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 0.75rem;
      transition: all 0.3s ease;
    }
    
    ion-textarea:hover,
    ion-textarea:focus {
      --background: rgba(30, 30, 30, 0.4);
      border-color: rgba(71, 118, 230, 0.5);
      box-shadow: 0 0 0 2px rgba(71, 118, 230, 0.2);
    }
    
    .settings-textarea {
      margin-top: 1rem;
      font-family: monospace;
      font-size: 0.9rem;
    }
    
    .settings-textarea.large {
      min-height: 300px;
    }
    
    /* Also make ion-input transparent */
    ion-input {
      --background: rgba(30, 30, 30, 0.3);
      --color: #f8f9fa;
      --placeholder-color: #adb5bd;
      --placeholder-opacity: 0.8;
      backdrop-filter: blur(5px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 0.5rem;
      transition: all 0.3s ease;
    }
    
    ion-input:hover,
    ion-input:focus {
      --background: rgba(30, 30, 30, 0.4);
      border-color: rgba(71, 118, 230, 0.5);
      box-shadow: 0 0 0 2px rgba(71, 118, 230, 0.2);
    }

    .radio-section {
      --background: transparent;
      --padding-start: 0;
      --padding-end: 0;
      margin-bottom: 0.5rem;
    }

    .settings-textarea {
      --background: rgba(30, 30, 30, 0.3) !important;
      --color: #f8f9fa !important;
      --placeholder-color: #adb5bd !important;
      --placeholder-opacity: 0.8 !important;
      --padding-start: 16px;
      --padding-end: 16px;
      --padding-top: 16px;
      --padding-bottom: 16px;
      backdrop-filter: blur(5px) !important;
      -webkit-backdrop-filter: blur(5px) !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 0.95rem;
      margin-top: 1rem;
      background: rgba(30, 30, 30, 0.3) !important;
    }

    .settings-textarea.large {
      min-height: 200px;
    }

    .char-count {
      display: block;
      text-align: right;
      margin-top: 0.5rem;
    }

    .template-warning {
      --background: rgba(255, 193, 7, 0.1);
      margin-top: 1rem;
    }

    .settings-actions {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin: 2rem auto;
      max-width: 800px;
      padding: 0 1rem;
    }

    .save-button {
      --background: #0d6efd;
    }

    .reset-button {
      --color: #6c757d;
      --border-color: #6c757d;
    }

    .no-story {
      text-align: center;
      padding: 3rem;
    }

    ion-radio-group ion-item {
      --background: transparent;
      --padding-start: 0;
      --padding-end: 0;
    }

    .template-placeholders {
      margin: 1rem 0;
      padding: 1rem;
      background: rgba(30, 30, 30, 0.3);
      backdrop-filter: blur(5px);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .placeholder-chip {
      width: 100%;
      justify-content: center;
      margin-bottom: 0.5rem;
      --background: transparent;
      --color: #ffc107;
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
    }

    /* DB Maintenance Styles */
    .stats-grid {
      margin-top: 1rem;
    }

    .stat-item {
      text-align: center;
      padding: 1rem;
      background: rgba(30, 30, 30, 0.3);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      margin-bottom: 0.5rem;
    }

    .stat-item h3 {
      font-size: 1.5rem;
      font-weight: bold;
      margin: 0 0 0.25rem 0;
    }

    .progress-card {
      background: linear-gradient(135deg, rgba(71, 118, 230, 0.1) 0%, rgba(139, 180, 248, 0.1) 100%);
      border-color: rgba(71, 118, 230, 0.3);
    }

    .progress-container {
      text-align: center;
      padding: 1rem 0;
    }

    .progress-container h4 {
      margin: 0 0 0.5rem 0;
      color: #f8f9fa;
    }

    .progress-container ion-progress-bar {
      margin: 1rem 0;
      --progress-background: rgba(71, 118, 230, 0.8);
      --background: rgba(255, 255, 255, 0.2);
      height: 8px;
      border-radius: 4px;
    }

    .action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 1rem 0;
    }

    .action-buttons ion-button {
      --border-radius: 6px;
    }

    .media-list {
      background: transparent;
      margin-top: 1rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .media-list ion-item {
      --background: rgba(30, 30, 30, 0.3);
      --border-color: rgba(255, 255, 255, 0.1);
      --color: #f8f9fa;
      transition: all 0.3s ease;
    }

    .media-list ion-item:hover {
      --background: rgba(40, 40, 40, 0.4);
      cursor: pointer;
    }

    .media-list ion-thumbnail {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .media-list ion-thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .integrity-list {
      background: transparent;
      margin-top: 1rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .integrity-list ion-item {
      --background: rgba(30, 30, 30, 0.3);
      --border-color: rgba(255, 255, 255, 0.1);
      --color: #f8f9fa;
    }

    .empty-state {
      text-align: center;
      padding: 2rem;
      background: rgba(30, 30, 30, 0.2);
      border-radius: 8px;
      margin-top: 1rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .db-operations {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .operation-button {
      --border-radius: 8px;
      height: 48px;
    }

    @media (max-width: 768px) {
      .settings-actions {
        padding: 0 0.5rem;
      }
      
      .settings-textarea.large {
        min-height: 150px;
      }

      .action-buttons {
        flex-direction: column;
      }

      .action-buttons ion-button {
        width: 100%;
      }

      .stat-item h3 {
        font-size: 1.2rem;
      }

      .media-list ion-thumbnail {
        width: 48px;
        height: 48px;
      }
    }
  `]
})
export class StorySettingsComponent implements OnInit {
  story: Story | null = null;
  settings: StorySettings = { ...DEFAULT_STORY_SETTINGS };
  hasUnsavedChanges = false;
  private originalSettings!: StorySettings;
  selectedTab = 'general';
  tabItems: TabItem[] = [
    { value: 'general', icon: 'information-circle-outline', label: 'General' },
    { value: 'cover-image', icon: 'image-outline', label: 'Cover Image' },
    { value: 'ai-system', icon: 'chatbox-outline', label: 'AI System' },
    { value: 'beat-config', icon: 'settings-outline', label: 'Beat Config' },
    { value: 'db-maintenance', icon: 'server-outline', label: 'DB Maintenance' }
  ];
  
  placeholders = [
    '{systemMessage}',
    '{codexEntries}',
    '{storySoFar}',
    '{storyTitle}',
    '{sceneFullText}',
    '{wordCount}',
    '{prompt}',
    '{pointOfView}',
    '{writingStyle}'
  ];

  // DB Maintenance properties
  orphanedImages: OrphanedImage[] = [];
  databaseStats: DatabaseStats | null = null;
  duplicateImages: DuplicateImage[] = [];
  integrityIssues: IntegrityIssue[] = [];
  isScanning = false;
  scanProgress = { operation: '', progress: 0, message: '' };
  selectedOrphanedImages = new Set<string>();
  selectedDuplicates = new Set<string>();

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storyService = inject(StoryService);
  private readonly dbMaintenanceService = inject(DbMaintenanceService);

  constructor() {
    addIcons({ 
      arrowBack, saveOutline, refreshOutline, checkmarkCircleOutline,
      warningOutline, informationCircleOutline, codeSlashOutline,
      settingsOutline, chatboxOutline, documentTextOutline, serverOutline,
      scanOutline, trashOutline, downloadOutline, statsChartOutline,
      copyOutline, searchOutline, closeCircleOutline, checkboxOutline,
      squareOutline, imageOutline
    });
  }

  async ngOnInit(): Promise<void> {
    const storyId = this.route.snapshot.paramMap.get('id');
    if (storyId) {
      this.story = await this.storyService.getStory(storyId);
      if (this.story) {
        // Load existing settings or use defaults
        this.settings = this.story.settings 
          ? { ...this.story.settings } 
          : { ...DEFAULT_STORY_SETTINGS };
        this.originalSettings = { ...this.settings };
      } else {
        this.router.navigate(['/']);
      }
    }

    // Subscribe to DB maintenance progress
    this.dbMaintenanceService.operationProgress$.subscribe(progress => {
      this.scanProgress = progress;
      this.isScanning = progress.progress > 0 && progress.progress < 100;
    });
  }

  onSettingsChange(): void {
    this.hasUnsavedChanges = 
      JSON.stringify(this.settings) !== JSON.stringify(this.originalSettings);
  }

  async saveSettings(): Promise<void> {
    if (!this.story) return;

    // Update story with new settings
    this.story.settings = { ...this.settings };
    await this.storyService.updateStory(this.story);
    
    this.originalSettings = { ...this.settings };
    this.hasUnsavedChanges = false;
  }

  resetToDefaults(): void {
    if (confirm('Do you really want to reset the settings to default values?')) {
      this.settings = { ...DEFAULT_STORY_SETTINGS };
      this.onSettingsChange();
    }
  }

  goBack(): void {
    if (this.hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Do you really want to leave the page?')) {
        this.navigateBack();
      }
    } else {
      this.navigateBack();
    }
  }

  private navigateBack(): void {
    if (this.story) {
      this.router.navigate(['/stories/editor', this.story.id]);
    } else {
      this.router.navigate(['/']);
    }
  }

  // DB Maintenance methods
  async scanOrphanedImages(): Promise<void> {
    try {
      this.orphanedImages = await this.dbMaintenanceService.findOrphanedImages();
      this.selectedOrphanedImages.clear();
    } catch (error) {
      console.error('Error scanning orphaned images:', error);
    }
  }

  async loadDatabaseStats(): Promise<void> {
    try {
      this.databaseStats = await this.dbMaintenanceService.getDatabaseStats();
    } catch (error) {
      console.error('Error loading database stats:', error);
    }
  }

  async scanDuplicateImages(): Promise<void> {
    try {
      this.duplicateImages = await this.dbMaintenanceService.findDuplicateImages();
      this.selectedDuplicates.clear();
    } catch (error) {
      console.error('Error scanning duplicate images:', error);
    }
  }

  async checkIntegrity(): Promise<void> {
    try {
      this.integrityIssues = await this.dbMaintenanceService.checkStoryIntegrity();
    } catch (error) {
      console.error('Error checking integrity:', error);
    }
  }

  async compactDatabase(): Promise<void> {
    if (confirm('Do you really want to compress the database? This may take some time.')) {
      try {
        const result = await this.dbMaintenanceService.compactDatabase();
        alert(`Compression successful! ${result.saved} documents removed.`);
        await this.loadDatabaseStats(); // Refresh stats
      } catch (error) {
        console.error('Error compacting database:', error);
        alert('Error during database compression.');
      }
    }
  }

  async deleteSelectedOrphanedImages(): Promise<void> {
    const selectedIds = Array.from(this.selectedOrphanedImages);
    if (selectedIds.length === 0) return;

    if (confirm(`Do you really want to delete ${selectedIds.length} orphaned images?`)) {
      try {
        const deletedCount = await this.dbMaintenanceService.deleteOrphanedImages(selectedIds);
        alert(`${deletedCount} images successfully deleted.`);
        await this.scanOrphanedImages(); // Refresh list
        await this.loadDatabaseStats(); // Refresh stats
      } catch (error) {
        console.error('Error deleting orphaned images:', error);
        alert('Error deleting images.');
      }
    }
  }

  async deleteSelectedDuplicates(): Promise<void> {
    const selectedDuplicates = this.duplicateImages.filter(dup => 
      this.selectedDuplicates.has(dup.originalId)
    );
    
    if (selectedDuplicates.length === 0) return;

    const totalToDelete = selectedDuplicates.reduce((sum, dup) => sum + dup.duplicateIds.length, 0);
    
    if (confirm(`Do you really want to delete ${totalToDelete} duplicates?`)) {
      try {
        const deletedCount = await this.dbMaintenanceService.deleteDuplicateImages(selectedDuplicates);
        alert(`${deletedCount} duplicates successfully deleted.`);
        await this.scanDuplicateImages(); // Refresh list
        await this.loadDatabaseStats(); // Refresh stats
      } catch (error) {
        console.error('Error deleting duplicates:', error);
        alert('Error deleting duplicates.');
      }
    }
  }

  async exportDatabase(): Promise<void> {
    try {
      const exportData = await this.dbMaintenanceService.exportDatabase();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `creative-writer-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting database:', error);
      alert('Error exporting database.');
    }
  }

  toggleOrphanedImageSelection(imageId: string): void {
    if (this.selectedOrphanedImages.has(imageId)) {
      this.selectedOrphanedImages.delete(imageId);
    } else {
      this.selectedOrphanedImages.add(imageId);
    }
  }

  toggleDuplicateSelection(originalId: string): void {
    if (this.selectedDuplicates.has(originalId)) {
      this.selectedDuplicates.delete(originalId);
    } else {
      this.selectedDuplicates.add(originalId);
    }
  }

  selectAllOrphanedImages(): void {
    this.orphanedImages.forEach(img => this.selectedOrphanedImages.add(img.id));
  }

  deselectAllOrphanedImages(): void {
    this.selectedOrphanedImages.clear();
  }

  selectAllDuplicates(): void {
    this.duplicateImages.forEach(dup => this.selectedDuplicates.add(dup.originalId));
  }

  deselectAllDuplicates(): void {
    this.selectedDuplicates.clear();
  }

  formatBytes(bytes: number): string {
    return this.dbMaintenanceService.formatBytes(bytes);
  }

  // Cover Image methods
  getCoverImageDataUrl(): string | null {
    if (!this.story?.coverImage) return null;
    return `data:image/png;base64,${this.story.coverImage}`;
  }

  getCoverImageFileName(): string | null {
    if (!this.story?.coverImage) return null;
    return 'cover-image.png'; // Default filename since we don't store original filename
  }

  getCoverImageFileSize(): number {
    if (!this.story?.coverImage) return 0;
    // Rough estimation: base64 is ~33% larger than binary
    return Math.floor((this.story.coverImage.length * 3) / 4);
  }

  onCoverImageSelected(result: ImageUploadResult): void {
    if (!this.story) return;
    
    this.story.coverImage = result.base64Data;
    this.hasUnsavedChanges = true;
  }

  onCoverImageRemoved(): void {
    if (!this.story) return;
    
    this.story.coverImage = undefined;
    this.hasUnsavedChanges = true;
  }
}