import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonChip, IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, statsChart, warning, checkmarkCircle, colorPaletteOutline, documentTextOutline, cloudOutline, listOutline, archiveOutline, globeOutline, logoGoogle, libraryOutline, hardwareChip, chatbubbleOutline, gitNetworkOutline, cloudUploadOutline, sparklesOutline } from 'ionicons/icons';
import { SettingsService } from '../core/services/settings.service';
import { ModelService } from '../core/services/model.service';
import { Settings } from '../core/models/settings.interface';
import { ModelOption } from '../core/models/model.interface';
import { SettingsTabsComponent, TabItem } from '../ui/components/settings-tabs.component';
import { SettingsContentComponent } from '../ui/components/settings-content.component';
import { BackgroundService } from '../shared/services/background.service';
import { DatabaseBackupComponent } from '../ui/components/database-backup.component';
import { ApiSettingsComponent } from '../ui/settings/api-settings.component';
import { UiSettingsComponent } from '../ui/settings/ui-settings.component';
import { PromptsSettingsComponent } from '../ui/settings/prompts-settings.component';
import { SceneGenerationSettingsComponent } from '../ui/settings/scene-generation-settings.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonChip, IonLabel,
    SettingsTabsComponent, SettingsContentComponent, DatabaseBackupComponent,
    ApiSettingsComponent, UiSettingsComponent, PromptsSettingsComponent, SceneGenerationSettingsComponent
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
        <ion-title>Settings</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" color="medium" (click)="goToAILogs()" title="AI Request Logs">
            <ion-icon name="stats-chart" slot="start"></ion-icon>
            AI Logs
          </ion-button>
          <ion-chip [color]="hasUnsavedChanges ? 'warning' : 'success'">
            <ion-icon [name]="hasUnsavedChanges ? 'warning' : 'checkmark-circle'" slot="start"></ion-icon>
            <ion-label>{{ hasUnsavedChanges ? 'Not saved' : 'Saved' }}</ion-label>
          </ion-chip>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Tab Navigation -->
      <app-settings-tabs 
        [tabs]="tabItems" 
        [(selectedTab)]="selectedTab">
      </app-settings-tabs>

      <app-settings-content>
        <!-- Tab Content -->
        <div [ngSwitch]="selectedTab">
          
          <!-- Models Tab -->
          <div *ngSwitchCase="'models'">
            <app-api-settings
              [settings]="settings"
              [combinedModels]="combinedModels"
              [replicateModels]="replicateModels"
              [loadingModels]="loadingModels"
              [modelLoadError]="modelLoadError"
              (settingsChange)="onSettingsChange()"
              (modelsLoaded)="onModelsLoaded($event)">
            </app-api-settings>
          </div>
          
          <!-- Appearance Tab -->
          <div *ngSwitchCase="'appearance'">
            <app-ui-settings
              [settings]="settings"
              (settingsChange)="onSettingsChange()">
            </app-ui-settings>
          </div>
          
          <!-- Scene Title Tab -->
          <div *ngSwitchCase="'scene-title'">
            <app-prompts-settings
              [settings]="settings"
              [combinedModels]="combinedModels"
              [loadingModels]="loadingModels"
              [modelsDisabled]="(!settings.openRouter.enabled || !settings.openRouter.apiKey) && (!settings.googleGemini.enabled || !settings.googleGemini.apiKey)"
              (settingsChange)="onSettingsChange()">
            </app-prompts-settings>
          </div>

          <!-- Scene Summary Tab -->
          <div *ngSwitchCase="'scene-summary'">
            <!-- Using the same prompts component, it handles both scene title and summary -->
            <app-prompts-settings
              [settings]="settings"
              [combinedModels]="combinedModels"
              [loadingModels]="loadingModels"
              [modelsDisabled]="(!settings.openRouter.enabled || !settings.openRouter.apiKey) && (!settings.googleGemini.enabled || !settings.googleGemini.apiKey)"
              (settingsChange)="onSettingsChange()">
            </app-prompts-settings>
          </div>

          <!-- Scene Generation Tab -->
          <div *ngSwitchCase="'scene-generation'">
            <app-scene-generation-settings
              [settings]="settings"
              [combinedModels]="combinedModels"
              [loadingModels]="loadingModels"
              [modelsDisabled]="(!settings.openRouter.enabled || !settings.openRouter.apiKey) && (!settings.googleGemini.enabled || !settings.googleGemini.apiKey)"
              (settingsChange)="onSettingsChange()">
            </app-scene-generation-settings>
          </div>

          <!-- Backup & Restore Tab -->
          <div *ngSwitchCase="'backup'">
            <app-database-backup></app-database-backup>
          </div>
        </div>

        <!-- Actions -->
        <div class="settings-actions">
          <ion-button expand="block" color="primary" (click)="saveSettings()" [disabled]="!hasUnsavedChanges">
            Save Settings
          </ion-button>
          <ion-button expand="block" fill="outline" color="medium" (click)="resetSettings()">
            Reset to Default
          </ion-button>
        </div>
      </app-settings-content>
    </ion-content>
    </div>
  `,
  styles: [`
    :host {
      /* Remove static background to allow dynamic background from BackgroundService */
      background: transparent;
      min-height: 100vh;
      display: block;
    }
    
    .ion-page {
      background: transparent;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    ion-header {
      --ion-toolbar-background: rgba(45, 45, 45, 0.3);
      --ion-toolbar-color: #f8f9fa;
      backdrop-filter: blur(15px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
      position: relative;
      z-index: 100;
    }
    
    ion-toolbar {
      --background: transparent;
      --padding-start: 16px;
      --padding-end: 16px;
    }
    
    ion-title {
      font-size: 1.1rem;
      font-weight: 600;
      line-height: 1.2;
      padding: 0;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      background: linear-gradient(135deg, #f8f9fa 0%, #8bb4f8 50%, #4776e6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    
    ion-button {
      --color: #f8f9fa;
      --background: rgba(255, 255, 255, 0.1);
      --background-hover: rgba(255, 255, 255, 0.2);
      --border-radius: 8px;
      margin: 0 4px;
      transition: all 0.2s ease;
    }
    
    ion-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    ion-icon {
      font-size: 1.2rem;
    }
    
    ion-content {
      --background: transparent;
      --color: #e0e0e0;
    }


    /* Ensure ng-dropdown-panel appears above everything */
    :global(.ng-dropdown-panel-open) {
      overflow: visible !important;
    }


    ion-card {
      margin-bottom: 1rem;
      background: linear-gradient(135deg, rgba(45, 45, 45, 0.4) 0%, rgba(30, 30, 30, 0.4) 100%);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(139, 180, 248, 0.2);
      border-radius: 12px;
      overflow: visible !important;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      position: relative;
      --ion-card-header-color: #ffffff;
    }
    
    ion-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(139, 180, 248, 0.05) 0%, rgba(71, 118, 230, 0.05) 100%);
      border-radius: 12px;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }
    
    ion-card:hover {
      border-color: rgba(139, 180, 248, 0.3);
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(71, 118, 230, 0.2);
    }
    
    ion-card:hover::before {
      opacity: 1;
    }

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
      overflow: visible !important;
      background: transparent;
      padding: 1.5rem;
    }

    ion-item {
      --background: rgba(20, 20, 20, 0.3);
      --color: #e0e0e0;
      --border-color: rgba(139, 180, 248, 0.1);
      --inner-border-width: 0 0 1px 0;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      margin: 0.5rem 0;
      border-radius: 8px;
      transition: all 0.2s ease;
    }
    
    ion-item:hover {
      --background: rgba(30, 30, 30, 0.4);
      --border-color: rgba(139, 180, 248, 0.2);
    }

    ion-item.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    ion-label {
      color: #e0e0e0 !important;
      font-weight: 500;
    }

    ion-input {
      --color: #e0e0e0;
      --placeholder-color: #6c757d;
      --background: rgba(0, 0, 0, 0.2);
      --padding-start: 8px;
      --padding-end: 8px;
      border-radius: 6px;
    }
    
    ion-input:focus-within {
      --background: rgba(0, 0, 0, 0.3);
    }

    ion-toggle {
      --background: rgba(60, 60, 60, 0.6);
      --background-checked: linear-gradient(135deg, #4776e6 0%, #8bb4f8 100%);
      --handle-background: #f8f9fa;
      --handle-background-checked: #ffffff;
      --handle-box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      --handle-box-shadow-checked: 0 2px 12px rgba(139, 180, 248, 0.4);
    }
    
    ion-select {
      --placeholder-color: #6c757d;
      color: #e0e0e0;
    }
    
    ion-range {
      --bar-background: rgba(60, 60, 60, 0.4);
      --bar-background-active: linear-gradient(90deg, #4776e6 0%, #8bb4f8 100%);
      --bar-height: 4px;
      --knob-background: #8bb4f8;
      --knob-box-shadow: 0 2px 8px rgba(139, 180, 248, 0.3);
      --knob-size: 20px;
    }
    
    ion-textarea {
      --color: #e0e0e0;
      --placeholder-color: #6c757d;
      --background: rgba(0, 0, 0, 0.2);
      --padding-start: 8px;
      --padding-end: 8px;
      border-radius: 6px;
    }
    
    ion-chip {
      --background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(139, 180, 248, 0.1) 100%);
      --color: #e0e0e0;
      border: 1px solid rgba(139, 180, 248, 0.2);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }
    
    ion-chip[color="success"] {
      --background: linear-gradient(135deg, rgba(40, 167, 69, 0.2) 0%, rgba(81, 207, 102, 0.2) 100%);
      --color: #51cf66;
      border-color: rgba(81, 207, 102, 0.3);
    }
    
    ion-chip[color="warning"] {
      --background: linear-gradient(135deg, rgba(255, 193, 7, 0.2) 0%, rgba(255, 152, 0, 0.2) 100%);
      --color: #ffc107;
      border-color: rgba(255, 193, 7, 0.3);
    }

    .settings-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0;
    }

    .settings-row.disabled {
      opacity: 0.5;
    }

    .settings-actions {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 2rem;
      padding: 0 1rem;
    }
    
    .settings-actions ion-button {
      --background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(139, 180, 248, 0.1) 100%);
      --background-hover: linear-gradient(135deg, rgba(71, 118, 230, 0.2) 0%, rgba(139, 180, 248, 0.2) 100%);
      --background-activated: linear-gradient(135deg, rgba(71, 118, 230, 0.3) 0%, rgba(139, 180, 248, 0.3) 100%);
      --color: #e0e0e0;
      --border-radius: 12px;
      border: 1px solid rgba(139, 180, 248, 0.3);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      font-weight: 600;
      letter-spacing: 0.5px;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      position: relative;
      overflow: hidden;
    }
    
    .settings-actions ion-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.6s ease;
    }
    
    .settings-actions ion-button:hover::before {
      left: 100%;
    }
    
    .settings-actions ion-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(71, 118, 230, 0.3);
      border-color: rgba(139, 180, 248, 0.5);
    }
    
    .settings-actions ion-button[color="primary"] {
      --background: linear-gradient(135deg, #4776e6 0%, #8bb4f8 100%);
      --background-hover: linear-gradient(135deg, #3a5fd4 0%, #7ca3e6 100%);
      --color: white;
      border: none;
      box-shadow: 0 4px 15px rgba(71, 118, 230, 0.3);
    }
    
    .settings-actions ion-button[color="primary"]:hover {
      box-shadow: 0 8px 25px rgba(71, 118, 230, 0.4);
    }
    
    .settings-actions ion-button[color="primary"]:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    
    .settings-actions ion-button[fill="outline"][color="medium"] {
      --background: transparent;
      --color: #adb5bd;
      border-color: rgba(173, 181, 189, 0.3);
    }
    
    .settings-actions ion-button[fill="outline"][color="medium"]:hover {
      --background: rgba(173, 181, 189, 0.1);
      border-color: rgba(173, 181, 189, 0.5);
    }
    
    .settings-actions ion-button[fill="outline"][color="warning"] {
      --background: transparent;
      --color: #ffc107;
      border-color: rgba(255, 193, 7, 0.3);
    }
    
    .settings-actions ion-button[fill="outline"][color="warning"]:hover {
      --background: rgba(255, 193, 7, 0.1);
      border-color: rgba(255, 193, 7, 0.5);
      box-shadow: 0 6px 20px rgba(255, 193, 7, 0.2);
    }

    .model-selection-wrapper {
      padding: 1rem;
      margin: 0.5rem 0;
      background: rgba(20, 20, 20, 0.3);
      border: 1px solid rgba(139, 180, 248, 0.15);
      border-radius: 10px;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      transition: all 0.3s ease;
    }
    
    .model-selection-wrapper:hover {
      border-color: rgba(139, 180, 248, 0.25);
      background: rgba(25, 25, 25, 0.4);
    }
    
    .model-selection-wrapper.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .model-selection-container {
      width: 100%;
    }
    
    .model-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      width: 100%;
    }

    .model-info {
      margin-top: 0.5rem;
      padding: 0.75rem;
      background: rgba(15, 15, 15, 0.3);
      border-radius: 6px;
      border: 1px solid rgba(139, 180, 248, 0.1);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
    }
    
    .model-info.disabled {
      opacity: 0.6;
    }

    .model-info p {
      margin: 0.25rem 0;
      font-size: 0.85rem;
    }
    
    .error-text {
      color: #ff6b6b !important;
      font-weight: 500;
      text-shadow: 0 0 10px rgba(255, 107, 107, 0.3);
    }

    .info-text {
      color: #8bb4f8;
      opacity: 0.8;
    }

    .model-option {
      padding: 0.5rem 0;
    }

    .model-option-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .provider-icon {
      font-size: 1.2rem;
      width: 1.2rem;
      height: 1.2rem;
    }

    .provider-icon.gemini {
      color: #4285f4; /* Google Blue */
    }

    .provider-icon.openrouter {
      color: #6467f2; /* OpenRouter Cornflower Blue */
    }

    .provider-icon.claude {
      color: #C15F3C; /* Claude Crail */
    }

    .provider-icon.ollama {
      color: #9333ea; /* Purple for local inference */
    }

    .provider-icon.replicate {
      color: #f59e0b; /* Amber for cloud ML */
    }

    /* Card title icons styling */
    ion-card-title .provider-icon {
      font-size: 1.3rem;
      width: 1.3rem;
      height: 1.3rem;
      vertical-align: middle;
    }

    .model-label {
      font-weight: 500;
      color: #e0e0e0;
    }

    .model-option-details {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
      color: #999;
      margin-bottom: 0.25rem;
    }

    .model-description {
      font-size: 0.8rem;
      color: #777;
      line-height: 1.3;
    }

    .content-filter-section {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(139, 180, 248, 0.2);
      position: relative;
    }
    
    .content-filter-section::before {
      content: '';
      position: absolute;
      top: -1px;
      left: 20%;
      right: 20%;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(139, 180, 248, 0.4), transparent);
    }

    .section-title {
      background: linear-gradient(135deg, #f8f9fa 0%, #8bb4f8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-size: 1.1rem;
      font-weight: 700;
      margin: 0 0 1rem 0;
      padding: 0 1rem;
      letter-spacing: 0.3px;
      text-shadow: 0 2px 8px rgba(139, 180, 248, 0.2);
    }
    
    .model-option {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    
    .model-name {
      font-weight: 500;
      color: #e0e0e0;
    }
    
    .model-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
      color: #9ca3af;
    }
    
    .model-cost {
      color: #10b981;
    }
    
    .model-context {
      color: #6b7280;
    }
    
    /* ng-select custom styling for cyberpunk theme */
    :global(.ng-select) {
      font-size: 1rem;
      position: relative !important;
    }
    
    /* Ensure dropdown appears above modals and other overlays */
    :global(.ng-select.ng-select-opened > .ng-select-container) {
      z-index: 1050 !important;
    }
    
    :global(.ng-select-custom) {
      width: 100% !important;
      display: block !important;
    }
    
    :global(.ng-select.ng-select-single .ng-select-container) {
      height: auto !important;
      min-height: 45px !important;
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.4) 0%, rgba(15, 15, 15, 0.4) 100%) !important;
      border: 1px solid rgba(139, 180, 248, 0.2) !important;
      border-radius: 8px !important;
      position: relative !important;
      z-index: 1001 !important;
      backdrop-filter: blur(5px) !important;
      -webkit-backdrop-filter: blur(5px) !important;
      transition: all 0.3s ease !important;
    }
    
    :global(.ng-select.ng-select-single .ng-select-container:hover) {
      border-color: rgba(139, 180, 248, 0.3) !important;
      background: linear-gradient(135deg, rgba(25, 25, 25, 0.5) 0%, rgba(20, 20, 20, 0.5) 100%) !important;
    }
    
    :global(.ng-select .ng-select-container .ng-value-container) {
      background: transparent !important;
      padding-left: 0.75rem !important;
    }
    
    :global(.ng-select .ng-select-container .ng-value-container .ng-input > input) {
      color: #e0e0e0 !important;
      background: transparent !important;
    }
    
    :global(.ng-select .ng-select-container .ng-value-container .ng-placeholder) {
      color: #6c757d !important;
    }
    
    :global(.ng-select .ng-select-container .ng-value-container .ng-value) {
      color: #e0e0e0 !important;
      background: transparent !important;
    }
    
    :global(.ng-select .ng-arrow-wrapper) {
      width: 25px;
    }
    
    :global(.ng-select .ng-arrow-wrapper .ng-arrow) {
      border-color: #8bb4f8 transparent transparent;
    }
    
    :global(.ng-select.ng-select-focused .ng-select-container) {
      border-color: rgba(139, 180, 248, 0.5) !important;
      box-shadow: 0 0 0 3px rgba(139, 180, 248, 0.2) !important;
      background: linear-gradient(135deg, rgba(30, 30, 30, 0.5) 0%, rgba(25, 25, 25, 0.5) 100%) !important;
    }
    
    :global(.ng-select.ng-select-disabled .ng-select-container) {
      background: rgba(20, 20, 20, 0.2) !important;
      cursor: not-allowed;
      opacity: 0.5;
    }
    
    :global(.ng-dropdown-panel) {
      background: linear-gradient(135deg, rgba(35, 35, 35, 0.95) 0%, rgba(25, 25, 25, 0.95) 100%) !important;
      border: 1px solid rgba(139, 180, 248, 0.3) !important;
      border-radius: 8px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(139, 180, 248, 0.2) !important;
      z-index: 100000 !important;
      position: fixed !important;
      max-height: 400px !important;
      overflow-y: auto !important;
      backdrop-filter: blur(15px) !important;
      -webkit-backdrop-filter: blur(15px) !important;
    }
    
    :global(.ng-dropdown-panel .ng-dropdown-panel-items) {
      background: transparent !important;
    }
    
    :global(.ng-dropdown-panel .ng-dropdown-panel-items .ng-option) {
      color: #e0e0e0 !important;
      background: rgba(30, 30, 30, 0.3) !important;
      padding: 0.75rem !important;
      border-bottom: 1px solid rgba(139, 180, 248, 0.1);
      transition: all 0.2s ease !important;
    }
    
    :global(.ng-dropdown-panel .ng-dropdown-panel-items .ng-option:last-child) {
      border-bottom: none;
    }
    
    :global(.ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-highlighted) {
      background: linear-gradient(135deg, rgba(71, 118, 230, 0.3) 0%, rgba(139, 180, 248, 0.3) 100%) !important;
      color: #f8f9fa !important;
      border-color: rgba(139, 180, 248, 0.2);
    }
    
    :global(.ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-selected) {
      background: linear-gradient(135deg, #4776e6 0%, #8bb4f8 100%) !important;
      color: white !important;
    }
    
    :global(.ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-selected.ng-option-highlighted) {
      background: linear-gradient(135deg, #3a5fd4 0%, #7ca3e6 100%) !important;
      color: white !important;
    }

    .prompt-help {
      margin-top: 0.5rem;
      font-size: 0.8rem;
      color: var(--ion-color-medium);
      font-style: italic;
    }

    .model-info-small {
      margin-top: 0.5rem;
    }

    .model-info-small .info-text {
      margin: 0;
      font-size: 0.8rem;
      color: var(--ion-color-medium);
      font-style: italic;
    }

    /* Mobile responsive adjustments */
    .appearance-section {
      padding: 0.5rem 0;
    }

    .appearance-section h3 {
      color: #f8f9fa;
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .appearance-description {
      color: #adb5bd;
      font-size: 0.9rem;
      margin-bottom: 1rem;
      line-height: 1.4;
    }

    @media (max-width: 768px) {
      .settings-row {
        grid-template-columns: 1fr;
      }

      .model-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
    }
  `]
})
export class SettingsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private settingsService = inject(SettingsService);
  private modelService = inject(ModelService);
  private backgroundService = inject(BackgroundService);

  settings: Settings;
  hasUnsavedChanges = false;
  private originalSettings!: Settings;
  private subscription: Subscription = new Subscription();
  
  // Model loading state
  replicateModels: ModelOption[] = [];
  combinedModels: ModelOption[] = [];
  loadingModels = false;
  modelLoadError: string | null = null;
  
  // Tab control
  selectedTab = 'models';
  tabItems: TabItem[] = [
    { value: 'models', icon: 'cloud-outline', label: 'AI Models' },
    { value: 'appearance', icon: 'color-palette-outline', label: 'Appearance' },
    { value: 'scene-title', icon: 'document-text-outline', label: 'Scene Titles' },
    { value: 'scene-summary', icon: 'list-outline', label: 'Scene Summary' },
    { value: 'scene-generation', icon: 'sparkles-outline', label: 'Scene Generation' },
    { value: 'backup', icon: 'archive-outline', label: 'Backup & Restore' }
  ];

  constructor() {
    this.settings = this.settingsService.getSettings();
    // Register Ionic icons
    addIcons({ arrowBack, statsChart, warning, checkmarkCircle, colorPaletteOutline, documentTextOutline, cloudOutline, listOutline, archiveOutline, globeOutline, logoGoogle, libraryOutline, hardwareChip, chatbubbleOutline, gitNetworkOutline, cloudUploadOutline, sparklesOutline });
  }

  ngOnInit(): void {
    // Subscribe to settings changes
    this.subscription.add(
      this.settingsService.settings$.subscribe(settings => {
        this.settings = { ...settings };
        this.originalSettings = JSON.parse(JSON.stringify(settings));
        this.hasUnsavedChanges = false;
        
        
        // Ensure appearance object exists
        if (!this.settings.appearance) {
          this.settings.appearance = { 
            textColor: '#e0e0e0',
            backgroundImage: 'none'
          };
        }

        if (!this.settings.favoriteModelLists) {
          this.settings.favoriteModelLists = {
            beatInput: [...(this.settings.favoriteModels ?? [])]
          };
        } else if (!Array.isArray(this.settings.favoriteModelLists.beatInput)) {
          this.settings.favoriteModelLists.beatInput = [...(this.settings.favoriteModels ?? [])];
        }
      })
    );
    
    // Subscribe to model loading state
    this.subscription.add(
      this.modelService.loading$.subscribe(loading => {
        this.loadingModels = loading;
      })
    );
    
    // Subscribe to model updates
    this.subscription.add(
      this.modelService.replicateModels$.subscribe(models => {
        this.replicateModels = models;
      })
    );
    
    // Load combined models if any API is enabled
    if ((this.settings.openRouter.enabled && this.settings.openRouter.apiKey) ||
        (this.settings.googleGemini.enabled && this.settings.googleGemini.apiKey)) {
      this.loadCombinedModels();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onSettingsChange(): void {
    this.hasUnsavedChanges = JSON.stringify(this.settings) !== JSON.stringify(this.originalSettings);
  }

  saveSettings(): void {
    this.settingsService.updateSettings(this.settings);
    this.hasUnsavedChanges = false;
    
    // Clear preview background since settings are now saved
    this.backgroundService.clearPreviewBackground();
  }

  resetSettings(): void {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
      this.settingsService.clearSettings();
      // Clear preview background
      this.backgroundService.clearPreviewBackground();
    }
  }

  onModelsLoaded(models: ModelOption[]): void {
    this.combinedModels = models;
  }

  goBack(): void {
    if (this.hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Do you really want to leave the page?')) {
        // Clear preview background since we're discarding changes
        this.backgroundService.clearPreviewBackground();
        this.router.navigate(['/']);
      }
    } else {
      // Clear preview background
      this.backgroundService.clearPreviewBackground();
      this.router.navigate(['/']);
    }
  }

  goToAILogs(): void {
    if (this.hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Do you really want to leave the page?')) {
        // Clear preview background since we're discarding changes
        this.backgroundService.clearPreviewBackground();
        this.router.navigate(['/logs']);
      }
    } else {
      // Clear preview background
      this.backgroundService.clearPreviewBackground();
      this.router.navigate(['/logs']);
    }
  }

  loadCombinedModels(): void {
    this.modelLoadError = null;
    this.modelService.getCombinedModels().subscribe({
      next: (models) => {
        this.combinedModels = models;
        
      },
      error: (error) => {
        console.error('Failed to load combined models:', error);
        this.modelLoadError = 'Error loading models. Check your API keys and internet connection.';
      }
    });
  }

}
