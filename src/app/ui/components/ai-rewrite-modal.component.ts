import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonTextarea, IonIcon, IonChip,
  IonSpinner, ModalController, IonModal, IonList, IonCheckbox,
  IonItemDivider, IonSearchbar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, sendOutline, refreshOutline, copyOutline, addOutline, readerOutline } from 'ionicons/icons';
import { BeatAIService } from '../../shared/services/beat-ai.service';
import { StoryService } from '../../stories/services/story.service';
import { SettingsService } from '../../core/services/settings.service';
import { AIRequestLoggerService } from '../../core/services/ai-request-logger.service';
import { ModelService } from '../../core/services/model.service';
import { Story, Scene, Chapter } from '../../stories/models/story.interface';
import { Observable, of, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export interface AIRewriteResult {
  originalText: string;
  rewrittenText: string;
  prompt?: string;
}

interface SceneContext {
  chapterId: string;
  sceneId: string;
  chapterTitle: string;
  sceneTitle: string;
  content: string;
  selected: boolean;
}

@Component({
  selector: 'app-ai-rewrite-modal',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonItem, IonLabel, IonTextarea, IonIcon, IonChip, IonSpinner,
    IonModal, IonList, IonCheckbox, IonItemDivider, IonSearchbar
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Rewrite Text with AI</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" (click)="dismiss()">
            <ion-icon name="close-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Context Selection -->
      <div class="context-section">
        <ion-label>
          <h3>Context for AI Reformulation</h3>
          <p>Select the context that the AI should consider during reformulation.</p>
        </ion-label>
        
        <div class="context-controls">
          <ion-button 
            fill="outline" 
            size="small" 
            [color]="includeStoryOutline ? 'primary' : 'medium'"
            (click)="includeStoryOutline = !includeStoryOutline">
            <ion-icon name="reader-outline" slot="start"></ion-icon>
            Story Overview
          </ion-button>
          
          <ion-button 
            fill="outline" 
            size="small" 
            color="medium"
            (click)="showSceneSelector = true">
            <ion-icon name="add-outline" slot="start"></ion-icon>
            Add Scenes
          </ion-button>
        </div>

        <!-- Context Chips -->
        <div class="context-chips" *ngIf="selectedScenes.length > 0 || includeStoryOutline">
          <ion-chip *ngIf="includeStoryOutline" color="success">
            <ion-label>Story Overview</ion-label>
            <ion-icon 
              name="close-outline" 
              (click)="includeStoryOutline = false">
            </ion-icon>
          </ion-chip>
          <ion-chip *ngFor="let scene of selectedScenes" [color]="scene.sceneId === currentSceneId ? 'primary' : 'medium'">
            <ion-label>{{ scene.chapterTitle }} - {{ scene.sceneTitle }}</ion-label>
            <ion-icon 
              name="close-outline" 
              (click)="removeSceneContext(scene)">
            </ion-icon>
          </ion-chip>
        </div>
      </div>

      <!-- Original Text -->
      <ion-item class="original-text-item">
        <ion-label position="stacked">Original Text</ion-label>
        <div class="original-text">{{ selectedText }}</div>
      </ion-item>

      <!-- Custom Prompt -->
      <ion-item>
        <ion-label position="stacked">Additional Prompt (optional)</ion-label>
        <ion-textarea
          [(ngModel)]="customPrompt"
          placeholder="e.g. 'Make it more formal', 'Write it more emotionally', 'Shorten it'"
          [autoGrow]="true"
          [maxlength]="500"
          [counter]="true">
        </ion-textarea>
      </ion-item>

      <!-- Quick Prompts -->
      <div class="quick-prompts" *ngIf="!isRewriting">
        <ion-label>Quick Options:</ion-label>
        <div class="prompt-chips">
          <ion-chip 
            *ngFor="let prompt of quickPrompts" 
            (click)="selectQuickPrompt(prompt)"
            [outline]="customPrompt !== prompt">
            {{ prompt }}
          </ion-chip>
        </div>
      </div>

      <!-- Rewritten Text -->
      <div *ngIf="rewrittenText" class="rewritten-section">
        <ion-item class="rewritten-text-item">
          <ion-label position="stacked">Rewritten Text</ion-label>
          <div class="rewritten-text">{{ rewrittenText }}</div>
        </ion-item>
      </div>

      <!-- Loading -->
      <div *ngIf="isRewriting" class="loading-section">
        <ion-spinner name="dots"></ion-spinner>
        <p>AI is rewriting the text...</p>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <ion-button 
          expand="block" 
          fill="solid" 
          color="primary"
          (click)="rewriteText()"
          [disabled]="isRewriting || !selectedText.trim()">
          <ion-icon name="send-outline" slot="start"></ion-icon>
          Rewrite
        </ion-button>

        <div class="button-row" *ngIf="rewrittenText">
          <ion-button 
            expand="block" 
            fill="outline" 
            color="primary"
            (click)="rewriteText()">
            <ion-icon name="refresh-outline" slot="start"></ion-icon>
            Try Again
          </ion-button>

          <ion-button 
            expand="block" 
            fill="outline" 
            color="medium"
            (click)="copyToClipboard()">
            <ion-icon name="copy-outline" slot="start"></ion-icon>
            Copy
          </ion-button>
        </div>

        <ion-button 
          *ngIf="rewrittenText"
          expand="block" 
          fill="solid" 
          color="success"
          (click)="useRewrittenText()">
          Use Text
        </ion-button>
      </div>
    </ion-content>

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
    .context-section {
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: rgba(71, 118, 230, 0.05);
      border: 1px solid rgba(71, 118, 230, 0.2);
      border-radius: 12px;
    }

    .context-section ion-label h3 {
      margin: 0 0 0.5rem 0;
      color: var(--ion-color-primary);
      font-weight: 600;
    }

    .context-section ion-label p {
      margin: 0 0 1rem 0;
      color: var(--ion-color-medium);
      font-size: 0.9rem;
    }

    .context-controls {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .context-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .context-chips ion-chip {
      margin: 0;
      cursor: pointer;
    }

    .original-text-item,
    .rewritten-text-item {
      --background: rgba(0, 0, 0, 0.05);
      --border-radius: 8px;
      margin: 1rem 0;
    }

    .original-text,
    .rewritten-text {
      background: rgba(255, 255, 255, 0.1);
      padding: 12px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      white-space: pre-wrap;
      line-height: 1.5;
      max-height: 200px;
      overflow-y: auto;
      font-family: inherit;
    }

    .rewritten-text {
      background: rgba(71, 118, 230, 0.1);
      border-color: rgba(71, 118, 230, 0.3);
    }

    .quick-prompts {
      margin: 1rem 0;
    }

    .quick-prompts ion-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: var(--ion-color-medium);
    }

    .prompt-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .prompt-chips ion-chip {
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .prompt-chips ion-chip:hover {
      transform: translateY(-1px);
    }

    .loading-section {
      text-align: center;
      padding: 2rem;
    }

    .loading-section ion-spinner {
      margin-bottom: 1rem;
    }

    .action-buttons {
      margin-top: 2rem;
      gap: 1rem;
    }

    .button-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin: 1rem 0;
    }

    .rewritten-section {
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Dark theme adjustments */
    @media (prefers-color-scheme: dark) {
      .original-text,
      .rewritten-text {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.1);
      }

      .rewritten-text {
        background: rgba(71, 118, 230, 0.15);
        border-color: rgba(71, 118, 230, 0.4);
      }
    }
  `]
})
export class AIRewriteModalComponent implements OnInit {
  @Input() selectedText = '';
  @Input() storyId = '';
  @Input() currentChapterId = '';
  @Input() currentSceneId = '';
  @Output() textRewritten = new EventEmitter<AIRewriteResult>();
  @Output() dismissed = new EventEmitter<void>();

  private modalController = inject(ModalController);
  private beatAIService = inject(BeatAIService);
  private storyService = inject(StoryService);
  private settingsService = inject(SettingsService);
  private aiLogger = inject(AIRequestLoggerService);
  private modelService = inject(ModelService);

  customPrompt = '';
  rewrittenText = '';
  isRewriting = false;
  
  // Context management
  story: Story | null = null;
  selectedScenes: SceneContext[] = [];
  includeStoryOutline = false;
  showSceneSelector = false;
  sceneSearchTerm = '';
  

  quickPrompts = [
    'Make it more formal',
    'Make it more casual',
    'Shorten it',
    'Expand it',
    'Write more emotionally',
    'Write more objectively',
    'Improve grammar',
    'Express more simply'
  ];

  constructor() {
    addIcons({ closeOutline, sendOutline, refreshOutline, copyOutline, addOutline, readerOutline });
  }

  async ngOnInit() {
    // Load story and setup default context
    if (this.storyId) {
      await this.loadStoryAndSetupContext();
    }
    
    // Focus the custom prompt textarea after a short delay
    setTimeout(() => {
      const textarea = document.querySelector('ion-textarea') as HTMLIonTextareaElement;
      if (textarea) {
        textarea.setFocus();
      }
    }, 300);
  }

  selectQuickPrompt(prompt: string) {
    this.customPrompt = this.customPrompt === prompt ? '' : prompt;
  }

  async rewriteText() {
    if (!this.selectedText.trim() || this.isRewriting) return;

    this.isRewriting = true;
    this.rewrittenText = '';

    try {
      // Prepare scene context
      const sceneContext = this.selectedScenes
        .map(scene => `<scene chapter="${scene.chapterTitle}" title="${scene.sceneTitle}">\n${scene.content}\n</scene>`)
        .join('\n\n');

      // Prepare story outline if enabled
      let storyOutline = '';
      if (this.includeStoryOutline) {
        storyOutline = this.buildStoryOutline();
      }

      // Build context text
      let contextText = '';
      if (storyOutline) {
        contextText += `Story Overview:\n${storyOutline}\n\n`;
      }
      if (sceneContext) {
        contextText += `Scene Context:\n${sceneContext}\n\n`;
      }

      // Build the rewrite prompt with context
      const basePrompt = contextText 
        ? `${contextText}Based on the above context, rewrite the following text: "${this.selectedText}"`
        : `Rewrite the following text: "${this.selectedText}"`;
      
      const fullPrompt = this.customPrompt 
        ? `${basePrompt}\n\nAdditional instruction: ${this.customPrompt}\n\nPlease ensure that the rewritten text fits the style and context of the story.`
        : `${basePrompt}\n\nPlease ensure that the rewritten text fits the style and context of the story.`;

      // Generate a unique beat ID for this rewrite request
      const beatId = `rewrite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Call AI directly without the beat generation template
      let accumulatedResponse = '';
      this.callAIDirectly(
        fullPrompt,
        beatId,
        { wordCount: Math.max(50, Math.ceil(this.selectedText.length * 1.2)) }
      ).subscribe({
        next: (chunk) => {
          accumulatedResponse = chunk;
          // Show progressive response
          this.rewrittenText = accumulatedResponse;
        },
        complete: () => {
          this.rewrittenText = accumulatedResponse || 'Error generating text.';
          this.isRewriting = false;
        },
        error: (error) => {
          console.error('Error rewriting text:', error);
          this.rewrittenText = 'Error rewriting text. Please try again.';
          this.isRewriting = false;
        }
      });
    } catch (error) {
      console.error('Error rewriting text:', error);
      this.rewrittenText = 'Error rewriting text. Please try again.';
      this.isRewriting = false;
    }
  }

  async copyToClipboard() {
    if (this.rewrittenText) {
      try {
        await navigator.clipboard.writeText(this.rewrittenText);
        // Could add a toast notification here
      } catch (error) {
        console.error('Failed to copy text:', error);
      }
    }
  }

  useRewrittenText() {
    if (this.rewrittenText) {
      const result = {
        originalText: this.selectedText,
        rewrittenText: this.rewrittenText,
        prompt: this.customPrompt || undefined
      };
      this.textRewritten.emit(result);
      this.modalController.dismiss(result);
    }
  }

  dismiss() {
    this.dismissed.emit();
    this.modalController.dismiss();
  }

  // Context management methods (copied from Scene Chat)
  private async loadStoryAndSetupContext(): Promise<void> {
    try {
      this.story = await this.storyService.getStory(this.storyId);
      if (this.story && this.currentChapterId && this.currentSceneId) {
        // Load current scene as default context
        const chapter = this.story.chapters.find(c => c.id === this.currentChapterId);
        const scene = chapter?.scenes.find(s => s.id === this.currentSceneId);
        
        if (chapter && scene) {
          this.selectedScenes.push({
            chapterId: chapter.id,
            sceneId: scene.id,
            chapterTitle: `C${chapter.chapterNumber || chapter.order}:${chapter.title}`,
            sceneTitle: `C${chapter.chapterNumber || chapter.order}S${scene.sceneNumber || scene.order}:${scene.title}`,
            content: this.extractFullTextFromScene(scene),
            selected: true
          });
        }
      }
    } catch (error) {
      console.error('Error loading story for context:', error);
    }
  }

  toggleSceneSelection(chapterId: string, sceneId: string): void {
    const index = this.selectedScenes.findIndex(s => s.sceneId === sceneId);
    
    if (index > -1) {
      this.selectedScenes.splice(index, 1);
    } else {
      const chapter = this.story?.chapters.find(c => c.id === chapterId);
      const scene = chapter?.scenes.find(s => s.id === sceneId);
      
      if (chapter && scene) {
        this.selectedScenes.push({
          chapterId: chapter.id,
          sceneId: scene.id,
          chapterTitle: `C${chapter.chapterNumber || chapter.order}:${chapter.title}`,
          sceneTitle: `C${chapter.chapterNumber || chapter.order}S${scene.sceneNumber || scene.order}:${scene.title}`,
          content: this.extractFullTextFromScene(scene),
          selected: true
        });
      }
    }
  }

  isSceneSelected(sceneId: string): boolean {
    return this.selectedScenes.some(s => s.sceneId === sceneId);
  }

  removeSceneContext(scene: SceneContext): void {
    const index = this.selectedScenes.findIndex(s => s.sceneId === scene.sceneId);
    if (index > -1) {
      this.selectedScenes.splice(index, 1);
    }
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

  private buildStoryOutline(): string {
    if (!this.story) return '';
    
    let outline = '';
    
    this.story.chapters.forEach(chapter => {
      outline += `\n## ${chapter.title}\n`;
      
      chapter.scenes.forEach(scene => {
        outline += `\n### ${scene.title}\n`;
        
        if (scene.summary) {
          outline += `${scene.summary}\n`;
        } else {
          // Fallback to truncated content if no summary
          const cleanText = this.extractFullTextFromScene(scene);
          const truncated = cleanText.substring(0, 200);
          outline += `${truncated}${cleanText.length > 200 ? '...' : ''}\n`;
        }
      });
    });
    
    return outline;
  }

  // Direct AI API calls (copied from Scene Chat)
  private callAIDirectly(prompt: string, beatId: string, options: { wordCount: number }): Observable<string> {
    const settings = this.settingsService.getSettings();
    
    // Use global model from settings
    const modelToUse = settings.selectedModel;
    
    // Extract provider from the selected model
    let provider: string | null = null;
    let actualModelId: string | null = null;
    
    if (modelToUse) {
      const [modelProvider, ...modelIdParts] = modelToUse.split(':');
      provider = modelProvider;
      actualModelId = modelIdParts.join(':'); // Rejoin in case model ID contains colons
    }
    
    // Check which API to use based on the selected model's provider
    const useGoogleGemini = provider === 'gemini' && settings.googleGemini.enabled && settings.googleGemini.apiKey;
    const useOpenRouter = provider === 'openrouter' && settings.openRouter.enabled && settings.openRouter.apiKey;
    
    if (!useGoogleGemini && !useOpenRouter) {
      console.warn('No AI API configured or no model selected');
      return of('Sorry, no AI API configured or no model selected.');
    }
    
    // For direct calls, we bypass the beat AI service and call the API directly
    return new Observable<string>(observer => {
      let accumulatedResponse = '';
      let logId: string;
      const startTime = Date.now();
      
      // Create a simple API call based on configuration
      const apiCall = useGoogleGemini 
        ? this.callGeminiAPI(prompt, { ...options, model: actualModelId })
        : this.callOpenRouterAPI(prompt, { ...options, model: actualModelId });
        
      apiCall.subscribe({
        next: (chunk) => {
          accumulatedResponse += chunk;
          observer.next(accumulatedResponse);
        },
        complete: () => {
          // Log success
          if (logId) {
            this.aiLogger.logSuccess(
              logId,
              accumulatedResponse,
              Date.now() - startTime
            );
          }
          observer.complete();
        },
        error: (error) => {
          // Log error
          if (logId) {
            this.aiLogger.logError(
              logId,
              error.message || 'Unknown error',
              Date.now() - startTime,
              { errorDetails: error }
            );
          }
          observer.error(error);
        }
      });
      
      // Store log ID for later use
      if (useGoogleGemini) {
        logId = this.logGeminiRequest(prompt, { ...options, model: actualModelId });
      } else {
        logId = this.logOpenRouterRequest(prompt, { ...options, model: actualModelId });
      }
    });
  }
  
  private callGeminiAPI(prompt: string, options: { wordCount: number; model?: string | null }): Observable<string> {
    const settings = this.settingsService.getSettings();
    const apiKey = settings.googleGemini.apiKey;
    const model = options.model || settings.googleGemini.model || 'gemini-1.5-flash';
    
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: Math.ceil(options.wordCount * 2.5),
        topP: 0.95,
        topK: 40
      }
    };
    
    return from(fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })).pipe(
      switchMap(response => {
        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }
        return this.processStreamResponse(response);
      })
    );
  }
  
  private callOpenRouterAPI(prompt: string, options: { wordCount: number; model?: string | null }): Observable<string> {
    const settings = this.settingsService.getSettings();
    const apiKey = settings.openRouter.apiKey;
    const model = options.model || settings.openRouter.model || 'anthropic/claude-3-haiku';
    
    const requestBody = {
      model: model,
      messages: [{
        role: 'user',
        content: prompt
      }],
      stream: true,
      max_tokens: Math.ceil(options.wordCount * 2.5),
      temperature: 0.7
    };
    
    return from(fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.href,
        'X-Title': 'Creative Writer'
      },
      body: JSON.stringify(requestBody)
    })).pipe(
      switchMap(response => {
        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }
        return this.processStreamResponse(response);
      })
    );
  }
  
  private processStreamResponse(response: Response): Observable<string> {
    return new Observable<string>(observer => {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      const processChunk = async () => {
        try {
          const { done, value } = await reader!.read();
          
          if (done) {
            observer.complete();
            return;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              if (jsonStr === '[DONE]') continue;
              
              try {
                const json = JSON.parse(jsonStr);
                let text = '';
                
                // Handle different response formats
                if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
                  // Gemini format
                  text = json.candidates[0].content.parts[0].text;
                } else if (json.choices?.[0]?.delta?.content) {
                  // OpenRouter format
                  text = json.choices[0].delta.content;
                }
                
                if (text) {
                  observer.next(text);
                }
              } catch {
                // Ignore JSON parse errors
              }
            }
          }
          
          processChunk();
        } catch (error) {
          observer.error(error);
        }
      };
      
      processChunk();
    });
  }

  private logGeminiRequest(prompt: string, options: { wordCount: number; model?: string | null }): string {
    const settings = this.settingsService.getSettings();
    const model = options.model || settings.googleGemini.model || 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;
    
    return this.aiLogger.logRequest({
      endpoint: endpoint,
      model: model,
      wordCount: options.wordCount,
      maxTokens: Math.ceil(options.wordCount * 2.5),
      prompt: prompt,
      apiProvider: 'gemini',
      streamingMode: true,
      requestDetails: {
        source: 'ai-rewrite',
        temperature: 0.7,
        topP: 0.95,
        topK: 40
      }
    });
  }
  
  private logOpenRouterRequest(prompt: string, options: { wordCount: number; model?: string | null }): string {
    const settings = this.settingsService.getSettings();
    const model = options.model || settings.openRouter.model || 'anthropic/claude-3-haiku';
    const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    
    return this.aiLogger.logRequest({
      endpoint: endpoint,
      model: model,
      wordCount: options.wordCount,
      maxTokens: Math.ceil(options.wordCount * 2.5),
      prompt: prompt,
      apiProvider: 'openrouter',
      streamingMode: true,
      requestDetails: {
        source: 'ai-rewrite',
        temperature: 0.7
      }
    });
  }
}
