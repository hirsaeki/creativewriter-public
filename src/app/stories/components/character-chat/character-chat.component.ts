import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonFooter, IonTextarea, IonAvatar, IonChip, IonLabel, IonSpinner,
  IonModal, IonList, IonItem
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBack, send, personCircle, chatbubbles, copy, refresh,
  close, helpCircle, timeOutline
} from 'ionicons/icons';

import { StoryService } from '../../services/story.service';
import { CodexService } from '../../services/codex.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import {
  PremiumModuleService,
  CharacterInfo,
  KnowledgeCutoff,
  StoryContext,
  CharacterChatServiceInterface
} from '../../../core/services/premium-module.service';
import { ModelService } from '../../../core/services/model.service';
import { OpenRouterApiService } from '../../../core/services/openrouter-api.service';
import { GoogleGeminiApiService } from '../../../core/services/google-gemini-api.service';
import { SettingsService } from '../../../core/services/settings.service';
import { Story } from '../../models/story.interface';
import { CodexEntry, Codex } from '../../models/codex.interface';
import { ModelOption } from '../../../core/models/model.interface';
import { AppHeaderComponent, HeaderAction } from '../../../ui/components/app-header.component';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * AI Service Adapter - bridges the remote module with local AI services
 * This adapter wraps OpenRouter/Gemini services for use by the premium module
 */
interface AIServiceAdapter {
  generateChatResponse(
    messages: { role: string; content: string }[],
    modelId: string
  ): Promise<string>;
}

@Component({
  selector: 'app-character-chat',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonFooter, IonTextarea, IonAvatar, IonChip, IonLabel, IonSpinner,
    IonModal, IonList, IonItem,
    AppHeaderComponent
  ],
  templateUrl: './character-chat.component.html',
  styleUrls: ['./character-chat.component.scss']
})
export class CharacterChatComponent implements OnInit, OnDestroy {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private storyService = inject(StoryService);
  private codexService = inject(CodexService);
  private subscriptionService = inject(SubscriptionService);
  private premiumModuleService = inject(PremiumModuleService);
  private modelService = inject(ModelService);
  private openRouterService = inject(OpenRouterApiService);
  private geminiService = inject(GoogleGeminiApiService);
  private settingsService = inject(SettingsService);

  // State
  story: Story | null = null;
  codex: Codex | null = null;
  characters: CodexEntry[] = [];
  selectedCharacter: CodexEntry | null = null;
  messages: ConversationMessage[] = [];
  currentMessage = '';
  isGenerating = false;
  isPremium = false;
  isModuleLoading = false;
  moduleError: string | null = null;

  // Premium module service instance
  private chatService: CharacterChatServiceInterface | null = null;

  // Knowledge cutoff
  knowledgeCutoff: KnowledgeCutoff | null = null;
  showKnowledgeModal = false;

  // Model selection
  availableModels: ModelOption[] = [];
  selectedModel = '';

  // Suggested starters
  suggestedStarters: string[] = [];

  // Header actions
  headerActions: HeaderAction[] = [
    { icon: 'time-outline', action: () => this.openKnowledgeSettings(), tooltip: 'Knowledge Cutoff' },
    { icon: 'help-circle', action: () => this.showHelp(), tooltip: 'Help' }
  ];

  private subscriptions = new Subscription();

  constructor() {
    addIcons({
      arrowBack, send, personCircle, chatbubbles, copy, refresh,
      close, helpCircle, timeOutline
    });
  }

  ngOnInit(): void {
    // Check premium status
    this.subscriptions.add(
      this.subscriptionService.isPremiumObservable.subscribe(isPremium => {
        this.isPremium = isPremium;
        if (isPremium) {
          this.loadPremiumModule();
        }
      })
    );

    // Load models
    this.subscriptions.add(
      this.modelService.getCombinedModels().subscribe(models => {
        this.availableModels = models;
        if (models.length > 0 && !this.selectedModel) {
          this.selectedModel = models[0].id;
        }
      })
    );

    // Load module status
    this.subscriptions.add(
      this.premiumModuleService.isLoading.subscribe(loading => {
        this.isModuleLoading = loading;
      })
    );

    this.subscriptions.add(
      this.premiumModuleService.loadError.subscribe(error => {
        this.moduleError = error;
      })
    );

    // Load story and codex
    this.loadStoryData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private async loadStoryData(): Promise<void> {
    const storyId = this.route.snapshot.paramMap.get('storyId');
    if (!storyId) {
      this.router.navigate(['/']);
      return;
    }

    try {
      this.story = await this.storyService.getStory(storyId);
      if (!this.story) {
        this.router.navigate(['/']);
        return;
      }

      // Load codex and extract characters
      this.codex = await this.codexService.getOrCreateCodex(storyId);
      if (this.codex) {
        const charactersCategory = this.codex.categories.find(
          c => c.title.toLowerCase() === 'characters'
        );
        if (charactersCategory) {
          this.characters = charactersCategory.entries;
        }
      }

      // Check for character ID in route
      const characterId = this.route.snapshot.paramMap.get('characterId');
      if (characterId) {
        this.selectedCharacter = this.characters.find(c => c.id === characterId) || null;
        if (this.selectedCharacter) {
          this.updateSuggestedStarters();
        }
      }
    } catch (error) {
      console.error('Failed to load story data:', error);
    }
  }

  async loadPremiumModule(): Promise<void> {
    if (!this.premiumModuleService.isCharacterChatLoaded) {
      const module = await this.premiumModuleService.loadCharacterChatModule();
      if (module) {
        // Create AI adapter that bridges to local AI services
        const aiAdapter = this.createAIAdapter();
        // Instantiate the CharacterChatService from the loaded module
        this.chatService = new module.CharacterChatService(aiAdapter);
      }
    }
  }

  /**
   * Creates an AI service adapter that bridges the remote module
   * to the local OpenRouter/Gemini services
   */
  private createAIAdapter(): AIServiceAdapter {
    return {
      generateChatResponse: async (
        messages: { role: string; content: string }[],
        modelId: string
      ): Promise<string> => {
        const settings = this.settingsService.getSettings();

        // Determine which AI service to use based on model ID
        const isGemini = modelId.startsWith('gemini:') || modelId.includes('gemini');

        // Convert messages to the format expected by the services
        const formattedMessages = messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content
        }));

        // Extract model name from ID (format: "provider:model")
        const modelName = modelId.includes(':') ? modelId.split(':')[1] : modelId;

        if (isGemini && settings.googleGemini?.enabled) {
          const response = await firstValueFrom(
            this.geminiService.generateText('', {
              model: modelName,
              messages: formattedMessages,
              maxTokens: 2000
            })
          );
          return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else if (settings.openRouter?.enabled) {
          const response = await firstValueFrom(
            this.openRouterService.generateText('', {
              model: modelName,
              messages: formattedMessages,
              maxTokens: 2000
            })
          );
          return response.choices?.[0]?.message?.content || '';
        } else {
          throw new Error('No AI service configured. Please enable OpenRouter or Gemini in settings.');
        }
      }
    };
  }

  selectCharacter(character: CodexEntry): void {
    this.selectedCharacter = character;
    this.messages = [];
    this.updateSuggestedStarters();
  }

  private updateSuggestedStarters(): void {
    if (!this.selectedCharacter) {
      this.suggestedStarters = [];
      return;
    }

    // Use the premium module for suggested starters if available
    if (this.chatService) {
      const characterInfo = this.buildCharacterInfo(this.selectedCharacter);
      this.suggestedStarters = this.chatService.getSuggestedStarters(characterInfo);
    } else {
      // Fallback: simple starters (no secret logic exposed)
      const name = this.selectedCharacter.title;
      this.suggestedStarters = [
        `Hello, ${name}.`,
        `What's on your mind?`
      ];
    }
  }

  useStarter(starter: string): void {
    this.currentMessage = starter;
    this.sendMessage();
  }

  async sendMessage(): Promise<void> {
    if (!this.currentMessage.trim() || !this.selectedCharacter || this.isGenerating) {
      return;
    }

    if (!this.isPremium) {
      this.moduleError = 'Premium subscription required for Character Chat';
      return;
    }

    if (!this.chatService) {
      this.moduleError = 'Premium module not loaded. Please try again.';
      return;
    }

    const userMessage = this.currentMessage.trim();
    this.currentMessage = '';

    // Add user message
    this.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    this.scrollToBottom();
    this.isGenerating = true;

    try {
      // Build inputs for the premium module
      const characterInfo = this.buildCharacterInfo(this.selectedCharacter);
      const storyContext = this.buildStoryContext();
      const conversationHistory = this.messages.slice(0, -1).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      // Use the premium module's chat method
      const response = await this.chatService.chat(
        characterInfo,
        userMessage,
        conversationHistory,
        storyContext,
        this.knowledgeCutoff || undefined,
        this.selectedModel
      );

      // Add assistant response
      this.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date()
      });

      this.scrollToBottom();

    } catch (error) {
      console.error('Chat error:', error);
      this.messages.push({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      });
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Build character info from codex entry
   * Note: This only extracts data - the actual prompt construction
   * happens in the premium module on the server
   */
  private buildCharacterInfo(entry: CodexEntry): CharacterInfo {
    return {
      name: entry.title,
      description: entry.content || undefined,
      notes: entry.tags?.join(', ')
    };
  }

  /**
   * Build story context from current story
   * Note: This only extracts data - the actual context processing
   * happens in the premium module on the server
   */
  private buildStoryContext(): StoryContext {
    if (!this.story) return {};

    const chapters = this.story.chapters?.map(ch => ({
      title: ch.title,
      summary: ch.scenes?.map(s => s.summary || s.title).join(' ') || '',
      order: ch.order,
      scenes: ch.scenes?.map(s => ({
        title: s.title,
        summary: s.summary,
        order: s.order
      }))
    }));

    return { chapters };
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop =
          this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  // Knowledge cutoff settings
  openKnowledgeSettings(): void {
    this.showKnowledgeModal = true;
  }

  setKnowledgeCutoff(chapterOrder: number, sceneOrder?: number): void {
    this.knowledgeCutoff = { chapterOrder, sceneOrder };
    this.showKnowledgeModal = false;
  }

  clearKnowledgeCutoff(): void {
    this.knowledgeCutoff = null;
    this.showKnowledgeModal = false;
  }

  // Utility methods
  goBack(): void {
    this.router.navigate(['/story', this.story?.id]);
  }

  showHelp(): void {
    alert('Character Chat lets you have conversations with characters from your story. Select a character to begin chatting. You can set a knowledge cutoff to limit what the character knows about the story.');
  }

  copyMessage(content: string): void {
    navigator.clipboard.writeText(content);
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getProviderIcon(provider: string): string {
    switch (provider) {
      case 'gemini': return 'logo-google';
      default: return 'cloud-outline';
    }
  }

  onEnterKey(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
