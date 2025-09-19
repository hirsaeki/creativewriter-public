import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel,
  IonToggle, IonTextarea, IonButton, IonRange, IonSelect, IonSelectOption, IonIcon
} from '@ionic/angular/standalone';
import { NgSelectModule } from '@ng-select/ng-select';
import { Settings } from '../../core/models/settings.interface';
import { ModelOption } from '../../core/models/model.interface';

@Component({
  selector: 'app-prompts-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NgSelectModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel,
    IonToggle, IonTextarea, IonButton, IonRange, IonSelect, IonSelectOption, IonIcon
  ],
  template: `
    <!-- Scene Title Generation -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>Scene Title Generation</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-item>
          <ion-label>Maximum Word Count</ion-label>
          <ion-range
            [(ngModel)]="settings.sceneTitleGeneration.maxWords"
            (ngModelChange)="settingsChange.emit()"
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
            (ngModelChange)="settingsChange.emit()"
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
            (ngModelChange)="settingsChange.emit()"
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
            (ngModelChange)="settingsChange.emit()"
            slot="end">
          </ion-toggle>
        </ion-item>

        <ion-item>
          <ion-label>Creativity (Temperature)</ion-label>
          <ion-range
            [(ngModel)]="settings.sceneTitleGeneration.temperature"
            (ngModelChange)="settingsChange.emit()"
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
                       [disabled]="modelsDisabled"
                       placeholder="Select model (empty = use global model)"
                       (ngModelChange)="settingsChange.emit()"
                       [loading]="loadingModels"
                       [virtualScroll]="true"
                       class="ng-select-custom"
                       appendTo="body">
              <ng-template ng-option-tmp let-item="item">
                <div class="model-option">
                  <div class="model-option-header">
                    <ion-icon 
                      [name]="getProviderIcon(item.provider)" 
                      class="provider-icon" 
                      [class.gemini]="item.provider === 'gemini'" 
                      [class.openrouter]="item.provider === 'openrouter'"
                      [class.ollama]="item.provider === 'ollama'"
                      [class.claude]="item.provider === 'claude'"
                      [class.replicate]="item.provider === 'replicate'"
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
            <div class="model-info-small">
              <p *ngIf="modelLoadError" class="error-text">{{ modelLoadError }}</p>
              <p *ngIf="!modelLoadError && !settings.sceneTitleGeneration.selectedModel" class="info-text">
                No model selected - the global model will be used
              </p>
              <p *ngIf="!modelLoadError && settings.sceneTitleGeneration.selectedModel" class="info-text">
                Specific model for scene titles: {{ getModelDisplayName(settings.sceneTitleGeneration.selectedModel) }}
              </p>
            </div>
          </div>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Additional Instructions (optional)</ion-label>
          <ion-textarea
            [(ngModel)]="settings.sceneTitleGeneration.customInstruction"
            (ngModelChange)="settingsChange.emit()"
            placeholder="e.g. 'Don't use articles' or 'Focus on emotions'"
            rows="3"
            auto-grow="true">
          </ion-textarea>
        </ion-item>
        
        <ion-item>
          <ion-label>Use Custom Prompt</ion-label>
          <ion-toggle
            [(ngModel)]="settings.sceneTitleGeneration.useCustomPrompt"
            (ngModelChange)="settingsChange.emit()"
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
            (ngModelChange)="settingsChange.emit()"
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

    <!-- Scene Summary Generation -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>Scene Summary</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-item>
          <ion-label>Desired Length (words)</ion-label>
          <ion-range
            [(ngModel)]="settings.sceneSummaryGeneration.wordCount"
            (ngModelChange)="settingsChange.emit()"
            min="50"
            max="400"
            step="10"
            snaps="true"
            ticks="true"
            slot="end">
            <ion-label slot="start">50</ion-label>
            <ion-label slot="end">400</ion-label>
          </ion-range>
        </ion-item>
        <ion-item>
          <ion-label>Creativity (Temperature)</ion-label>
          <ion-range
            [(ngModel)]="settings.sceneSummaryGeneration.temperature"
            (ngModelChange)="settingsChange.emit()"
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
                       [disabled]="modelsDisabled"
                       placeholder="Select model (empty = use global model)"
                       (ngModelChange)="settingsChange.emit()"
                       [loading]="loadingModels"
                       [virtualScroll]="true"
                       class="ng-select-custom"
                       appendTo="body">
              <ng-template ng-option-tmp let-item="item">
                <div class="model-option">
                  <div class="model-option-header">
                    <ion-icon 
                      [name]="getProviderIcon(item.provider)" 
                      class="provider-icon" 
                      [class.gemini]="item.provider === 'gemini'" 
                      [class.openrouter]="item.provider === 'openrouter'"
                      [class.ollama]="item.provider === 'ollama'"
                      [class.claude]="item.provider === 'claude'"
                      [class.replicate]="item.provider === 'replicate'"
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
            (ngModelChange)="settingsChange.emit()"
            placeholder="e.g. 'Focus on main plot' or 'Include character emotions'"
            rows="3"
            auto-grow="true">
          </ion-textarea>
        </ion-item>
        
        <ion-item>
          <ion-label>Use Custom Prompt</ion-label>
          <ion-toggle
            [(ngModel)]="settings.sceneSummaryGeneration.useCustomPrompt"
            (ngModelChange)="settingsChange.emit()"
            slot="end">
          </ion-toggle>
        </ion-item>
        
        <ion-item *ngIf="settings.sceneSummaryGeneration.useCustomPrompt">
          <ion-label position="stacked">
            Custom Prompt
            <p class="prompt-help">
              Available placeholders: {{ '{' }}sceneTitle{{ '}' }}, {{ '{' }}sceneContent{{ '}' }}, {{ '{' }}customInstruction{{ '}' }}, {{ '{' }}languageInstruction{{ '}' }}, {{ '{' }}summaryWordCount{{ '}' }}
            </p>
          </ion-label>
          <ion-textarea
            [(ngModel)]="settings.sceneSummaryGeneration.customPrompt"
            (ngModelChange)="settingsChange.emit()"
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
  `,
  styles: [`
    :host {
      display: block;
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

    .model-selection-container {
      width: 100%;
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

    .info-text {
      color: #8bb4f8;
      opacity: 0.8;
    }
  `]
})
export class PromptsSettingsComponent {
  @Input() settings!: Settings;
  @Input() combinedModels: ModelOption[] = [];
  @Input() loadingModels = false;
  @Input() modelsDisabled = false;
  @Input() modelLoadError: string | null = null;
  
  @Output() settingsChange = new EventEmitter<void>();

  formatContextLength(length: number): string {
    if (length >= 1000000) {
      return `${(length / 1000000).toFixed(1)}M`;
    } else if (length >= 1000) {
      return `${(length / 1000).toFixed(0)}K`;
    }
    return length.toString();
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

  resetToDefaultPrompt(): void {
    const defaultPrompt = 'Create a title for the following scene. The title should be up to {maxWords} words long and capture the essence of the scene.\n\n{styleInstruction}\n{genreInstruction}\n{languageInstruction}{customInstruction}\n\nScene content (only this one scene):\n{sceneContent}\n\nRespond only with the title, without further explanations or quotes.';
    this.settings.sceneTitleGeneration.customPrompt = defaultPrompt;
    this.settingsChange.emit();
  }

  resetToDefaultSummaryPrompt(): void {
    const defaultPrompt = 'Create a summary of the following scene:\n\nTitle: {sceneTitle}\n\nContent:\n{sceneContent}\n\nWrite a focused, comprehensive summary that captures the most important plot points and character developments. Aim for about {summaryWordCount} words.\n\n{languageInstruction}';
    this.settings.sceneSummaryGeneration.customPrompt = defaultPrompt;
    this.settingsChange.emit();
  }

  getProviderIcon(provider: string): string {
    switch (provider) {
      case 'gemini':
        return 'logo-google';
      case 'openrouter':
        return 'openrouter-custom';
      case 'claude':
        return 'claude-custom';
      case 'ollama':
        return 'ollama-custom';
      case 'replicate':
        return 'replicate-custom';
      default:
        return 'globe-outline';
    }
  }

  getProviderTooltip(provider: string): string {
    switch (provider) {
      case 'gemini':
        return 'Google Gemini - Advanced multimodal AI from Google';
      case 'openrouter':
        return 'OpenRouter - Access to multiple AI models through unified API';
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
}
