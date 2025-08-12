import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonInput, IonToggle,
  IonChip, IonItem, IonLabel, IonSelect, IonSelectOption, IonRange, IonTextarea
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, statsChart, warning, checkmarkCircle, globeOutline, logoGoogle, colorPaletteOutline, documentTextOutline, cloudOutline, listOutline, hardwareChip } from 'ionicons/icons';
import { SettingsService } from '../core/services/settings.service';
import { ModelService } from '../core/services/model.service';
import { OllamaApiService } from '../core/services/ollama-api.service';
import { Settings } from '../core/models/settings.interface';
import { ModelOption } from '../core/models/model.interface';
import { NgSelectModule } from '@ng-select/ng-select';
import { ColorPickerComponent } from '../shared/components/color-picker.component';
import { SettingsTabsComponent, TabItem } from '../shared/components/settings-tabs.component';
import { SettingsContentComponent } from '../shared/components/settings-content.component';
import { BackgroundSelectorComponent } from '../shared/components/background-selector.component';
import { BackgroundUploadComponent } from '../shared/components/background-upload.component';
import { BackgroundService } from '../shared/services/background.service';
import { CustomBackground } from '../shared/services/synced-custom-background.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NgSelectModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonInput, IonToggle,
    IonChip, IonItem, IonLabel, IonSelect, IonSelectOption, IonRange, IonTextarea,
    ColorPickerComponent, SettingsTabsComponent, SettingsContentComponent, BackgroundSelectorComponent, BackgroundUploadComponent
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
            <!-- Global Model Selection -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>AI Model Selection</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="model-selection-wrapper">
              <div class="model-selection-container">
                <div class="model-header">
                  <ion-label>Global Model</ion-label>
                  <ion-button 
                    size="small"
                    fill="outline"
                    (click)="loadCombinedModels()" 
                    [disabled]="(!settings.openRouter.enabled || !settings.openRouter.apiKey) && (!settings.googleGemini.enabled || !settings.googleGemini.apiKey) && (!settings.replicate.enabled || !settings.replicate.apiKey) && (!settings.ollama.enabled || !settings.ollama.baseUrl) || loadingModels"
                    title="Load Models">
                    {{ loadingModels ? 'Loading...' : 'Load Models' }}
                  </ion-button>
                </div>
                <ng-select [(ngModel)]="settings.selectedModel"
                           [items]="combinedModels"
                           bindLabel="label"
                           bindValue="id"
                           [searchable]="true"
                           [clearable]="true"
                           [disabled]="(!settings.openRouter.enabled || !settings.openRouter.apiKey) && (!settings.googleGemini.enabled || !settings.googleGemini.apiKey) && (!settings.replicate.enabled || !settings.replicate.apiKey) && (!settings.ollama.enabled || !settings.ollama.baseUrl)"
                           placeholder="Select or search model..."
                           (ngModelChange)="onGlobalModelChange()"
                           [loading]="loadingModels"
                           [virtualScroll]="true"
                           class="ng-select-custom"
                           appendTo="body">
                  <ng-template ng-option-tmp let-item="item">
                    <div class="model-option">
                      <div class="model-option-header">
                        <ion-icon 
                          [name]="item.provider === 'gemini' ? 'logo-google' : item.provider === 'ollama' ? 'hardware-chip' : 'globe-outline'" 
                          class="provider-icon" 
                          [class.gemini]="item.provider === 'gemini'" 
                          [class.openrouter]="item.provider === 'openrouter'"
                          [class.ollama]="item.provider === 'ollama'"
                          [class.replicate]="item.provider === 'replicate'"></ion-icon>
                        <span class="model-label">{{ item.label }}</span>
                      </div>
                      <div class="model-option-details">
                        <span class="model-cost">Input: {{ item.costInputEur }} | Output: {{ item.costOutputEur }}</span>
                        <span class="model-context">Context: {{ formatContextLength(item.contextLength) }}</span>
                      </div>
                      <div class="model-description" *ngIf="item.description">{{ item.description }}</div>
                    </div>
                  </ng-template>
                </ng-select>
                <div class="model-info">
                  <p *ngIf="modelLoadError" class="error-text">{{ modelLoadError }}</p>
                  <p *ngIf="!modelLoadError && combinedModels.length > 0" class="info-text">
                    {{ combinedModels.length }} models available. Prices in EUR per 1M tokens.
                  </p>
                  <p *ngIf="!modelLoadError && combinedModels.length === 0 && (settings.openRouter.enabled || settings.googleGemini.enabled || settings.replicate.enabled || settings.ollama.enabled)" class="info-text">
                    Click 'Load Models' to display available models.
                  </p>
                </div>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- OpenRouter Settings -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>OpenRouter API</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label>Enable OpenRouter</ion-label>
              <ion-toggle 
                [(ngModel)]="settings.openRouter.enabled"
                (ngModelChange)="onProviderToggle('openRouter')"
                slot="end">
              </ion-toggle>
            </ion-item>

            <ion-item [class.disabled]="!settings.openRouter.enabled">
              <ion-input
                type="password"
                [(ngModel)]="settings.openRouter.apiKey"
                (ngModelChange)="onApiKeyChange('openRouter')"
                placeholder="sk-or-v1-..."
                [disabled]="!settings.openRouter.enabled"
                label="API Key"
                labelPlacement="stacked"
                helperText="Find your OpenRouter API key at openrouter.ai/keys">
              </ion-input>
            </ion-item>

            <div class="model-info" [class.disabled]="!settings.openRouter.enabled">
              <p class="info-text">Use the global model selection above.</p>
            </div>

            <div class="settings-row" [class.disabled]="!settings.openRouter.enabled">
              <ion-item>
                <ion-input
                  type="number"
                  [(ngModel)]="settings.openRouter.temperature"
                  (ngModelChange)="onSettingsChange()"
                  min="0"
                  max="2"
                  step="0.1"
                  [disabled]="!settings.openRouter.enabled"
                  label="Temperature"
                  labelPlacement="stacked">
                </ion-input>
              </ion-item>
              <ion-item>
                <ion-input
                  type="number"
                  [(ngModel)]="settings.openRouter.topP"
                  (ngModelChange)="onSettingsChange()"
                  min="0"
                  max="1"
                  step="0.1"
                  [disabled]="!settings.openRouter.enabled"
                  label="Top P"
                  labelPlacement="stacked">
                </ion-input>
              </ion-item>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Replicate Settings -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Replicate API</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label>Enable Replicate</ion-label>
              <ion-toggle 
                [(ngModel)]="settings.replicate.enabled"
                (ngModelChange)="onProviderToggle('replicate')"
                slot="end">
              </ion-toggle>
            </ion-item>

            <ion-item [class.disabled]="!settings.replicate.enabled">
              <ion-input
                type="password"
                [(ngModel)]="settings.replicate.apiKey"
                (ngModelChange)="onApiKeyChange('replicate')"
                placeholder="r8_..."
                [disabled]="!settings.replicate.enabled"
                label="API Key"
                labelPlacement="stacked"
                helperText="Find your Replicate API key at replicate.com/account/api-tokens">
              </ion-input>
            </ion-item>

            <div class="model-selection-wrapper" [class.disabled]="!settings.replicate.enabled">
              <div class="model-selection-container">
                <div class="model-header">
                  <ion-label>Model</ion-label>
                  <ion-button 
                    size="small"
                    fill="outline"
                    (click)="loadModels()" 
                    [disabled]="!settings.replicate.enabled || !settings.replicate.apiKey || loadingModels"
                    title="Modelle von Replicate laden">
                    {{ loadingModels ? 'Loading...' : 'Load Models' }}
                  </ion-button>
                </div>
                <ng-select [(ngModel)]="settings.replicate.model"
                           [items]="replicateModels"
                           bindLabel="label"
                           bindValue="id"
                           [searchable]="true"
                           [clearable]="true"
                           [disabled]="!settings.replicate.enabled"
                           placeholder="Select or search model..."
                           (ngModelChange)="onSettingsChange()"
                           [loading]="loadingModels"
                           [virtualScroll]="true"
                           class="ng-select-custom">
                </ng-select>
                <div class="model-info">
                  <p *ngIf="modelLoadError" class="error-text">{{ modelLoadError }}</p>
                  <p *ngIf="!modelLoadError && replicateModels.length > 0" class="info-text">
                    {{ replicateModels.length }} models available. Estimated prices in EUR per 1M tokens.
                  </p>
                  <p *ngIf="!modelLoadError && replicateModels.length === 0 && settings.replicate.enabled" class="info-text">
                    Click 'Load Models' to display available models.
                  </p>
                  <p *ngIf="!settings.replicate.enabled" class="info-text">
                    Format: owner/model-name (e.g. meta/llama-2-70b-chat)
                  </p>
                </div>
              </div>
            </div>

            <ion-item [class.disabled]="!settings.replicate.enabled">
              <ion-input
                type="text"
                [(ngModel)]="settings.replicate.version"
                (ngModelChange)="onSettingsChange()"
                placeholder="Leave empty for latest version"
                [disabled]="!settings.replicate.enabled"
                label="Version (optional)"
                labelPlacement="stacked">
              </ion-input>
            </ion-item>
          </ion-card-content>
        </ion-card>

        <!-- Ollama Settings -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Ollama (Local AI)</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label>Enable Ollama</ion-label>
              <ion-toggle 
                [(ngModel)]="settings.ollama.enabled"
                (ngModelChange)="onProviderToggle('ollama')"
                slot="end">
              </ion-toggle>
            </ion-item>

            <ion-item [class.disabled]="!settings.ollama.enabled">
              <ion-input
                type="url"
                [(ngModel)]="settings.ollama.baseUrl"
                (ngModelChange)="onOllamaUrlChange()"
                placeholder="http://localhost:11434"
                [disabled]="!settings.ollama.enabled"
                label="Base URL"
                labelPlacement="stacked"
                helperText="URL where your Ollama server is running">
              </ion-input>
            </ion-item>

            <div class="connection-test" [class.disabled]="!settings.ollama.enabled">
              <ion-button 
                size="small"
                fill="outline"
                (click)="testOllamaConnection()" 
                [disabled]="!settings.ollama.enabled || !settings.ollama.baseUrl || testingOllamaConnection"
                title="Test Connection">
                <ion-icon name="checkmark-circle" slot="start" *ngIf="ollamaConnectionStatus === 'success'"></ion-icon>
                <ion-icon name="warning" slot="start" *ngIf="ollamaConnectionStatus === 'error'"></ion-icon>
                {{ testingOllamaConnection ? 'Testing...' : 'Test Connection' }}
              </ion-button>
              <span *ngIf="ollamaConnectionStatus === 'success'" class="connection-status success">✓ Connected</span>
              <span *ngIf="ollamaConnectionStatus === 'error'" class="connection-status error">✗ Connection Failed</span>
            </div>

            <div class="model-info" [class.disabled]="!settings.ollama.enabled">
              <p class="info-text">Use the global model selection above to choose from your local models. <br>
                Install models with: <code>ollama pull llama3.2</code></p>
            </div>

            <div class="settings-row" [class.disabled]="!settings.ollama.enabled">
              <ion-item>
                <ion-input
                  type="number"
                  [(ngModel)]="settings.ollama.temperature"
                  (ngModelChange)="onSettingsChange()"
                  min="0"
                  max="2"
                  step="0.1"
                  [disabled]="!settings.ollama.enabled"
                  label="Temperature"
                  labelPlacement="stacked">
                </ion-input>
              </ion-item>
              <ion-item>
                <ion-input
                  type="number"
                  [(ngModel)]="settings.ollama.topP"
                  (ngModelChange)="onSettingsChange()"
                  min="0"
                  max="1"
                  step="0.1"
                  [disabled]="!settings.ollama.enabled"
                  label="Top P"
                  labelPlacement="stacked">
                </ion-input>
              </ion-item>
              <ion-item>
                <ion-input
                  type="number"
                  [(ngModel)]="settings.ollama.maxTokens"
                  (ngModelChange)="onSettingsChange()"
                  min="100"
                  max="10000"
                  step="100"
                  [disabled]="!settings.ollama.enabled"
                  label="Max Tokens"
                  labelPlacement="stacked">
                </ion-input>
              </ion-item>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Google Gemini Settings -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Google Gemini API</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label>Enable Google Gemini</ion-label>
              <ion-toggle 
                [(ngModel)]="settings.googleGemini.enabled"
                (ngModelChange)="onProviderToggle('googleGemini')"
                slot="end">
              </ion-toggle>
            </ion-item>

            <ion-item [class.disabled]="!settings.googleGemini.enabled">
              <ion-input
                type="password"
                [(ngModel)]="settings.googleGemini.apiKey"
                (ngModelChange)="onApiKeyChange('googleGemini')"
                placeholder="AIza..."
                [disabled]="!settings.googleGemini.enabled"
                label="API Key"
                labelPlacement="stacked"
                helperText="Find your Google AI API key at aistudio.google.com/app/apikey">
              </ion-input>
            </ion-item>

            <div class="model-info" [class.disabled]="!settings.googleGemini.enabled">
              <p class="info-text">Use the global model selection above.</p>
            </div>

            <div class="settings-row" [class.disabled]="!settings.googleGemini.enabled">
              <ion-item>
                <ion-input
                  type="number"
                  [(ngModel)]="settings.googleGemini.temperature"
                  (ngModelChange)="onSettingsChange()"
                  min="0"
                  max="2"
                  step="0.1"
                  [disabled]="!settings.googleGemini.enabled"
                  label="Temperature"
                  labelPlacement="stacked">
                </ion-input>
              </ion-item>
              <ion-item>
                <ion-input
                  type="number"
                  [(ngModel)]="settings.googleGemini.topP"
                  (ngModelChange)="onSettingsChange()"
                  min="0"
                  max="1"
                  step="0.1"
                  [disabled]="!settings.googleGemini.enabled"
                  label="Top P"
                  labelPlacement="stacked">
                </ion-input>
              </ion-item>
            </div>

            <!-- Content Filter Settings -->
            <div *ngIf="settings.googleGemini.enabled" class="content-filter-section">
              <h4 class="section-title">Content Filter Settings</h4>
              
              <ion-item>
                <ion-label>Harassment</ion-label>
                <ion-select
                  [(ngModel)]="settings.googleGemini.contentFilter.harassment"
                  (ngModelChange)="onSettingsChange()"
                  interface="popover"
                  slot="end">
                  <ion-select-option value="BLOCK_NONE">Don't Block</ion-select-option>
                  <ion-select-option value="BLOCK_ONLY_HIGH">Only high risks</ion-select-option>
                  <ion-select-option value="BLOCK_MEDIUM_AND_ABOVE">Medium and high risks</ion-select-option>
                  <ion-select-option value="BLOCK_LOW_AND_ABOVE">Low and higher risks</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-label>Hate Speech</ion-label>
                <ion-select
                  [(ngModel)]="settings.googleGemini.contentFilter.hateSpeech"
                  (ngModelChange)="onSettingsChange()"
                  interface="popover"
                  slot="end">
                  <ion-select-option value="BLOCK_NONE">Don't Block</ion-select-option>
                  <ion-select-option value="BLOCK_ONLY_HIGH">Only high risks</ion-select-option>
                  <ion-select-option value="BLOCK_MEDIUM_AND_ABOVE">Medium and high risks</ion-select-option>
                  <ion-select-option value="BLOCK_LOW_AND_ABOVE">Low and higher risks</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-label>Sexually Explicit</ion-label>
                <ion-select
                  [(ngModel)]="settings.googleGemini.contentFilter.sexuallyExplicit"
                  (ngModelChange)="onSettingsChange()"
                  interface="popover"
                  slot="end">
                  <ion-select-option value="BLOCK_NONE">Don't Block</ion-select-option>
                  <ion-select-option value="BLOCK_ONLY_HIGH">Only high risks</ion-select-option>
                  <ion-select-option value="BLOCK_MEDIUM_AND_ABOVE">Medium and high risks</ion-select-option>
                  <ion-select-option value="BLOCK_LOW_AND_ABOVE">Low and higher risks</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-label>Dangerous Content</ion-label>
                <ion-select
                  [(ngModel)]="settings.googleGemini.contentFilter.dangerousContent"
                  (ngModelChange)="onSettingsChange()"
                  interface="popover"
                  slot="end">
                  <ion-select-option value="BLOCK_NONE">Don't Block</ion-select-option>
                  <ion-select-option value="BLOCK_ONLY_HIGH">Only high risks</ion-select-option>
                  <ion-select-option value="BLOCK_MEDIUM_AND_ABOVE">Medium and high risks</ion-select-option>
                  <ion-select-option value="BLOCK_LOW_AND_ABOVE">Low and higher risks</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-label>Civic Integrity</ion-label>
                <ion-select
                  [(ngModel)]="settings.googleGemini.contentFilter.civicIntegrity"
                  (ngModelChange)="onSettingsChange()"
                  interface="popover"
                  slot="end">
                  <ion-select-option value="BLOCK_NONE">Don't Block</ion-select-option>
                  <ion-select-option value="BLOCK_ONLY_HIGH">Only high risks</ion-select-option>
                  <ion-select-option value="BLOCK_MEDIUM_AND_ABOVE">Medium and high risks</ion-select-option>
                  <ion-select-option value="BLOCK_LOW_AND_ABOVE">Low and higher risks</ion-select-option>
                </ion-select>
              </ion-item>
            </div>

            <div class="model-info" *ngIf="settings.googleGemini.enabled">
              <p class="info-text">
                <strong>Content Filter:</strong> Configurable safety settings for different content categories.
              </p>
            </div>
          </ion-card-content>
        </ion-card>
          </div>
          
          <!-- Appearance Tab -->
          <div *ngSwitchCase="'appearance'">
            <ion-card>
          <ion-card-header>
            <ion-card-title>Appearance</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="appearance-section">
              <h3>Text Color</h3>
              <p class="appearance-description">
                This color is used for text in the story editor and Beat AI input.
              </p>
              <app-color-picker 
                [color]="settings.appearance.textColor"
                (colorChange)="onTextColorChange($event)">
              </app-color-picker>
            </div>
            
            <div class="appearance-section">
              <app-background-selector 
                [selectedBackgroundImage]="settings.appearance.backgroundImage"
                (backgroundImageChange)="onBackgroundImageChange($event)">
              </app-background-selector>
            </div>
            
            <div class="appearance-section">
              <app-background-upload
                (backgroundUploaded)="onBackgroundUploaded($event)">
              </app-background-upload>
            </div>
          </ion-card-content>
        </ion-card>
          </div>
          
          <!-- Scene Title Tab -->
          <div *ngSwitchCase="'scene-title'">
            <ion-card>
          <ion-card-header>
            <ion-card-title>Scene Title Generation</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label>Maximum Word Count</ion-label>
              <ion-range
                [(ngModel)]="settings.sceneTitleGeneration.maxWords"
                (ngModelChange)="onSettingsChange()"
                min="1"
                max="20"
                step="1"
                snaps="true"
                ticks="true"
                slot="end">
                <ion-label slot="start">1</ion-label>
                <ion-label slot="end">20</ion-label>
              </ion-range>
            </ion-item>

            <ion-item>
              <ion-label>Style</ion-label>
              <ion-select
                [(ngModel)]="settings.sceneTitleGeneration.style"
                (ngModelChange)="onSettingsChange()"
                interface="popover"
                slot="end">
                <ion-select-option value="concise">Concise</ion-select-option>
                <ion-select-option value="descriptive">Descriptive</ion-select-option>
                <ion-select-option value="action">Action-packed</ion-select-option>
                <ion-select-option value="emotional">Emotional</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item>
              <ion-label>Language</ion-label>
              <ion-select
                [(ngModel)]="settings.sceneTitleGeneration.language"
                (ngModelChange)="onSettingsChange()"
                interface="popover"
                slot="end">
                <ion-select-option value="german">German</ion-select-option>
                <ion-select-option value="english">English</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item>
              <ion-label>Consider Genre</ion-label>
              <ion-toggle
                [(ngModel)]="settings.sceneTitleGeneration.includeGenre"
                (ngModelChange)="onSettingsChange()"
                slot="end">
              </ion-toggle>
            </ion-item>

            <ion-item>
              <ion-label>Creativity (Temperature)</ion-label>
              <ion-range
                [(ngModel)]="settings.sceneTitleGeneration.temperature"
                (ngModelChange)="onSettingsChange()"
                min="0.1"
                max="1.0"
                step="0.1"
                snaps="true"
                slot="end">
                <ion-label slot="start">0.1</ion-label>
                <ion-label slot="end">1.0</ion-label>
              </ion-range>
            </ion-item>
            
            <ion-item>
              <ion-label position="stacked">AI Model for Scene Titles</ion-label>
              <div class="model-selection-container">
                <ng-select [(ngModel)]="settings.sceneTitleGeneration.selectedModel"
                           [items]="combinedModels"
                           bindLabel="label"
                           bindValue="id"
                           [searchable]="true"
                           [clearable]="true"
                           [disabled]="(!settings.openRouter.enabled || !settings.openRouter.apiKey) && (!settings.googleGemini.enabled || !settings.googleGemini.apiKey)"
                           placeholder="Select model (empty = use global model)"
                           (ngModelChange)="onSceneTitleModelChange()"
                           [loading]="loadingModels"
                           [virtualScroll]="true"
                           class="ng-select-custom"
                           appendTo="body">
                  <ng-template ng-option-tmp let-item="item">
                    <div class="model-option">
                      <div class="model-option-header">
                        <ion-icon 
                          [name]="item.provider === 'gemini' ? 'logo-google' : item.provider === 'ollama' ? 'hardware-chip' : 'globe-outline'" 
                          class="provider-icon" 
                          [class.gemini]="item.provider === 'gemini'" 
                          [class.openrouter]="item.provider === 'openrouter'"
                          [class.ollama]="item.provider === 'ollama'"
                          [class.replicate]="item.provider === 'replicate'"></ion-icon>
                        <span class="model-label">{{ item.label }}</span>
                      </div>
                      <div class="model-option-details">
                        <span class="model-cost">Input: {{ item.costInputEur }} | Output: {{ item.costOutputEur }}</span>
                        <span class="model-context">Context: {{ formatContextLength(item.contextLength) }}</span>
                      </div>
                      <div class="model-description" *ngIf="item.description">{{ item.description }}</div>
                    </div>
                  </ng-template>
                </ng-select>
                <div class="model-info-small">
                  <p *ngIf="!settings.sceneTitleGeneration.selectedModel" class="info-text">
                    No model selected - the global model will be used
                  </p>
                  <p *ngIf="settings.sceneTitleGeneration.selectedModel" class="info-text">
                    Specific model for scene titles: {{ getModelDisplayName(settings.sceneTitleGeneration.selectedModel) }}
                  </p>
                </div>
              </div>
            </ion-item>

            <ion-item>
              <ion-label position="stacked">Additional Instructions (optional)</ion-label>
              <ion-textarea
                [(ngModel)]="settings.sceneTitleGeneration.customInstruction"
                (ngModelChange)="onSettingsChange()"
                placeholder="e.g. 'Don't use articles' or 'Focus on emotions'"
                rows="3"
                auto-grow="true">
              </ion-textarea>
            </ion-item>
            
            <ion-item>
              <ion-label>Use Custom Prompt</ion-label>
              <ion-toggle
                [(ngModel)]="settings.sceneTitleGeneration.useCustomPrompt"
                (ngModelChange)="onSettingsChange()"
                slot="end">
              </ion-toggle>
            </ion-item>
            
            <ion-item *ngIf="settings.sceneTitleGeneration.useCustomPrompt">
              <ion-label position="stacked">
                Custom Prompt
                <p class="prompt-help">
                  Available placeholders: {{ '{' }}maxWords{{ '}' }}, {{ '{' }}styleInstruction{{ '}' }}, {{ '{' }}genreInstruction{{ '}' }}, {{ '{' }}languageInstruction{{ '}' }}, {{ '{' }}customInstruction{{ '}' }}, {{ '{' }}sceneContent{{ '}' }}
                </p>
              </ion-label>
              <ion-textarea
                [(ngModel)]="settings.sceneTitleGeneration.customPrompt"
                (ngModelChange)="onSettingsChange()"
                placeholder="Create a short title for the following scene..."
                rows="8"
                auto-grow="true">
              </ion-textarea>
            </ion-item>
            
            <ion-item *ngIf="settings.sceneTitleGeneration.useCustomPrompt">
              <ion-button fill="outline" size="small" (click)="resetToDefaultPrompt()">
                Restore Default Prompt
              </ion-button>
            </ion-item>
          </ion-card-content>
        </ion-card>
          </div>

          <!-- Scene Summary Tab -->
          <div *ngSwitchCase="'scene-summary'">
            <ion-card>
          <ion-card-header>
            <ion-card-title>Scene Summary</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label>Creativity (Temperature)</ion-label>
              <ion-range
                [(ngModel)]="settings.sceneSummaryGeneration.temperature"
                (ngModelChange)="onSettingsChange()"
                min="0.1"
                max="1.0"
                step="0.1"
                snaps="true"
                slot="end">
                <ion-label slot="start">0.1</ion-label>
                <ion-label slot="end">1.0</ion-label>
              </ion-range>
            </ion-item>

            <ion-item>
              <ion-label position="stacked">AI Model for Scene Summary</ion-label>
              <div class="model-selection-container">
                <ng-select [(ngModel)]="settings.sceneSummaryGeneration.selectedModel"
                           [items]="combinedModels"
                           bindLabel="label"
                           bindValue="id"
                           [searchable]="true"
                           [clearable]="true"
                           [disabled]="(!settings.openRouter.enabled || !settings.openRouter.apiKey) && (!settings.googleGemini.enabled || !settings.googleGemini.apiKey)"
                           placeholder="Select model (empty = use global model)"
                           (ngModelChange)="onSceneSummaryModelChange()"
                           [loading]="loadingModels"
                           [virtualScroll]="true"
                           class="ng-select-custom"
                           appendTo="body">
                  <ng-template ng-option-tmp let-item="item">
                    <div class="model-option">
                      <div class="model-option-header">
                        <ion-icon 
                          [name]="item.provider === 'gemini' ? 'logo-google' : item.provider === 'ollama' ? 'hardware-chip' : 'globe-outline'" 
                          class="provider-icon" 
                          [class.gemini]="item.provider === 'gemini'" 
                          [class.openrouter]="item.provider === 'openrouter'"
                          [class.ollama]="item.provider === 'ollama'"
                          [class.replicate]="item.provider === 'replicate'"></ion-icon>
                        <span class="model-label">{{ item.label }}</span>
                      </div>
                      <div class="model-description" *ngIf="item.description">{{ item.description }}</div>
                    </div>
                  </ng-template>
                </ng-select>
                <div class="model-info-small">
                  <p *ngIf="!settings.sceneSummaryGeneration.selectedModel" class="info-text">
                    No model selected - the global model will be used
                  </p>
                  <p *ngIf="settings.sceneSummaryGeneration.selectedModel" class="info-text">
                    Specific model for scene summary: {{ getModelDisplayName(settings.sceneSummaryGeneration.selectedModel) }}
                  </p>
                </div>
              </div>
            </ion-item>

            <ion-item>
              <ion-label position="stacked">Additional Instructions (optional)</ion-label>
              <ion-textarea
                [(ngModel)]="settings.sceneSummaryGeneration.customInstruction"
                (ngModelChange)="onSettingsChange()"
                placeholder="e.g. 'Focus on emotional aspects' or 'Mention important objects'"
                rows="3"
                auto-grow="true">
              </ion-textarea>
            </ion-item>

            <ion-item>
              <ion-label>Use Custom Prompt</ion-label>
              <ion-toggle
                [(ngModel)]="settings.sceneSummaryGeneration.useCustomPrompt"
                (ngModelChange)="onSettingsChange()"
                slot="end">
              </ion-toggle>
            </ion-item>
            
            <ion-item *ngIf="settings.sceneSummaryGeneration.useCustomPrompt">
              <ion-label position="stacked">
                Custom Prompt
                <p class="prompt-help">
                  Available placeholders: {{ '{' }}sceneTitle{{ '}' }}, {{ '{' }}sceneContent{{ '}' }}, {{ '{' }}customInstruction{{ '}' }}
                </p>
              </ion-label>
              <ion-textarea
                [(ngModel)]="settings.sceneSummaryGeneration.customPrompt"
                (ngModelChange)="onSettingsChange()"
                placeholder="Create a summary of the following scene..."
                rows="8"
                auto-grow="true">
              </ion-textarea>
            </ion-item>
            
            <ion-item *ngIf="settings.sceneSummaryGeneration.useCustomPrompt">
              <ion-button fill="outline" size="small" (click)="resetToDefaultSummaryPrompt()">
                Restore Default Prompt
              </ion-button>
            </ion-item>
          </ion-card-content>
        </ion-card>
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
      color: #4285f4;
    }

    .provider-icon.openrouter {
      color: #00a67e;
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
  private ollamaApiService = inject(OllamaApiService);

  settings: Settings;
  hasUnsavedChanges = false;
  private originalSettings!: Settings;
  private subscription: Subscription = new Subscription();
  
  // Model loading state
  openRouterModels: ModelOption[] = [];
  replicateModels: ModelOption[] = [];
  geminiModels: ModelOption[] = [];
  ollamaModels: ModelOption[] = [];
  combinedModels: ModelOption[] = [];
  loadingModels = false;
  modelLoadError: string | null = null;
  
  // Ollama connection testing
  testingOllamaConnection = false;
  ollamaConnectionStatus: 'success' | 'error' | null = null;
  
  // Tab control
  selectedTab = 'models';
  tabItems: TabItem[] = [
    { value: 'models', icon: 'cloud-outline', label: 'AI Models' },
    { value: 'appearance', icon: 'color-palette-outline', label: 'Appearance' },
    { value: 'scene-title', icon: 'document-text-outline', label: 'Scene Titles' },
    { value: 'scene-summary', icon: 'list-outline', label: 'Scene Summary' }
  ];

  constructor() {
    this.settings = this.settingsService.getSettings();
    // Register Ionic icons
    addIcons({ arrowBack, statsChart, warning, checkmarkCircle, globeOutline, logoGoogle, colorPaletteOutline, documentTextOutline, cloudOutline, listOutline, hardwareChip });
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
        
        // Auto-load models if a model is already selected but models aren't loaded yet
        this.autoLoadModelsIfNeeded();
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
      this.modelService.openRouterModels$.subscribe(models => {
        this.openRouterModels = models;
      })
    );
    
    this.subscription.add(
      this.modelService.replicateModels$.subscribe(models => {
        this.replicateModels = models;
      })
    );
    
    this.subscription.add(
      this.modelService.geminiModels$.subscribe(models => {
        this.geminiModels = models;
      })
    );
    
    // Initial auto-load check
    this.autoLoadModelsIfNeeded();
    
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

  loadModels(): void {
    this.modelLoadError = null;
    this.modelService.loadAllModels().subscribe({
      next: () => { /* Do nothing - models are loaded */ },
      error: (error) => {
        console.error('Failed to load models:', error);
        this.modelLoadError = 'Error loading models. Check your API keys and internet connection.';
      }
    });
  }
  
  onApiKeyChange(provider: 'openRouter' | 'replicate' | 'googleGemini'): void {
    this.onSettingsChange();
    
    // Auto-load models when API key is entered and provider is enabled
    // This ensures models are available for selection
    if (provider === 'openRouter' && this.settings.openRouter.enabled && this.settings.openRouter.apiKey) {
      this.modelService.loadOpenRouterModels().subscribe();
    } else if (provider === 'replicate' && this.settings.replicate.enabled && this.settings.replicate.apiKey) {
      this.modelService.loadReplicateModels().subscribe();
    } else if (provider === 'googleGemini' && this.settings.googleGemini.enabled && this.settings.googleGemini.apiKey) {
      this.modelService.loadGeminiModels().subscribe();
    }
  }
  
  onOllamaUrlChange(): void {
    this.onSettingsChange();
    this.ollamaConnectionStatus = null; // Reset connection status when URL changes
    
    // Auto-load models when URL is entered and provider is enabled
    if (this.settings.ollama.enabled && this.settings.ollama.baseUrl) {
      this.modelService.loadOllamaModels().subscribe();
    }
  }
  
  onProviderToggle(provider: 'openRouter' | 'replicate' | 'googleGemini' | 'ollama'): void {
    // No more mutual exclusion - providers can be enabled at the same time
    this.onSettingsChange();
    
    // Load models when provider is enabled and has credentials
    if (provider === 'openRouter' && this.settings.openRouter.enabled && this.settings.openRouter.apiKey) {
      this.modelService.loadOpenRouterModels().subscribe();
    } else if (provider === 'replicate' && this.settings.replicate.enabled && this.settings.replicate.apiKey) {
      this.modelService.loadReplicateModels().subscribe();
    } else if (provider === 'googleGemini' && this.settings.googleGemini.enabled && this.settings.googleGemini.apiKey) {
      this.modelService.loadGeminiModels().subscribe();
    } else if (provider === 'ollama' && this.settings.ollama.enabled && this.settings.ollama.baseUrl) {
      this.modelService.loadOllamaModels().subscribe();
      this.ollamaConnectionStatus = null; // Reset connection status
    }
  }
  
  testOllamaConnection(): void {
    if (!this.settings.ollama.baseUrl) return;
    
    this.testingOllamaConnection = true;
    this.ollamaConnectionStatus = null;
    
    this.ollamaApiService.testConnection().subscribe({
      next: () => {
        this.testingOllamaConnection = false;
        this.ollamaConnectionStatus = 'success';
        // Auto-load models on successful connection
        if (this.settings.ollama.enabled) {
          this.modelService.loadOllamaModels().subscribe();
        }
      },
      error: (error) => {
        this.testingOllamaConnection = false;
        this.ollamaConnectionStatus = 'error';
        console.error('Ollama connection test failed:', error);
      }
    });
  }
  
  shouldShowDeprecatedOpenRouterModel(): boolean {
    return !!(this.settings.openRouter.model && 
             this.openRouterModels.length > 0 && 
             !this.openRouterModels.find(m => m.id === this.settings.openRouter.model));
  }
  
  shouldShowDeprecatedReplicateModel(): boolean {
    return !!(this.settings.replicate.model && 
             this.replicateModels.length > 0 && 
             !this.replicateModels.find(m => m.id === this.settings.replicate.model));
  }
  
  formatContextLength(length: number): string {
    if (length >= 1000000) {
      return `${(length / 1000000).toFixed(1)}M`;
    } else if (length >= 1000) {
      return `${(length / 1000).toFixed(0)}K`;
    }
    return length.toString();
  }
  
  private autoLoadModelsIfNeeded(): void {
    // Auto-load OpenRouter models if:
    // 1. OpenRouter is enabled
    // 2. API key is present  
    // 3. A model is already selected
    // 4. Models haven't been loaded yet
    if (this.settings.openRouter.enabled && 
        this.settings.openRouter.apiKey && 
        this.settings.openRouter.model && 
        this.openRouterModels.length === 0 &&
        !this.loadingModels) {
      this.modelService.loadOpenRouterModels().subscribe();
    }
    
    // Auto-load Replicate models if:
    // 1. Replicate is enabled
    // 2. API key is present
    // 3. A model is already selected  
    // 4. Models haven't been loaded yet
    if (this.settings.replicate.enabled && 
        this.settings.replicate.apiKey && 
        this.settings.replicate.model && 
        this.replicateModels.length === 0 &&
        !this.loadingModels) {
      this.modelService.loadReplicateModels().subscribe();
    }
    
    // Auto-load Gemini models if:
    // 1. Gemini is enabled
    // 2. API key is present
    // 3. A model is already selected
    // 4. Models haven't been loaded yet
    if (this.settings.googleGemini.enabled && 
        this.settings.googleGemini.apiKey && 
        this.settings.googleGemini.model && 
        this.geminiModels.length === 0 &&
        !this.loadingModels) {
      this.modelService.loadGeminiModels().subscribe();
    }
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

  onGlobalModelChange(): void {
    
    // Update the individual API model settings based on the selected model
    if (this.settings.selectedModel) {
      const [provider, ...modelIdParts] = this.settings.selectedModel.split(':');
      const modelId = modelIdParts.join(':'); // Rejoin in case model ID contains colons
      
      if (provider === 'openrouter') {
        this.settings.openRouter.model = modelId;
      } else if (provider === 'gemini') {
        this.settings.googleGemini.model = modelId;
      }
    }
    
    this.onSettingsChange();
  }

  resetToDefaultPrompt(): void {
    const defaultPrompt = 'Create a title for the following scene. The title should be up to {maxWords} words long and capture the essence of the scene.\n\n{styleInstruction}\n{genreInstruction}\n{languageInstruction}{customInstruction}\n\nScene content (only this one scene):\n{sceneContent}\n\nRespond only with the title, without further explanations or quotes.';
    this.settings.sceneTitleGeneration.customPrompt = defaultPrompt;
    this.onSettingsChange();
  }

  onSceneTitleModelChange(): void {
    this.onSettingsChange();
  }

  resetToDefaultSummaryPrompt(): void {
    const defaultPrompt = 'Create a summary of the following scene:\n\nTitle: {sceneTitle}\n\nContent:\n{sceneContent}\n\nThe summary should capture the most important plot points and character developments. Write a complete and comprehensive summary with at least 3-5 sentences.';
    this.settings.sceneSummaryGeneration.customPrompt = defaultPrompt;
    this.onSettingsChange();
  }

  onSceneSummaryModelChange(): void {
    this.onSettingsChange();
  }

  onTextColorChange(color: string): void {
    // Update local settings first to track changes
    this.settings.appearance.textColor = color;
    this.onSettingsChange();
    
  }

  onBackgroundImageChange(backgroundImage: string): void {
    // Update local settings first to track changes
    this.settings.appearance.backgroundImage = backgroundImage;
    this.onSettingsChange();
    
    // Set preview background for immediate visual feedback
    this.backgroundService.setPreviewBackground(backgroundImage);
    
  }

  onBackgroundUploaded(customBackground: CustomBackground): void {
    // Automatically select the newly uploaded background
    const customId = `custom:${customBackground._id}`;
    this.onBackgroundImageChange(customId);
    
  }

  getModelDisplayName(modelId: string): string {
    if (!modelId) return 'Global Model';
    
    // Find the model in available models to get its display name
    const model = this.combinedModels.find(m => m.id === modelId);
    if (model) {
      return model.label;
    }
    
    // If not found in available models, try to extract a readable name from the ID
    if (modelId.includes(':')) {
      const parts = modelId.split(':');
      const modelName = parts[1] || modelId;
      return modelName.split('/').pop() || modelName;
    }
    
    return modelId;
  }
}