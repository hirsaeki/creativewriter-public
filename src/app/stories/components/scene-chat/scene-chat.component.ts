import { Component, OnInit, ViewChild, ElementRef, OnDestroy, TemplateRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonFooter, IonItem, IonLabel, IonTextarea, IonList,
  IonChip, IonAvatar, IonSearchbar, IonModal, IonCheckbox, IonItemDivider,
  IonButton, IonIcon, IonButtons, IonToolbar, IonTitle, IonHeader
} from '@ionic/angular/standalone';
import { AppHeaderComponent, HeaderAction } from '../../../shared/components/app-header.component';
import { addIcons } from 'ionicons';
import { 
  arrowBack, sendOutline, peopleOutline, documentTextOutline, 
  addOutline, checkmarkOutline, closeOutline, sparklesOutline,
  personOutline, locationOutline, cubeOutline, readerOutline,
  copyOutline, logoGoogle, globeOutline
} from 'ionicons/icons';
import { StoryService } from '../../services/story.service';
import { SettingsService } from '../../../core/services/settings.service';
import { BeatAIService } from '../../../shared/services/beat-ai.service';
import { PromptManagerService } from '../../../shared/services/prompt-manager.service';
import { CodexService } from '../../services/codex.service';
import { AIRequestLoggerService } from '../../../core/services/ai-request-logger.service';
import { ModelService } from '../../../core/services/model.service';
import { Story, Scene, Chapter } from '../../models/story.interface';
import { ModelOption } from '../../../core/models/model.interface';
import { StoryRole } from '../../models/codex.interface';
import { Subscription, Observable, of, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { NgSelectModule } from '@ng-select/ng-select';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isPresetPrompt?: boolean;
  extractionType?: 'characters' | 'locations' | 'objects';
}

interface SceneContext {
  chapterId: string;
  sceneId: string;
  chapterTitle: string;
  sceneTitle: string;
  content: string;
  selected: boolean;
}

interface PresetPrompt {
  id: string;
  title: string;
  description: string;
  prompt: string;
  extractionType: 'characters' | 'locations' | 'objects';
  icon: string;
}

@Component({
  selector: 'app-scene-chat',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NgSelectModule, AppHeaderComponent,
    IonContent, IonFooter, IonItem, IonLabel, IonTextarea, IonList,
    IonChip, IonAvatar, IonSearchbar, IonModal, IonCheckbox, IonItemDivider,
    IonButton, IonIcon, IonButtons, IonToolbar, IonTitle, IonHeader
  ],
  templateUrl: './scene-chat.component.html',
  styleUrls: ['./scene-chat.component.scss']
})
export class SceneChatComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private storyService = inject(StoryService);
  private settingsService = inject(SettingsService);
  private beatAIService = inject(BeatAIService);
  private promptManager = inject(PromptManagerService);
  private codexService = inject(CodexService);
  private aiLogger = inject(AIRequestLoggerService);
  private modelService = inject(ModelService);

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;
  @ViewChild('modelToolbar', { read: TemplateRef }) modelToolbar!: TemplateRef<unknown>;

  story: Story | null = null;
  activeChapterId = '';
  activeSceneId = '';
  messages: ChatMessage[] = [];
  currentMessage = '';
  isGenerating = false;
  
  selectedScenes: SceneContext[] = [];
  showSceneSelector = false;
  sceneSearchTerm = '';
  
  showPresetPrompts = false;
  presetPrompts: PresetPrompt[] = [];
  
  includeStoryOutline = false;
  
  selectedModel = '';
  availableModels: ModelOption[] = [];
  
  headerActions: HeaderAction[] = [];
  
  private subscriptions = new Subscription();
  private abortController: AbortController | null = null;
  keyboardVisible = false;

  constructor() {
    addIcons({ 
      arrowBack, sendOutline, peopleOutline, documentTextOutline, 
      addOutline, checkmarkOutline, closeOutline, sparklesOutline,
      personOutline, locationOutline, cubeOutline, readerOutline,
      copyOutline, logoGoogle, globeOutline
    });
    
    this.initializePresetPrompts();
    this.initializeHeaderActions();
  }

  ngOnInit() {
    const storyId = this.route.snapshot.paramMap.get('storyId');
    const chapterId = this.route.snapshot.paramMap.get('chapterId');
    const sceneId = this.route.snapshot.paramMap.get('sceneId');

    if (storyId && chapterId && sceneId) {
      this.loadStory(storyId, chapterId, sceneId).catch(error => {
        console.error('Error loading story:', error);
        this.goBack();
      });
    }
    
    // Load available models
    this.loadAvailableModels();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  private async loadStory(storyId: string, chapterId: string, sceneId: string) {
    this.story = await this.storyService.getStory(storyId);
    if (this.story) {
      this.activeChapterId = chapterId;
      this.activeSceneId = sceneId;
      
      // Load current scene as default context
      const chapter = this.story.chapters.find(c => c.id === chapterId);
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
      
      // Add initial system message
      this.messages.push({
        role: 'assistant',
        content: 'Hello! I am your AI assistant for this scene. I work exclusively with the context of selected scenes. You can ask me questions to extract characters, analyze details, or develop ideas.',
        timestamp: new Date()
      });
    }
  }

  goBack() {
    this.router.navigate(['/stories/editor', this.story?.id], {
      queryParams: { chapterId: this.activeChapterId, sceneId: this.activeSceneId }
    });
  }

  async sendMessage(extractionType?: 'characters' | 'locations' | 'objects') {
    if (!this.currentMessage.trim() || this.isGenerating) return;

    const userMessage = this.currentMessage;
    this.currentMessage = '';
    
    // Add user message
    this.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      isPresetPrompt: !!extractionType,
      extractionType
    });

    this.isGenerating = true;
    this.scrollToBottom();

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

      // const settings = this.settingsService.getSettings(); // Unused variable
      // Generate a unique beat ID for this chat message
      const beatId = 'chat-' + Date.now();
      
      let prompt = '';
      
      // Always use direct AI calls without system prompt or codex
      let contextText = '';
      if (storyOutline) {
        contextText += `Story Overview:\n${storyOutline}\n\n`;
      }
      if (sceneContext) {
        contextText += `Scene Text:\n${sceneContext}\n\n`;
      }
      
      // Add chat history context (exclude initial system message and preset prompts)
      const chatHistory = this.buildChatHistory();
      if (chatHistory) {
        contextText += `Previous chat history:\n${chatHistory}\n\n`;
      }
      
      // Build prompt based on type
      if (extractionType) {
        // Use the extraction prompt directly
        prompt = `${contextText}${userMessage}`;
      } else {
        // For normal chat, just add the user's question
        prompt = `${contextText}User Question: ${userMessage}\n\nPlease answer helpfully and creatively based on the given context and previous conversation.`;
      }
      
      // Call AI directly without the beat generation template
      let accumulatedResponse = '';
      const subscription = this.callAIDirectly(
        prompt,
        beatId,
        { wordCount: 400 }
      ).subscribe({
        next: (chunk) => {
          accumulatedResponse = chunk;
        },
        complete: () => {
          this.messages.push({
            role: 'assistant',
            content: accumulatedResponse,
            timestamp: new Date(),
            extractionType
          });
          this.isGenerating = false;
          this.scrollToBottom();
        },
        error: (error) => {
          console.error('Error generating response:', error);
          this.messages.push({
            role: 'assistant',
            content: 'Sorry, an error occurred. Please try again.',
            timestamp: new Date()
          });
          this.isGenerating = false;
          this.scrollToBottom();
        }
      });
      
      this.subscriptions.add(subscription);

    } catch (error) {
      console.error('Error generating response:', error);
      this.messages.push({
        role: 'assistant',
        content: 'Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuche es erneut.',
        timestamp: new Date()
      });
      this.isGenerating = false;
      this.scrollToBottom();
    }
  }

  onEnterKey(event: KeyboardEvent) {
    if (!event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatMessage(content: string): string {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

  toggleSceneSelection(chapterId: string, sceneId: string) {
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

  removeSceneContext(scene: SceneContext) {
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

  onInputFocus() {
    this.keyboardVisible = true;
    setTimeout(() => {
      this.scrollToBottom();
    }, 300);
  }

  onInputBlur() {
    this.keyboardVisible = false;
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

  private initializePresetPrompts() {
    this.presetPrompts = [
      {
        id: 'extract-characters',
        title: 'Extract Characters',
        description: 'Extract all characters from selected scenes',
        extractionType: 'characters',
        icon: 'person-outline',
        prompt: `Please analyze the following scenes and extract all characters. For each character provide the following information:

**Name:** [Character name]
**Role:** [Main character/Supporting character/Background character]
**Description:** [Physical description, personality, important traits]
**Relationships:** [Relationships to other characters]
**Motivation:** [What drives the character]

Structure the answer clearly separated by characters.`
      },
      {
        id: 'extract-locations',
        title: 'Extract Locations',
        description: 'Extract all locations and places from scenes',
        extractionType: 'locations',
        icon: 'location-outline',
        prompt: `Please analyze the following scenes and extract all places and locations. For each location provide the following information:

**Name:** [Location name]
**Type:** [City, Building, Room, Landscape, etc.]
**Description:** [Physical description, atmosphere, important details]
**Significance:** [Why is this location important for the story]
**Mood:** [What mood/atmosphere prevails here]

Strukturiere die Antwort klar nach Orten getrennt.`
      },
      {
        id: 'extract-objects',
        title: 'Extract Objects',
        description: 'Extract important objects and items',
        extractionType: 'objects',
        icon: 'cube-outline',
        prompt: `Please analyze the following scenes and extract all important items and objects. For each object provide the following information:

**Name:** [Object name]
**Type:** [Weapon, Tool, Jewelry, Document, etc.]
**Description:** [Physical description, material, appearance]
**Significance:** [Why is this object important]
**Owner:** [Who owns the object]
**Properties:** [Special abilities or characteristics]

Strukturiere die Antwort klar nach Gegenständen getrennt.`
      }
    ];
  }

  usePresetPrompt(preset: PresetPrompt) {
    this.showPresetPrompts = false;
    this.currentMessage = preset.prompt;
    
    // Send the preset prompt immediately
    setTimeout(() => {
      this.sendMessage(preset.extractionType);
    }, 100);
  }

  getPresetColor(extractionType: 'characters' | 'locations' | 'objects'): string {
    switch (extractionType) {
      case 'characters': return 'primary';
      case 'locations': return 'secondary';
      case 'objects': return 'tertiary';
      default: return 'medium';
    }
  }

  async addToCodex(message: ChatMessage) {
    if (!message.extractionType || !this.story) return;

    try {
      // Get or create codex
      const codex = await this.codexService.getOrCreateCodex(this.story.id);
      
      // Find the appropriate category
      const categoryName = this.getCategoryName(message.extractionType);
      const category = codex.categories.find(c => c.title === categoryName);
      
      if (!category) {
        console.error(`Category ${categoryName} not found`);
        return;
      }

      // Parse the AI response to extract entries
      const entries = this.parseExtractionResponse(message.content, message.extractionType);
      
      // Add each entry to the codex
      for (const entry of entries) {
        await this.codexService.addEntry(this.story.id, category.id, {
          title: entry.name,
          content: entry.description,
          tags: entry.tags || [],
          storyRole: message.extractionType === 'characters' ? (entry.role as StoryRole) : undefined
        });
      }

      // Show success message
      this.messages.push({
        role: 'assistant',
        content: `✅ ${entries.length} ${this.getExtractionTypeLabel(message.extractionType)} successfully added to Codex!`,
        timestamp: new Date()
      });
      
      this.scrollToBottom();
    } catch (error) {
      console.error('Error adding to codex:', error);
      this.messages.push({
        role: 'assistant',
        content: '❌ Error adding to codex. Please try again.',
        timestamp: new Date()
      });
      this.scrollToBottom();
    }
  }

  private getExtractionTypeLabel(type: 'characters' | 'locations' | 'objects'): string {
    switch (type) {
      case 'characters': return 'Characters';
      case 'locations': return 'Locations';
      case 'objects': return 'Objects';
      default: return 'Entries';
    }
  }

  private getCategoryName(extractionType: 'characters' | 'locations' | 'objects'): string {
    switch (extractionType) {
      case 'characters': return 'Characters';
      case 'locations': return 'Locations';
      case 'objects': return 'Objects';
      default: return 'Notes';
    }
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

  private callAIDirectly(prompt: string, beatId: string, options: { wordCount: number }): Observable<string> {
    const settings = this.settingsService.getSettings();
    
    // Use selected model if available, otherwise fall back to global
    const modelToUse = this.selectedModel || settings.selectedModel;
    
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
    // We'll use the beat AI service's internal methods by creating a minimal wrapper
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
        source: 'scene-chat',
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
        source: 'scene-chat',
        temperature: 0.7
      }
    });
  }

  private parseExtractionResponse(content: string, type: 'characters' | 'locations' | 'objects'): {name: string; description?: string; role?: string; tags?: string[]}[] {
    const entries: {name: string; description?: string; role?: string; tags?: string[]}[] = [];
    
    // Simple parsing - look for **Name:** patterns
    const nameRegex = /\*\*Name:\*\*\s*([^\n]+)/g;
    let match;
    
    while ((match = nameRegex.exec(content)) !== null) {
      const name = match[1].trim();
      if (name) {
        // Extract description (text between this name and next name or end)
        const startIndex = match.index + match[0].length;
        const nextNameIndex = content.indexOf('**Name:**', startIndex);
        const endIndex = nextNameIndex !== -1 ? nextNameIndex : content.length;
        const description = content.substring(startIndex, endIndex).trim();
        
        // Basic role extraction for characters
        let role = '';
        if (type === 'characters') {
          if (description.toLowerCase().includes('hauptcharakter') || description.toLowerCase().includes('protagonist')) {
            role = 'Protagonist';
          } else if (description.toLowerCase().includes('nebencharakter')) {
            role = 'Nebencharakter';
          } else if (description.toLowerCase().includes('hintergrundcharakter')) {
            role = 'Hintergrundcharakter';
          }
        }
        
        entries.push({
          name,
          description,
          role,
          tags: []
        });
      }
    }
    
    return entries;
  }

  async copyToClipboard(text: string, event: Event): Promise<void> {
    // Prevent event bubbling
    event.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(text);
      
      // Show temporary success feedback
      const button = event.target as HTMLElement;
      const icon = button.querySelector('ion-icon') || button;
      const originalName = icon.getAttribute('name');
      
      // Change icon to checkmark temporarily
      icon.setAttribute('name', 'checkmark-outline');
      icon.setAttribute('style', 'color: var(--ion-color-success)');
      
      // Reset icon after 1.5 seconds
      setTimeout(() => {
        icon.setAttribute('name', originalName || 'copy-outline');
        icon.removeAttribute('style');
      }, 1500);
      
    } catch (err) {
      console.error('Failed to copy text to clipboard:', err);
      
      // Fallback for older browsers or when clipboard API fails
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        // Show success feedback for fallback method too
        const button = event.target as HTMLElement;
        const icon = button.querySelector('ion-icon') || button;
        const originalName = icon.getAttribute('name');
        
        icon.setAttribute('name', 'checkmark-outline');
        icon.setAttribute('style', 'color: var(--ion-color-success)');
        
        setTimeout(() => {
          icon.setAttribute('name', originalName || 'copy-outline');
          icon.removeAttribute('style');
        }, 1500);
      } catch (fallbackErr) {
        console.error('Fallback copy method also failed:', fallbackErr);
      }
    }
  }
  
  private loadAvailableModels(): void {
    this.subscriptions.add(
      this.settingsService.settings$.subscribe(() => {
        this.reloadModels();
      })
    );
    this.reloadModels();
  }

  private reloadModels(): void {
    this.subscriptions.add(
      this.modelService.getCombinedModels().subscribe(models => {
        this.availableModels = models;
        if (models.length > 0 && !this.selectedModel) {
          this.setDefaultModel();
        }
      })
    );
  }

  private setDefaultModel(): void {
    const settings = this.settingsService.getSettings();
    if (settings.selectedModel) {
      this.selectedModel = settings.selectedModel;
    } else if (this.availableModels.length > 0) {
      this.selectedModel = this.availableModels[0].id;
    }
  }
  
  getProviderIcon(provider: string): string {
    return provider === 'gemini' ? 'logo-google' : 'globe-outline';
  }
  
  private buildChatHistory(): string {
    // Filter out system messages, preset prompts, and the current message being processed
    const relevantMessages = this.messages.filter(message => {
      // Skip initial system message
      if (message.content.includes('Hello! I am your AI assistant')) {
        return false;
      }
      // Skip preset prompt messages (they have extractionType but we want to keep extraction results)
      if (message.isPresetPrompt) {
        return false;
      }
      return true;
    });
    
    // If no relevant messages, return empty string
    if (relevantMessages.length === 0) {
      return '';
    }
    
    // Format messages for AI context
    const formattedMessages = relevantMessages.map(message => {
      const role = message.role === 'user' ? 'Nutzer' : 'Assistent';
      // Clean up any HTML formatting for AI context
      const content = message.content
        .replace(/<br>/g, '\n')
        .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
        .replace(/<em>(.*?)<\/em>/g, '*$1*')
        .replace(/<[^>]*>/g, ''); // Remove any other HTML tags
      
      return `${role}: ${content}`;
    });
    
    return formattedMessages.join('\n\n');
  }

  private initializeHeaderActions(): void {
    this.headerActions = [
      {
        icon: 'sparkles-outline',
        action: () => this.showPresetPrompts = true,
        showOnMobile: true,
        showOnDesktop: true
      },
      {
        icon: 'reader-outline',
        action: () => this.includeStoryOutline = !this.includeStoryOutline,
        color: this.includeStoryOutline ? 'primary' : 'medium',
        showOnMobile: true,
        showOnDesktop: true
      },
      {
        icon: 'add-outline',
        action: () => this.showSceneSelector = true,
        showOnMobile: true,
        showOnDesktop: true
      }
    ];
  }
}