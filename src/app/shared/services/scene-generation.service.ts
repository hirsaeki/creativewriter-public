import { Injectable, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { SettingsService } from '../../core/services/settings.service';
import { PromptManagerService } from './prompt-manager.service';
import { StoryService } from '../../stories/services/story.service';
import { CodexService } from '../../stories/services/codex.service';
import { OpenRouterApiService, OpenRouterResponse } from '../../core/services/openrouter-api.service';
import { GoogleGeminiApiService, GoogleGeminiResponse } from '../../core/services/google-gemini-api.service';
import { OllamaApiService, OllamaResponse, OllamaChatResponse } from '../../core/services/ollama-api.service';
import { ClaudeApiService, ClaudeResponse } from '../../core/services/claude-api.service';
import { Story, DEFAULT_STORY_SETTINGS } from '../../stories/models/story.interface';

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

  async generateFromOutline(
    options: SceneFromOutlineOptions,
    control?: {
      cancel$?: Observable<void>;
      onProgress?: (p: { words: number; segments: number }) => void;
    }
  ): Promise<{ content: string; title?: string; canceled?: boolean }> {
    // Ensure prompt manager watches current story
    await this.promptManager.setCurrentStory(options.storyId);
    const story = await this.storyService.getStory(options.storyId);
    if (!story) throw new Error('Story not found');

    // Build initial prompt + messages using the story's Beat Generation template
    const { systemMessage, messages, languageInstruction } = await this.buildInitialBeatMessages(story, options);
    const { provider, modelId } = this.splitProvider(options.model);
    const temperature = options.temperature ?? this.getDefaultTemperature(provider);

    const targetWords = Math.max(200, Math.min(25000, options.wordCount || 600));
    const segmentMax = 3000; // conservative per-call word goal to stay within limits
    const maxSegments = 30;  // safety cap
    const minChunkWords = 180; // encourage reasonably sized chunks per iteration

    let combined = '';
    let currentWords = 0;
    let segments = 0;
    let wasCanceled = false;
    const rootCancelSub = control?.cancel$?.subscribe(() => { wasCanceled = true; });

    // Helper to call provider with messages and token budget derived from a word goal
    const callProvider = async (msgs: { role: 'system' | 'user' | 'assistant'; content: string }[], wordGoal: number): Promise<string> => {
      const calculatedTokens = Math.ceil(wordGoal * 3);
      const maxTokens = Math.max(3000, Math.min(calculatedTokens, 100000));
      const promptForLogging = this.messagesToPrompt(systemMessage, msgs.filter(m => m.role !== 'system'));

      const requestId = this.generateRequestId();
      let cancelSub: Subscription | undefined;
      try {
        return await new Promise<string>((resolve, reject) => {
          let resolved = false;
          const finalize = (value: string, isError = false) => {
            if (!resolved) {
              resolved = true;
              cancelSub?.unsubscribe();
              if (isError) { reject(value); } else { resolve(value); }
            }
          };

        const obs = provider === 'gemini'
          ? this.gemini.generateText(promptForLogging, {
              model: modelId,
              maxTokens,
              temperature,
              messages: [{ role: 'system', content: systemMessage }, ...msgs],
              requestId
            })
          : provider === 'openrouter'
          ? this.openRouter.generateText(promptForLogging, {
              model: modelId,
              maxTokens,
              temperature,
              messages: [{ role: 'system', content: systemMessage }, ...msgs],
              requestId
            })
          : provider === 'ollama'
          ? this.ollama.generateText(promptForLogging, {
              model: modelId,
              maxTokens,
              temperature,
              messages: [{ role: 'system', content: systemMessage }, ...msgs],
              requestId
            })
          : this.claude.generateText(promptForLogging, {
              model: modelId,
              maxTokens,
              temperature,
              messages: [{ role: 'system', content: systemMessage }, ...msgs],
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
              } else {
                const r = response as ClaudeResponse;
                finalize(r.content?.[0]?.text?.trim() || '');
              }
              sub.unsubscribe();
            },
            error: () => {
              finalize('', true);
              sub.unsubscribe();
            }
          });

          if (control?.cancel$) {
            cancelSub = control.cancel$.subscribe(() => {
              try {
                if (provider === 'gemini') this.gemini.abortRequest(requestId);
                else if (provider === 'openrouter') this.openRouter.abortRequest(requestId);
                else if (provider === 'claude') this.claude.abortRequest(requestId);
                else this.ollama.abortRequest(requestId);
              } catch {/* noop */}
            });
          }
        });
      } finally {
        cancelSub?.unsubscribe();
      }
    };

    // 1) Initial segment from outline using beat template (sceneFullText empty)
    {
      const initialGoal = Math.min(segmentMax, targetWords);
      const initialText = await callProvider(messages, initialGoal);
      combined = initialText;
      currentWords = this.countWords(initialText);
      segments++;
      control?.onProgress?.({ words: currentWords, segments });
    }

    // 2) Continue generation iteratively until target reached or safety cap
    while (currentWords < targetWords && segments < maxSegments) {
      const remaining = targetWords - currentWords;
      const goal = Math.min(segmentMax, remaining);

      // Use a modest tail of prior output for continuity (avoid bloating context)
      const tail = this.tailText(combined, 6000);

      //  Build continuation prompt via the beat template with sceneFullText as tail
      const continuationMessages = await this.buildContinuationBeatMessages(story, options, tail, goal, languageInstruction);

      if (wasCanceled) {
        break;
      }

      let next = '';
      try {
        next = await callProvider(continuationMessages, goal);
      } catch {
        // On provider error during continuation, stop iterating and return what we have
        break;
      }
      let cleaned = next.trim();

      // Break if model returns nothing meaningful to avoid loops
      if (!cleaned || cleaned.split(/\s+/).length < 30) {
        break;
      }

      // If the chunk is quite short, try up to 2 quick top-ups to reach a more useful size
      let chunkWords = this.countWords(cleaned);
      let retries = 0;
      while (!wasCanceled && chunkWords < minChunkWords && retries < 2) {
        const needed = Math.max(minChunkWords - chunkWords, Math.round(goal * 0.3));
        const topUpGoal = Math.min(segmentMax, Math.max(200, needed));

        const tail2 = this.tailText((cleaned.length > 100 ? cleaned : (combined + '\n\n' + cleaned)), 6000);
        const continuationMessages2 = await this.buildContinuationBeatMessages(story, options, tail2, topUpGoal, languageInstruction);

        let more = '';
        try {
          more = await callProvider(continuationMessages2, topUpGoal);
        } catch {
          break;
        }
        const cleanedMore = more.trim();
        const moreWords = this.countWords(cleanedMore);
        if (!cleanedMore || moreWords < 20) {
          break;
        }
        cleaned += (cleaned.endsWith('\n') ? '' : '\n\n') + cleanedMore;
        chunkWords += moreWords;
        retries++;
      }

      combined += (combined.endsWith('\n') ? '' : '\n\n') + cleaned;
      currentWords = this.countWords(combined);
      segments++;
      control?.onProgress?.({ words: currentWords, segments });
    }

    const normalized = this.plainTextToHtml(combined);
    rootCancelSub?.unsubscribe();
    return { content: normalized, canceled: wasCanceled };
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
    return 0.7;
  }

  private async buildInitialBeatMessages(story: Story, options: SceneFromOutlineOptions): Promise<{ systemMessage: string; messages: { role: 'user' | 'assistant' | 'system'; content: string }[]; languageInstruction: string }> {
    const systemMessage = story.settings?.systemMessage || DEFAULT_STORY_SETTINGS.systemMessage;
    const langPref = (options.language || story.settings?.language || 'en') as 'en' | 'de' | 'fr' | 'es' | 'custom';
    const languageInstruction = this.getLanguageInstruction(langPref);
    const wordCount = Math.max(200, Math.min(25000, options.wordCount || 600));

    const storySoFar = story.settings?.useFullStoryContext
      ? await this.promptManager.getStoryXmlFormat(options.sceneId)
      : await this.promptManager.getStoryXmlFormatWithoutSummaries(options.sceneId);

    const codexText = await this.buildSimpleCodexText(options.storyId);

    const writingStyle = story.settings?.beatInstruction === 'stay' ? 'Stay in the moment' : 'Continue the story';
    const pointOfView = '';

    const template = story.settings?.beatGenerationTemplate || DEFAULT_STORY_SETTINGS.beatGenerationTemplate;

    const placeholders: Record<string, string> = {
      systemMessage,
      codexEntries: codexText,
      storySoFar,
      storyTitle: story.title || 'Story',
      sceneFullText: '',
      wordCount: String(wordCount),
      prompt: options.outline,
      pointOfView,
      writingStyle
    };

    const processed = this.applyTemplatePlaceholders(template, placeholders);
    const messages = this.parseStructuredPrompt(processed);
    // Ensure system message is present as proper system role for providers that support it
    if (!messages.some(m => m.role === 'system')) {
      messages.unshift({ role: 'system', content: systemMessage });
    }
    return { systemMessage, messages, languageInstruction };
  }

  private async buildContinuationBeatMessages(
    story: Story,
    options: SceneFromOutlineOptions,
    sceneTail: string,
    goalWords: number,
    languageInstruction: string
  ): Promise<{ role: 'user' | 'assistant' | 'system'; content: string }[]> {
    const systemMessage = story.settings?.systemMessage || DEFAULT_STORY_SETTINGS.systemMessage;
    const storySoFar = story.settings?.useFullStoryContext
      ? await this.promptManager.getStoryXmlFormat(options.sceneId)
      : await this.promptManager.getStoryXmlFormatWithoutSummaries(options.sceneId);

    const codexText = await this.buildSimpleCodexText(options.storyId);
    const writingStyle = story.settings?.beatInstruction === 'stay' ? 'Stay in the moment' : 'Continue the story';
    const pointOfView = '';
    const template = story.settings?.beatGenerationTemplate || DEFAULT_STORY_SETTINGS.beatGenerationTemplate;

    const placeholders: Record<string, string> = {
      systemMessage,
      codexEntries: codexText,
      storySoFar,
      storyTitle: story.title || 'Story',
      sceneFullText: sceneTail,
      wordCount: String(goalWords),
      prompt: `Continue the same scene seamlessly without repeating sentences. Use the outline as guide. ${languageInstruction}\n\nOutline:\n${options.outline}`,
      pointOfView,
      writingStyle
    };

    const processed = this.applyTemplatePlaceholders(template, placeholders);
    const messages = this.parseStructuredPrompt(processed);
    if (!messages.some(m => m.role === 'system')) {
      messages.unshift({ role: 'system', content: systemMessage });
    }
    return messages;
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

  private applyTemplatePlaceholders(template: string, placeholders: Record<string, string>): string {
    let out = template;
    Object.entries(placeholders).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      out = out.replace(regex, value || '');
    });
    return out;
  }

  private parseStructuredPrompt(prompt: string): { role: 'system' | 'user' | 'assistant'; content: string }[] {
    const messagePattern = /<message role="(system|user|assistant)">([\s\S]*?)<\/message>/gi;
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = messagePattern.exec(prompt)) !== null) {
      const role = match[1] as 'system' | 'user' | 'assistant';
      const content = match[2].trim();
      messages.push({ role, content });
    }
    if (messages.length === 0) {
      messages.push({ role: 'user', content: prompt });
    }
    return messages;
  }

  private getLanguageInstruction(lang: SceneFromOutlineOptions['language']): string {
    switch (lang) {
      case 'de': return 'Schreibe auf Deutsch.';
      case 'fr': return 'Écris en français.';
      case 'es': return 'Escribe en español.';
      case 'en': return 'Write in English.';
      case 'custom':
      default: return 'Use the same language as the outline.';
    }
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

  private tailText(content: string, maxChars: number): string {
    if (!content) return '';
    const len = content.length;
    if (len <= maxChars) return content;
    return content.slice(len - maxChars);
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
