import { Component, Input, Output, EventEmitter, AfterViewInit, OnInit, OnChanges, OnDestroy, SimpleChanges, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonList, IonItem, IonLabel, IonButton, IonIcon, IonInput,
  IonChip, IonTextarea, IonSelect, IonSelectOption, IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  chevronForward, chevronDown, add, trash, createOutline,
  flashOutline, documentTextOutline, timeOutline, sparklesOutline, close
} from 'ionicons/icons';
import { Story, Chapter, Scene } from '../models/story.interface';
import { StoryService } from '../services/story.service';
import { OpenRouterApiService } from '../../core/services/openrouter-api.service';
import { GoogleGeminiApiService } from '../../core/services/google-gemini-api.service';
import { ModelService } from '../../core/services/model.service';
import { SettingsService } from '../../core/services/settings.service';
import { PromptManagerService } from '../../shared/services/prompt-manager.service';
import { ModelOption } from '../../core/models/model.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-story-structure',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonList, IonItem, IonLabel, IonButton, IonIcon, IonInput,
    IonChip, IonTextarea, IonSelect, IonSelectOption, IonBadge
  ],
  template: `
    <div class="story-structure" role="navigation" aria-label="Story structure">
      <div class="structure-header">
        <h2>Structure</h2>
        <ion-button 
          fill="clear" 
          size="small"
          class="close-button"
          (click)="onCloseSidebar()"
          aria-label="Close sidebar">
          <ion-icon name="close" slot="icon-only"></ion-icon>
        </ion-button>
      </div>
      
      <ion-content class="structure-content" [scrollEvents]="true">
        <div id="add-chapter-help" class="sr-only">
          Adds a new chapter to the story
        </div>
        
        <div class="structure-actions">
          <ion-button 
            expand="block" 
            fill="outline" 
            color="primary" 
            class="add-chapter-btn" 
            (click)="addChapter()"
            aria-label="Add new chapter">
            <ion-icon name="add" slot="start" [attr.aria-hidden]="true"></ion-icon>
            New Chapter
          </ion-button>
        </div>
        
        <ion-list class="chapters-list" role="tree" aria-label="Chapters and Scenes">
          <div *ngFor="let chapter of story.chapters; trackBy: trackChapter" 
               class="chapter-item">
            
            <ion-item 
              button 
              detail="false" 
              (click)="toggleChapter(chapter.id)" 
              (keydown)="onChapterKeyDown($event, chapter.id)"
              class="chapter-header"
              role="treeitem"
              tabindex="0"
              [attr.aria-expanded]="expandedChapters.has(chapter.id)"
              [attr.aria-label]="'Chapter: ' + (chapter.title || 'Untitled') + '. ' + (expandedChapters.has(chapter.id) ? 'Collapsed' : 'Expanded')">
              <ion-icon 
                [name]="expandedChapters.has(chapter.id) ? 'chevron-down' : 'chevron-forward'" 
                slot="start" 
                class="expand-icon"
                (click)="toggleChapter(chapter.id); $event.stopPropagation()"
                [attr.aria-hidden]="true">
              </ion-icon>
              <div class="chapter-title-container">
                <div class="chapter-id-display">{{ 'C' + (chapter.chapterNumber || chapter.order) }}</div>
                <ion-input 
                  [(ngModel)]="chapter.title" 
                  (ionBlur)="updateChapter(chapter)"
                  (click)="$event.stopPropagation()"
                  class="chapter-title-input"
                  placeholder="Chapter Title"
                  [attr.aria-label]="'Edit chapter title'"
                ></ion-input>
              </div>
              <ion-button 
                fill="clear" 
                color="danger" 
                slot="end" 
                (click)="deleteChapter(chapter.id, $event)"
                [attr.aria-label]="'Delete chapter: ' + (chapter.title || 'Untitled')">
                <ion-icon name="trash" slot="icon-only" [attr.aria-hidden]="true"></ion-icon>
              </ion-button>
            </ion-item>
            
            <div class="scenes-list" *ngIf="expandedChapters.has(chapter.id)" role="group" [attr.aria-label]="'Scenes in chapter: ' + (chapter.title || 'Untitled')">
              <ion-list role="none">
                <ng-container *ngFor="let scene of chapter.scenes; trackBy: trackScene">
                  <ion-item 
                    button
                    detail="false"
                    [class.active-scene]="isActiveScene(chapter.id, scene.id)"
                    (click)="selectScene(chapter.id, scene.id)"
                    (keydown)="onSceneKeyDown($event, chapter.id, scene.id)"
                    class="scene-item multi-line"
                    role="treeitem"
                    tabindex="0"
                    [attr.aria-selected]="isActiveScene(chapter.id, scene.id)"
                    [attr.aria-label]="'Scene: ' + (scene.title || 'Untitled') + '. ' + (getWordCount(scene.content)) + ' words' + (isActiveScene(chapter.id, scene.id) ? '. Currently selected' : '')">
                    
                    <div class="scene-content">
                      <!-- First line: Scene title with AI button -->
                      <div class="scene-title-row">
                        <div class="scene-title-container">
                          <div class="scene-id-display">{{ 'C' + (chapter.chapterNumber || chapter.order) + 'S' + (scene.sceneNumber || scene.order) }}</div>
                          <div 
                            *ngIf="!isEditingTitle.has(scene.id)"
                            class="scene-title-display"
                            (click)="startEditingTitle(scene.id, $event)"
                            [attr.aria-label]="'Scene title: ' + (scene.title || 'Untitled') + '. Click to edit.'"
                            tabindex="0"
                            (keydown.enter)="startEditingTitle(scene.id, $event)"
                            (keydown.space)="startEditingTitle(scene.id, $event)">
                            {{ scene.title || 'Scene Title' }}
                          </div>
                          <ion-input 
                            *ngIf="isEditingTitle.has(scene.id)"
                            [(ngModel)]="scene.title" 
                            (ionBlur)="stopEditingTitle(chapter.id, scene)"
                            (keydown.enter)="stopEditingTitle(chapter.id, scene)"
                            (keydown.escape)="cancelEditingTitle(scene)"
                            (click)="$event.stopPropagation()"
                            class="scene-title-input-edit"
                            placeholder="Scene Title"
                            fill="clear"
                            [attr.aria-label]="'Edit scene title'"
                            #titleInput
                          ></ion-input>
                        </div>
                        
                        <ion-button 
                          fill="clear" 
                          size="small"
                          [color]="isGeneratingTitle.has(scene.id) ? 'medium' : 'primary'"
                          (click)="generateSceneTitle(chapter.id, scene.id, $event)"
                          [disabled]="isGeneratingTitle.has(scene.id) || !selectedModel || !scene.content.trim()"
                          class="ai-title-btn"
                          [attr.aria-label]="isGeneratingTitle.has(scene.id) ? 'Title is being generated...' : 'Generate AI title for scene'"
                          (touchstart)="$event.stopPropagation()"
                          (touchend)="$event.stopPropagation()">
                          <ion-icon 
                            [name]="isGeneratingTitle.has(scene.id) ? 'time-outline' : 'sparkles-outline'" 
                            slot="icon-only"
                            [attr.aria-hidden]="true">
                          </ion-icon>
                        </ion-button>
                      </div>
                      
                      <!-- Second line: Word count and action buttons -->
                      <div class="scene-actions-row">
                        <ion-badge color="medium" class="word-count-badge">
                          {{ getWordCount(scene.content) }} words
                        </ion-badge>
                        
                        <div class="action-buttons">
                          <ion-button 
                            fill="clear" 
                            size="small"
                            [color]="scene.summary ? 'success' : 'medium'"
                            (click)="toggleSceneDetails(scene.id, $event)"
                            class="expand-scene-btn"
                            [attr.aria-label]="'Scene details ' + (expandedScenes.has(scene.id) ? 'collapse' : 'expand')"
                            [attr.aria-expanded]="expandedScenes.has(scene.id)"
                            (touchstart)="$event.stopPropagation()"
                            (touchend)="$event.stopPropagation()">
                            <ion-icon 
                              [name]="expandedScenes.has(scene.id) ? 'chevron-down' : 'chevron-forward'" 
                              slot="icon-only"
                              [attr.aria-hidden]="true">
                            </ion-icon>
                          </ion-button>
                          
                          
                          <ion-button 
                            fill="clear" 
                            size="small"
                            color="danger" 
                            (click)="deleteScene(chapter.id, scene.id, $event)"
                            [attr.aria-label]="'Delete scene: ' + (scene.title || 'Untitled')"
                            (touchstart)="$event.stopPropagation()"
                            (touchend)="$event.stopPropagation()">
                            <ion-icon name="trash" slot="icon-only" [attr.aria-hidden]="true"></ion-icon>
                          </ion-button>
                        </div>
                      </div>
                    </div>
                  </ion-item>
                  
                  <div class="scene-details" *ngIf="expandedScenes.has(scene.id)">
                    <div class="scene-summary-section">
                      <div class="summary-header">
                        <span>Summary</span>
                        <div class="summary-buttons">
                          <ion-button 
                            size="small"
                            fill="solid"
                            [color]="isGeneratingSummary.has(scene.id) ? 'medium' : 'success'"
                            (click)="generateSceneSummary(chapter.id, scene.id)"
                            [disabled]="isGeneratingSummary.has(scene.id) || !selectedModel || !scene.content.trim()"
                            [attr.aria-label]="isGeneratingSummary.has(scene.id) ? 'Summary is being generated...' : 'Generate AI summary for scene'"
                            (touchstart)="$event.stopPropagation()"
                            (touchend)="$event.stopPropagation()">
                            <ion-icon 
                              [name]="isGeneratingSummary.has(scene.id) ? 'time-outline' : 'flash-outline'" 
                              slot="icon-only"
                              [attr.aria-hidden]="true">
                            </ion-icon>
                          </ion-button>
                          <ion-button 
                            *ngIf="scene.summary"
                            size="small"
                            fill="solid"
                            color="danger"
                            (click)="deleteSceneSummary(chapter.id, scene.id)"
                            [attr.aria-label]="'Delete summary for scene'"
                            (touchstart)="$event.stopPropagation()"
                            (touchend)="$event.stopPropagation()">
                            <ion-icon 
                              name="trash" 
                              slot="icon-only"
                              [attr.aria-hidden]="true">
                            </ion-icon>
                          </ion-button>
                        </div>
                      </div>
                      
                      <ion-select 
                        [(ngModel)]="selectedModel"
                        placeholder="Choose AI model..."
                        interface="popover"
                        class="model-select"
                        aria-label="Select AI model for summary"
>
                        <ion-select-option *ngFor="let model of availableModels" [value]="model.id">
                          {{ model.label }}
                        </ion-select-option>
                      </ion-select>
                      
                      <ion-textarea 
                        [(ngModel)]="scene.summary"
                        [value]="scene.summary || ''"
                        (ionBlur)="updateSceneSummary(chapter.id, scene.id, scene.summary || '')"
                        (ionInput)="autoResizeTextarea($event)"
                        [attr.data-scene-id]="scene.id"
                        placeholder="AI-generated scene summary will be displayed here..."
                        class="summary-textarea"
                        [rows]="2"
                        [autoGrow]="false"
                        [attr.aria-label]="'Summary for scene: ' + (scene.title || 'Untitled')">
                      </ion-textarea>
                      
                      <ion-chip *ngIf="scene.summaryGeneratedAt" color="medium" class="summary-info">
                        <ion-icon name="time-outline"></ion-icon>
                        <ion-label>{{ scene.summaryGeneratedAt | date:'short' }}</ion-label>
                      </ion-chip>
                    </div>
                  </div>
                </ng-container>
              </ion-list>
              
              <ion-button 
                expand="block" 
                fill="outline" 
                color="primary" 
                class="add-scene-btn" 
                (click)="addScene(chapter.id)"
                [attr.aria-label]="'Add new scene to chapter: ' + (chapter.title || 'Untitled')">
                <ion-icon name="add" slot="start" [attr.aria-hidden]="true"></ion-icon>
                New Scene
              </ion-button>
            </div>
          </div>
        </ion-list>
      </ion-content>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    
    .story-structure {
      width: 100%;
      height: 100%;
      background: transparent;
      border-right: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden; /* Prevent container overflow */
    }
    
    .structure-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(45, 45, 45, 0.3);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      box-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
    }
    
    .structure-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #f8f9fa;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
    
    .close-button {
      --color: #f8f9fa;
      --background: rgba(255, 255, 255, 0.1);
      --background-hover: rgba(255, 255, 255, 0.2);
      --background-activated: rgba(255, 255, 255, 0.3);
      --border-radius: 8px;
      --padding-start: 8px;
      --padding-end: 8px;
      margin: -4px -4px -4px 0;
      transition: all 0.2s ease;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    
    .close-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    /* Hide close button on desktop since menu is always visible */
    @media (min-width: 1024px) {
      .close-button {
        display: none;
      }
    }

    
    
    
    
    .structure-content {
      --background: transparent !important;
      background: transparent !important;
      height: 100vh;
      overflow-y: auto;
      min-height: 0; /* Important for flex children */
    }
    
    /* Ensure parent containers don't interfere with scrolling */
    .scene-details {
      overflow: visible;
    }
    
    .scene-summary-section {
      overflow: visible;
    }
    
    .structure-content::part(background) {
      background: transparent !important;
    }
    
    .structure-content::part(scroll) {
      background: transparent !important;
      padding-bottom: 10rem;
    }
    
    .structure-actions {
      padding: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      margin-bottom: 0.5rem;
    }
    
    .add-chapter-btn {
      --background: linear-gradient(135deg, rgba(71, 118, 230, 0.2) 0%, rgba(139, 180, 248, 0.2) 100%);
      --background-hover: linear-gradient(135deg, rgba(71, 118, 230, 0.3) 0%, rgba(139, 180, 248, 0.3) 100%);
      --color: #8bb4f8;
      --border-color: rgba(71, 118, 230, 0.5);
      --border-style: dashed;
      --border-width: 2px;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      transition: all 0.3s ease;
    }
    
    .add-chapter-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(71, 118, 230, 0.3);
    }
    
    .chapters-list {
      background: transparent;
      padding-top: 0.5rem;
      padding-bottom: 10rem; /* Increased bottom padding to ensure last items are reachable */
    }
    
    .chapter-item {
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.7) 0%, rgba(15, 15, 15, 0.7) 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      backdrop-filter: blur(8px) saturate(120%);
      -webkit-backdrop-filter: blur(8px) saturate(120%);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
      overflow: hidden;
    }
    
    .chapter-item:hover {
      background: linear-gradient(135deg, rgba(25, 25, 25, 0.8) 0%, rgba(20, 20, 20, 0.8) 100%);
      border-color: rgba(71, 118, 230, 0.3);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      transform: translateY(-2px);
    }
    
    .chapter-header {
      --background: transparent;
      --background-hover: rgba(255, 255, 255, 0.1);
      --color: #f8f9fa;
    }
    
    .expand-icon {
      color: #8bb4f8;
      font-size: 1rem;
      padding: 0.5rem;
      margin: -0.5rem;
      cursor: pointer;
    }
    
    .chapter-title-input {
      --background: transparent;
      --color: #f8f9fa;
      --placeholder-color: #adb5bd;
      font-weight: 500;
      font-size: 0.9rem;
    }
    
    .scenes-list {
      background: transparent;
      padding: 0.5rem;
    }
    
    .scenes-list ion-list {
      background: transparent;
    }
    
    .scene-item {
      --background: rgba(30, 30, 30, 0.6);
      --background-hover: rgba(71, 118, 230, 0.5);
      --color: #f8f9fa;
      --border-radius: 8px;
      margin-bottom: 0.25rem;
      --padding-start: 8px;
      --padding-end: 8px;
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
    }
    
    .scene-item.multi-line {
      --padding-top: 8px;
      --padding-bottom: 8px;
      min-height: 60px;
    }
    
    .scene-item.active-scene {
      --background: var(--ion-color-step-50, #f9f9f9);
      --color: inherit;
      border-left: 4px solid var(--ion-color-primary);
      font-weight: 500;
      --background-hover: var(--ion-color-step-100, #f1f1f1);
      --background-focused: var(--ion-color-step-100, #f1f1f1);
    }
    
    .scene-content {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 4px;
    }
    
    .scene-title-row {
      display: flex;
      align-items: flex-start;
      width: 100%;
    }
    
    .scene-title-display {
      flex: 1;
      font-size: 0.9rem;
      color: var(--ion-text-color);
      padding: 2px 8px 2px 0;
      cursor: pointer;
      white-space: normal;
      word-wrap: break-word;
      overflow-wrap: break-word;
      line-height: 1.4;
      min-height: 22px;
      transition: background-color 0.2s;
      border-radius: 4px;
    }
    
    .scene-title-display:hover {
      background-color: var(--ion-color-step-100);
    }
    
    .scene-title-display:focus {
      outline: 2px solid var(--ion-color-primary);
      outline-offset: 1px;
    }
    
    .scene-title-input-edit {
      --color: var(--ion-text-color);
      --placeholder-color: var(--ion-color-medium);
      font-size: 0.9rem;
      flex: 1;
      --padding-start: 0;
      --padding-end: 8px;
      --padding-top: 2px;
      --padding-bottom: 2px;
    }
    
    .scene-item.active-scene .scene-title-input-edit {
      --color: var(--ion-color-primary-contrast);
    }
    
    .scene-item.active-scene .scene-title-display {
      color: inherit;
    }
    
    .ai-title-btn {
      --padding-start: 4px;
      --padding-end: 4px;
      margin-left: 4px;
      margin-top: 2px;
      flex-shrink: 0;
    }
    
    .scene-actions-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
    
    .word-count-badge {
      font-size: 0.7rem;
      height: 20px;
      --padding-horizontal: 6px;
    }
    
    .action-buttons {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    
    .action-buttons ion-button {
      --padding-start: 4px;
      --padding-end: 4px;
    }
    
    
    .scene-item.active-scene ion-badge {
      --background: var(--ion-color-primary-contrast);
      --color: var(--ion-color-primary);
    }
    
    .scene-details {
      background: var(--ion-background-color);
      padding: 0.5rem;
    }
    
    .scene-summary-section {
      background: var(--ion-color-step-100);
      padding: 1rem;
      margin: 0.5rem 0;
      border-radius: 8px;
      border: 1px solid var(--ion-color-step-200);
      display: flex;
      flex-direction: column;
      min-height: 300px;
    }
    
    .summary-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
      color: var(--ion-color-medium);
      font-weight: 500;
      flex-shrink: 0;
    }
    
    .summary-buttons {
      display: flex;
      gap: 0.25rem;
      align-items: center;
    }
    
    .model-select {
      width: 100%;
      margin-bottom: 0.5rem;
      --background: rgba(30, 30, 30, 0.4);
      --color: #f8f9fa;
      --placeholder-color: #adb5bd;
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      flex-shrink: 0;
    }
    
    .summary-textarea {
      --background: rgba(30, 30, 30, 0.4);
      --color: #f8f9fa;
      --placeholder-color: #adb5bd;
      --padding-start: 12px;
      --padding-end: 12px;
      --padding-top: 12px;
      --padding-bottom: 12px;
      font-size: 0.9rem;
      margin-top: 0.5rem;
      width: 100%;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      flex: 1 1 auto;
      min-height: 200px;
      resize: none;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
      
      /* Try ionic custom properties for height */
      --min-height: 200px;
      --max-height: none;
    }
    
    /* Fix for ionic textarea native element scrolling */
    .summary-textarea textarea {
      overflow: unset;
      height: 100%;
      resize: none;
      box-sizing: border-box;
    }
    
    .summary-textarea::-webkit-scrollbar {
      width: 8px;
    }
    
    .summary-textarea::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }
    
    .summary-textarea::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
    }
    
    .summary-textarea::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }
    
    
    .summary-info {
      margin-top: 0.5rem;
      align-self: flex-end;
      flex-shrink: 0;
    }
    
    .add-scene-btn {
      margin: 0.5rem;
      --background: linear-gradient(135deg, rgba(71, 118, 230, 0.2) 0%, rgba(139, 180, 248, 0.2) 100%);
      --background-hover: linear-gradient(135deg, rgba(71, 118, 230, 0.3) 0%, rgba(139, 180, 248, 0.3) 100%);
      --color: #8bb4f8;
      --border-color: rgba(71, 118, 230, 0.5);
      --border-style: dashed;
      --border-width: 2px;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      transition: all 0.3s ease;
    }
    
    .add-scene-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(71, 118, 230, 0.3);
    }
    
    /* Screen reader only content */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    
    /* Keyboard focus improvements */
    .chapter-header:focus-visible,
    .scene-item:focus-visible {
      outline: 2px solid var(--ion-color-primary);
      outline-offset: 2px;
      border-radius: 4px;
    }
    
    ion-button:focus-visible {
      outline: 2px solid var(--ion-color-primary);
      outline-offset: 2px;
    }
    
    ion-input:focus-visible,
    ion-textarea:focus-visible,
    ion-select:focus-visible {
      outline: 2px solid var(--ion-color-primary);
      outline-offset: 1px;
    }

    /* Tablet adjustments */
    @media (max-width: 1024px) and (min-width: 769px) {
      .chapter-header {
        --min-height: 44px;
      }
      
      .scene-item {
        --min-height: 48px;
      }
      
      .ai-title-btn,
      .action-buttons ion-button {
        min-width: 40px;
        min-height: 40px;
      }
    }
    
    /* Mobile adjustments */
    @media (max-width: 768px) {
      .structure-content {
        overflow-y: auto;
        flex: 1;
        min-height: 0; /* Allow content to shrink and be scrollable */
        -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
        /* Remove fixed height calculation to allow flex to handle it */
      }
      
      .chapters-list {
        padding-top: 0.75rem; /* Extra top padding on mobile */
        padding-bottom: 12rem; /* Further increased padding for mobile */
        min-height: 100%; /* Ensure scrollable area */
      }
      
      .scenes-list {
        max-height: none; /* Remove any height restrictions */
      }
      
      .scene-details {
        max-height: none; /* Remove any height restrictions */
      }
      
      /* Larger touch targets for mobile */
      .chapter-header {
        --min-height: 48px; /* Minimum touch target size */
        --padding-top: 12px;
        --padding-bottom: 12px;
      }
      
      /* Make expand icon easier to tap on mobile */
      .expand-icon {
        font-size: 1.25rem;
        padding: 0.75rem;
        margin: -0.75rem;
        min-width: 44px;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        z-index: 5;
      }
      
      /* Add tap highlight for better feedback */
      .expand-icon:active {
        background-color: var(--ion-color-step-200);
        border-radius: 50%;
      }
      
      .scene-item {
        --min-height: 56px; /* Larger touch target for scenes */
        --padding-top: 12px;
        --padding-bottom: 12px;
      }
      
      .scene-item.multi-line {
        min-height: 72px; /* Even larger for multi-line content */
      }
      
      /* Larger buttons on mobile */
      .chapter-header ion-button {
        --padding-start: 8px;
        --padding-end: 8px;
        min-width: 44px;
        min-height: 44px;
      }
      
      .ai-title-btn {
        --padding-start: 8px;
        --padding-end: 8px;
        min-width: 48px;
        min-height: 48px;
        margin-left: 8px;
        position: relative;
        z-index: 10;
      }
      
      .action-buttons ion-button {
        --padding-start: 8px;
        --padding-end: 8px;
        min-width: 48px;
        min-height: 48px;
        margin: 0 2px;
        position: relative;
        z-index: 10;
      }
      
      .add-scene-btn {
        --min-height: 48px;
        margin: 0.75rem;
        font-size: 1rem;
      }
      
      /* Larger input fields */
      .chapter-title-input {
        --min-height: 44px;
        font-size: 1rem;
      }
      
      .scene-title-input {
        --min-height: 44px;
        font-size: 0.95rem;
      }
      
      /* Better spacing for scene content */
      .scene-content {
        gap: 8px;
        position: relative;
      }
      
      .scene-title-row {
        min-height: 48px;
        align-items: center;
      }
      
      .scene-actions-row {
        min-height: 48px;
        padding-top: 4px;
        align-items: center;
      }
    }
    
    /* Extra small mobile devices */
    @media (max-width: 480px) {
      .story-structure {
        max-width: 100vw;
        width: 100vw; /* Ensure full width */
        border-radius: 0; /* Remove border radius on very small screens */
      }
      
      
      .chapters-list {
        padding: 0.5rem;
        padding-bottom: 8rem; /* Ensure bottom padding on small screens too */
      }
      
      .chapter-item {
        margin-bottom: 0.75rem;
      }
      
      .scenes-list {
        padding: 0.25rem;
      }
      
      .scene-content {
        gap: 6px;
      }
      
      .word-count-badge {
        font-size: 0.65rem;
        height: 18px;
      }
      
      .summary-textarea {
        font-size: 0.8rem;
        max-height: 150px; /* Smaller max height on very small screens */
        -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
      }
      
      .add-scene-btn {
        margin: 0.5rem;
        font-size: 0.9rem;
      }
    }
    
    /* Large mobile devices and small tablets */
    @media (min-width: 481px) and (max-width: 768px) {
      .story-structure {
        max-width: 100vw; /* Full width on all mobile sizes */
        width: 100vw; /* Ensure full width */
      }
      
      .scene-item.multi-line {
        min-height: 80px; /* More space for content */
      }
      
      .scene-content {
        gap: 10px;
      }
    }

    /* Enhanced scrollbar and touch interactions for all mobile */
    @media (max-width: 768px) {
      .structure-content::-webkit-scrollbar {
        width: 8px; /* Slightly wider for easier thumb interaction */
        display: block;
      }
      
      .structure-content::-webkit-scrollbar-track {
        background: var(--ion-color-step-100);
        border-radius: 4px;
        margin: 4px 0; /* Add margin to track */
      }
      
      .structure-content::-webkit-scrollbar-thumb {
        background: var(--ion-color-medium);
        border-radius: 4px;
        min-height: 40px; /* Minimum thumb size for touch */
      }
      
      .structure-content::-webkit-scrollbar-thumb:active {
        background: var(--ion-color-medium-tint);
      }
      
      /* Improved touch feedback */
      .chapter-header:active,
      .scene-item:active {
        background: var(--ion-color-medium-shade) !important;
        transition: background-color 0.1s ease;
      }
      
      /* Enhanced touch feedback with ripple effect */
      .chapter-header,
      .scene-item {
        position: relative;
        overflow: hidden;
        transition: all 0.2s ease;
      }
      
      .chapter-header::before,
      .scene-item::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
        opacity: 0;
        transform: scale(0);
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
      }
      
      .chapter-header:active,
      .scene-item:active {
        transform: scale(0.98);
        background: var(--ion-color-medium-shade) !important;
      }
      
      .chapter-header:active::before,
      .scene-item:active::before {
        opacity: 1;
        transform: scale(1);
      }
      
      /* Loading state animations */
      .ai-title-btn[disabled],
      .summary-section ion-button[disabled] {
        opacity: 0.6;
        position: relative;
      }
      
      .ai-title-btn[disabled] ion-icon,
      .summary-section ion-button[disabled] ion-icon {
        animation: pulse 1.5s ease-in-out infinite;
      }
      
      @keyframes pulse {
        0%, 100% {
          opacity: 0.6;
          transform: scale(1);
        }
        50% {
          opacity: 1;
          transform: scale(1.1);
        }
      }
      
      /* Improved button hover/focus states */
      ion-button:not([disabled]):hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      
      ion-button:not([disabled]):active {
        transform: translateY(0);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
      }
    }
    
    /* Extra touch feedback for very small screens */
    @media (max-width: 480px) {
      .structure-content::-webkit-scrollbar {
        width: 10px; /* Even wider scrollbar for tiny screens */
      }
      
      .structure-content::-webkit-scrollbar-thumb {
        min-height: 50px; /* Larger minimum thumb size */
      }
      
      /* Enhanced vibration feedback simulation */
      .chapter-header:active,
      .scene-item:active {
        animation: vibrate 0.1s ease-in-out;
      }
      
      @keyframes vibrate {
        0%, 100% { transform: translateX(0) scale(0.98); }
        25% { transform: translateX(-1px) scale(0.98); }
        75% { transform: translateX(1px) scale(0.98); }
      }
      
      /* Loading spinner for very small screens */
      .ai-title-btn[disabled]::after,
      .summary-section ion-button[disabled]::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 12px;
        height: 12px;
        margin: -6px 0 0 -6px;
        border: 2px solid transparent;
        border-top: 2px solid var(--ion-color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        z-index: 1;
      }
      
      /* Ensure buttons are above other elements */
      .ai-title-btn,
      .action-buttons ion-button {
        position: relative;
        z-index: 20;
        pointer-events: auto;
      }
      
      /* Prevent scene item clicks from interfering with button clicks */
      .scene-item {
        pointer-events: auto;
      }
      
      .scene-content {
        pointer-events: none;
      }
      
      .scene-content > * {
        pointer-events: auto;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Chapter and Scene ID displays */
      .chapter-title-container {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
      }

      .chapter-id-display {
        background: var(--ion-color-primary-tint);
        color: var(--ion-color-primary-contrast);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        min-width: 20px;
        text-align: center;
        white-space: nowrap;
      }

      .scene-title-container {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        flex: 1;
        min-width: 0; /* Allow flex item to shrink below content size */
      }

      .scene-id-display {
        background: var(--ion-color-secondary-tint);
        color: var(--ion-color-secondary-contrast);
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 500;
        min-width: 30px;
        text-align: center;
        white-space: nowrap;
        flex-shrink: 0;
        margin-top: 3px;
      }

      .chapter-title-input {
        flex: 1;
      }
      
      .scene-title-display {
        --min-height: 44px;
        font-size: 0.95rem;
        padding: 8px 8px 8px 0;
      }
      
      .scene-title-input-edit {
        --min-height: 44px;
        font-size: 0.95rem;
      }
    }
  `]
})
export class StoryStructureComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  private storyService = inject(StoryService);
  private openRouterApiService = inject(OpenRouterApiService);
  private googleGeminiApiService = inject(GoogleGeminiApiService);
  private modelService = inject(ModelService);
  private settingsService = inject(SettingsService);
  private cdr = inject(ChangeDetectorRef);
  private promptManager = inject(PromptManagerService);
  private router = inject(Router);

  @Input() story!: Story;
  @Input() activeChapterId: string | null = null;
  @Input() activeSceneId: string | null = null;
  @Output() sceneSelected = new EventEmitter<{chapterId: string, sceneId: string}>();
  @Output() closeSidebar = new EventEmitter<void>();
  
  expandedChapters = new Set<string>();
  expandedScenes = new Set<string>();
  isGeneratingSummary = new Set<string>();
  isGeneratingTitle = new Set<string>();
  isEditingTitle = new Set<string>();
  private originalTitles = new Map<string, string>();
  selectedModel = '';
  availableModels: ModelOption[] = [];
  private subscription = new Subscription();

  constructor() {
    addIcons({ 
      chevronForward, chevronDown, add, trash, createOutline,
      flashOutline, documentTextOutline, timeOutline, sparklesOutline, close
    });
  }

  ngOnInit() {
    // Auto-expand chapter containing active scene
    this.expandActiveChapter();
    
    // Load available models and set default
    this.loadAvailableModels();
    this.setDefaultModel();
  }
  
  ngOnChanges(changes: SimpleChanges) {
    // When activeChapterId or activeSceneId changes, expand the relevant chapter
    if (changes['activeChapterId'] || changes['activeSceneId']) {
      this.expandActiveChapter();
      // Auto-scroll to active scene when active scene changes
      setTimeout(() => this.scrollToActiveScene(), 100);
    }
  }
  
  ngAfterViewInit() {
    // Resize all existing textareas after view initialization
    setTimeout(() => this.resizeAllTextareas(), 100);
    
    // Auto-scroll to active scene when component loads
    this.scrollToActiveScene();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
  
  private expandActiveChapter(): void {
    if (!this.story?.chapters) return;
    
    // If we have an active chapter ID, expand it
    if (this.activeChapterId) {
      this.expandedChapters.add(this.activeChapterId);
      return;
    }
    
    // If we have an active scene ID, find and expand its chapter
    if (this.activeSceneId) {
      for (const chapter of this.story.chapters) {
        if (chapter.scenes.some(scene => scene.id === this.activeSceneId)) {
          this.expandedChapters.add(chapter.id);
          return;
        }
      }
    }
    
    // Fallback: expand first chapter if no active chapter/scene
    if (this.story.chapters.length > 0) {
      this.expandedChapters.add(this.story.chapters[0].id);
    }
  }

  trackChapter(index: number, chapter: Chapter): string {
    return chapter.id;
  }

  trackScene(index: number, scene: Scene): string {
    return scene.id;
  }

  toggleChapter(chapterId: string): void {
    if (this.expandedChapters.has(chapterId)) {
      this.expandedChapters.delete(chapterId);
    } else {
      this.expandedChapters.add(chapterId);
    }
  }

  async addChapter(): Promise<void> {
    await this.storyService.addChapter(this.story.id);
    // Refresh story data
    const updatedStory = await this.storyService.getStory(this.story.id);
    if (updatedStory) {
      this.story = updatedStory;
      // Auto-expand new chapter
      const newChapter = this.story.chapters[this.story.chapters.length - 1];
      this.expandedChapters.add(newChapter.id);
    }
  }

  async updateChapter(chapter: Chapter): Promise<void> {
    await this.storyService.updateChapter(this.story.id, chapter.id, { title: chapter.title });
    // Refresh prompt manager when chapter title changes
    this.promptManager.refresh();
  }

  async deleteChapter(chapterId: string, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.story.chapters.length <= 1) {
      alert('A story must have at least one chapter.');
      return;
    }
    
    if (confirm('Really delete chapter? All scenes will be lost.')) {
      await this.storyService.deleteChapter(this.story.id, chapterId);
      const updatedStory = await this.storyService.getStory(this.story.id);
      if (updatedStory) {
        this.story = updatedStory;
        this.expandedChapters.delete(chapterId);
      }
    }
  }

  async addScene(chapterId: string): Promise<void> {
    await this.storyService.addScene(this.story.id, chapterId);
    const updatedStory = await this.storyService.getStory(this.story.id);
    if (updatedStory) {
      this.story = updatedStory;
      // Auto-select new scene
      const chapter = this.story.chapters.find(c => c.id === chapterId);
      if (chapter) {
        const newScene = chapter.scenes[chapter.scenes.length - 1];
        this.selectScene(chapterId, newScene.id);
      }
    }
  }

  async updateScene(chapterId: string, scene: Scene): Promise<void> {
    await this.storyService.updateScene(this.story.id, chapterId, scene.id, { title: scene.title });
    // Refresh prompt manager when scene title changes
    this.promptManager.refresh();
  }

  async deleteScene(chapterId: string, sceneId: string, event: Event): Promise<void> {
    event.stopPropagation();
    const chapter = this.story.chapters.find(c => c.id === chapterId);
    if (chapter && chapter.scenes.length <= 1) {
      alert('A chapter must have at least one scene.');
      return;
    }
    
    if (confirm('Really delete scene?')) {
      await this.storyService.deleteScene(this.story.id, chapterId, sceneId);
      const updatedStory = await this.storyService.getStory(this.story.id);
      if (updatedStory) {
        this.story = updatedStory;
      }
    }
  }


  selectScene(chapterId: string, sceneId: string): void {
    this.sceneSelected.emit({ chapterId, sceneId });
  }

  isActiveScene(chapterId: string, sceneId: string): boolean {
    return this.activeChapterId === chapterId && this.activeSceneId === sceneId;
  }

  getWordCount(content: string): number {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
  
  toggleSceneDetails(sceneId: string, event: Event): void {
    event.stopPropagation();
    if (this.expandedScenes.has(sceneId)) {
      this.expandedScenes.delete(sceneId);
    } else {
      this.expandedScenes.add(sceneId);
      // Resize textarea after expanding
      setTimeout(() => this.resizeTextareaForScene(sceneId), 50);
    }
  }
  
  generateSceneSummary(chapterId: string, sceneId: string): void {
    const chapter = this.story.chapters.find(c => c.id === chapterId);
    const scene = chapter?.scenes.find(s => s.id === sceneId);
    
    if (!scene || !scene.content.trim()) {
      return;
    }
    
    // Get settings to check API availability
    const settings = this.settingsService.getSettings();
    
    // Use specific model for scene summary if configured, otherwise fall back to selected model
    const modelToUse = settings.sceneSummaryGeneration.selectedModel || this.selectedModel;
    
    if (!modelToUse) {
      return;
    }
    const openRouterAvailable = settings.openRouter.enabled && settings.openRouter.apiKey;
    const googleGeminiAvailable = settings.googleGemini.enabled && settings.googleGemini.apiKey;
    
    if (!openRouterAvailable && !googleGeminiAvailable) {
      alert('No AI API configured. Please configure OpenRouter or Google Gemini in settings.');
      return;
    }
    
    this.isGeneratingSummary.add(sceneId);
    this.cdr.detectChanges(); // Force change detection for mobile
    
    // Set a timeout to clear busy state if request takes too long
    const timeoutId = setTimeout(() => {
      if (this.isGeneratingSummary.has(sceneId)) {
        this.isGeneratingSummary.delete(sceneId);
        this.cdr.detectChanges();
        alert('Summary generation is taking too long. Please try again.');
      }
    }, 30000); // 30 second timeout
    
    // Remove embedded images from content to reduce token count
    let sceneContent = this.removeEmbeddedImages(scene.content);
    
    // Limit content length to avoid token limit issues
    // Approximate: 1 token ≈ 4 characters, so for safety we limit to ~50k tokens ≈ 200k characters
    const maxContentLength = 200000;
    let contentTruncated = false;
    
    if (sceneContent.length > maxContentLength) {
      sceneContent = sceneContent.substring(0, maxContentLength);
      contentTruncated = true;
    }
    
    // Build prompt based on settings
    let prompt: string;
    if (settings.sceneSummaryGeneration.useCustomPrompt) {
      prompt = settings.sceneSummaryGeneration.customPrompt
        .replace(/{sceneTitle}/g, scene.title || 'Untitled')
        .replace(/{sceneContent}/g, sceneContent + (contentTruncated ? '\n\n[Note: Content was truncated as it was too long]' : ''))
        .replace(/{customInstruction}/g, settings.sceneSummaryGeneration.customInstruction || '');
    } else {
      // Default prompt
      prompt = `Create a summary of the following scene:

Title: ${scene.title || 'Untitled'}

Content:
${sceneContent}${contentTruncated ? '\n\n[Note: Content was truncated as it was too long]' : ''}

The summary should capture the most important plot points and character developments. Write a complete and comprehensive summary with at least 3-5 sentences.`;
      
      // Add custom instruction if provided
      if (settings.sceneSummaryGeneration.customInstruction) {
        prompt += `\n\nZusätzliche Anweisungen: ${settings.sceneSummaryGeneration.customInstruction}`;
      }
    }

    // Extract provider from model if available
    let provider: string | null = null;
    let actualModelId: string | null = null;
    
    if (modelToUse) {
      const [modelProvider, ...modelIdParts] = modelToUse.split(':');
      provider = modelProvider;
      actualModelId = modelIdParts.join(':'); // Rejoin in case model ID contains colons
    }
    
    // Determine which API to use
    const useGoogleGemini = (provider === 'gemini' && googleGeminiAvailable) || 
                           (provider !== 'gemini' && provider !== 'openrouter' && googleGeminiAvailable && !openRouterAvailable);
    const useOpenRouter = (provider === 'openrouter' && openRouterAvailable) || 
                         (provider !== 'gemini' && provider !== 'openrouter' && openRouterAvailable);
    
    // Set the actual model ID for fallback cases
    if (provider !== 'gemini' && provider !== 'openrouter') {
      actualModelId = this.selectedModel; // Use the full model string for fallback
    }

    // Use the appropriate API
    if (useGoogleGemini) {
      this.googleGeminiApiService.generateText(prompt, {
        model: actualModelId!,
        maxTokens: 3000,
        temperature: settings.sceneSummaryGeneration.temperature
      }).subscribe({
        next: async (response) => {
          let summary = '';
          
          // Google Gemini response format
          if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
              summary = candidate.content.parts[0].text.trim();
            }
          }
          
          if (summary) {
            // Check if summary seems incomplete (ends abruptly without proper punctuation)
            if (summary && !summary.match(/[.!?]$/)) {
              summary += '.'; // Add period if missing
            }
            
            // Update the scene summary in the local object first
            if (scene) {
              scene.summary = summary;
              scene.summaryGeneratedAt = new Date();
            }
            
            // Force change detection before service update
            this.cdr.detectChanges();
            
            // Update in service
            await this.updateSceneSummary(chapterId, sceneId, summary);
            await this.storyService.updateScene(this.story.id, chapterId, sceneId, {
              summary: summary,
              summaryGeneratedAt: scene?.summaryGeneratedAt || new Date()
            });
            
            // Refresh the story data to ensure consistency
            const updatedStory = await this.storyService.getStory(this.story.id);
            if (updatedStory) {
              this.story = updatedStory;
            }
          }
          clearTimeout(timeoutId); // Clear timeout on success
          this.isGeneratingSummary.delete(sceneId);
          this.cdr.detectChanges(); // Force change detection
          
          // Ensure textarea is properly resized and updated after content update
          setTimeout(() => {
            if (scene && scene.summary) {
              this.updateTextareaValue(sceneId, scene.summary);
            }
            this.resizeTextareaForScene(sceneId);
            this.cdr.detectChanges();
          }, 150);
        },
        error: (error) => {
          console.error('Error generating scene summary:', error);
          clearTimeout(timeoutId); // Clear timeout on error
          
          const errorMessage = 'Error generating summary.';
          alert(errorMessage);
          this.isGeneratingSummary.delete(sceneId);
          this.cdr.detectChanges(); // Force change detection
        }
      });
    } else if (useOpenRouter) {
      this.openRouterApiService.generateText(prompt, {
        model: actualModelId!,
        maxTokens: 3000,
        temperature: settings.sceneSummaryGeneration.temperature
      }).subscribe({
      next: async (response) => {
        if (response.choices && response.choices.length > 0) {
          let summary = response.choices[0].message.content.trim();
          
          // Check if summary seems incomplete (ends abruptly without proper punctuation)
          if (summary && !summary.match(/[.!?]$/)) {
            summary += '.'; // Add period if missing
          }
          
          // Check if response was truncated due to max_tokens limit
          if (response.choices[0].finish_reason === 'length') {
            console.warn('Summary was truncated due to token limit. Consider increasing maxTokens.');
            summary += ' [Summary was truncated due to token limit]';
          }
          
          // Update the scene summary in the local object first
          if (scene) {
            scene.summary = summary;
            scene.summaryGeneratedAt = new Date();
          }
          
          // Force change detection before service update
          this.cdr.detectChanges();
          
          // Update in service
          await this.updateSceneSummary(chapterId, sceneId, summary);
          await this.storyService.updateScene(this.story.id, chapterId, sceneId, {
            summary: summary,
            summaryGeneratedAt: scene?.summaryGeneratedAt || new Date()
          });
          
          // Refresh the story data to ensure consistency
          const updatedStory = await this.storyService.getStory(this.story.id);
          if (updatedStory) {
            this.story = updatedStory;
          }
        }
        clearTimeout(timeoutId); // Clear timeout on success
        this.isGeneratingSummary.delete(sceneId);
        this.cdr.detectChanges(); // Force change detection
        
        // Ensure textarea is properly resized and updated after content update
        setTimeout(() => {
          if (scene && scene.summary) {
            this.updateTextareaValue(sceneId, scene.summary);
          }
          this.resizeTextareaForScene(sceneId);
          this.cdr.detectChanges();
        }, 150);
      },
      error: (error) => {
        console.error('Error generating scene summary:', error);
        clearTimeout(timeoutId); // Clear timeout on error
        
        let errorMessage = 'Error generating summary.';
        
        // Check for specific error types
        if (error.status === 400) {
          errorMessage = 'Invalid request. Please check your API settings.';
        } else if (error.status === 401) {
          errorMessage = 'Invalid API key. Please check your OpenRouter API key in settings.';
        } else if (error.status === 403) {
          errorMessage = 'Access denied. Your API key may not have the required permissions.';
        } else if (error.status === 429) {
          errorMessage = 'Rate limit reached. Please wait a moment and try again.';
        } else if (error.status === 500) {
          errorMessage = 'OpenRouter server error. Please try again later.';
        } else if (error.message?.includes('nicht aktiviert')) {
          errorMessage = error.message;
        }
        
        alert(errorMessage);
        this.isGeneratingSummary.delete(sceneId);
        this.cdr.detectChanges(); // Force change detection
        }
      });
    }
  }
  
  generateSceneTitle(chapterId: string, sceneId: string, event: Event): void {
    event.stopPropagation();
    
    const chapter = this.story.chapters.find(c => c.id === chapterId);
    const scene = chapter?.scenes.find(s => s.id === sceneId);
    
    // Get scene title generation settings
    const settings = this.settingsService.getSettings();
    const titleSettings = settings.sceneTitleGeneration;
    
    // Use scene title specific model if set, otherwise fall back to global model
    const modelToUse = titleSettings.selectedModel || this.selectedModel;
    
    if (!scene || !scene.content.trim() || !modelToUse) {
      return;
    }
    
    // Check which APIs are available and configured
    const openRouterAvailable = settings.openRouter.enabled && settings.openRouter.apiKey;
    const googleGeminiAvailable = settings.googleGemini.enabled && settings.googleGemini.apiKey;
    
    if (!openRouterAvailable && !googleGeminiAvailable) {
      alert('No AI API configured. Please configure OpenRouter or Google Gemini in settings.');
      return;
    }
    
    // Extract provider and actual model ID from the combined format
    let provider: string | null = null;
    let actualModelId: string | null = null;
    
    if (modelToUse) {
      const [modelProvider, ...modelIdParts] = modelToUse.split(':');
      provider = modelProvider;
      actualModelId = modelIdParts.join(':'); // Rejoin in case model ID contains colons
    }
    
    // Determine which API to use based on the model's provider and availability
    const useGoogleGemini = (provider === 'gemini' && googleGeminiAvailable) || 
                           (provider !== 'gemini' && provider !== 'openrouter' && googleGeminiAvailable && !openRouterAvailable);
    const useOpenRouter = (provider === 'openrouter' && openRouterAvailable) || 
                         (provider !== 'gemini' && provider !== 'openrouter' && openRouterAvailable);
    
    // Set the actual model ID for fallback cases
    if (provider !== 'gemini' && provider !== 'openrouter') {
      actualModelId = modelToUse; // Use the full model string for fallback
    }
    
    this.isGeneratingTitle.add(sceneId);
    this.cdr.detectChanges(); // Force change detection for mobile
    
    // Set a timeout to clear busy state if request takes too long
    const timeoutId = setTimeout(() => {
      if (this.isGeneratingTitle.has(sceneId)) {
        this.isGeneratingTitle.delete(sceneId);
        this.cdr.detectChanges();
        alert('Title generation is taking too long. Please try again.');
      }
    }, 30000); // 30 second timeout
    
    // Remove embedded images from content to reduce token count
    let sceneContent = this.removeEmbeddedImages(scene.content);
    
    // Limit content length for title generation - we need even less content for a title
    // For title generation, 50k characters should be more than enough
    const maxContentLength = 50000;
    
    if (sceneContent.length > maxContentLength) {
      sceneContent = sceneContent.substring(0, maxContentLength);
    }
    
    // Build style instructions based on settings
    let styleInstruction = '';
    switch (titleSettings.style) {
      case 'descriptive':
        styleInstruction = 'The title should be descriptive and atmospheric.';
        break;
      case 'action':
        styleInstruction = 'The title should be action-packed and dynamic.';
        break;
      case 'emotional':
        styleInstruction = 'The title should reflect the emotional mood of the scene.';
        break;
      case 'concise':
      default:
        styleInstruction = 'The title should be concise and impactful.';
        break;
    }
    
    const languageInstruction = titleSettings.language === 'english' 
      ? 'Respond in English.' 
      : 'Respond in German.';
    
    const genreInstruction = titleSettings.includeGenre 
      ? 'Consider the genre of the story when choosing the title.' 
      : '';
    
    const customInstruction = titleSettings.customInstruction 
      ? `\n${titleSettings.customInstruction}` 
      : '';
    
    // Build prompt with settings
    let prompt: string;
    
    if (titleSettings.useCustomPrompt && titleSettings.customPrompt) {
      // Use custom prompt template with placeholder replacement
      prompt = titleSettings.customPrompt
        .replace('{maxWords}', titleSettings.maxWords.toString())
        .replace('{styleInstruction}', styleInstruction)
        .replace('{genreInstruction}', genreInstruction)
        .replace('{languageInstruction}', languageInstruction)
        .replace('{customInstruction}', customInstruction)
        .replace('{sceneContent}', sceneContent);
    } else {
      // Use default prompt template
      prompt = `Create a title for the following scene. The title should be up to ${titleSettings.maxWords} words long and capture the essence of the scene.

${styleInstruction}
${genreInstruction}
${languageInstruction}${customInstruction}

Scene content (only this one scene):
${sceneContent}

Respond only with the title, without further explanations or quotation marks.`;
    }

    // Choose API based on provider
    if (useGoogleGemini) {
      this.googleGeminiApiService.generateText(prompt, {
        model: actualModelId!,
        maxTokens: Math.max(50, titleSettings.maxWords * 6), // Allow more tokens for longer titles (up to 20 words)
        temperature: titleSettings.temperature
      }).subscribe({
        next: async (response) => {
          let title = '';
          
          // Google Gemini response format
          if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
              title = candidate.content.parts[0].text.trim();
            }
          }
          
          if (title) {
            // Remove quotes if present
            title = title.replace(/^["']|["']$/g, '');
            
            // Update scene title
            if (scene) {
              scene.title = title;
              await this.updateScene(chapterId, scene);
            }
          }
          clearTimeout(timeoutId); // Clear timeout on success
          this.isGeneratingTitle.delete(sceneId);
          this.cdr.detectChanges(); // Force change detection
        },
        error: (error) => {
          console.error('Error generating scene title:', error);
          clearTimeout(timeoutId); // Clear timeout on error
          
          const errorMessage = 'Error generating title.';
          alert(errorMessage);
          this.isGeneratingTitle.delete(sceneId);
          this.cdr.detectChanges(); // Force change detection
        }
      });
    } else if (useOpenRouter) {
      this.openRouterApiService.generateText(prompt, {
        model: actualModelId!,
        maxTokens: Math.max(50, titleSettings.maxWords * 6), // Allow more tokens for longer titles (up to 20 words)
        temperature: titleSettings.temperature
      }).subscribe({
        next: async (response) => {
          let title = '';
          
          // OpenRouter response format
          if (response.choices && response.choices.length > 0) {
            title = response.choices[0].message.content.trim();
          }
          
          if (title) {
            // Remove quotes if present
            title = title.replace(/^["']|["']$/g, '');
            
            // Update scene title
            if (scene) {
              scene.title = title;
              await this.updateScene(chapterId, scene);
            }
          }
          clearTimeout(timeoutId); // Clear timeout on success
          this.isGeneratingTitle.delete(sceneId);
          this.cdr.detectChanges(); // Force change detection
        },
      error: (error) => {
        console.error('Error generating scene title:', error);
        clearTimeout(timeoutId); // Clear timeout on error
        
        let errorMessage = 'Error generating title.';
        
        // Check for specific error types
        if (error.status === 400) {
          errorMessage = 'Invalid request. Please check your API settings.';
        } else if (error.status === 401) {
          errorMessage = 'Invalid API key. Please check your OpenRouter API key in settings.';
        } else if (error.status === 403) {
          errorMessage = 'Access denied. Your API key may not have the required permissions.';
        } else if (error.status === 429) {
          errorMessage = 'Rate limit reached. Please wait a moment and try again.';
        } else if (error.status === 500) {
          errorMessage = 'OpenRouter server error. Please try again later.';
        } else if (error.message?.includes('nicht aktiviert')) {
          errorMessage = error.message;
        }
        
        alert(errorMessage);
        this.isGeneratingTitle.delete(sceneId);
        this.cdr.detectChanges(); // Force change detection
        }
      });
    }
  }
  
  async updateSceneSummary(chapterId: string, sceneId: string, summary: string): Promise<void> {
    const chapter = this.story.chapters.find(c => c.id === chapterId);
    const scene = chapter?.scenes.find(s => s.id === sceneId);
    
    if (scene) {
      scene.summary = summary;
      await this.storyService.updateScene(this.story.id, chapterId, sceneId, { summary });
      // Refresh prompt manager when scene summary changes
      this.promptManager.refresh();
    }
  }
  
  async deleteSceneSummary(chapterId: string, sceneId: string): Promise<void> {
    if (confirm('Do you really want to delete the summary?')) {
      const chapter = this.story.chapters.find(c => c.id === chapterId);
      const scene = chapter?.scenes.find(s => s.id === sceneId);
      if (scene) {
        scene.summary = '';
        scene.summaryGeneratedAt = undefined;
        await this.storyService.updateScene(this.story.id, chapterId, sceneId, { 
          summary: '',
          summaryGeneratedAt: undefined 
        });
        // Refresh prompt manager when scene summary changes
        this.promptManager.refresh();
        // Force change detection to update UI
        this.cdr.detectChanges();
      }
    }
  }
  
  autoResizeTextarea(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    if (textarea) {
      // For summary textareas, we don't resize since they have fixed max-height with scrolling
      if (textarea.classList.contains('summary-textarea')) {
        return;
      }
      this.resizeTextarea(textarea);
    }
  }
  
  private resizeTextarea(textarea: HTMLTextAreaElement): void {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight to fit content
    const newHeight = Math.max(32, textarea.scrollHeight);
    textarea.style.height = newHeight + 'px';
  }
  
  private resizeAllTextareas(): void {
    const textareas = document.querySelectorAll('.summary-textarea');
    textareas.forEach((textarea) => {
      this.resizeTextarea(textarea as HTMLTextAreaElement);
    });
  }
  
  private resizeTextareaForScene(sceneId: string): void {
    const textarea = document.querySelector(`textarea[data-scene-id="${sceneId}"]`) as HTMLTextAreaElement;
    if (textarea) {
      this.resizeTextarea(textarea);
    } else {
      // Retry after a short delay if textarea is not yet available
      setTimeout(() => {
        const retryTextarea = document.querySelector(`textarea[data-scene-id="${sceneId}"]`) as HTMLTextAreaElement;
        if (retryTextarea) {
          this.resizeTextarea(retryTextarea);
        }
      }, 50);
    }
  }
  
  private updateTextareaValue(sceneId: string, value: string): void {
    const textarea = document.querySelector(`textarea[data-scene-id="${sceneId}"]`) as HTMLTextAreaElement;
    if (textarea) {
      // Manually set the value to ensure it's displayed
      textarea.value = value;
      // Trigger input event to notify Angular of the change
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  
  private loadAvailableModels(): void {
    // Subscribe to model changes
    this.subscription.add(
      this.modelService.openRouterModels$.subscribe(models => {
        this.availableModels = models;
        if (models.length > 0 && !this.selectedModel) {
          this.setDefaultModel();
        }
      })
    );
    
    // Load models if not already loaded
    const currentModels = this.modelService.getCurrentOpenRouterModels();
    if (currentModels.length === 0) {
      this.modelService.loadOpenRouterModels().subscribe();
    } else {
      this.availableModels = currentModels;
    }
  }
  
  private setDefaultModel(): void {
    const settings = this.settingsService.getSettings();
    if (settings.openRouter.enabled && settings.openRouter.model) {
      this.selectedModel = settings.openRouter.model;
    } else if (this.availableModels.length > 0) {
      // Fallback to first available model
      this.selectedModel = this.availableModels[0].id;
    }
  }
  
  onChapterKeyDown(event: KeyboardEvent, chapterId: string): void {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        event.stopPropagation();
        this.toggleChapter(chapterId);
        break;
      case 'ArrowRight':
        if (!this.expandedChapters.has(chapterId)) {
          event.preventDefault();
          this.expandedChapters.add(chapterId);
        }
        break;
      case 'ArrowLeft':
        if (this.expandedChapters.has(chapterId)) {
          event.preventDefault();
          this.expandedChapters.delete(chapterId);
        }
        break;
    }
  }
  
  onSceneKeyDown(event: KeyboardEvent, chapterId: string, sceneId: string): void {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        event.stopPropagation();
        this.selectScene(chapterId, sceneId);
        break;
    }
  }
  
  onCloseSidebar(): void {
    this.closeSidebar.emit();
  }
  
  startEditingTitle(sceneId: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    
    // Find the scene to store its original title
    for (const chapter of this.story.chapters) {
      const scene = chapter.scenes.find(s => s.id === sceneId);
      if (scene) {
        this.originalTitles.set(sceneId, scene.title || '');
        break;
      }
    }
    
    this.isEditingTitle.add(sceneId);
    
    // Focus the input after Angular renders it
    setTimeout(() => {
      const inputs = document.querySelectorAll('.scene-title-input-edit');
      inputs.forEach((input: Element) => {
        if (input && 'setFocus' in input && typeof (input as { setFocus: () => void }).setFocus === 'function') {
          (input as { setFocus: () => void }).setFocus();
        }
      });
    }, 50);
  }
  
  stopEditingTitle(chapterId: string, scene: Scene): void {
    this.isEditingTitle.delete(scene.id);
    this.originalTitles.delete(scene.id);
    this.updateScene(chapterId, scene);
  }
  
  cancelEditingTitle(scene: Scene): void {
    // Restore original title
    const originalTitle = this.originalTitles.get(scene.id);
    if (originalTitle !== undefined) {
      scene.title = originalTitle;
    }
    
    this.isEditingTitle.delete(scene.id);
    this.originalTitles.delete(scene.id);
  }
  
  private scrollToActiveScene(): void {
    if (!this.activeSceneId) return;
    
    // Wait for DOM to be updated
    setTimeout(() => {
      const activeSceneElement = document.querySelector(`.scene-item.active-scene`);
      if (!activeSceneElement) return;
      
      // Find just the ion-content element - it's the scrollable container
      const ionContent = document.querySelector('.story-structure ion-content');
      
      if (ionContent) {
        // Get the scrollable element - for ion-content it's usually itself or a child
        const scrollElement = ionContent.shadowRoot?.querySelector('.inner-scroll') || ionContent;
        
        // Simple approach: get element position and scroll to center it
        const elementRect = activeSceneElement.getBoundingClientRect();
        const containerRect = scrollElement.getBoundingClientRect();
        
        // Calculate how much to scroll to center the element
        const elementCenter = elementRect.top + (elementRect.height / 2);
        const containerCenter = containerRect.top + (containerRect.height / 2);
        const scrollOffset = elementCenter - containerCenter;
        
        // Apply the scroll offset
        const currentScrollTop = scrollElement.scrollTop || 0;
        const newScrollTop = currentScrollTop + scrollOffset;
        
        // Scroll to the calculated position
        if (scrollElement.scrollTo) {
          scrollElement.scrollTo({
            top: newScrollTop,
            behavior: 'instant'
          });
        } else {
          scrollElement.scrollTop = newScrollTop;
        }
      }
      
    }, 150); // Slightly longer timeout to ensure DOM is ready
  }

  private removeEmbeddedImages(content: string): string {
    // Remove base64 encoded images
    // Matches: <img src="data:image/[type];base64,[data]" ...>
    let cleanedContent = content.replace(/<img[^>]*src="data:image\/[^"]*"[^>]*>/gi, '[Image removed]');
    
    // Also remove markdown-style base64 images
    // Matches: ![alt](data:image/[type];base64,[data])
    cleanedContent = cleanedContent.replace(/!\[[^\]]*\]\(data:image\/[^)]*\)/gi, '[Image removed]');
    
    // Remove any remaining large base64 strings that might be in the content
    // This catches base64 strings that are at least 1000 characters long
    cleanedContent = cleanedContent.replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/]{1000,}={0,2}/g, '[Image data removed]');
    
    return cleanedContent;
  }

  // Methods for formatting chapter and scene displays with IDs
  getChapterDisplayTitle(chapter: Chapter): string {
    return this.storyService.formatChapterDisplay(chapter);
  }

  getSceneDisplayTitle(chapter: Chapter, scene: Scene): string {
    return this.storyService.formatSceneDisplay(chapter, scene);
  }
}