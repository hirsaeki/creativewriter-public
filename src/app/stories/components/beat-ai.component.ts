import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { 
  IonIcon, PopoverController, IonModal, IonChip, IonLabel, IonSearchbar, IonCheckbox, IonItemDivider,
  IonButton, IonButtons, IonToolbar, IonTitle, IonHeader, IonContent, IonList, IonItem
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoGoogle, globeOutline, createOutline, refreshOutline, trashOutline, analyticsOutline, colorWandOutline, addOutline, closeOutline, readerOutline, copyOutline } from 'ionicons/icons';
import { BeatAIModalService } from '../../shared/services/beat-ai-modal.service';
import { TokenInfoPopoverComponent } from '../../shared/components/token-info-popover.component';
import { TokenCounterService, SupportedModel } from '../../shared/services/token-counter.service';
import { BeatAI, BeatAIPromptEvent } from '../models/beat-ai.interface';
import { Subscription } from 'rxjs';
import { ModelOption } from '../../core/models/model.interface';
import { ModelService } from '../../core/services/model.service';
import { SettingsService } from '../../core/services/settings.service';
import { BeatAIService } from '../../shared/services/beat-ai.service';
import { ProseMirrorEditorService, SimpleEditorConfig } from '../../shared/services/prosemirror-editor.service';
import { EditorView } from 'prosemirror-view';
import { StoryService } from '../services/story.service';
import { Story, Scene, Chapter } from '../models/story.interface';

interface SceneContext {
  chapterId: string;
  sceneId: string;
  chapterTitle: string;
  sceneTitle: string;
  content: string;
  selected: boolean;
}

@Component({
  selector: 'app-beat-ai',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NgSelectModule, IonIcon, IonModal, IonChip, IonLabel, 
    IonSearchbar, IonCheckbox, IonItemDivider, IonButton, IonButtons, IonToolbar, 
    IonTitle, IonHeader, IonContent, IonList, IonItem
  ],
  template: `
    <div class="beat-ai-container" [class.editing]="beatData.isEditing" [class.generating]="beatData.isGenerating" [style.--beat-ai-text-color]="currentTextColor">
      <!-- Prompt Input Section -->
      <div class="beat-prompt-section" [class.collapsed]="!beatData.isEditing && beatData.generatedContent">
        <div class="beat-header">
          <div class="beat-icon">
            <ion-icon name="color-wand-outline"></ion-icon>
          </div>
          <div class="beat-title">Beat AI</div>
          <div class="beat-actions">
            <button 
              *ngIf="beatData.isEditing || !beatData.prompt" 
              class="action-btn context-btn"
              (click)="showSceneSelector = true; $event.stopPropagation()"
              title="Select context">
              <ion-icon name="add-outline"></ion-icon>
            </button>
            <button 
              *ngIf="beatData.isEditing || !beatData.prompt" 
              class="action-btn outline-btn"
              [class.active]="includeStoryOutline"
              (click)="toggleStoryOutline(); $event.stopPropagation()"
              title="Include/exclude story overview">
              <ion-icon name="reader-outline"></ion-icon>
            </button>
            <button 
              *ngIf="!beatData.isEditing && beatData.prompt" 
              class="action-btn edit-btn"
              (click)="startEditing(); $event.stopPropagation()"
              title="Edit prompt">
              <ion-icon name="create-outline"></ion-icon>
            </button>
            <button 
              *ngIf="beatData.generatedContent && !beatData.isGenerating" 
              class="action-btn regenerate-btn"
              (click)="regenerateContent(); $event.stopPropagation()"
              title="Regenerate">
              <ion-icon name="refresh-outline"></ion-icon>
            </button>
            <button 
              *ngIf="beatData.generatedContent && !beatData.isGenerating" 
              class="action-btn delete-btn"
              (click)="deleteContentAfterBeat(); $event.stopPropagation()"
              title="Delete text after this beat">
              <ion-icon name="trash-outline"></ion-icon>
            </button>
          </div>
        </div>

        <!-- Context Chips -->
        <div class="context-chips" *ngIf="selectedScenes.length > 0 || includeStoryOutline">
          <ion-chip *ngIf="includeStoryOutline" color="success">
            <ion-label>Story Overview</ion-label>
            <ion-icon 
              name="close-outline" 
              (click)="removeStoryOutline(); $event.stopPropagation()">
            </ion-icon>
          </ion-chip>
          <ion-chip *ngFor="let scene of selectedScenes" [color]="scene.sceneId === sceneId ? 'primary' : 'medium'">
            <ion-label>{{ scene.chapterTitle }} - {{ scene.sceneTitle }}</ion-label>
            <ion-icon 
              name="close-outline" 
              (click)="removeSceneContext(scene); $event.stopPropagation()">
            </ion-icon>
          </ion-chip>
        </div>
        
        <div class="prompt-input-container" *ngIf="beatData.isEditing || !beatData.prompt">
          <div
            #promptInput
            class="prompt-input prosemirror-container"
          ></div>
          
          <!-- Generation Options -->
          <div class="generation-options" *ngIf="beatData.isEditing || !beatData.prompt">
            <div class="options-row">
              <div class="option-group">
                <ng-select [(ngModel)]="selectedBeatType"
                           [items]="beatTypeOptions"
                           bindLabel="label"
                           bindValue="value"
                           [clearable]="false"
                           [searchable]="false"
                           placeholder="Choose beat type..."
                           class="model-select"
                           appendTo="body"
                           (change)="onBeatTypeChange()">
                  <ng-template ng-option-tmp let-item="item">
                    <div class="beat-type-option">
                      <span class="beat-type-label">{{ item.label }}</span>
                      <span class="beat-type-description">{{ item.description }}</span>
                    </div>
                  </ng-template>
                </ng-select>
              </div>
              <div class="option-group">
                <ng-select [(ngModel)]="selectedWordCount"
                           [items]="wordCountOptions"
                           bindLabel="label"
                           bindValue="value"
                           [clearable]="false"
                           [searchable]="false"
                           placeholder="Choose word count..."
                           class="model-select"
                           appendTo="body"
                           (change)="onWordCountChange()">
                </ng-select>
                <input 
                  *ngIf="showCustomWordCount"
                  type="number"
                  [(ngModel)]="customWordCount"
                  class="custom-word-count"
                  placeholder="Anzahl eingeben..."
                  min="10"
                  max="50000"
                  (blur)="validateCustomWordCount()">
              </div>
              <div class="option-group model-selection-group">
                <!-- Favorite Models Quick Access -->
                <div class="favorite-models" *ngIf="favoriteModels.length > 0">
                  <div class="favorite-label">Favoriten:</div>
                  <div class="favorite-buttons">
                    <button *ngFor="let model of favoriteModels"
                            class="favorite-btn"
                            [class.active]="selectedModel === model.id"
                            (click)="selectFavoriteModel(model)"
                            [title]="model.label">
                      <ion-icon [name]="getProviderIcon(model.provider)" class="provider-icon-inline" [class.gemini]="model.provider === 'gemini'" [class.openrouter]="model.provider === 'openrouter'"></ion-icon>
                      <span class="model-short-name">{{ getShortModelName(model.label) }}</span>
                    </button>
                  </div>
                </div>
                <ng-select [(ngModel)]="selectedModel"
                           [items]="availableModels"
                           bindLabel="label"
                           bindValue="id"
                           [clearable]="false"
                           [searchable]="true"
                           placeholder="Select model..."
                           class="model-select"
                           appendTo="body"
                           (change)="onModelChange()">
                  <ng-template ng-label-tmp let-item="item">
                    <div class="model-option-inline">
                      <ion-icon [name]="getProviderIcon(item.provider)" class="provider-icon-inline" [class.gemini]="item.provider === 'gemini'" [class.openrouter]="item.provider === 'openrouter'"></ion-icon>
                      <span class="model-label">{{ item.label }}</span>
                      <button class="favorite-toggle"
                              (click)="toggleFavorite($event, item)"
                              [class.is-favorite]="isFavorite(item.id)"
                              title="Mark as favorite">
                        ⭐
                      </button>
                    </div>
                  </ng-template>
                  <ng-template ng-option-tmp let-item="item">
                    <div class="model-option-inline">
                      <ion-icon [name]="getProviderIcon(item.provider)" class="provider-icon-inline" [class.gemini]="item.provider === 'gemini'" [class.openrouter]="item.provider === 'openrouter'"></ion-icon>
                      <span class="model-label">{{ item.label }}</span>
                      <button class="favorite-toggle"
                              (click)="toggleFavorite($event, item)"
                              [class.is-favorite]="isFavorite(item.id)"
                              title="Mark as favorite">
                        ⭐
                      </button>
                    </div>
                  </ng-template>
                </ng-select>
              </div>
            </div>
          </div>

          <div class="prompt-actions">
            <button 
              class="generate-btn primary"
              (click)="generateContent(); $event.stopPropagation()"
              [disabled]="!currentPrompt.trim() || beatData.isGenerating || !selectedModel">
              Generate
            </button>
            <button 
              class="generate-btn primary"
              (click)="showPromptPreview(); $event.stopPropagation()"
              [disabled]="!currentPrompt.trim()"
              title="Show prompt preview">
              👁️ Preview
            </button>
            <button 
              class="generate-btn secondary"
              (click)="showTokenInfo(); $event.stopPropagation()"
              [disabled]="!currentPrompt.trim() || !selectedModel"
              title="Token-Analyse anzeigen">
              <ion-icon name="analytics-outline"></ion-icon>
            </button>
            <button 
              *ngIf="beatData.prompt && beatData.isEditing"
              class="cancel-btn"
              (click)="cancelEditing(); $event.stopPropagation()">
              Cancel
            </button>
          </div>
        </div>
        
        <div class="prompt-display" *ngIf="!beatData.isEditing && beatData.prompt">
          <div class="prompt-text">{{ beatData.prompt }}</div>
          <div class="beat-info">
            <span class="beat-type-badge" [class.story-beat]="(beatData.beatType || 'story') === 'story'" [class.scene-beat]="(beatData.beatType || 'story') === 'scene'">
              {{ (beatData.beatType || 'story') === 'story' ? 'StoryBeat' : 'SceneBeat' }}
            </span>
            <span class="model-badge" *ngIf="beatData.model" title="Verwendetes AI-Modell">
              {{ getModelDisplayName(beatData.model) }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Generation Status -->
      <div class="generation-status" *ngIf="beatData.isGenerating">
        <div class="generation-indicator">
          <span class="generating-text">Text wird gestreamt...</span>
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
        <button 
          class="stop-btn"
          (click)="stopGeneration(); $event.stopPropagation()"
          title="Stop generation">
          ⏹️ Stop
        </button>
      </div>
    </div>


    <!-- Scene Selector Modal -->
    <ion-modal [isOpen]="showSceneSelector" (didDismiss)="showSceneSelector = false">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Add Scenes as Context</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="showSceneSelector = false">
                <ion-icon name="close-outline" slot="icon-only"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <ion-searchbar 
            [(ngModel)]="sceneSearchTerm" 
            placeholder="Search scene..."
            animated="true">
          </ion-searchbar>
          
          <ion-list>
            <div *ngFor="let chapter of story?.chapters">
              <ion-item-divider>
                <ion-label>C{{ chapter.chapterNumber || chapter.order }}:{{ chapter.title }}</ion-label>
              </ion-item-divider>
              <ion-item 
                *ngFor="let scene of getFilteredScenes(chapter)" 
                [button]="true"
                (click)="toggleSceneSelection(chapter.id, scene.id)">
                <ion-checkbox 
                  slot="start" 
                  [checked]="isSceneSelected(scene.id)">
                </ion-checkbox>
                <ion-label>
                  <h3>C{{ chapter.chapterNumber || chapter.order }}S{{ scene.sceneNumber || scene.order }}:{{ scene.title }}</h3>
                  <p>{{ getScenePreview(scene) }}</p>
                </ion-label>
              </ion-item>
            </div>
          </ion-list>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .beat-ai-container {
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      background: rgba(42, 42, 42, 0.2);
      backdrop-filter: blur(8px);
      margin: 1rem 0;
      overflow: hidden;
      transition: all 0.3s ease;
      max-width: 100%;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
    
    .beat-ai-container.editing {
      border-color: #0d6efd;
      box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25);
    }
    
    .beat-ai-container.generating {
      border-color: #ffc107;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }
    
    .beat-prompt-section {
      padding: 0.5rem;
      transition: all 0.3s ease;
    }
    
    .beat-prompt-section.collapsed {
      padding: 0.5rem;
    }
    
    .beat-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    
    .beat-icon {
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      color: #8bb4f8;
    }
    
    .beat-icon ion-icon {
      font-size: 1.2rem;
    }
    
    .beat-title {
      font-weight: 600;
      color: #f8f9fa;
      flex: 1;
    }
    
    .beat-actions {
      display: flex;
      gap: 0.5rem;
    }
    
    .action-btn {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(139, 180, 248, 0.05) 100%);
      border: 1px solid rgba(139, 180, 248, 0.2);
      padding: 0.4rem;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      color: #8bb4f8;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      position: relative;
      overflow: hidden;
      width: 44px;
      height: 44px;
      /* Ensure minimum touch target size */
      min-width: 44px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      /* Better touch feedback */
      -webkit-touch-callout: none;
      /* Prevent text selection on double-tap */
      -webkit-text-size-adjust: none;
    }
    
    .action-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(139, 180, 248, 0.2), transparent);
      transition: left 0.6s ease;
    }
    
    .action-btn:hover::before {
      left: 100%;
    }
    
    .action-btn ion-icon {
      font-size: 1.1rem;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    }
    
    .edit-btn:hover {
      background: linear-gradient(135deg, rgba(71, 118, 230, 0.2) 0%, rgba(139, 180, 248, 0.2) 100%);
      border-color: rgba(139, 180, 248, 0.4);
      transform: translateY(-1px) scale(1.05);
      box-shadow: 0 4px 12px rgba(71, 118, 230, 0.3);
      color: #a8c7ff;
    }
    
    .regenerate-btn:hover {
      background: linear-gradient(135deg, rgba(64, 192, 87, 0.2) 0%, rgba(81, 207, 102, 0.2) 100%);
      border-color: rgba(81, 207, 102, 0.4);
      transform: translateY(-1px) scale(1.05) rotate(180deg);
      box-shadow: 0 4px 12px rgba(64, 192, 87, 0.3);
      color: #51cf66;
    }
    
    .delete-btn:hover {
      background: linear-gradient(135deg, rgba(255, 107, 107, 0.2) 0%, rgba(220, 53, 69, 0.2) 100%);
      border-color: rgba(255, 107, 107, 0.4);
      transform: translateY(-1px) scale(1.05);
      box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
      color: #ff6b6b;
    }
    
    .context-btn:hover {
      background: linear-gradient(135deg, rgba(139, 180, 248, 0.2) 0%, rgba(71, 118, 230, 0.2) 100%);
      border-color: rgba(139, 180, 248, 0.4);
      transform: translateY(-1px) scale(1.05);
      box-shadow: 0 4px 12px rgba(139, 180, 248, 0.3);
      color: #a8c7ff;
    }
    
    .outline-btn:hover {
      background: linear-gradient(135deg, rgba(81, 207, 102, 0.2) 0%, rgba(64, 192, 87, 0.2) 100%);
      border-color: rgba(81, 207, 102, 0.4);
      transform: translateY(-1px) scale(1.05);
      box-shadow: 0 4px 12px rgba(64, 192, 87, 0.3);
      color: #51cf66;
    }
    
    .outline-btn.active {
      background: linear-gradient(135deg, rgba(81, 207, 102, 0.3) 0%, rgba(64, 192, 87, 0.3) 100%);
      border-color: rgba(81, 207, 102, 0.6);
      color: #51cf66;
    }
    
    @media (max-width: 768px) {
      .beat-actions {
        gap: 0.6rem;
        /* Add padding to prevent edge tapping issues */
        padding: 0.25rem;
      }
      
      .action-btn {
        width: 48px;
        height: 48px;
        padding: 0.5rem;
        /* Increase spacing between buttons on mobile */
        margin: 0 2px;
        /* Ensure adequate touch area even with visual styling */
        min-width: 48px;
        min-height: 48px;
      }
      
      .action-btn ion-icon {
        font-size: 1.2rem;
      }
    }

    .context-chips {
      padding: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      background: rgba(45, 45, 45, 0.3);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(8px);
      margin-top: 0.5rem;
    }

    .context-chips ion-chip {
      margin: 0;
      cursor: pointer;
    }

    .context-chips ion-chip ion-icon {
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .context-chips ion-chip ion-icon:hover {
      opacity: 1;
    }
    
    .prompt-input-container {
      margin-top: 0.1rem;
    }
    
    .prompt-input.prosemirror-container {
      width: 100%;
      background: rgba(20, 20, 20, 0.1);
      backdrop-filter: blur(3px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 0;
      color: var(--beat-ai-text-color, #e0e0e0);
      font-family: inherit;
      font-size: 0.9rem;
      line-height: 1.2;
      min-height: auto;
      max-height: 300px;
      overflow-y: auto;
      transition: all 0.15s ease;
      box-sizing: border-box;
      cursor: text;
      /* Isolate from parent editor */
      position: relative;
      z-index: 10;
      /* Allow text selection in the prompt input */
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      user-select: text;
    }
    
    .prompt-input.prosemirror-container:focus-within {
      outline: none;
      border-color: #0d6efd;
      box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25);
    }
    
    .prompt-input.prosemirror-container :global(.ProseMirror) {
      outline: none;
      padding: 0.6rem !important;
      min-height: auto;
      background: rgba(15, 15, 15, 0.1);
      backdrop-filter: blur(2px);
      color: var(--beat-ai-text-color, #e0e0e0) !important;
      font-size: 0.9rem;
      line-height: 1.2;
      font-family: inherit;
      width: 100%;
      box-sizing: border-box;
      border-radius: 4px;
    }
    
    .prompt-input.prosemirror-container :global(.ProseMirror *) {
      color: inherit !important;
      cursor: text;
      /* Prevent text selection on mobile */
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      user-select: text;
      /* Prevent touch callout */
      -webkit-touch-callout: none;
      /* Prevent tap highlight */
      -webkit-tap-highlight-color: transparent;
    }
    
    /* Ensure buttons don't inherit text color - use initial instead of revert */
    .beat-ai-container button {
      color: initial !important;
      cursor: pointer !important;
    }
    
    /* Specific colors for action buttons */
    .action-btn {
      color: #8bb4f8 !important;
    }
    
    .action-btn ion-icon {
      color: inherit !important;
    }
    
    .edit-btn:hover {
      color: #a8c7ff !important;
    }
    
    .regenerate-btn:hover {
      color: #51cf66 !important;
    }
    
    .delete-btn:hover {
      color: #ff6b6b !important;
    }
    
    /* Generate and cancel buttons should use their default colors */
    .generate-btn.primary {
      background: #0d6efd !important;
      color: white !important;
    }
    
    .cancel-btn {
      background: #6c757d !important;
      color: white !important;
    }
    
    .stop-btn {
      background: #dc3545 !important;
      color: white !important;
    }
    
    /* Ensure badges don't inherit text color */
    .beat-type-badge,
    .model-badge {
      color: initial !important;
    }
    
    .beat-type-badge.story-beat {
      color: #4dabf7 !important;
    }
    
    .beat-type-badge.scene-beat {
      color: #51cf66 !important;
    }
    
    .model-badge {
      color: #ffc107 !important;
    }
    
    .prompt-input.prosemirror-container :global(.ProseMirror[data-placeholder]:empty::before) {
      content: attr(data-placeholder);
      color: #6c757d;
      pointer-events: none;
      position: absolute;
    }
    
    .prompt-input.prosemirror-container :global(.ProseMirror p) {
      margin: 0;
      color: var(--beat-ai-text-color, #e0e0e0) !important;
      font-size: 0.9rem;
      line-height: 1.2;
    }
    
    .prompt-input.prosemirror-container :global(.ProseMirror p:empty) {
      min-height: 1em;
    }
    
    .prompt-input.prosemirror-container :global(.codex-highlight) {
      text-decoration: underline;
      text-decoration-style: dotted;
      cursor: help;
    }
    
    .prompt-input.prosemirror-container :global(.codex-highlight-title) {
      text-decoration-color: #4dabf7;
    }
    
    .prompt-input.prosemirror-container :global(.codex-highlight-tag) {
      text-decoration-color: #51cf66;
    }
    
    .prompt-input.prosemirror-container :global(.simple-text-editor) {
      position: relative;
      z-index: 1;
      /* Ensure this editor is isolated from parent editor events */
      pointer-events: auto;
    }
    
    .generation-options {
      margin-top: 0.5rem;
      margin-bottom: 0.5rem;
    }
    
    .options-row {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 1rem;
    }

    @media (max-width: 768px) {
      .options-row {
        grid-template-columns: 1fr;
        gap: 0.5rem;
      }
    }
    
    .option-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .model-selection-group {
      gap: 0.75rem;
    }
    
    .favorite-models {
      background: rgba(30, 30, 30, 0.3);
      backdrop-filter: blur(3px);
      padding: 0.5rem;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .favorite-label {
      font-size: 0.85rem;
      color: #adb5bd;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }
    
    .favorite-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    
    .favorite-btn {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.4rem 0.8rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      color: #e0e0e0;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    
    .favorite-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-1px);
    }
    
    .favorite-btn.active {
      background: rgba(13, 110, 253, 0.2);
      border-color: #0d6efd;
      color: #4dabf7;
    }
    
    .favorite-btn .provider-icon-inline {
      font-size: 0.9rem;
    }
    
    .model-short-name {
      font-weight: 500;
    }
    
    .favorite-toggle {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.2rem;
      margin-left: auto;
      font-size: 1rem;
      opacity: 0.3;
      transition: all 0.2s;
      filter: grayscale(1);
    }
    
    .favorite-toggle:hover {
      opacity: 0.7;
      transform: scale(1.2);
    }
    
    .favorite-toggle.is-favorite {
      opacity: 1;
      filter: grayscale(0);
    }
    
    .model-select {
      font-size: 0.9rem;
    }
    
    .custom-word-count {
      width: 100%;
      padding: 0.5rem;
      background: #1a1a1a;
      border: 1px solid #404040;
      border-radius: 6px;
      color: #f8f9fa;
      font-size: 0.9rem;
      transition: border-color 0.2s;
    }
    
    .custom-word-count:focus {
      outline: none;
      border-color: #0d6efd;
    }
    
    .custom-word-count::placeholder {
      color: #6c757d;
    }
    
    .model-name {
      display: block;
      font-weight: 500;
    }
    
    .model-cost {
      color: #28a745;
      font-weight: 500;
    }
    
    .model-option-inline {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .provider-icon-inline {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
    }
    
    .provider-icon-inline {
      display: inline-flex;
      align-items: center;
      margin-right: 0.25rem;
    }
    
    .provider-icon-inline.gemini {
      color: #4285f4;
    }
    
    .provider-icon-inline.openrouter {
      color: #00a67e;
    }

    .beat-type-option {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    
    .beat-type-label {
      font-weight: 500;
      color: #f8f9fa;
    }
    
    .beat-type-description {
      font-size: 0.8rem;
      color: #adb5bd;
      font-style: italic;
    }

    .beat-info {
      margin-top: 0.5rem;
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    
    .beat-type-badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .beat-type-badge.story-beat {
      background: rgba(13, 110, 253, 0.2);
      color: #4dabf7;
      border: 1px solid rgba(13, 110, 253, 0.3);
    }
    
    .beat-type-badge.scene-beat {
      background: rgba(40, 167, 69, 0.2);
      color: #51cf66;
      border: 1px solid rgba(40, 167, 69, 0.3);
    }

    .model-badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-weight: 500;
      background: rgba(255, 193, 7, 0.2);
      color: #ffc107;
      border: 1px solid rgba(255, 193, 7, 0.3);
      cursor: help;
    }

    .prompt-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    
    .generate-btn, .cancel-btn {
      padding: 0.2rem;
      border: none;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .generate-btn.primary {
      background: #0d6efd;
      color: white;
    }
    
    .generate-btn.secondary {
      background: #6c757d;
      color: white;
      padding: 0.2rem 0.4rem;
      min-width: auto;
    }
    
    .generate-btn.primary:hover:not(:disabled) {
      background: #0b5ed7;
    }
    
    .generate-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .cancel-btn {
      background: #6c757d;
      color: white;
    }
    
    .cancel-btn:hover {
      background: #5a6268;
    }
    
    .prompt-display {
      margin-top: 0.25rem;
      background: rgba(20, 20, 20, 0.2);
      backdrop-filter: blur(3px);
      padding: 0.5rem;
      border-radius: 4px;
    }
    
    .prompt-text {
      color: var(--beat-ai-text-color, #adb5bd);
      font-style: italic;
      font-size: 0.9rem;
      line-height: 1.4;
    }
    
    .generation-status {
      padding: 0.5rem 1rem;
      background: rgba(36, 36, 36, 0.2);
      backdrop-filter: blur(5px);
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .generation-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .stop-btn {
      background: #dc3545;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    
    .stop-btn:hover {
      background: #c82333;
    }
    
    .generating-text {
      color: #ffc107;
      font-size: 0.9rem;
      font-weight: 500;
    }
    
    .typing-indicator {
      display: inline-flex;
      gap: 2px;
      margin-left: 4px;
    }
    
    .typing-indicator span {
      width: 4px;
      height: 4px;
      background: #0d6efd;
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }
    
    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.4;
      }
      30% {
        transform: translateY(-8px);
        opacity: 1;
      }
    }
    
    /* Custom ng-select styling */
    :global(.model-select .ng-select-container) {
      min-height: 44px !important; /* iOS minimum touch target */
      background: #1a1a1a !important;
      border: 1px solid #404040 !important;
      border-radius: 4px !important;
    }
    
    :global(.model-select .ng-select-container .ng-value-container) {
      padding-left: 0.3rem !important;
      background: transparent !important;
    }
    
    :global(.model-select .ng-select-container .ng-value-container .ng-input > input) {
      color: #e0e0e0 !important;
      background: transparent !important;
    }
    
    :global(.model-select .ng-select-container .ng-value-container .ng-value) {
      color: #e0e0e0 !important;
      background: transparent !important;
    }
    
    :global(.model-select .ng-select-container .ng-value-container .ng-placeholder) {
      color: #6c757d !important;
    }
    
    :global(.model-select.ng-select-focused .ng-select-container) {
      border-color: #0d6efd !important;
      box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25) !important;
    }
    
    :global(.model-select .ng-dropdown-panel) {
      background: #2d2d2d !important;
      border: 1px solid #404040 !important;
      border-radius: 4px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
      z-index: 9999 !important;
    }
    
    :global(.model-select .ng-dropdown-panel .ng-dropdown-panel-items .ng-option) {
      color: #e0e0e0 !important;
      background: #2d2d2d !important;
      padding: 0.5rem !important;
      font-size: 0.9rem !important;
    }
    
    :global(.model-select .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-highlighted) {
      background: #383838 !important;
    }
    
    :global(.model-select .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-selected) {
      background: #0d6efd !important;
    }















    /* Mobile optimizations for Beat AI */
    @media (max-width: 768px) {
      .favorite-models {
        padding: 0.4rem;
      }
      
      .favorite-buttons {
        gap: 0.3rem;
      }
      
      .favorite-btn {
        padding: 0.3rem 0.6rem;
        font-size: 0.8rem;
      }
      
      .model-selection-group {
        gap: 0.5rem;
      }
      .beat-ai-container {
        margin: 0.2rem 0;
        border-radius: 6px;
      }
      
      .beat-prompt-section {
        padding: 0.4rem;
      }
      
      .beat-header {
        margin-bottom: 0.4rem;
      }
      
      .beat-title {
        font-size: 0.9rem;
      }
      
      .prompt-input.prosemirror-container :global(.ProseMirror) {
        font-size: 0.9rem;
        padding: 0.3rem !important;
        min-height: auto;
      }
      
      .generation-options {
        margin-top: 0.4rem;
        margin-bottom: 0.4rem;
      }
                  
      .prompt-actions {
        margin-top: 0.4rem;
        gap: 0.25rem;
      }
      
      .generate-btn, .cancel-btn {
        padding: 0.4rem 0.8rem;
        font-size: 0.85rem;
        min-width: 80px;
      }
      
      
      .generation-status {
        padding: 0.4rem 0.75rem;
        flex-direction: column;
        gap: 0.4rem;
        align-items: stretch;
      }
      
      .stop-btn {
        padding: 0.4rem 0.8rem;
        font-size: 0.8rem;
        align-self: center;
        min-width: 100px;
      }
    }

    @media (max-width: 480px) {
      .beat-ai-container {
        margin: 0.25rem 0;
      }
      
      .beat-prompt-section {
        padding: 0.3rem;
      }
      
      .beat-header {
        margin-bottom: 0.3rem;
      }
      
      .beat-actions {
        gap: 0.75rem;
        /* More padding on very small screens */
        padding: 0.4rem;
        /* Prevent buttons from being too close to screen edges */
        margin: 0 0.2rem;
      }
      
      .action-btn {
        /* Slightly larger on very small screens for better accessibility */
        width: 52px;
        height: 52px;
        min-width: 52px;
        min-height: 52px;
      }
      
      .prompt-actions {
        justify-content: center;
      }
      
      .generate-btn, .cancel-btn {
        flex: 1;
        min-width: auto;
        max-width: 120px;
      }
      
    }
  `],
  encapsulation: ViewEncapsulation.None
})
export class BeatAIComponent implements OnInit, OnDestroy, AfterViewInit {
  private modelService = inject(ModelService);
  private settingsService = inject(SettingsService);
  private beatAIService = inject(BeatAIService);
  private proseMirrorService = inject(ProseMirrorEditorService);
  private elementRef = inject(ElementRef);
  private popoverController = inject(PopoverController);
  private tokenCounter = inject(TokenCounterService);
  private modalService = inject(BeatAIModalService);

  @Input() beatData!: BeatAI;
  @Input() storyId?: string;
  @Input() chapterId?: string;
  @Input() sceneId?: string;
  @Output() promptSubmit = new EventEmitter<BeatAIPromptEvent>();
  currentTextColor = '#e0e0e0';
  @Output() contentUpdate = new EventEmitter<BeatAI>();
  @Output() delete = new EventEmitter<string>();
  @Output() beatFocus = new EventEmitter<void>();
  
  @ViewChild('promptInput') promptInput!: ElementRef<HTMLDivElement>;
  
  currentPrompt = '';
  selectedWordCount: number | string = 400;
  customWordCount = 400;
  showCustomWordCount = false;
  selectedModel = '';
  availableModels: ModelOption[] = [];
  favoriteModels: ModelOption[] = [];
  selectedBeatType: 'story' | 'scene' = 'story';
  beatTypeOptions = [
    { value: 'story', label: 'StoryBeat', description: 'With complete story context' },
    { value: 'scene', label: 'SceneBeat', description: 'Ohne Szenen-Zusammenfassungen' }
  ];
  wordCountOptions = [
    { value: 20, label: '~20 words' },
    { value: 50, label: '~50 words' },
    { value: 100, label: '~100 words' },
    { value: 200, label: '~200 words' },
    { value: 400, label: '~400 words' },
    { value: 600, label: '~600 words' },
    { value: 800, label: '~800 words' },
    { value: 1000, label: '~1,000 words' },
    { value: 1500, label: '~1,500 words' },
    { value: 2000, label: '~2,000 words' },
    { value: 3000, label: '~3,000 words' },
    { value: 5000, label: '~5,000 words' },
    { value: 8000, label: '~8,000 words' },
    { value: 10000, label: '~10,000 words' },
    { value: 12000, label: '~12,000 words' },
    { value: 'custom', label: 'Custom amount...' }
  ];
  copyButtonText = 'Copy';
  
  // Context selection properties
  story: Story | null = null;
  selectedScenes: SceneContext[] = [];
  showSceneSelector = false;
  sceneSearchTerm = '';
  includeStoryOutline = true; // Default to including story outline
  
  private subscription = new Subscription();
  private editorView: EditorView | null = null;
  private storyService = inject(StoryService);
  
  constructor() {
    // Register icons
    addIcons({ logoGoogle, globeOutline, createOutline, refreshOutline, trashOutline, analyticsOutline, colorWandOutline, addOutline, closeOutline, readerOutline, copyOutline });
  }
  
  ngOnInit(): void {
    // Set initial text color from settings immediately
    const settings = this.settingsService.getSettings();
    this.currentTextColor = settings.appearance?.textColor || '#e0e0e0';
    
    this.currentPrompt = this.beatData.prompt;
    
    // Subscribe to modal events
    this.modalService.close$.subscribe(() => this.hidePromptPreview());
    this.modalService.generate$.subscribe(() => this.generateContent());
    this.modalService.copy$.subscribe(() => this.copyPromptToClipboard());
    
    // Load saved beat type or use default
    this.selectedBeatType = this.beatData.beatType || 'story';
    
    // Load saved word count or use default
    if (this.beatData.wordCount) {
      // Check if it's a custom value
      const isPresetValue = this.wordCountOptions.some(option => 
        typeof option.value === 'number' && option.value === this.beatData.wordCount
      );
      
      if (isPresetValue) {
        this.selectedWordCount = this.beatData.wordCount;
      } else {
        // It's a custom value
        this.selectedWordCount = 'custom';
        this.customWordCount = this.beatData.wordCount;
        this.showCustomWordCount = true;
      }
    }
    
    // Load saved scene selection and story outline setting
    if (this.beatData.includeStoryOutline !== undefined) {
      this.includeStoryOutline = this.beatData.includeStoryOutline;
    }
    
    // Load available models and set default
    this.loadAvailableModels();
    this.setDefaultModel();
    
    // Load story and setup default context
    this.loadStoryAndSetupContext();
    
    // Auto-focus prompt input if it's a new beat
    if (!this.beatData.prompt) {
      this.beatData.isEditing = true;
      // Wait for DOM to update with editing state, then initialize editor
      setTimeout(() => {
        if (this.promptInput && !this.editorView) {
          this.initializeProseMirrorEditor();
        }
      }, 100);
    }
    
    // Subscribe to generation events for this beat
    this.subscription.add(
      this.beatAIService.generation$.subscribe(generationEvent => {
        if (generationEvent.beatId === this.beatData.id) {
          if (generationEvent.isComplete) {
            // Generation completed
            this.beatData.isGenerating = false;
            this.contentUpdate.emit(this.beatData);
          }
          // Note: Streaming text is handled directly in the editor via ProseMirror service
          // The component just tracks the generation state
        }
      })
    );
  }
  
  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }
  }

  ngAfterViewInit(): void {
    // Initialize ProseMirror editor if in editing mode
    if (this.beatData.isEditing && this.promptInput && !this.editorView) {
      this.initializeProseMirrorEditor();
    }
    
    // Apply text color to this specific component
    this.applyTextColorDirectly();
  }

  private initializeProseMirrorEditor(): void {
    if (!this.promptInput || this.editorView) return;

    const config: SimpleEditorConfig = {
      placeholder: 'Describe the beat that the AI should generate...',
      onUpdate: (content: string) => {
        this.currentPrompt = content;
        this.onPromptChange();
      },
      storyContext: {
        storyId: this.storyId,
        chapterId: this.chapterId,
        sceneId: this.sceneId
      }
    };

    this.editorView = this.proseMirrorService.createSimpleTextEditor(
      this.promptInput.nativeElement,
      config
    );

    // Set initial content if available
    if (this.currentPrompt) {
      // Use setSimpleContent to ensure codex highlighting is processed
      this.proseMirrorService.setSimpleContent(this.currentPrompt);
      // Ensure currentPrompt stays synchronized after setting content
      // (setSimpleContent doesn't trigger the onUpdate callback)
    }
  }

  private insertTextDirectly(text: string): void {
    if (!this.editorView || !text) return;

    // Insert text at position 1 (after the paragraph start)
    const { state } = this.editorView;
    const tr = state.tr.insertText(text, 1);
    this.editorView.dispatch(tr);
  }
  
  async startEditing(): Promise<void> {
    this.beatData.isEditing = true;
    this.currentPrompt = this.beatData.prompt;
    this.beatFocus.emit();
    
    // Restore all persisted settings when switching back to edit mode
    await this.restorePersistedSettings();
    
    // Destroy existing editor if it exists (DOM element will be recreated by *ngIf)
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }
    
    // Initialize editor after DOM updates
    setTimeout(() => {
      if (this.promptInput) {
        this.initializeProseMirrorEditor();
      }
      
      // Focus editor after initialization
      setTimeout(() => {
        if (this.editorView) {
          this.editorView.focus();
        }
      }, 50);
    }, 100);
  }
  
  async cancelEditing(): Promise<void> {
    this.beatData.isEditing = false;
    this.currentPrompt = this.beatData.prompt;
    
    // Restore all persisted settings when canceling
    await this.restorePersistedSettings();
    
    // Destroy editor when canceling
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }
  }
  
  async generateContent(): Promise<void> {
    if (!this.currentPrompt.trim() || !this.selectedModel) return;
    
    this.beatData.prompt = this.currentPrompt.trim();
    this.beatData.isEditing = false;
    this.beatData.isGenerating = true;
    this.beatData.updatedAt = new Date();
    this.beatData.wordCount = this.getActualWordCount();
    this.beatData.model = this.selectedModel;
    this.beatData.beatType = this.selectedBeatType;
    
    // Persist the selected scenes and story outline setting
    this.beatData.selectedScenes = this.selectedScenes.map(scene => ({
      sceneId: scene.sceneId,
      chapterId: scene.chapterId
    }));
    this.beatData.includeStoryOutline = this.includeStoryOutline;
    
    // Build custom context from selected scenes
    const customContext = await this.buildCustomContext();
    
    this.promptSubmit.emit({
      beatId: this.beatData.id,
      prompt: this.beatData.prompt,
      action: 'generate',
      wordCount: this.getActualWordCount(),
      model: this.selectedModel,
      storyId: this.storyId,
      chapterId: this.chapterId,
      sceneId: this.sceneId,
      beatType: this.beatData.beatType,
      customContext: customContext // Add custom context
    });
    
    this.contentUpdate.emit(this.beatData);
  }
  
  async regenerateContent(): Promise<void> {
    if (!this.beatData.prompt) return;
    
    this.beatData.isGenerating = true;
    this.beatData.wordCount = this.getActualWordCount();
    this.beatData.model = this.selectedModel;
    this.beatData.beatType = this.selectedBeatType;
    
    // Persist the selected scenes and story outline setting
    this.beatData.selectedScenes = this.selectedScenes.map(scene => ({
      sceneId: scene.sceneId,
      chapterId: scene.chapterId
    }));
    this.beatData.includeStoryOutline = this.includeStoryOutline;
    
    // Build custom context from selected scenes
    const customContext = await this.buildCustomContext();
    
    this.promptSubmit.emit({
      beatId: this.beatData.id,
      prompt: this.beatData.prompt,
      action: 'generate',
      wordCount: this.getActualWordCount(),
      model: this.selectedModel,
      storyId: this.storyId,
      chapterId: this.chapterId,
      sceneId: this.sceneId,
      beatType: this.beatData.beatType,
      customContext: customContext // Add custom context
    });
    
    this.contentUpdate.emit(this.beatData);
  }
  
  deleteContentAfterBeat(): void {
    if (confirm('Do you really want to delete all text after this beat? This action cannot be undone.')) {
      this.promptSubmit.emit({
        beatId: this.beatData.id,
        action: 'deleteAfter',
        storyId: this.storyId,
        chapterId: this.chapterId,
        sceneId: this.sceneId,
        beatType: this.beatData.beatType
      });
    }
  }
  
  onPromptKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.generateContent();
    }
  }
  
  onPromptChange(): void {
    // ProseMirror handles content changes automatically
  }

  onWordCountChange(): void {
    if (this.selectedWordCount === 'custom') {
      this.showCustomWordCount = true;
      // Focus the custom input after Angular updates the view
      setTimeout(() => {
        const customInput = document.querySelector('.custom-word-count') as HTMLInputElement;
        if (customInput) {
          customInput.focus();
          customInput.select();
        }
      }, 0);
    } else {
      this.showCustomWordCount = false;
      this.customWordCount = this.selectedWordCount as number;
    }
  }

  validateCustomWordCount(): void {
    if (this.customWordCount < 10) {
      this.customWordCount = 10;
    } else if (this.customWordCount > 50000) {
      this.customWordCount = 50000;
    }
  }

  onBeatTypeChange(): void {
    // Update the beat data with the new type
    this.beatData.beatType = this.selectedBeatType;
    this.beatData.updatedAt = new Date();
    
    // Emit the content update to save the change
    this.contentUpdate.emit(this.beatData);
  }

  private getActualWordCount(): number {
    if (this.selectedWordCount === 'custom') {
      return this.customWordCount;
    }
    return this.selectedWordCount as number;
  }

  private loadAvailableModels(): void {
    // Subscribe to settings changes to reload models when API switches
    this.subscription.add(
      this.settingsService.settings$.subscribe(settings => {
        this.reloadModels();
        // Update text color
        this.currentTextColor = settings.appearance?.textColor || '#e0e0e0';
        
        // Apply the new color to this component
        this.applyTextColorDirectly();
        
        // Update favorite models
        this.updateFavoriteModels();
      })
    );
    
    // Initial load
    this.reloadModels();
  }
  
  private reloadModels(): void {
    // Load combined models from all active APIs
    this.subscription.add(
      this.modelService.getCombinedModels().subscribe(models => {
        this.availableModels = models;
        if (models.length > 0 && !this.selectedModel) {
          this.setDefaultModel();
        }
        // Update favorite models after loading
        this.updateFavoriteModels();
      })
    );
  }
  
  private setDefaultModel(): void {
    const settings = this.settingsService.getSettings();
    
    // First priority: use the model stored with this beat
    if (this.beatData.model && this.availableModels.some(m => m.id === this.beatData.model)) {
      this.selectedModel = this.beatData.model;
    }
    // Second priority: use the global selected model if available
    else if (settings.selectedModel) {
      this.selectedModel = settings.selectedModel;
    } 
    // Fallback: use first available model
    else if (this.availableModels.length > 0) {
      this.selectedModel = this.availableModels[0].id;
    }
  }

  private async restorePersistedSettings(): Promise<void> {
    // Restore the persisted model
    this.setDefaultModel();
    
    // Restore the persisted word count
    if (this.beatData.wordCount) {
      // Check if it's a custom value
      const isPresetValue = this.wordCountOptions.some(option => 
        typeof option.value === 'number' && option.value === this.beatData.wordCount
      );
      
      if (isPresetValue) {
        this.selectedWordCount = this.beatData.wordCount;
        this.showCustomWordCount = false;
      } else {
        // It's a custom value
        this.selectedWordCount = 'custom';
        this.customWordCount = this.beatData.wordCount;
        this.showCustomWordCount = true;
      }
    }
    
    // Restore the persisted beat type
    if (this.beatData.beatType) {
      this.selectedBeatType = this.beatData.beatType;
    }
    
    // Restore the persisted story outline setting
    if (this.beatData.includeStoryOutline !== undefined) {
      this.includeStoryOutline = this.beatData.includeStoryOutline;
    }
    
    // Restore the persisted selected scenes
    if (this.beatData.selectedScenes && this.beatData.selectedScenes.length > 0 && this.story) {
      // Clear current selection
      this.selectedScenes = [];
      
      // Restore each persisted scene
      for (const persistedScene of this.beatData.selectedScenes) {
        const chapter = this.story.chapters.find(c => c.id === persistedScene.chapterId);
        const scene = chapter?.scenes.find(s => s.id === persistedScene.sceneId);
        
        if (chapter && scene) {
          this.selectedScenes.push({
            chapterId: chapter.id,
            sceneId: scene.id,
            chapterTitle: `C${chapter.chapterNumber || chapter.order}:${chapter.title}`,
            sceneTitle: `S${scene.sceneNumber || scene.order}:${scene.title}`,
            content: this.extractFullTextFromScene(scene),
            selected: true
          });
        }
      }
    }
  }

  private focusPromptInput(): void {
    if (this.editorView) {
      this.editorView.focus();
    }
  }

  async showPromptPreview(): Promise<void> {
    if (!this.currentPrompt.trim()) {
      return;
    }

    // Build custom context from selected scenes
    const customContext = await this.buildCustomContext();

    // Use the context provided via Input properties
    // These will be set by the BeatAINodeView from the story editor context
    this.beatAIService.previewPrompt(this.currentPrompt, this.beatData.id, {
      storyId: this.storyId,
      chapterId: this.chapterId,
      sceneId: this.sceneId,
      wordCount: this.getActualWordCount(),
      beatType: this.beatData.beatType,
      customContext: customContext
    }).subscribe(content => {
      this.modalService.show(content);
    });
  }

  hidePromptPreview(): void {
    this.modalService.close();
  }

  async showTokenInfo(): Promise<void> {
    if (!this.currentPrompt.trim() || !this.selectedModel) {
      return;
    }

    // Build custom context from selected scenes
    const customContext = await this.buildCustomContext();

    // Get the full prompt that would be sent to the model
    const fullPrompt = await this.beatAIService.previewPrompt(this.currentPrompt, this.beatData.id, {
      storyId: this.storyId,
      chapterId: this.chapterId,
      sceneId: this.sceneId,
      wordCount: this.getActualWordCount(),
      beatType: this.beatData.beatType,
      customContext: customContext
    }).toPromise();

    // Map the selected model to SupportedModel type
    // Handle formats like "gemini:gemini-1.5-pro" or "openrouter:anthropic/claude-3-haiku"
    let modelToMap = this.selectedModel;
    if (modelToMap.includes(':')) {
      const parts = modelToMap.split(':');
      modelToMap = parts[1] || modelToMap;
    }
    if (modelToMap.includes('/')) {
      modelToMap = modelToMap.split('/').pop() || modelToMap;
    }

    const modelMapping: Record<string, SupportedModel> = {
      'claude-3-5-sonnet-20241022': 'claude-3.5-sonnet',
      'claude-3-5-sonnet': 'claude-3.5-sonnet',
      'claude-3.5-sonnet': 'claude-3.5-sonnet',
      'claude-3-5-sonnet-v2': 'claude-3.7-sonnet',
      'claude-3.7-sonnet': 'claude-3.7-sonnet',
      'claude-3-haiku': 'claude-3.5-sonnet', // Map haiku to closest available
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-1.5-pro-latest': 'gemini-1.5-pro',
      'gemini-2.0-flash-thinking-exp': 'gemini-2.5-pro',
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'grok-beta': 'grok-3',
      'grok-3': 'grok-3'
    };

    const mappedModel = modelMapping[modelToMap] || 'custom';

    const popover = await this.popoverController.create({
      component: TokenInfoPopoverComponent,
      componentProps: {
        prompt: fullPrompt || this.currentPrompt,
        model: mappedModel,
        showComparison: true
      },
      cssClass: 'token-info-popover',
      translucent: true,
      mode: 'ios',
      showBackdrop: true,
      backdropDismiss: true
    });

    await popover.present();
  }

  stopGeneration(): void {
    this.beatAIService.stopGeneration(this.beatData.id);
    this.beatData.isGenerating = false;
    this.contentUpdate.emit(this.beatData);
  }

  onModelChange(): void {
    // Save the selected model to the beat data
    if (this.selectedModel) {
      this.beatData.model = this.selectedModel;
      this.beatData.updatedAt = new Date();
      this.contentUpdate.emit(this.beatData);
    }
  }

  getProviderIcon(provider: string): string {
    switch (provider) {
      case 'gemini':
        return 'logo-google';
      case 'openrouter':
        return 'globe-outline';
      case 'anthropic':
        return 'globe-outline'; // Oder ein spezifisches Icon wenn verfügbar
      default:
        return 'globe-outline';
    }
  }

  getModelDisplayName(modelId: string): string {
    if (!modelId) return '';
    
    // Find the model in available models to get its display name
    const model = this.availableModels.find(m => m.id === modelId);
    if (model) {
      return model.label;
    }
    
    // If not found in available models, try to extract a readable name from the ID
    // Handle format like "gemini:gemini-1.5-pro" or "openrouter:anthropic/claude-3-haiku"
    if (modelId.includes(':')) {
      const parts = modelId.split(':');
      const modelName = parts[1] || modelId;
      return modelName.split('/').pop() || modelName; // Handle provider/model format
    }
    
    return modelId;
  }

  private applyTextColorDirectly(): void {
    // The story editor's MutationObserver will handle this automatically,
    // but we still apply it directly for immediate feedback
    setTimeout(() => {
      const hostElement = this.elementRef.nativeElement;
      
      if (hostElement) {
        const container = hostElement.querySelector?.('.beat-ai-container') || hostElement;
        if (container) {
          (container as HTMLElement).style.setProperty('--beat-ai-text-color', this.currentTextColor);
        }
      }
    }, 50);
  }
  
  private updateFavoriteModels(): void {
    const settings = this.settingsService.getSettings();
    const favoriteIds = settings.favoriteModels || [];
    
    this.favoriteModels = this.availableModels.filter(model => 
      favoriteIds.includes(model.id)
    );
  }
  
  selectFavoriteModel(model: ModelOption): void {
    this.selectedModel = model.id;
    this.onModelChange();
  }
  
  getShortModelName(label: string): string {
    // Create short names for favorite buttons
    if (label.includes('Claude 3.7 Sonnet') || label.includes('Claude 3.5 Sonnet v2')) return 'Claude 3.7';
    if (label.includes('Claude Sonnet 4')) return 'Sonnet 4';
    if (label.includes('Gemini 2.5 Pro')) return 'Gemini 2.5';
    if (label.includes('Grok-3') || label.includes('Grok3')) return 'Grok3';
    
    // For other models, try to extract a short name
    const parts = label.split(' ');
    if (parts.length > 2) {
      return `${parts[0]} ${parts[1]}`;
    }
    return label;
  }
  
  toggleFavorite(event: Event, model: ModelOption): void {
    event.stopPropagation();
    event.preventDefault();
    
    const settings = this.settingsService.getSettings();
    const favoriteIds = settings.favoriteModels || [];
    
    const index = favoriteIds.indexOf(model.id);
    if (index > -1) {
      // Remove from favorites
      favoriteIds.splice(index, 1);
    } else {
      // Add to favorites (max 6 favorites)
      if (favoriteIds.length < 6) {
        favoriteIds.push(model.id);
      } else {
        // Replace the oldest favorite
        favoriteIds.shift();
        favoriteIds.push(model.id);
      }
    }
    
    // Save updated favorites
    this.settingsService.updateSettings({
      ...settings,
      favoriteModels: favoriteIds
    });
  }
  
  isFavorite(modelId: string): boolean {
    const settings = this.settingsService.getSettings();
    return (settings.favoriteModels || []).includes(modelId);
  }

  // Context selection methods
  private async loadStoryAndSetupContext(): Promise<void> {
    if (!this.storyId) return;
    
    try {
      this.story = await this.storyService.getStory(this.storyId);
      if (this.story) {
        await this.setupDefaultContext();
      }
    } catch (error) {
      console.error('Error loading story for beat context:', error);
    }
  }

  private async setupDefaultContext(): Promise<void> {
    if (!this.storyId || !this.chapterId || !this.sceneId) return;
    
    // Always get fresh data from database to ensure we have the latest content
    const freshStory = await this.storyService.getStory(this.storyId);
    if (!freshStory) return;
    
    // Check if there are persisted selected scenes to restore
    if (this.beatData.selectedScenes && this.beatData.selectedScenes.length > 0) {
      // Restore persisted selected scenes
      for (const persistedScene of this.beatData.selectedScenes) {
        const chapter = freshStory.chapters.find(c => c.id === persistedScene.chapterId);
        const scene = chapter?.scenes.find(s => s.id === persistedScene.sceneId);
        
        if (chapter && scene) {
          this.selectedScenes.push({
            chapterId: chapter.id,
            sceneId: scene.id,
            chapterTitle: `C${chapter.chapterNumber || chapter.order}:${chapter.title}`,
            sceneTitle: `S${scene.sceneNumber || scene.order}:${scene.title}`,
            content: this.extractFullTextFromScene(scene),
            selected: true
          });
        }
      }
    } else {
      // Set up default context if no persisted scenes
      const chapter = freshStory.chapters.find(c => c.id === this.chapterId);
      const scene = chapter?.scenes.find(s => s.id === this.sceneId);
      
      if (chapter && scene) {
        // Add current scene as default context
        const currentSceneContent = this.extractFullTextFromScene(scene);
        
        // If current scene has no content, try to find the previous scene with content
        let contentToUse = currentSceneContent;
        if (!contentToUse.trim()) {
          const previousScene = this.findPreviousSceneWithContent(chapter, scene);
          if (previousScene.scene) {
            contentToUse = this.extractFullTextFromScene(previousScene.scene);
          }
        }
        
        this.selectedScenes.push({
          chapterId: chapter.id,
          sceneId: scene.id,
          chapterTitle: `C${chapter.chapterNumber || chapter.order}:${chapter.title}`,
          sceneTitle: `S${scene.sceneNumber || scene.order}:${scene.title}`,
          content: contentToUse,
          selected: true
        });
      }
    }
  }

  private findPreviousSceneWithContent(currentChapter: Chapter, currentScene: Scene): { chapter: Chapter; scene: Scene } | { chapter: null; scene: null } {
    if (!this.story) return { chapter: null, scene: null };
    
    // First, try to find previous scene in current chapter
    const currentSceneIndex = currentChapter.scenes.findIndex(s => s.id === currentScene.id);
    if (currentSceneIndex > 0) {
      for (let i = currentSceneIndex - 1; i >= 0; i--) {
        const scene = currentChapter.scenes[i];
        const content = this.extractFullTextFromScene(scene);
        if (content.trim()) {
          return { chapter: currentChapter, scene };
        }
      }
    }
    
    // If no previous scene found in current chapter, try previous chapters
    const currentChapterIndex = this.story.chapters.findIndex(c => c.id === currentChapter.id);
    if (currentChapterIndex > 0) {
      for (let i = currentChapterIndex - 1; i >= 0; i--) {
        const chapter = this.story.chapters[i];
        // Start from last scene in previous chapter
        for (let j = chapter.scenes.length - 1; j >= 0; j--) {
          const scene = chapter.scenes[j];
          const content = this.extractFullTextFromScene(scene);
          if (content.trim()) {
            return { chapter, scene };
          }
        }
      }
    }
    
    return { chapter: null, scene: null };
  }

  async toggleSceneSelection(chapterId: string, sceneId: string): Promise<void> {
    const index = this.selectedScenes.findIndex(s => s.sceneId === sceneId);
    
    if (index > -1) {
      this.selectedScenes.splice(index, 1);
    } else {
      // Get fresh data from database to ensure latest content
      const freshStory = await this.storyService.getStory(this.storyId!);
      if (!freshStory) return;
      
      const chapter = freshStory.chapters.find(c => c.id === chapterId);
      const scene = chapter?.scenes.find(s => s.id === sceneId);
      
      if (chapter && scene) {
        this.selectedScenes.push({
          chapterId: chapter.id,
          sceneId: scene.id,
          chapterTitle: `C${chapter.chapterNumber || chapter.order}:${chapter.title}`,
          sceneTitle: `S${scene.sceneNumber || scene.order}:${scene.title}`,
          content: this.extractFullTextFromScene(scene),
          selected: true
        });
      }
    }
    
    // Persist the selected scenes
    this.persistContextSettings();
  }

  isSceneSelected(sceneId: string): boolean {
    return this.selectedScenes.some(s => s.sceneId === sceneId);
  }

  removeSceneContext(scene: SceneContext): void {
    const index = this.selectedScenes.findIndex(s => s.sceneId === scene.sceneId);
    if (index > -1) {
      this.selectedScenes.splice(index, 1);
    }
    
    // Persist the updated selected scenes
    this.persistContextSettings();
  }

  getFilteredScenes(chapter: Chapter): Scene[] {
    if (!this.sceneSearchTerm) return chapter.scenes;
    
    const searchLower = this.sceneSearchTerm.toLowerCase();
    return chapter.scenes.filter(scene => 
      scene.title.toLowerCase().includes(searchLower) ||
      scene.content.toLowerCase().includes(searchLower)
    );
  }

  getScenePreview(scene: Scene): string {
    const cleanText = this.extractFullTextFromScene(scene);
    return cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : '');
  }

  private extractFullTextFromScene(scene: Scene): string {
    if (!scene.content) return '';

    // Use DOM parser for more reliable HTML parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(scene.content, 'text/html');
    
    // Remove all beat AI wrapper elements and their contents
    const beatWrappers = doc.querySelectorAll('.beat-ai-wrapper, .beat-ai-node');
    beatWrappers.forEach(element => element.remove());
    
    // Remove beat markers and comments
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }
    
    textNodes.forEach(textNode => {
      // Remove beat markers like [Beat: description]
      textNode.textContent = textNode.textContent?.replace(/\[Beat:[^\]]*\]/g, '') || '';
    });
    
    // Convert to text while preserving paragraph structure
    let cleanText = '';
    const paragraphs = doc.querySelectorAll('p');
    
    for (const p of paragraphs) {
      const text = p.textContent?.trim() || '';
      if (text) {
        cleanText += text + '\n\n';
      } else {
        // Empty paragraph becomes single newline
        cleanText += '\n';
      }
    }
    
    // If no paragraphs found, fall back to body text
    if (!paragraphs.length) {
      cleanText = doc.body.textContent || '';
    }
    
    // Clean up extra whitespace
    cleanText = cleanText.replace(/\n\s*\n\s*\n/g, '\n\n');
    cleanText = cleanText.trim();

    return cleanText;
  }

  private async buildCustomContext(): Promise<{ 
    selectedScenes: string[]; 
    includeStoryOutline: boolean;
    selectedSceneContexts: { sceneId: string; chapterId: string; content: string; }[];
  }> {
    // For the current scene, get fresh content from database
    const freshSelectedScenes = [];
    
    for (const scene of this.selectedScenes) {
      let content = scene.content;
      
      // If this is the current scene being edited, get fresh content from database
      if (scene.sceneId === this.sceneId && this.storyId) {
        try {
          const freshStory = await this.storyService.getStory(this.storyId);
          if (freshStory) {
            const freshChapter = freshStory.chapters.find(c => c.id === scene.chapterId);
            const freshScene = freshChapter?.scenes.find(s => s.id === scene.sceneId);
            if (freshScene) {
              content = this.extractFullTextFromScene(freshScene);
            }
          }
        } catch (error) {
          console.error('Error getting fresh scene content:', error);
          // Fall back to cached content
        }
      }
      
      freshSelectedScenes.push({
        sceneId: scene.sceneId,
        chapterId: scene.chapterId,
        content: content
      });
    }
    
    return {
      selectedScenes: freshSelectedScenes.map(scene => scene.content),
      includeStoryOutline: this.includeStoryOutline,
      selectedSceneContexts: freshSelectedScenes
    };
  }

  async copyPromptToClipboard(): Promise<void> {
    if (!this.modalService.content) {
      return;
    }
    
    try {
      await navigator.clipboard.writeText(this.modalService.content);
      
      // Brief visual feedback
      this.copyButtonText = 'Kopiert!';
      setTimeout(() => {
        this.copyButtonText = 'Copy';
      }, 1500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers
      this.fallbackCopyTextToClipboard(this.modalService.content);
    }
  }

  private fallbackCopyTextToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.copyButtonText = 'Kopiert!';
        setTimeout(() => {
          this.copyButtonText = 'Copy';
        }, 1500);
      }
    } catch (err) {
      console.error('Fallback: Could not copy text: ', err);
    }
    
    document.body.removeChild(textArea);
  }

  toggleStoryOutline(): void {
    this.includeStoryOutline = !this.includeStoryOutline;
    this.persistContextSettings();
  }

  removeStoryOutline(): void {
    this.includeStoryOutline = false;
    this.persistContextSettings();
  }

  private persistContextSettings(): void {
    // Update the beat data with current settings
    this.beatData.selectedScenes = this.selectedScenes.map(scene => ({
      sceneId: scene.sceneId,
      chapterId: scene.chapterId
    }));
    this.beatData.includeStoryOutline = this.includeStoryOutline;
    this.beatData.updatedAt = new Date();
    
    // Emit the change to trigger saving
    this.contentUpdate.emit(this.beatData);
  }
  




}
