import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SettingsService } from '../../core/services/settings.service';
import { PromptManagerService } from './prompt-manager.service';
import { StoryService } from '../../stories/services/story.service';
import { CodexService } from '../../stories/services/codex.service';
import { OpenRouterApiService } from '../../core/services/openrouter-api.service';
import { GoogleGeminiApiService } from '../../core/services/google-gemini-api.service';
import { OllamaApiService, OllamaResponse, OllamaChatResponse } from '../../core/services/ollama-api.service';
import { ClaudeApiService } from '../../core/services/claude-api.service';
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

  async generateFromOutline(options: SceneFromOutlineOptions): Promise<{ content: string; title?: string }> {
    // Ensure prompt manager watches current story
    await this.promptManager.setCurrentStory(options.storyId);
    const story = await this.storyService.getStory(options.storyId);
    if (!story) throw new Error('Story not found');

    // Build initial prompt + messages
    const { systemMessage, messages, languageInstruction, storyContext, codexText } = await this.buildMessages(story, options);
    const { provider, modelId } = this.splitProvider(options.model);
    const temperature = options.temperature ?? this.getDefaultTemperature(provider);

    const targetWords = Math.max(200, Math.min(25000, options.wordCount || 600));
    const segmentMax = 3000; // conservative per-call word goal to stay within limits
    const maxSegments = 30;  // safety cap

    let combined = '';
    let currentWords = 0;
    let segments = 0;

    // Helper to call provider with messages and token budget derived from a word goal
    const callProvider = async (msgs: { role: 'system' | 'user' | 'assistant'; content: string }[], wordGoal: number): Promise<string> => {
      const calculatedTokens = Math.ceil(wordGoal * 3);
      const maxTokens = Math.max(3000, Math.min(calculatedTokens, 100000));
      const promptForLogging = this.messagesToPrompt(systemMessage, msgs.filter(m => m.role !== 'system'));

      if (provider === 'gemini') {
        const resp = await firstValueFrom(this.gemini.generateText(promptForLogging, {
          model: modelId,
          maxTokens,
          temperature,
          messages: [{ role: 'system', content: systemMessage }, ...msgs]
        }));
        return resp.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      } else if (provider === 'openrouter') {
        const resp = await firstValueFrom(this.openRouter.generateText(promptForLogging, {
          model: modelId,
          maxTokens,
          temperature,
          messages: [{ role: 'system', content: systemMessage }, ...msgs]
        }));
        return resp.choices?.[0]?.message?.content?.trim() || '';
      } else if (provider === 'ollama') {
        const resp = await firstValueFrom(this.ollama.generateText(promptForLogging, {
          model: modelId,
          maxTokens,
          temperature,
          messages: [{ role: 'system', content: systemMessage }, ...msgs]
        }));
        if ((resp as OllamaResponse).response !== undefined) {
          return (resp as OllamaResponse).response?.trim() || '';
        } else {
          return (resp as OllamaChatResponse).message?.content?.trim() || '';
        }
      } else if (provider === 'claude') {
        const resp = await firstValueFrom(this.claude.generateText(promptForLogging, {
          model: modelId,
          maxTokens,
          temperature,
          messages: [{ role: 'system', content: systemMessage }, ...msgs]
        }));
        return resp.content?.[0]?.text?.trim() || '';
      }
      throw new Error('Unsupported provider: ' + provider);
    };

    // 1) Initial segment from outline
    {
      const initialGoal = Math.min(segmentMax, targetWords);
      const initialText = await callProvider(messages, initialGoal);
      combined = initialText;
      currentWords = this.countWords(initialText);
      segments++;
    }

    // 2) Continue generation iteratively until target reached or safety cap
    while (currentWords < targetWords && segments < maxSegments) {
      const remaining = targetWords - currentWords;
      const goal = Math.min(segmentMax, remaining);

      // Use a small tail of prior output for continuity
      const tail = this.tailText(combined, 12000);

      // Minimal continuation context: keep outline, optional codex, optional story context (summaries)
      const continueUser = [
        options.outline ? `<scene_outline>\n${options.outline}\n</scene_outline>` : '',
        codexText ? `<glossary>\n${codexText}\n</glossary>` : '',
        storyContext ? `<story_context>\n${storyContext}\n</story_context>` : '',
        `<previous_scene_tail>\n${tail}\n</previous_scene_tail>`,
        `<instructions>\nContinue the same scene seamlessly from the previous text without repeating any sentences. Aim for about ${goal} words. ${languageInstruction}` +
        `${this.settingsService.getSettings().sceneGenerationFromOutline?.customInstruction ? `\n${this.settingsService.getSettings().sceneGenerationFromOutline!.customInstruction}` : ''}` +
        `\nDo not add headings or summaries. Output only the next part of the prose.\n</instructions>`
      ].filter(Boolean).join('\n\n');

      const continuationMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        // Keep conversation minimal to save tokens: we provide tail as assistant content
        { role: 'user', content: continueUser },
        { role: 'assistant', content: tail },
        { role: 'user', content: `Continue where you left off for about ${goal} words. Do not repeat anything from the prior text.` }
      ];

      const next = await callProvider(continuationMessages, goal);
      const cleaned = next.trim();

      // Break if model returns nothing meaningful to avoid loops
      if (!cleaned || cleaned.split(/\s+/).length < 50) {
        break;
      }

      combined += (combined.endsWith('\n') ? '' : '\n\n') + cleaned;
      currentWords = this.countWords(combined);
      segments++;
    }

    const normalized = this.plainTextToHtml(combined);
    return { content: normalized };
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

  private async buildMessages(story: Story, options: SceneFromOutlineOptions): Promise<{ systemMessage: string; messages: { role: 'user' | 'assistant' | 'system'; content: string }[]; languageInstruction: string; storyContext: string; codexText: string }> {
    // System message
    const systemMessage = story.settings?.systemMessage || DEFAULT_STORY_SETTINGS.systemMessage;
    const appSettings = this.settingsService.getSettings();

    // Optional story context
    let storyContext = '';
    if (options.includeStoryOutline) {
      storyContext = options.useFullStoryContext
        ? this.promptManager.getFullStoryContext()
        : this.promptManager.getSummaryContext();
    }

    // Optional codex summary
    let codexText = '';
    if (options.includeCodex) {
      try {
        const codex = await this.codexService.getOrCreateCodex(options.storyId);
        const lines: string[] = [];
        for (const cat of codex.categories) {
          const entries = cat.entries.slice(0, 10); // limit for prompt brevity
          if (entries.length) {
            lines.push(`[${cat.title}]`);
            for (const e of entries) {
              const title = e.title || 'Untitled';
              const desc = (e.content || '').replace(/\s+/g, ' ').trim();
              lines.push(`- ${title}${desc ? ': ' + desc : ''}`);
            }
          }
        }
        codexText = lines.join('\n');
      } catch {
        codexText = '';
      }
    }

    const langPref = (options.language || story.settings?.language || 'en') as 'en' | 'de' | 'fr' | 'es' | 'custom';
    const languageInstruction = this.getLanguageInstruction(langPref);
    const wordCount = Math.max(200, Math.min(25000, options.wordCount || 600));

    let userContent = '';
    if (appSettings.sceneGenerationFromOutline?.useCustomPrompt) {
      const tpl = appSettings.sceneGenerationFromOutline.customPrompt || '';
      const customInstr = appSettings.sceneGenerationFromOutline.customInstruction || '';
      userContent = tpl
        .replace(/\{systemMessage\}/g, systemMessage)
        .replace(/\{storyTitle\}/g, story.title || '')
        .replace(/\{codexEntries\}/g, codexText)
        .replace(/\{storySoFar\}/g, storyContext)
        .replace(/\{sceneOutline\}/g, options.outline)
        .replace(/\{wordCount\}/g, String(wordCount))
        .replace(/\{languageInstruction\}/g, languageInstruction)
        .replace(/\{customInstruction\}/g, customInstr ? `\n${customInstr}` : '');
      // Ensure language instruction present if omitted in template
      if (!userContent.includes(languageInstruction)) {
        userContent += `\n\n${languageInstruction}`;
      }
    } else {
      userContent = [
        `<story_title>${story.title}</story_title>`,
        codexText ? `<glossary>\n${codexText}\n</glossary>` : '',
        storyContext ? `<story_context>\n${storyContext}\n</story_context>` : '',
        `<scene_outline>\n${options.outline}\n</scene_outline>`,
        `<instructions>\nWrite a complete, coherent scene based strictly on the outline. Aim for ~${wordCount} words. ${languageInstruction}` +
        `${appSettings.sceneGenerationFromOutline?.customInstruction ? `\n${appSettings.sceneGenerationFromOutline.customInstruction}` : ''}` +
        `\nDo not include meta comments or headings. Output only the scene prose.\n</instructions>`
      ].filter(Boolean).join('\n\n');
    }

    const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'user', content: userContent }
    ];
    return { systemMessage, messages, languageInstruction, storyContext, codexText };
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
}
