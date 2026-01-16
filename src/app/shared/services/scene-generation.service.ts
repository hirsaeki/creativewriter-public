import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { SettingsService } from '../../core/services/settings.service';
import { PromptManagerService } from './prompt-manager.service';
import { StoryService } from '../../stories/services/story.service';
import { CodexService } from '../../stories/services/codex.service';
import { OpenRouterApiService, OpenRouterResponse } from '../../core/services/openrouter-api.service';
import { GoogleGeminiApiService, GoogleGeminiResponse } from '../../core/services/google-gemini-api.service';
import { OllamaApiService, OllamaResponse, OllamaChatResponse } from '../../core/services/ollama-api.service';
import { ClaudeApiService, ClaudeResponse } from '../../core/services/claude-api.service';
import { OpenAICompatibleApiService, OpenAICompatibleResponse } from '../../core/services/openai-compatible-api.service';
import { AIProviderValidationService } from '../../core/services/ai-provider-validation.service';
import { Story, DEFAULT_STORY_SETTINGS, StorySettings, DEFAULT_SCENE_FROM_OUTLINE_TEMPLATE_SECTIONS } from '../../stories/models/story.interface';
import { sceneFromOutlineSectionsToTemplate, mergeSceneFromOutlineSections } from '../utils/template-migration';

export interface SceneFromOutlineOptions {
  storyId: string;
  chapterId: string;
  sceneId: string;
  outline: string;
  model: string; // provider-prefixed id e.g. 'gemini:gemini-1.5-pro'
  wordCount?: number;
  includeStoryOutline?: boolean;
  useFullStoryContext?: boolean; // if false and includeStoryOutline, use summaries
  includeCodex?: boolean;
  temperature?: number;
  language?: 'en' | 'de' | 'fr' | 'es' | 'custom';
}

export interface SceneGenerationProgress {
  isGenerating: boolean;
  sceneId?: string;
  storyId?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class SceneGenerationService {
  private settingsService = inject(SettingsService);
  private promptManager = inject(PromptManagerService);
  private storyService = inject(StoryService);
  private codexService = inject(CodexService);
  private openRouter = inject(OpenRouterApiService);
  private gemini = inject(GoogleGeminiApiService);
  private ollama = inject(OllamaApiService);
  private claude = inject(ClaudeApiService);
  private openAICompatible = inject(OpenAICompatibleApiService);
  private aiProviderValidation = inject(AIProviderValidationService);

  // Progress tracking for background generation
  private progressSubject = new BehaviorSubject<SceneGenerationProgress>({ isGenerating: false });
  public progress$ = this.progressSubject.asObservable();

  /**
   * Generate a scene from an outline using a single API call.
   * Maximum word count is 5000 words.
   */
  async generateFromOutline(
    options: SceneFromOutlineOptions,
    control?: {
      cancel$?: Observable<void>;
      onProgress?: (p: { words: number; segments: number }) => void;
    }
  ): Promise<{ content: string; title?: string; canceled?: boolean }> {
    // Update progress
    this.progressSubject.next({
      isGenerating: true,
      sceneId: options.sceneId,
      storyId: options.storyId
    });

    try {
      // Ensure prompt manager watches current story
      await this.promptManager.setCurrentStory(options.storyId);
      const story = await this.storyService.getStory(options.storyId);
      if (!story) throw new Error('Story not found');

      // Build prompt messages using the story's Beat Generation template
      const { systemMessage, messages } = await this.buildInitialBeatMessages(story, options);
      const { provider, modelId } = this.splitProvider(options.model);
      const temperature = options.temperature ?? this.getDefaultTemperature(provider);

      // Validate that the provider is configured and available
      const settings = this.settingsService.getSettings();
      if (!this.aiProviderValidation.isProviderAvailable(provider, settings)) {
        throw new Error(`AI provider '${provider}' is not configured or not available. Please configure it in settings.`);
      }

      // Cap at 5000 words for single-shot generation
      const targetWords = Math.max(200, Math.min(5000, options.wordCount || 600));

      let wasCanceled = false;
      const cancelSub = control?.cancel$?.subscribe(() => { wasCanceled = true; });

      try {
        // Single API call
        const content = await this.callProvider(
          provider,
          modelId,
          systemMessage,
          messages,
          targetWords,
          temperature,
          control?.cancel$
        );

        if (wasCanceled) {
          this.progressSubject.next({ isGenerating: false });
          return { content: this.plainTextToHtml(content), canceled: true };
        }

        const wordCount = this.countWords(content);
        control?.onProgress?.({ words: wordCount, segments: 1 });

        const html = this.plainTextToHtml(content);

        // Save content to scene
        await this.storyService.updateScene(
          options.storyId,
          options.chapterId,
          options.sceneId,
          { content: html }
        );

        this.progressSubject.next({ isGenerating: false });
        return { content: html, canceled: false };
      } finally {
        cancelSub?.unsubscribe();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      this.progressSubject.next({ isGenerating: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Call the AI provider with the given messages and return the generated text.
   */
  private async callProvider(
    provider: string,
    modelId: string,
    systemMessage: string,
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    wordGoal: number,
    temperature: number,
    cancel$?: Observable<void>
  ): Promise<string> {
    const calculatedTokens = Math.ceil(wordGoal * 1.5) + 2000;
    const maxTokens = Math.max(3000, Math.min(calculatedTokens, 100000));
    const promptForLogging = this.messagesToPrompt(systemMessage, messages.filter(m => m.role !== 'system'));

    const requestId = this.generateRequestId();
    let cancelSub: Subscription | undefined;

    try {
      return await new Promise<string>((resolve, reject) => {
        let resolved = false;
        const finalize = (value: string, isError = false) => {
          if (!resolved) {
            resolved = true;
            cancelSub?.unsubscribe();
            if (isError) { reject(new Error(value || 'Generation failed')); } else { resolve(value); }
          }
        };

        const obs = provider === 'gemini'
          ? this.gemini.generateText(promptForLogging, {
              model: modelId,
              maxTokens,
              temperature,
              messages: [{ role: 'system', content: systemMessage }, ...messages],
              requestId
            })
          : provider === 'openrouter'
          ? this.openRouter.generateText(promptForLogging, {
              model: modelId,
              maxTokens,
              temperature,
              messages: [{ role: 'system', content: systemMessage }, ...messages],
              requestId
            })
          : provider === 'ollama'
          ? this.ollama.generateText(promptForLogging, {
              model: modelId,
              maxTokens,
              temperature,
              messages: [{ role: 'system', content: systemMessage }, ...messages],
              requestId
            })
          : provider === 'openaiCompatible'
          ? this.openAICompatible.generateText(promptForLogging, {
              model: modelId,
              maxTokens,
              temperature,
              messages: [{ role: 'system', content: systemMessage }, ...messages],
              requestId
            })
          : this.claude.generateText(promptForLogging, {
              model: modelId,
              maxTokens,
              temperature,
              messages: [{ role: 'system', content: systemMessage }, ...messages],
              requestId
            });

        const sub = (obs as unknown as Observable<unknown>).subscribe({
          next: (response: unknown) => {
            if (provider === 'gemini') {
              const r = response as GoogleGeminiResponse;
              finalize(r.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '');
            } else if (provider === 'openrouter') {
              const r = response as OpenRouterResponse;
              finalize(r.choices?.[0]?.message?.content?.trim() || '');
            } else if (provider === 'ollama') {
              const r = response as OllamaResponse | OllamaChatResponse;
              if ((r as OllamaResponse).response !== undefined) {
                finalize((r as OllamaResponse).response?.trim() || '');
              } else {
                finalize((r as OllamaChatResponse).message?.content?.trim() || '');
              }
            } else if (provider === 'openaiCompatible') {
              const r = response as OpenAICompatibleResponse;
              finalize(r.choices?.[0]?.message?.content?.trim() || '');
            } else {
              const r = response as ClaudeResponse;
              finalize(r.content?.[0]?.text?.trim() || '');
            }
            sub.unsubscribe();
          },
          error: (err) => {
            finalize(err?.message || 'Generation failed', true);
            sub.unsubscribe();
          }
        });

        if (cancel$) {
          cancelSub = cancel$.subscribe(() => {
            try {
              if (provider === 'gemini') this.gemini.abortRequest(requestId);
              else if (provider === 'openrouter') this.openRouter.abortRequest(requestId);
              else if (provider === 'claude') this.claude.abortRequest(requestId);
              else if (provider === 'openaiCompatible') this.openAICompatible.cancelRequest(requestId);
              else this.ollama.abortRequest(requestId);
            } catch {/* noop */}
          });
        }
      });
    } finally {
      cancelSub?.unsubscribe();
    }
  }

  private splitProvider(model: string): { provider: string; modelId: string } {
    const [provider, ...parts] = model.split(':');
    return { provider, modelId: parts.join(':') };
  }

  private getDefaultTemperature(provider: string): number {
    const s = this.settingsService.getSettings();
    if (provider === 'gemini') return s.googleGemini?.temperature ?? 0.7;
    if (provider === 'openrouter') return s.openRouter?.temperature ?? 0.7;
    if (provider === 'ollama') return s.ollama?.temperature ?? 0.7;
    if (provider === 'claude') return s.claude?.temperature ?? 0.7;
    if (provider === 'openaiCompatible') return s.openAICompatible?.temperature ?? 0.7;
    return 0.7;
  }

  private async buildInitialBeatMessages(story: Story, options: SceneFromOutlineOptions): Promise<{ systemMessage: string; messages: { role: 'user' | 'assistant' | 'system'; content: string }[] }> {
    const systemMessage = story.settings?.systemMessage || DEFAULT_STORY_SETTINGS.systemMessage;
    const wordCount = Math.max(200, Math.min(5000, options.wordCount || 600));

    // Get story context based on options
    const storySoFar = options.includeStoryOutline
      ? (options.useFullStoryContext
        ? await this.promptManager.getStoryXmlFormat(options.sceneId)
        : await this.promptManager.getStoryXmlFormatWithoutSummaries(options.sceneId))
      : '';

    // Get codex text if enabled
    const codexText = options.includeCodex
      ? await this.buildSimpleCodexText(options.storyId)
      : '';

    // Get scene-from-outline template sections (per-story or default)
    const sections = mergeSceneFromOutlineSections(
      DEFAULT_SCENE_FROM_OUTLINE_TEMPLATE_SECTIONS,
      story.settings?.sceneFromOutlineTemplateSections
    );

    // Build template from sections
    const template = sceneFromOutlineSectionsToTemplate(sections, systemMessage);

    // Build placeholders for the scene-from-outline template
    const placeholders: Record<string, string> = {
      systemMessage,
      codexEntries: codexText,
      storySoFar,
      storyTitle: story.title || 'Story',
      wordCount: String(wordCount),
      sceneOutline: options.outline,
      pointOfView: this.buildPointOfViewString(story.settings),
      tense: this.buildTenseString(story.settings),
      languageInstruction: this.buildLanguageInstruction(story.settings?.language),
      customInstruction: this.buildCustomInstruction()
    };

    const processed = this.applyTemplatePlaceholders(template, placeholders);
    const messages = this.parseStructuredPrompt(processed);
    // Ensure system message is present as proper system role for providers that support it
    if (!messages.some(m => m.role === 'system')) {
      messages.unshift({ role: 'system', content: systemMessage });
    }
    return { systemMessage, messages };
  }

  private buildPointOfViewString(settings?: StorySettings): string {
    const perspective = settings?.narrativePerspective || 'third-person-limited';
    const povMap: Record<string, string> = {
      'first-person': 'First Person',
      'third-person-limited': 'Third Person Limited',
      'third-person-omniscient': 'Third Person Omniscient',
      'second-person': 'Second Person'
    };
    return `<point_of_view>${povMap[perspective] || 'Third Person Limited'} perspective</point_of_view>`;
  }

  private buildTenseString(settings?: StorySettings): string {
    const tense = settings?.tense || 'past';
    return `<tense>Write in ${tense} tense</tense>`;
  }

  private buildLanguageInstruction(language?: string): string {
    const langMap: Record<string, string> = {
      'de': 'Write the scene in German (Deutsch).',
      'fr': 'Write the scene in French (Français).',
      'es': 'Write the scene in Spanish (Español).',
      'en': 'Write the scene in English.',
      'custom': 'Write the scene in the same language as the story context.'
    };
    const instruction = langMap[language || ''];
    return instruction ? `<language_requirement>${instruction}</language_requirement>` : '';
  }

  private buildCustomInstruction(): string {
    const settings = this.settingsService.getSettings();
    const instruction = settings.sceneGenerationFromOutline?.customInstruction || '';
    return instruction ? `<additional_instructions>${instruction}</additional_instructions>` : '';
  }

  private async buildSimpleCodexText(storyId: string): Promise<string> {
    try {
      const codex = await this.codexService.getOrCreateCodex(storyId);
      const lines: string[] = [];
      for (const cat of codex.categories) {
        const entries = cat.entries.slice(0, 10);
        if (entries.length) {
          lines.push(`[${cat.title}]`);
          for (const e of entries) {
            const title = e.title || 'Untitled';
            const desc = (e.content || '').replace(/\s+/g, ' ').trim();
            lines.push(`- ${title}${desc ? ': ' + desc : ''}`);
          }
        }
      }
      return lines.join('\n');
    } catch {
      return '';
    }
  }

  /**
   * Apply template placeholders with validation and error reporting.
   * Detects unreplaced placeholders and logs warnings for debugging.
   *
   * @param template The template string with {placeholder} syntax
   * @param placeholders Key-value pairs for replacement
   * @returns Processed template with placeholders replaced
   */
  private applyTemplatePlaceholders(template: string, placeholders: Record<string, string>): string {
    if (!template) return '';

    // Extract all placeholders from template for validation
    const placeholderPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    const templatePlaceholders = new Set<string>();
    let match;
    while ((match = placeholderPattern.exec(template)) !== null) {
      templatePlaceholders.add(match[1]);
    }

    // Track which placeholders were replaced
    const replacedPlaceholders = new Set<string>();
    let out = template;

    // Replace each provided placeholder
    Object.entries(placeholders).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      // Escape special regex characters in the placeholder name for safe matching
      const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedPlaceholder, 'g');

      // Track if this placeholder was actually in the template
      if (templatePlaceholders.has(key)) {
        replacedPlaceholders.add(key);
      }

      // Replace with empty string if value is undefined/null
      out = out.replace(regex, value ?? '');
    });

    // Detect unreplaced placeholders (in template but not provided)
    const unreplacedPlaceholders = Array.from(templatePlaceholders).filter(
      key => !replacedPlaceholders.has(key)
    );

    // Detect unused placeholders (provided but not in template)
    const unusedPlaceholders = Object.keys(placeholders).filter(
      key => !templatePlaceholders.has(key)
    );

    // Log warnings for debugging (helps developers identify template issues)
    if (unreplacedPlaceholders.length > 0) {
      console.warn(
        `[SceneGeneration] Template has unreplaced placeholders: ${unreplacedPlaceholders.join(', ')}`
      );
    }

    if (unusedPlaceholders.length > 0) {
      console.debug(
        `[SceneGeneration] Unused placeholder values provided: ${unusedPlaceholders.join(', ')}`
      );
    }

    return out;
  }

  /**
   * Parse structured prompt with message role tags.
   * Supports XML-style <message role="...">content</message> syntax.
   * Falls back to treating entire prompt as user message if no tags found.
   *
   * @param prompt The prompt string, potentially with message tags
   * @returns Array of messages with roles and content
   */
  private parseStructuredPrompt(prompt: string): { role: 'system' | 'user' | 'assistant'; content: string }[] {
    if (!prompt) {
      console.warn('[SceneGeneration] Empty prompt provided to parseStructuredPrompt');
      return [{ role: 'user', content: '' }];
    }

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
    const validRoles = ['system', 'user', 'assistant'];

    // Try new delimiter format first: ---SYSTEM---, ---USER---, ---ASSISTANT---
    const delimiterPattern = /---\s*(SYSTEM|USER|ASSISTANT)\s*---/gi;
    const parts = prompt.split(delimiterPattern);

    if (parts.length > 1) {
      // New delimiter format detected
      let i = 1; // Skip any content before first delimiter
      while (i < parts.length - 1) {
        const roleStr = parts[i].toLowerCase().trim();
        const content = parts[i + 1]?.trim() || '';
        if (!validRoles.includes(roleStr)) {
          console.warn(`[SceneGeneration] Invalid role in template: ${roleStr}`);
          i += 2;
          continue;
        }
        if (content) {
          messages.push({ role: roleStr as 'system' | 'user' | 'assistant', content });
        } else {
          console.warn(`[SceneGeneration] Empty content for ${roleStr} message in template`);
        }
        i += 2;
      }
    }

    // Fallback to legacy XML format if no delimiter messages found
    if (messages.length === 0) {
      const messagePattern = /<message role="(system|user|assistant)">([\s\S]*?)<\/message>/gi;
      let match: RegExpExecArray | null;

      // Detect potential malformed message tags
      const openTagPattern = /<message[^>]*>/gi;
      const closeTagPattern = /<\/message>/gi;
      const openTags = (prompt.match(openTagPattern) || []).length;
      const closeTags = (prompt.match(closeTagPattern) || []).length;

      if (openTags !== closeTags) {
        console.warn(
          `[SceneGeneration] Mismatched message tags in template: ${openTags} opening tags, ${closeTags} closing tags`
        );
      }

      // Detect message tags with invalid roles
      const invalidRolePattern = /<message role="(?!system|user|assistant)[^"]*">/gi;
      const invalidRoles = prompt.match(invalidRolePattern);
      if (invalidRoles && invalidRoles.length > 0) {
        console.warn(
          `[SceneGeneration] Invalid message roles found in template: ${invalidRoles.join(', ')}`
        );
      }

      // Extract valid messages
      while ((match = messagePattern.exec(prompt)) !== null) {
        const role = match[1] as 'system' | 'user' | 'assistant';
        const content = match[2].trim();

        if (!content) {
          console.warn(`[SceneGeneration] Empty content for ${role} message in template`);
        }

        messages.push({ role, content });
      }
    }

    // Final fallback: if no structured messages found, treat entire prompt as user message
    if (messages.length === 0) {
      console.debug('[SceneGeneration] No structured messages found, using prompt as single user message');
      messages.push({ role: 'user', content: prompt });
    }

    return messages;
  }

  private plainTextToHtml(text: string): string {
    if (!text) return '';
    // Normalize line breaks
    const normalized = text.replace(/\r\n?/g, '\n').trim();
    const parts = normalized.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return '';
    return parts.map(p => `<p>${this.escapeHtml(p)}</p>`).join('\n');
  }

  private countWords(content: string): number {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private messagesToPrompt(system: string, messages: { role: 'user' | 'assistant' | 'system'; content: string }[]): string {
    // For logging/compat; real calls pass structured messages, but our providers also log the prompt string
    const msgs = [`[system]\n${system}`].concat(messages.map(m => `[${m.role}]\n${m.content}`));
    return msgs.join('\n\n');
  }

  private generateRequestId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}
