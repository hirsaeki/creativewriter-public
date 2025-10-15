import { Component, Input, Output, EventEmitter, inject, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonInput, IonToggle,
  IonItem, IonLabel, IonSelect, IonSelectOption, IonButton, IonIcon
} from '@ionic/angular/standalone';
import { NgSelectModule } from '@ng-select/ng-select';
import { Settings } from '../../core/models/settings.interface';
import { ModelOption } from '../../core/models/model.interface';
import { OllamaApiService } from '../../core/services/ollama-api.service';
import { ClaudeApiService } from '../../core/services/claude-api.service';
import { ModelService } from '../../core/services/model.service';
import { OpenRouterIconComponent } from '../icons/openrouter-icon.component';
import { ClaudeIconComponent } from '../icons/claude-icon.component';
import { ReplicateIconComponent } from '../icons/replicate-icon.component';
import { OllamaIconComponent } from '../icons/ollama-icon.component';

@Component({
  selector: 'app-api-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NgSelectModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonInput, IonToggle,
    IonItem, IonLabel, IonSelect, IonSelectOption, IonButton, IonIcon,
    OpenRouterIconComponent,
    ClaudeIconComponent,
    ReplicateIconComponent,
    OllamaIconComponent
  ],
  template: `
    <!-- Global Model Selection -->
    <ion-card>
      <ion-card-header (click)="isModelSelectionCollapsed = !isModelSelectionCollapsed" style="cursor: pointer;">
        <div class="card-header-content">
          <ion-card-title>AI Model Selection</ion-card-title>
          <span style="color: #8bb4f8; font-size: 1.5rem; margin-left: auto; padding: 0.5rem;">
            {{ isModelSelectionCollapsed ? '▼' : '▲' }}
          </span>
        </div>
      </ion-card-header>
      <ion-card-content [class.collapsed]="isModelSelectionCollapsed">
        <div class="model-selection-wrapper">
          <div class="model-selection-container">
            <div class="model-header">
              <ion-label>Global Model</ion-label>
              <ion-button 
                size="small"
                fill="outline"
                (click)="loadCombinedModels()" 
                [disabled]="(!settings.openRouter.enabled || !settings.openRouter.apiKey) && (!settings.googleGemini.enabled || !settings.googleGemini.apiKey) && (!settings.replicate.enabled || !settings.replicate.apiKey) && (!settings.ollama.enabled || !settings.ollama.baseUrl) && (!settings.claude.enabled || !settings.claude.apiKey) || loadingModels"
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
                       [disabled]="(!settings.openRouter.enabled || !settings.openRouter.apiKey) && (!settings.googleGemini.enabled || !settings.googleGemini.apiKey) && (!settings.replicate.enabled || !settings.replicate.apiKey) && (!settings.ollama.enabled || !settings.ollama.baseUrl) && (!settings.claude.enabled || !settings.claude.apiKey)"
                       placeholder="Select or search model..."
                       (ngModelChange)="onGlobalModelChange()"
                       [loading]="loadingModels"
                       [virtualScroll]="true"
                       class="ng-select-custom"
                       appendTo="body">
              <ng-template ng-option-tmp let-item="item">
                <div class="model-option">
                  <div class="model-option-header">
                    <app-openrouter-icon 
                      *ngIf="item.provider === 'openrouter'"
                      size="18" 
                      color="#6467f2" 
                      class="provider-icon openrouter"
                      [title]="getProviderTooltip(item.provider)">
                    </app-openrouter-icon>
                    <app-claude-icon 
                      *ngIf="item.provider === 'claude'"
                      size="18" 
                      color="#C15F3C" 
                      class="provider-icon claude"
                      [title]="getProviderTooltip(item.provider)">
                    </app-claude-icon>
                    <app-replicate-icon 
                      *ngIf="item.provider === 'replicate'"
                      size="18" 
                      color="#9c27b0" 
                      class="provider-icon replicate"
                      [title]="getProviderTooltip(item.provider)">
                    </app-replicate-icon>
                    <app-ollama-icon 
                      *ngIf="item.provider === 'ollama'"
                      size="18" 
                      color="#ff9800" 
                      class="provider-icon ollama"
                      [title]="getProviderTooltip(item.provider)">
                    </app-ollama-icon>
                    <ion-icon 
                      *ngIf="item.provider !== 'openrouter' && item.provider !== 'claude' && item.provider !== 'replicate' && item.provider !== 'ollama'"
                      [name]="getProviderIcon(item.provider)" 
                      class="provider-icon" 
                      [class.gemini]="item.provider === 'gemini'"
                      [title]="getProviderTooltip(item.provider)"></ion-icon>
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
              <p *ngIf="!modelLoadError && combinedModels.length === 0 && (settings.openRouter.enabled || settings.googleGemini.enabled || settings.replicate.enabled || settings.ollama.enabled || settings.claude.enabled)" class="info-text">
                Click 'Load Models' to display available models.
              </p>
            </div>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- OpenRouter Settings -->
    <ion-card>
      <ion-card-header (click)="isOpenRouterCollapsed = !isOpenRouterCollapsed" style="cursor: pointer;">
        <div class="card-header-content">
          <ion-card-title>
            <app-openrouter-icon size="20" color="#6467f2" style="margin-right: 8px;"></app-openrouter-icon>
            OpenRouter API
          </ion-card-title>
          <span style="color: #8bb4f8; font-size: 1.5rem; margin-left: auto; padding: 0.5rem;">
            {{ isOpenRouterCollapsed ? '▼' : '▲' }}
          </span>
        </div>
      </ion-card-header>
      <ion-card-content [class.collapsed]="isOpenRouterCollapsed">
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
              (ngModelChange)="settingsChange.emit()"
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
              (ngModelChange)="settingsChange.emit()"
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
      <ion-card-header (click)="isReplicateCollapsed = !isReplicateCollapsed" style="cursor: pointer;">
        <div class="card-header-content">
          <ion-card-title>
            <app-replicate-icon size="20" color="#9c27b0" style="margin-right: 8px;"></app-replicate-icon>
            Replicate API
          </ion-card-title>
          <span style="color: #8bb4f8; font-size: 1.5rem; margin-left: auto; padding: 0.5rem;">
            {{ isReplicateCollapsed ? '▼' : '▲' }}
          </span>
        </div>
      </ion-card-header>
      <ion-card-content [class.collapsed]="isReplicateCollapsed">
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
                (click)="loadReplicateModels()" 
                [disabled]="!settings.replicate.enabled || !settings.replicate.apiKey || loadingModels"
                title="Load models from Replicate">
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
                       (ngModelChange)="settingsChange.emit()"
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
            (ngModelChange)="settingsChange.emit()"
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
      <ion-card-header (click)="isOllamaCollapsed = !isOllamaCollapsed" style="cursor: pointer;">
        <div class="card-header-content">
          <ion-card-title>
            <app-ollama-icon size="20" color="#ff9800" style="margin-right: 8px;"></app-ollama-icon>
            Ollama (Local AI)
          </ion-card-title>
          <span style="color: #8bb4f8; font-size: 1.5rem; margin-left: auto; padding: 0.5rem;">
            {{ isOllamaCollapsed ? '▼' : '▲' }}
          </span>
        </div>
      </ion-card-header>
      <ion-card-content [class.collapsed]="isOllamaCollapsed">
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
              (ngModelChange)="settingsChange.emit()"
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
              (ngModelChange)="settingsChange.emit()"
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
              (ngModelChange)="settingsChange.emit()"
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
      <ion-card-header (click)="isGeminiCollapsed = !isGeminiCollapsed" style="cursor: pointer;">
        <div class="card-header-content">
          <ion-card-title>
            <ion-icon name="logo-google" class="provider-icon gemini" style="margin-right: 8px;"></ion-icon>
            Google Gemini API
          </ion-card-title>
          <span style="color: #8bb4f8; font-size: 1.5rem; margin-left: auto; padding: 0.5rem;">
            {{ isGeminiCollapsed ? '▼' : '▲' }}
          </span>
        </div>
      </ion-card-header>
      <ion-card-content [class.collapsed]="isGeminiCollapsed">
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
              (ngModelChange)="settingsChange.emit()"
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
              (ngModelChange)="settingsChange.emit()"
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
              (ngModelChange)="settingsChange.emit()"
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
              (ngModelChange)="settingsChange.emit()"
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
              (ngModelChange)="settingsChange.emit()"
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
              (ngModelChange)="settingsChange.emit()"
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
              (ngModelChange)="settingsChange.emit()"
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

    <!-- Claude API Settings -->
    <ion-card>
      <ion-card-header (click)="isClaudeCollapsed = !isClaudeCollapsed" style="cursor: pointer;">
        <div class="card-header-content">
          <ion-card-title>
            <app-claude-icon size="20" color="#C15F3C" style="margin-right: 8px;"></app-claude-icon>
            Claude API (Anthropic)
          </ion-card-title>
          <span style="color: #8bb4f8; font-size: 1.5rem; margin-left: auto; padding: 0.5rem;">
            {{ isClaudeCollapsed ? '▼' : '▲' }}
          </span>
        </div>
      </ion-card-header>
      <ion-card-content [class.collapsed]="isClaudeCollapsed">
        <ion-item>
          <ion-label>Enable Claude</ion-label>
          <ion-toggle 
            [(ngModel)]="settings.claude.enabled"
            (ngModelChange)="onProviderToggle('claude')"
            slot="end">
          </ion-toggle>
        </ion-item>

        <ion-item [class.disabled]="!settings.claude.enabled">
          <ion-input
            type="password"
            [(ngModel)]="settings.claude.apiKey"
            (ngModelChange)="onApiKeyChange('claude')"
            placeholder="sk-ant-api03-..."
            [disabled]="!settings.claude.enabled"
            label="API Key"
            labelPlacement="stacked"
            helperText="Find your Claude API key at console.anthropic.com">
          </ion-input>
        </ion-item>

        <div class="connection-test" [class.disabled]="!settings.claude.enabled">
          <ion-button 
            size="small"
            fill="outline"
            (click)="testClaudeConnection()" 
            [disabled]="!settings.claude.enabled || !settings.claude.apiKey || testingClaudeConnection"
            title="Test Connection">
            <ion-icon name="checkmark-circle" slot="start" *ngIf="claudeConnectionStatus === 'success'"></ion-icon>
            <ion-icon name="warning" slot="start" *ngIf="claudeConnectionStatus === 'error'"></ion-icon>
            {{ testingClaudeConnection ? 'Testing...' : 'Test Connection' }}
          </ion-button>
          <span *ngIf="claudeConnectionStatus === 'success'" class="connection-status success">✓ Connected</span>
          <span *ngIf="claudeConnectionStatus === 'error'" class="connection-status error">✗ Connection Failed</span>
        </div>

        <div class="model-info" [class.disabled]="!settings.claude.enabled">
          <p class="info-text">Use the global model selection above.</p>
        </div>

        <div class="settings-row" [class.disabled]="!settings.claude.enabled">
          <ion-item>
            <ion-input
              type="number"
              [(ngModel)]="settings.claude.temperature"
              (ngModelChange)="settingsChange.emit()"
              min="0"
              max="1"
              step="0.1"
              [disabled]="!settings.claude.enabled"
              label="Temperature"
              labelPlacement="stacked">
            </ion-input>
          </ion-item>
          <ion-item>
            <ion-input
              type="number"
              [(ngModel)]="settings.claude.topP"
              (ngModelChange)="settingsChange.emit()"
              min="0"
              max="1"
              step="0.1"
              [disabled]="!settings.claude.enabled"
              label="Top P"
              labelPlacement="stacked">
            </ion-input>
          </ion-item>
          <ion-item>
            <ion-input
              type="number"
              [(ngModel)]="settings.claude.topK"
              (ngModelChange)="settingsChange.emit()"
              min="0"
              max="200"
              step="1"
              [disabled]="!settings.claude.enabled"
              label="Top K"
              labelPlacement="stacked">
            </ion-input>
          </ion-item>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    :host {
      display: block;
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
      color: #6467f2;
    }

    .provider-icon.ollama {
      color: #ff9800;
    }

    .provider-icon.replicate {
      color: #9c27b0;
    }

    .provider-icon.claude {
      color: #C15F3C;
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

    .settings-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0;
    }

    .settings-row.disabled {
      opacity: 0.5;
    }

    .connection-test {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 1rem 0;
    }

    .connection-test.disabled {
      opacity: 0.5;
    }

    .connection-status {
      font-size: 0.9rem;
      font-weight: 500;
    }

    .connection-status.success {
      color: #51cf66;
    }

    .connection-status.error {
      color: #ff6b6b;
    }

    code {
      background: rgba(0, 0, 0, 0.3);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: monospace;
      color: #8bb4f8;
    }

    .card-header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }

    ion-card-content.collapsed {
      display: none;
    }

    ion-card-header {
      transition: all 0.3s ease;
    }

    ion-card-header:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .card-header-content ion-button {
      --color: #8bb4f8;
      --background: transparent;
    }

    .card-header-content ion-button:hover {
      --color: #ffffff;
    }

    .card-header-content ion-icon {
      color: #8bb4f8;
      font-size: 1.2rem;
    }

    .card-header-content ion-button:hover ion-icon {
      color: #ffffff;
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
export class ApiSettingsComponent implements OnDestroy {
  private ollamaApiService = inject(OllamaApiService);
  private claudeApiService = inject(ClaudeApiService);
  private modelService = inject(ModelService);
  private subscriptions = new Subscription();

  @Input() settings!: Settings;
  @Input() combinedModels: ModelOption[] = [];
  @Input() replicateModels: ModelOption[] = [];
  @Input() loadingModels = false;
  @Input() modelLoadError: string | null = null;
  
  @Output() settingsChange = new EventEmitter<void>();
  @Output() modelsLoaded = new EventEmitter<ModelOption[]>();
  
  testingOllamaConnection = false;
  ollamaConnectionStatus: 'success' | 'error' | null = null;
  testingClaudeConnection = false;
  claudeConnectionStatus: 'success' | 'error' | null = null;

  // Collapsible card states
  isModelSelectionCollapsed = false;
  isOpenRouterCollapsed = false;
  isReplicateCollapsed = true;
  isOllamaCollapsed = true;
  isGeminiCollapsed = true;
  isClaudeCollapsed = true;

  formatContextLength(length: number): string {
    if (length >= 1000000) {
      return `${(length / 1000000).toFixed(1)}M`;
    } else if (length >= 1000) {
      return `${(length / 1000).toFixed(0)}K`;
    }
    return length.toString();
  }

  loadCombinedModels(): void {
    this.subscriptions.add(
      this.modelService.getCombinedModels().subscribe({
        next: (models) => {
          this.modelsLoaded.emit(models);
        },
        error: (error) => {
          console.error('Failed to load combined models:', error);
        }
      })
    );
  }

  loadReplicateModels(): void {
    this.subscriptions.add(
      this.modelService.loadReplicateModels().subscribe()
    );
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
      } else if (provider === 'claude') {
        this.settings.claude.model = modelId;
      }
    }
    
    this.settingsChange.emit();
  }

  onApiKeyChange(provider: 'openRouter' | 'replicate' | 'googleGemini' | 'claude'): void {
    this.settingsChange.emit();

    // Auto-load models when API key is entered and provider is enabled
    if (provider === 'openRouter' && this.settings.openRouter.enabled && this.settings.openRouter.apiKey) {
      this.subscriptions.add(this.modelService.loadOpenRouterModels().subscribe());
    } else if (provider === 'replicate' && this.settings.replicate.enabled && this.settings.replicate.apiKey) {
      this.subscriptions.add(this.modelService.loadReplicateModels().subscribe());
    } else if (provider === 'googleGemini' && this.settings.googleGemini.enabled && this.settings.googleGemini.apiKey) {
      this.subscriptions.add(this.modelService.loadGeminiModels().subscribe());
    } else if (provider === 'claude' && this.settings.claude.enabled && this.settings.claude.apiKey) {
      this.subscriptions.add(this.modelService.loadClaudeModels().subscribe());
    }
  }
  
  onOllamaUrlChange(): void {
    this.settingsChange.emit();
    this.ollamaConnectionStatus = null; // Reset connection status when URL changes

    // Auto-load models when URL is entered and provider is enabled
    if (this.settings.ollama.enabled && this.settings.ollama.baseUrl) {
      this.subscriptions.add(this.modelService.loadOllamaModels().subscribe());
    }
  }
  
  onProviderToggle(provider: 'openRouter' | 'replicate' | 'googleGemini' | 'ollama' | 'claude'): void {
    this.settingsChange.emit();

    // Load models when provider is enabled and has credentials
    if (provider === 'openRouter' && this.settings.openRouter.enabled && this.settings.openRouter.apiKey) {
      this.subscriptions.add(this.modelService.loadOpenRouterModels().subscribe());
    } else if (provider === 'replicate' && this.settings.replicate.enabled && this.settings.replicate.apiKey) {
      this.subscriptions.add(this.modelService.loadReplicateModels().subscribe());
    } else if (provider === 'googleGemini' && this.settings.googleGemini.enabled && this.settings.googleGemini.apiKey) {
      this.subscriptions.add(this.modelService.loadGeminiModels().subscribe());
    } else if (provider === 'ollama' && this.settings.ollama.enabled && this.settings.ollama.baseUrl) {
      this.subscriptions.add(this.modelService.loadOllamaModels().subscribe());
      this.ollamaConnectionStatus = null; // Reset connection status
    } else if (provider === 'claude' && this.settings.claude.enabled && this.settings.claude.apiKey) {
      this.subscriptions.add(this.modelService.loadClaudeModels().subscribe());
      this.claudeConnectionStatus = null; // Reset connection status
    }
  }
  
  testOllamaConnection(): void {
    if (!this.settings.ollama.baseUrl) return;

    this.testingOllamaConnection = true;
    this.ollamaConnectionStatus = null;

    this.subscriptions.add(
      this.ollamaApiService.testConnection().subscribe({
        next: () => {
          this.testingOllamaConnection = false;
          this.ollamaConnectionStatus = 'success';
          // Auto-load models on successful connection
          if (this.settings.ollama.enabled) {
            this.subscriptions.add(this.modelService.loadOllamaModels().subscribe());
          }
        },
        error: (error) => {
          this.testingOllamaConnection = false;
          this.ollamaConnectionStatus = 'error';
          console.error('Ollama connection test failed:', error);
        }
      })
    );
  }

  testClaudeConnection(): void {
    if (!this.settings.claude.apiKey) return;

    this.testingClaudeConnection = true;
    this.claudeConnectionStatus = null;

    this.subscriptions.add(
      this.claudeApiService.testConnection().subscribe({
        next: (success) => {
          this.testingClaudeConnection = false;
          this.claudeConnectionStatus = success ? 'success' : 'error';
          // Auto-load models on successful connection
          if (success && this.settings.claude.enabled) {
            this.subscriptions.add(this.modelService.loadClaudeModels().subscribe());
          }
        },
        error: (error) => {
          this.testingClaudeConnection = false;
          this.claudeConnectionStatus = 'error';
          console.error('Claude connection test failed:', error);
        }
      })
    );
  }

  getProviderIcon(provider: string): string {
    switch (provider) {
      case 'gemini':
        return 'logo-google';
      case 'openrouter':
        return 'openrouter-custom'; // Custom OpenRouter logo
      case 'claude':
        return 'claude-custom'; // Official Claude logo
      case 'ollama':
        return 'ollama-custom'; // Official Ollama logo
      case 'replicate':
        return 'replicate-custom'; // Official Replicate logo
      default:
        return 'globe-outline';
    }
  }

  getProviderTooltip(provider: string): string {
    switch (provider) {
      case 'gemini':
        return 'Google Gemini - Advanced multimodal AI from Google';
      case 'openrouter':
        return 'OpenRouter - Unified API gateway for multiple AI models';
      case 'claude':
        return 'Claude - Anthropic\'s helpful, harmless, and honest AI assistant';
      case 'ollama':
        return 'Ollama - Run large language models locally on your machine';
      case 'replicate':
        return 'Replicate - Cloud platform for running machine learning models';
      default:
        return 'AI Provider';
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
