import { Component, Input, Output, EventEmitter, AfterViewInit, OnInit, OnChanges, OnDestroy, SimpleChanges, ChangeDetectorRef, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonList, IonItem, IonLabel, IonButton, IonIcon, IonInput,
  IonChip, IonTextarea, IonSelect, IonSelectOption, IonBadge, ActionSheetController, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  chevronForward, chevronDown, add, trash, createOutline,
  flashOutline, documentTextOutline, timeOutline, sparklesOutline, close,
  logoGoogle, gitNetworkOutline, cloudOutline, hardwareChip
} from 'ionicons/icons';
import { Story, Chapter, Scene } from '../../models/story.interface';
import { StoryService } from '../../services/story.service';
import { OpenRouterApiService } from '../../../core/services/openrouter-api.service';
import { GoogleGeminiApiService } from '../../../core/services/google-gemini-api.service';
import { ModelService } from '../../../core/services/model.service';
import { SettingsService } from '../../../core/services/settings.service';
import { PromptManagerService } from '../../../shared/services/prompt-manager.service';
import { ModelOption } from '../../../core/models/model.interface';
import { OpenRouterIconComponent } from '../../../ui/icons/openrouter-icon.component';
import { ClaudeIconComponent } from '../../../ui/icons/claude-icon.component';
import { ReplicateIconComponent } from '../../../ui/icons/replicate-icon.component';
import { OllamaIconComponent } from '../../../ui/icons/ollama-icon.component';
import { Subscription } from 'rxjs';
import { SceneCreateFromOutlineComponent } from '../scene-create-from-outline/scene-create-from-outline.component';

@Component({
  selector: 'app-story-structure',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonList, IonItem, IonLabel, IonButton, IonIcon, IonInput,
    IonChip, IonTextarea, IonSelect, IonSelectOption, IonBadge,
    OpenRouterIconComponent, ClaudeIconComponent, ReplicateIconComponent, OllamaIconComponent
  ],
  templateUrl: './story-structure.component.html',
  styleUrls: ['./story-structure.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
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
  private actionSheetCtrl = inject(ActionSheetController);
  private modalCtrl = inject(ModalController);

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
  summaryFavoriteModels: ModelOption[] = [];
  private subscription = new Subscription();

  constructor() {
    addIcons({ 
      chevronForward, chevronDown, add, trash, createOutline,
      flashOutline, documentTextOutline, timeOutline, sparklesOutline, close,
      logoGoogle, gitNetworkOutline, cloudOutline, hardwareChip
    });
  }

  ngOnInit() {
    // Auto-expand chapter containing active scene
    this.expandActiveChapter();
    
    // Load available models and set default
    this.loadAvailableModels();
    this.setDefaultModel();
    this.updateSummaryFavoriteModels();
  }
  
  ngOnChanges(changes: SimpleChanges) {
    // When activeChapterId or activeSceneId changes, expand the relevant chapter
    if (changes['activeChapterId'] || changes['activeSceneId']) {
      this.expandActiveChapter();
      // Auto-scroll to active scene when active scene changes
      setTimeout(() => this.scrollToActiveScene(), 100);
    }

    if (changes['story']) {
      this.updateSummaryFavoriteModels();
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
      this.updateSummaryFavoriteModels();
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
      const wasActive = this.activeChapterId === chapterId;
      this.story = updatedStory;
      this.updateSummaryFavoriteModels();
      this.expandedChapters.delete(chapterId);
        // If the deleted chapter was active, select a sensible fallback
        if (wasActive && this.story.chapters.length > 0) {
          const fallbackChapter = this.story.chapters[Math.min(0, this.story.chapters.length - 1)];
          const fallbackScene = fallbackChapter.scenes?.[0];
          if (fallbackScene) {
            this.selectScene(fallbackChapter.id, fallbackScene.id);
          }
        }
        // Refresh prompt manager and mark for check
        this.promptManager.refresh();
        this.cdr.markForCheck();
      }
    }
  }

  async addScene(chapterId: string): Promise<void> {
    // Offer choice: empty or generate from outline
    const sheet = await this.actionSheetCtrl.create({
      header: 'Create Scene',
      subHeader: 'Choose how to create the new scene',
      buttons: [
        {
          text: 'Empty scene',
          role: 'empty',
          icon: 'add',
          handler: async () => {
            await this.createEmptyScene(chapterId);
          }
        },
        {
          text: 'Generate from outline (AI)',
          role: 'ai',
          icon: 'sparkles-outline',
          handler: async () => {
            await this.openCreateFromOutlineModal(chapterId);
          }
        },
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  private async createEmptyScene(chapterId: string): Promise<void> {
    await this.storyService.addScene(this.story.id, chapterId);
    const updatedStory = await this.storyService.getStory(this.story.id);
    if (updatedStory) {
      this.story = updatedStory;
      this.updateSummaryFavoriteModels();
      const chapter = this.story.chapters.find(c => c.id === chapterId);
      if (chapter) {
        const newScene = chapter.scenes[chapter.scenes.length - 1];
        this.selectScene(chapterId, newScene.id);
      }
    }
  }

  private async openCreateFromOutlineModal(chapterId: string): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: SceneCreateFromOutlineComponent,
      componentProps: {
        storyId: this.story.id,
        chapterId
      },
      cssClass: 'scene-create-from-outline-modal'
    });

    await modal.present();
    const result = await modal.onWillDismiss<{ createdSceneId?: string; chapterId?: string }>();
    if (result.data?.createdSceneId && result.data?.chapterId) {
      const updatedStory = await this.storyService.getStory(this.story.id);
      if (updatedStory) {
        this.story = updatedStory;
        this.updateSummaryFavoriteModels();
        this.selectScene(result.data.chapterId, result.data.createdSceneId);
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
    
    if (confirm('Really delete scene?')) {
      // Find current index before deletion
      const chapterBefore = this.story.chapters.find(c => c.id === chapterId);
      const idxBefore = chapterBefore?.scenes.findIndex(s => s.id === sceneId) ?? -1;

      await this.storyService.deleteScene(this.story.id, chapterId, sceneId);
      const updatedStory = await this.storyService.getStory(this.story.id);
      if (updatedStory) {
        const wasActive = this.activeSceneId === sceneId;
        this.story = updatedStory;
        this.updateSummaryFavoriteModels();
        // If the deleted scene was active, choose a sensible fallback
        if (wasActive) {
          const ch = this.story.chapters.find(c => c.id === chapterId);
          const scenes = ch?.scenes || [];
          if (scenes.length > 0) {
            // Same chapter neighbor (previous index if possible, otherwise first)
            const fallbackIndex = Math.max(0, Math.min(idxBefore, scenes.length - 1));
            const fallbackScene = scenes[fallbackIndex];
            this.selectScene(chapterId, fallbackScene.id);
          } else {
            // Chapter is empty now. Try next chapters, then previous chapters, otherwise create a new empty scene
            const chapters = this.story.chapters;
            const currentIdx = chapters.findIndex(c => c.id === chapterId);
            let selected = false;

            // Search forward for the next chapter that has scenes
            for (let i = currentIdx + 1; i < chapters.length; i++) {
              const nextCh = chapters[i];
              if (nextCh.scenes && nextCh.scenes.length > 0) {
                this.selectScene(nextCh.id, nextCh.scenes[0].id);
                selected = true;
                break;
              }
            }
            // If not found, search backward
            if (!selected) {
              for (let i = currentIdx - 1; i >= 0; i--) {
                const prevCh = chapters[i];
                if (prevCh.scenes && prevCh.scenes.length > 0) {
                  const lastScene = prevCh.scenes[prevCh.scenes.length - 1];
                  this.selectScene(prevCh.id, lastScene.id);
                  selected = true;
                  break;
                }
              }
            }
            // If the entire story has no scenes, create a new empty scene in the current (now empty) chapter
            if (!selected) {
              this.storyService.addScene(this.story.id, chapterId).then(async (newScene) => {
                const refreshed = await this.storyService.getStory(this.story.id);
                if (refreshed) {
                  this.story = refreshed;
                  this.selectScene(chapterId, newScene.id);
                  this.cdr.markForCheck();
                }
              });
            }
          }
        }
        this.promptManager.refresh();
        this.cdr.markForCheck();
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
    this.cdr.markForCheck(); // Force change detection for mobile
    
    // Set a timeout to clear busy state if request takes too long
    const timeoutId = setTimeout(() => {
      if (this.isGeneratingSummary.has(sceneId)) {
        this.isGeneratingSummary.delete(sceneId);
        this.cdr.markForCheck();
        alert('Summary generation is taking too long. Please try again.');
      }
    }, 30000); // 30 second timeout
    
    // Remove embedded images and strip HTML/Beat AI nodes for clean prompt text
    let sceneContent = this.removeEmbeddedImages(scene.content);
    sceneContent = this.promptManager.extractPlainTextFromHtml(sceneContent);
    
    // Limit content length to avoid token limit issues
    // Approximate: 1 token ≈ 4 characters, so for safety we limit to ~50k tokens ≈ 200k characters
    const maxContentLength = 200000;
    let contentTruncated = false;
    
    if (sceneContent.length > maxContentLength) {
      sceneContent = sceneContent.substring(0, maxContentLength);
      contentTruncated = true;
    }
    
    // Determine language instruction for summary based on story language
    const storyLanguage = this.story.settings?.language || 'en';
    const languageInstruction = (() => {
      switch (storyLanguage) {
        case 'de':
          return 'Antworte auf Deutsch.';
        case 'fr':
          return 'Réponds en français.';
        case 'es':
          return 'Responde en español.';
        case 'en':
          return 'Respond in English.';
        case 'custom':
        default:
          return 'Write the summary in the same language as the scene content.';
      }
    })();

    // Desired summary length in words (bounded for safety)
    const desiredWordCount = Math.max(20, Math.min(1000, settings.sceneSummaryGeneration.wordCount || 120));
    const wordCountInstruction = `Aim for about ${desiredWordCount} words.`;

    // Build prompt based on settings
    let prompt: string;
    if (settings.sceneSummaryGeneration.useCustomPrompt) {
      prompt = settings.sceneSummaryGeneration.customPrompt
        .replace(/{sceneTitle}/g, scene.title || 'Untitled')
        .replace(/{sceneContent}/g, sceneContent + (contentTruncated ? '\n\n[Note: Content was truncated as it was too long]' : ''))
        .replace(/{customInstruction}/g, settings.sceneSummaryGeneration.customInstruction || '')
        .replace(/{languageInstruction}/g, languageInstruction)
        .replace(/{summaryWordCount}/g, String(desiredWordCount));
      // Ensure language instruction is present even if template doesn't include placeholder
      if (!prompt.includes(languageInstruction)) {
        prompt += `\n\n${languageInstruction}`;
      }
      // Ensure approximate word count guidance present if template omits it
      if (!/\bword(s)?\b/i.test(prompt)) {
        prompt += `\n\n${wordCountInstruction}`;
      }
    } else {
      // Default prompt
      prompt = `Create a summary of the following scene:\n\nTitle: ${scene.title || 'Untitled'}\n\nContent:\n${sceneContent}${contentTruncated ? '\n\n[Note: Content was truncated as it was too long]' : ''}\n\nWrite a focused, comprehensive summary that captures the most important plot points and character developments. ${wordCountInstruction}`;
      
      // Add custom instruction if provided
      if (settings.sceneSummaryGeneration.customInstruction) {
        prompt += `\n\nZusätzliche Anweisungen: ${settings.sceneSummaryGeneration.customInstruction}`;
      }
      // Add language instruction at the end
      prompt += `\n\n${languageInstruction}`;
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
            this.cdr.markForCheck();
            
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
              this.updateSummaryFavoriteModels();
            }
          }
          clearTimeout(timeoutId); // Clear timeout on success
          this.isGeneratingSummary.delete(sceneId);
          this.cdr.markForCheck(); // Force change detection
          
          // Ensure textarea is properly resized and updated after content update
          setTimeout(() => {
            if (scene && scene.summary) {
              this.updateTextareaValue(sceneId, scene.summary);
            }
            this.resizeTextareaForScene(sceneId);
            this.cdr.markForCheck();
          }, 150);
        },
        error: (error) => {
          console.error('Error generating scene summary:', error);
          clearTimeout(timeoutId); // Clear timeout on error
          
          const errorMessage = 'Error generating summary.';
          alert(errorMessage);
          this.isGeneratingSummary.delete(sceneId);
          this.cdr.markForCheck(); // Force change detection
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
          this.cdr.markForCheck();
          
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
          this.updateSummaryFavoriteModels();
        }
      }
        clearTimeout(timeoutId); // Clear timeout on success
        this.isGeneratingSummary.delete(sceneId);
        this.cdr.markForCheck(); // Force change detection
        
        // Ensure textarea is properly resized and updated after content update
        setTimeout(() => {
          if (scene && scene.summary) {
            this.updateTextareaValue(sceneId, scene.summary);
          }
          this.resizeTextareaForScene(sceneId);
          this.cdr.markForCheck();
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
        this.cdr.markForCheck(); // Force change detection
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
    this.cdr.markForCheck(); // Force change detection for mobile
    
    // Set a timeout to clear busy state if request takes too long
    const timeoutId = setTimeout(() => {
      if (this.isGeneratingTitle.has(sceneId)) {
        this.isGeneratingTitle.delete(sceneId);
        this.cdr.markForCheck();
        alert('Title generation is taking too long. Please try again.');
      }
    }, 30000); // 30 second timeout
    
    // Remove embedded images and strip HTML/Beat AI nodes for clean prompt text
    let sceneContent = this.removeEmbeddedImages(scene.content);
    sceneContent = this.promptManager.extractPlainTextFromHtml(sceneContent);
    
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
          this.cdr.markForCheck(); // Force change detection
        },
        error: (error) => {
          console.error('Error generating scene title:', error);
          clearTimeout(timeoutId); // Clear timeout on error
          
          const errorMessage = 'Error generating title.';
          alert(errorMessage);
          this.isGeneratingTitle.delete(sceneId);
          this.cdr.markForCheck(); // Force change detection
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
          this.cdr.markForCheck(); // Force change detection
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
        this.cdr.markForCheck(); // Force change detection
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
        this.cdr.markForCheck();
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
      this.modelService.getCombinedModels().subscribe(models => {
        this.availableModels = models;
        if (models.length > 0 && !this.selectedModel) {
          this.setDefaultModel();
        }
        this.updateSummaryFavoriteModels();
        this.cdr.markForCheck();
      })
    );
  }
  
  private setDefaultModel(): void {
    const settings = this.settingsService.getSettings();
    const preferredModelId = settings.sceneSummaryGeneration.selectedModel
      || settings.selectedModel
      || settings.openRouter.model;

    if (preferredModelId) {
      const matched = this.findModelForFavorite(preferredModelId);
      if (matched) {
        this.selectedModel = matched.id;
        return;
      }
    }

    if (this.availableModels.length > 0) {
      this.selectedModel = this.availableModels[0].id;
    }
  }

  private updateSummaryFavoriteModels(): void {
    if (!this.story) {
      this.summaryFavoriteModels = [];
      return;
    }

    const favoriteIds = this.story.settings?.favoriteModelLists?.sceneSummary ?? [];
    const normalized = Array.isArray(favoriteIds) ? favoriteIds : [];

    const resolved = normalized
      .map(id => this.findModelForFavorite(id))
      .filter((model): model is ModelOption => !!model);

    this.summaryFavoriteModels = resolved;
    this.cdr.markForCheck();
  }

  private findModelForFavorite(favoriteId: string): ModelOption | undefined {
    if (!favoriteId) {
      return undefined;
    }

    let model = this.availableModels.find(m => m.id === favoriteId);
    if (model) {
      return model;
    }

    const trimmedId = favoriteId.includes(':') ? favoriteId.split(':').slice(1).join(':') : favoriteId;
    model = this.availableModels.find(m => m.id === trimmedId || m.id.endsWith(`:${trimmedId}`) || m.id.endsWith(`/${trimmedId}`));
    return model;
  }

  selectSummaryFavorite(model: ModelOption): void {
    this.selectedModel = model.id;
    this.cdr.markForCheck();
  }

  getShortModelName(label: string): string {
    if (!label) {
      return '';
    }
    if (label.length <= 18) {
      return label;
    }
    const segments = label.split(' ');
    if (segments.length > 1) {
      return `${segments[0]} ${segments[1].slice(0, 6)}`;
    }
    return label.slice(0, 18);
  }

  getProviderIcon(provider: string): string {
    switch (provider) {
      case 'gemini':
        return 'logo-google';
      case 'openrouter':
        return 'git-network-outline';
      case 'ollama':
        return 'hardware-chip';
      case 'replicate':
        return 'cloud-outline';
      case 'claude':
      default:
        return 'sparkles-outline';
    }
  }
  
  private isEventFromTextInput(event: KeyboardEvent): boolean {
    const isElement = (node: EventTarget | null | undefined): node is Element => {
      return !!node && (node as Element).tagName !== undefined;
    };
    const isTextLike = (el: Element): boolean => {
      const tag = el.tagName?.toLowerCase?.() || '';
      if (tag === 'input' || tag === 'textarea' || tag === 'ion-input' || tag === 'ion-textarea') return true;
      if (el instanceof HTMLElement) {
        if (el.isContentEditable) return true;
        const ce = el.getAttribute('contenteditable');
        return ce === '' || ce === 'true';
      }
      return false;
    };
    const pathTargets = (event.composedPath ? event.composedPath() : [event.target]) as EventTarget[];
    for (const t of pathTargets) {
      if (isElement(t) && isTextLike(t)) return true;
    }
    return false;
  }

  onChapterKeyDown(event: KeyboardEvent, chapterId: string): void {
    // Do not handle keys when focus is inside a text input/textarea
    if (this.isEventFromTextInput(event)) return;
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
    // Do not handle keys when focus is inside a text input/textarea
    if (this.isEventFromTextInput(event)) return;
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
