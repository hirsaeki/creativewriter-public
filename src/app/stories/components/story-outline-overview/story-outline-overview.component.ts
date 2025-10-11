import { Component, ChangeDetectionStrategy, OnInit, inject, computed, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonSearchbar, IonAccordion, IonAccordionGroup, IonItem, IonLabel,
  IonButton, IonIcon, IonList, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonTextarea, IonInput,
  IonBadge, IonSkeletonText, IonNote, IonSpinner, IonFab, IonFabButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, openOutline, clipboardOutline, copyOutline, refreshOutline, createOutline, saveOutline, closeOutline, flashOutline, sparklesOutline, timeOutline } from 'ionicons/icons';
import { Story, Chapter } from '../../models/story.interface';
import { StoryService } from '../../services/story.service';
import { AppHeaderComponent, HeaderAction, BurgerMenuItem } from '../../../ui/components/app-header.component';
import { ModelSelectorComponent } from '../../../shared/components/model-selector/model-selector.component';
import { SettingsService } from '../../../core/services/settings.service';
import { OpenRouterApiService } from '../../../core/services/openrouter-api.service';
import { GoogleGeminiApiService } from '../../../core/services/google-gemini-api.service';
import { PromptManagerService } from '../../../shared/services/prompt-manager.service';
import { PromptTemplateService } from '../../../shared/services/prompt-template.service';
import { StoryStatsService } from '../../services/story-stats.service';
import { CodexContextService } from '../../../shared/services/codex-context.service';

@Component({
  selector: 'app-story-outline-overview',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    AppHeaderComponent, ModelSelectorComponent,
    IonContent, IonSearchbar, IonAccordion, IonAccordionGroup, IonItem, IonLabel,
    IonButton, IonIcon, IonList, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonTextarea, IonInput,
    IonBadge, IonSkeletonText, IonNote, IonSpinner, IonFab, IonFabButton
  ],
  templateUrl: './story-outline-overview.component.html',
  styleUrls: ['./story-outline-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StoryOutlineOverviewComponent implements OnInit {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('searchbar') querySearchbar?: IonSearchbar;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private storyService = inject(StoryService);
  private settingsService = inject(SettingsService);
  private openRouterApi = inject(OpenRouterApiService);
  private geminiApi = inject(GoogleGeminiApiService);
  private promptManager = inject(PromptManagerService);
  private promptTemplateService = inject(PromptTemplateService);
  private storyStats = inject(StoryStatsService);
  private codexContextService = inject(CodexContextService);

  // Header config
  leftActions: HeaderAction[] = [];
  rightActions: HeaderAction[] = [];
  burgerMenuItems: BurgerMenuItem[] = [];

  // Data
  story = signal<Story | null>(null);
  query = signal('');
  selectedModel = '';

  // UI state
  loading = signal<boolean>(true);
  expanded = signal<Set<string>>(new Set());
  expandedArray = computed<string[]>(() => Array.from(this.expanded()));

  // Derived view model
  filteredChapters = computed<Chapter[]>(() => {
    const s = this.story();
    if (!s) return [] as Chapter[];
    const q = this.query().toLowerCase().trim();
    const chapters = Array.isArray(s.chapters) ? s.chapters : [];
    return chapters.map((ch) => ({
      ...ch,
      scenes: ch.scenes.filter(sc => {
        if (!q) return true;
        const hay = `${ch.title}\n${sc.title}\n${sc.summary || ''}`.toLowerCase();
        return hay.includes(q);
      })
    })).filter(ch => ch.scenes.length > 0);
  });

  sceneWordCounts = computed<Record<string, number>>(() => {
    const s = this.story();
    if (!s) return {};
    const counts: Record<string, number> = {};
    for (const chapter of s.chapters ?? []) {
      for (const scene of chapter.scenes ?? []) {
        counts[scene.id] = this.storyStats.calculateSceneWordCount(scene);
      }
    }
    return counts;
  });

  // UI state
  toolbarVisible = signal<boolean>(false);

  constructor() {
    addIcons({ arrowBack, openOutline, clipboardOutline, copyOutline, refreshOutline, createOutline, saveOutline, closeOutline, flashOutline, sparklesOutline, timeOutline });
  }

  toggleToolbar(): void {
    const next = !this.toolbarVisible();
    this.toolbarVisible.set(next);
    if (next) {
      setTimeout(() => this.querySearchbar?.setFocus(), 200);
    }
  }

  getSceneWordCount(sceneId: string): number {
    return this.sceneWordCounts()[sceneId] ?? 0;
  }

  getSceneWordCountLabel(sceneId: string): string {
    const count = this.getSceneWordCount(sceneId);
    const noun = count === 1 ? 'word' : 'words';
    return `${count} ${noun}`;
  }

  async ngOnInit(): Promise<void> {
    const storyId = this.route.snapshot.paramMap.get('id');
    if (!storyId) {
      this.router.navigate(['/']);
      return;
    }
    const chapterId = this.route.snapshot.queryParamMap.get('chapterId');
    const sceneId = this.route.snapshot.queryParamMap.get('sceneId');
    await this.loadStory(storyId, chapterId, sceneId);
    this.setupHeader(storyId);
  }

  private async loadStory(id: string, chapterId: string | null = null, sceneId: string | null = null) {
    this.loading.set(true);
    try {
      const s = await this.storyService.getStory(id);
      if (!s) {
        this.router.navigate(['/']);
        return;
      }
      this.story.set(s);
      // If we have a chapterId, only expand that chapter. Otherwise expand all chapters
      if (chapterId) {
        this.expanded.set(new Set([chapterId]));
        // Schedule scroll to scene after view is ready and accordion expanded
        if (sceneId) {
          setTimeout(() => this.scrollToScene(sceneId), 600);
        }
      } else {
        // Expand all chapters by default for quick overview
        const all = new Set<string>(s.chapters.map(c => c.id));
        this.expanded.set(all);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private setupHeader(storyId: string) {
    this.leftActions = [
      {
        icon: 'arrow-back',
        action: () => this.goBackToEditor(storyId),
        tooltip: 'Back to editor',
        showOnDesktop: true,
        showOnMobile: true
      }
    ];
    this.rightActions = [
      {
        icon: 'copy-outline',
        label: 'Copy All',
        action: () => this.copyAllSummaries(),
        tooltip: 'Copy all summaries to clipboard',
        showOnDesktop: true,
        showOnMobile: false
      }
    ];
  }

  goBackToEditor(storyId: string): void {
    this.router.navigate(['/stories/editor', storyId]);
  }

  openInEditor(chapterId: string, sceneId: string): void {
    const sid = this.story()?.id;
    if (!sid) return;
    this.router.navigate([
      '/stories/editor', sid
    ], { queryParams: { chapterId, sceneId }});
  }

  onAccordionChange(ev: CustomEvent<{ value: string[] | string | null | undefined }>) {
    const raw = ev?.detail?.value;
    let values: string[] = [];
    if (Array.isArray(raw)) values = raw;
    else if (typeof raw === 'string') values = [raw];
    this.expanded.set(new Set(values));
  }

  copyAllSummaries(): void {
    const s = this.story();
    if (!s) return;
    const lines: string[] = [];
    lines.push(`# ${s.title || 'Story'} — Outline Overview`);
    for (const ch of s.chapters) {
      lines.push(`\n## ${ch.chapterNumber}. ${ch.title || 'Untitled Chapter'}`);
      for (const sc of ch.scenes) {
        const title = `${sc.sceneNumber}. ${sc.title || 'Untitled Scene'}`;
        const summary = (sc.summary || '').trim();
        lines.push(`\n### ${title}`);
        lines.push(summary ? summary : '_(no summary)_');
      }
    }
    const text = lines.join('\n');
    navigator.clipboard?.writeText(text).catch(() => {
      // ignore clipboard errors in non-secure contexts
    });
  }

  // Inline summary editing state
  editingSummaries: Record<string, string> = {};
  private savingSet = new Set<string>();

  isEditing(sceneId: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.editingSummaries, sceneId);
  }

  startEdit(sceneId: string, current: string | undefined): void {
    this.editingSummaries = { ...this.editingSummaries, [sceneId]: current || '' };
  }

  cancelEdit(sceneId: string): void {
    const rest = { ...this.editingSummaries };
    delete rest[sceneId];
    this.editingSummaries = rest;
  }

  onEditSummaryChange(sceneId: string, value: string): void {
    this.editingSummaries = { ...this.editingSummaries, [sceneId]: value };
  }

  saving(sceneId: string): boolean {
    return this.savingSet.has(sceneId);
  }

  async saveSceneSummary(chapterId: string, sceneId: string): Promise<void> {
    const s = this.story();
    if (!s) return;
    const summary = this.editingSummaries[sceneId] ?? '';
    this.savingSet.add(sceneId);
    try {
      await this.storyService.updateScene(s.id, chapterId, sceneId, { summary });
      // Update local story signal immutably to avoid full reload
      const updatedChapters = s.chapters.map(ch => {
        if (ch.id !== chapterId) return ch;
        return {
          ...ch,
          updatedAt: new Date(),
          scenes: ch.scenes.map(sc => sc.id === sceneId ? { ...sc, summary, updatedAt: new Date() } : sc)
        };
      });
      this.story.set({ ...s, chapters: updatedChapters, updatedAt: new Date() });
      this.cancelEdit(sceneId);
    } catch (e) {
      console.error('Failed to save scene summary', e);
    } finally {
      this.savingSet.delete(sceneId);
    }
  }

  onSummaryKeydown(event: KeyboardEvent, chapterId: string, sceneId: string): void {
    if ((event.key === 'Enter' || event.key === 'NumpadEnter') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.saveSceneSummary(chapterId, sceneId);
    }
  }

  // AI generation states
  private generatingSummary = signal<Set<string>>(new Set());
  private generatingTitle = signal<Set<string>>(new Set());

  isGeneratingSummary(sceneId: string): boolean { return this.generatingSummary().has(sceneId); }
  isGeneratingTitle(sceneId: string): boolean { return this.generatingTitle().has(sceneId); }

  // Inline title editing state
  editingTitles: Record<string, string> = {};
  private savingTitleSet = new Set<string>();

  isEditingTitle(sceneId: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.editingTitles, sceneId);
  }

  startEditTitle(sceneId: string, current: string | undefined): void {
    this.editingTitles = { ...this.editingTitles, [sceneId]: current || '' };
  }

  cancelEditTitle(sceneId: string): void {
    const rest = { ...this.editingTitles };
    delete rest[sceneId];
    this.editingTitles = rest;
  }

  onEditTitleChange(sceneId: string, value: string): void {
    this.editingTitles = { ...this.editingTitles, [sceneId]: value };
  }

  savingTitle(sceneId: string): boolean {
    return this.savingTitleSet.has(sceneId);
  }

  async saveSceneTitle(chapterId: string, sceneId: string): Promise<void> {
    const s = this.story();
    if (!s) return;
    const title = (this.editingTitles[sceneId] ?? '').trim();
    if (!title) return; // avoid empty titles
    this.savingTitleSet.add(sceneId);
    try {
      await this.storyService.updateScene(s.id, chapterId, sceneId, { title });
      const updatedChapters = s.chapters.map(ch => {
        if (ch.id !== chapterId) return ch;
        return {
          ...ch,
          updatedAt: new Date(),
          scenes: ch.scenes.map(sc => sc.id === sceneId ? { ...sc, title, updatedAt: new Date() } : sc)
        };
      });
      this.story.set({ ...s, chapters: updatedChapters, updatedAt: new Date() });
      this.cancelEditTitle(sceneId);
    } catch (e) {
      console.error('Failed to save scene title', e);
    } finally {
      this.savingTitleSet.delete(sceneId);
    }
  }

  // --- AI Generation (reuse logic from StoryStructureComponent) ---
  async generateSceneSummary(chapterId: string, sceneId: string): Promise<void> {
    const s = this.story();
    if (!s) return;
    const chapter = s.chapters.find(c => c.id === chapterId);
    const scene = chapter?.scenes.find(sc => sc.id === sceneId);
    if (!scene || !scene.content?.trim()) return;

    const settings = this.settingsService.getSettings();
    const modelToUse = settings.sceneSummaryGeneration.selectedModel || this.selectedModel || settings.selectedModel;
    if (!modelToUse) { alert('No AI model configured.'); return; }

    const openRouterAvailable = settings.openRouter.enabled && settings.openRouter.apiKey;
    const geminiAvailable = settings.googleGemini.enabled && settings.googleGemini.apiKey;
    if (!openRouterAvailable && !geminiAvailable) {
      alert('No AI API configured. Please configure OpenRouter or Google Gemini in settings.');
      return;
    }

    this.generatingSummary.update(set => new Set(set).add(sceneId));
    const timeoutId = setTimeout(() => {
      if (this.generatingSummary().has(sceneId)) {
        this.generatingSummary.update(set => {
          const newSet = new Set(set);
          newSet.delete(sceneId);
          return newSet;
        });
        alert('Summary generation is taking too long. Please try again.');
      }
    }, 30000);

    // Clean content and build prompt
    let sceneContent = this.removeEmbeddedImages(scene.content);
    sceneContent = this.promptManager.extractPlainTextFromHtml(sceneContent);
    const sceneWordCount = this.getSceneWordCount(sceneId) || this.storyStats.calculateSceneWordCount(scene);
    const minimumSummaryWords = this.calculateSummaryMinimumWords(sceneWordCount);
    const wordCountInstruction = `Ensure the summary is at least ${minimumSummaryWords} words.`;
    const maxContentLength = 200000;
    let truncated = false;
    if (sceneContent.length > maxContentLength) { sceneContent = sceneContent.slice(0, maxContentLength); truncated = true; }

    const storyLanguage = s.settings?.language || 'en';
    const languageInstruction = (() => {
      switch (storyLanguage) {
        case 'de': return 'Antworte auf Deutsch.';
        case 'fr': return 'Réponds en français.';
        case 'es': return 'Responde en español.';
        case 'en': return 'Respond in English.';
        default: return 'Write the summary in the same language as the scene content.';
      }
    })();

    const truncatedNote = truncated ? '\n\n[Note: Content was truncated as it was too long]' : '';
    const customInstructionRaw = settings.sceneSummaryGeneration.customInstruction ?? '';
    const customInstructionPresent = customInstructionRaw.trim().length > 0;
    const additionalInstructionsXml = customInstructionPresent
      ? `      <customInstruction>${this.escapeXml(customInstructionRaw)}</customInstruction>`
      : '';
    const codexPromptContext = [scene.title || '', customInstructionRaw.trim()].filter(Boolean).join('\n');

    let codexEntriesRaw = '';
    try {
      const codexContext = await this.codexContextService.buildCodexXml(
        s.id,
        sceneContent,
        codexPromptContext
      );
      codexEntriesRaw = codexContext.xml;
    } catch (error) {
      console.error('Failed to build codex context for scene summary', error);
    }

    const codexEntriesForTemplate = codexEntriesRaw
      ? this.indentXmlBlock(codexEntriesRaw, '      ')
      : '      <codex />';
    const codexEntriesForCustomPrompt = codexEntriesRaw || '<codex />';
    const languageInstructionXml = `<languageRequirement>${this.escapeXml(languageInstruction)}</languageRequirement>`;
    const lengthRequirementXml = `<lengthRequirement>${this.escapeXml(wordCountInstruction)}</lengthRequirement>`;
    const redundancyNote = 'Do not repeat information already captured in the codex context.';

    let prompt: string;
    if (settings.sceneSummaryGeneration.useCustomPrompt) {
      prompt = settings.sceneSummaryGeneration.customPrompt
        .replace(/{sceneTitle}/g, scene.title || 'Untitled')
        .replace(/{sceneContent}/g, sceneContent + truncatedNote)
        .replace(/{customInstruction}/g, customInstructionRaw)
        .replace(/{customInstructionXml}/g, additionalInstructionsXml.trim())
        .replace(/{languageInstructionXml}/g, languageInstructionXml)
        .replace(/{languageInstruction}/g, languageInstruction)
        .replace(/{summaryWordCount}/g, minimumSummaryWords.toString())
        .replace(/{lengthRequirement}/g, wordCountInstruction)
        .replace(/{codexEntries}/g, codexEntriesForCustomPrompt);
      if (!prompt.includes(languageInstruction)) prompt += `\n\n${languageInstruction}`;
      if (!prompt.includes(redundancyNote)) prompt += `\n\n${redundancyNote}`;
      if (!prompt.includes(wordCountInstruction)) prompt += `\n\n${wordCountInstruction}`;
    } else {
      try {
        const template = await this.promptTemplateService.getSceneSummaryTemplate();
        prompt = template
          .replace(/\{sceneTitle\}/g, this.escapeXml(scene.title || 'Untitled'))
          .replace(/\{sceneContent\}/g, sceneContent)
          .replace(/\{truncatedNote\}/g, truncatedNote)
          .replace(/\{codexEntries\}/g, codexEntriesForTemplate)
          .replace(/\{languageInstruction\}/g, languageInstructionXml)
          .replace(/\{lengthRequirement\}/g, lengthRequirementXml)
          .replace(/\{additionalInstructions\}/g, additionalInstructionsXml);
        prompt = prompt.replace(/\{summaryWordCount\}/g, minimumSummaryWords.toString());
      } catch (error) {
        console.error('Failed to load default scene summary template', error);
        clearTimeout(timeoutId);
        this.generatingSummary.update(set => {
          const newSet = new Set(set);
          newSet.delete(sceneId);
          return newSet;
        });
        alert('Failed to load the scene summary prompt template. Please try again later or configure a custom prompt.');
        return;
      }
    }

    let provider: string | null = null; let actualModelId: string | null = null;
    const [prov, ...parts] = modelToUse.split(':'); provider = prov; actualModelId = parts.join(':');
    const useGemini = (provider === 'gemini' && geminiAvailable) || (provider !== 'gemini' && provider !== 'openrouter' && geminiAvailable && !openRouterAvailable);
    const useOpenRouter = (provider === 'openrouter' && openRouterAvailable) || (provider !== 'gemini' && provider !== 'openrouter' && openRouterAvailable);
    if (provider !== 'gemini' && provider !== 'openrouter') actualModelId = modelToUse;

    const finalize = async (summary: string) => {
      if (!summary) return;
      if (summary && !summary.match(/[.!?]$/)) summary += '.';
      // Update local signal story immutably and persist
      const current = this.story(); if (!current) return;
      const updatedChapters = current.chapters.map(ch => ch.id === chapterId ? {
        ...ch,
        scenes: ch.scenes.map(sc => sc.id === sceneId ? { ...sc, summary, summaryGeneratedAt: new Date(), updatedAt: new Date() } : sc),
        updatedAt: new Date()
      } : ch);
      this.story.set({ ...current, chapters: updatedChapters, updatedAt: new Date() });
      await this.storyService.updateScene(current.id, chapterId, sceneId, { summary, summaryGeneratedAt: new Date() });
      this.promptManager.refresh();
      clearTimeout(timeoutId);
      this.generatingSummary.update(set => {
        const newSet = new Set(set);
        newSet.delete(sceneId);
        return newSet;
      });
    };

    if (useGemini) {
      this.geminiApi.generateText(prompt, { model: actualModelId!, maxTokens: 3000, temperature: settings.sceneSummaryGeneration.temperature })
        .subscribe({
          next: async (response) => {
            const cand = response.candidates?.[0];
            const text = cand?.content?.parts?.[0]?.text?.trim() || '';
            await finalize(text);
          },
          error: (error) => {
            console.error('Error generating scene summary:', error);
            clearTimeout(timeoutId);
            this.generatingSummary.update(set => {
              const newSet = new Set(set);
              newSet.delete(sceneId);
              return newSet;
            });
            alert(this.describeGeminiError(error));
          }
        });
    } else if (useOpenRouter) {
      this.openRouterApi.generateText(prompt, { model: actualModelId!, maxTokens: 3000, temperature: settings.sceneSummaryGeneration.temperature })
        .subscribe({
          next: async (response) => {
            const choice = response.choices?.[0];
            let text = choice?.message?.content?.trim() || '';
            if (choice?.finish_reason === 'length') text += ' [Summary was truncated due to token limit]';
            await finalize(text);
          },
          error: (error) => {
            console.error('Error generating scene summary:', error);
            clearTimeout(timeoutId);
            this.generatingSummary.update(set => {
              const newSet = new Set(set);
              newSet.delete(sceneId);
              return newSet;
            });
            alert(this.describeOpenRouterError(error));
          }
        });
    }
  }

  generateSceneTitle(chapterId: string, sceneId: string): void {
    const s = this.story();
    if (!s) return;
    const chapter = s.chapters.find(c => c.id === chapterId);
    const scene = chapter?.scenes.find(sc => sc.id === sceneId);
    if (!scene || !scene.content?.trim()) return;

    const settings = this.settingsService.getSettings();
    const titleSettings = settings.sceneTitleGeneration;
    const modelToUse = titleSettings.selectedModel || this.selectedModel || settings.selectedModel;
    if (!modelToUse) { alert('No AI model configured.'); return; }

    const openRouterAvailable = settings.openRouter.enabled && settings.openRouter.apiKey;
    const geminiAvailable = settings.googleGemini.enabled && settings.googleGemini.apiKey;
    if (!openRouterAvailable && !geminiAvailable) {
      alert('No AI API configured. Please configure OpenRouter or Google Gemini in settings.');
      return;
    }

    this.generatingTitle.update(set => new Set(set).add(sceneId));
    const timeoutId = setTimeout(() => {
      if (this.generatingTitle().has(sceneId)) {
        this.generatingTitle.update(set => {
          const newSet = new Set(set);
          newSet.delete(sceneId);
          return newSet;
        });
        alert('Title generation is taking too long. Please try again.');
      }
    }, 30000);

    let sceneContent = this.removeEmbeddedImages(scene.content);
    sceneContent = this.promptManager.extractPlainTextFromHtml(sceneContent);
    const maxContentLength = 50000;
    if (sceneContent.length > maxContentLength) sceneContent = sceneContent.slice(0, maxContentLength);

    let styleInstruction = '';
    switch (titleSettings.style) {
      case 'descriptive': styleInstruction = 'The title should be descriptive and atmospheric.'; break;
      case 'action': styleInstruction = 'The title should be action-packed and dynamic.'; break;
      case 'emotional': styleInstruction = 'The title should reflect the emotional mood of the scene.'; break;
      case 'concise': default: styleInstruction = 'The title should be concise and impactful.'; break;
    }
    const languageInstruction = titleSettings.language === 'english' ? 'Respond in English.' : 'Respond in German.';
    const genreInstruction = titleSettings.includeGenre ? 'Consider the genre of the story when choosing the title.' : '';
    const customInstruction = titleSettings.customInstruction ? `\n${titleSettings.customInstruction}` : '';

    let prompt: string;
    if (titleSettings.useCustomPrompt && titleSettings.customPrompt) {
      prompt = titleSettings.customPrompt
        .replace('{maxWords}', titleSettings.maxWords.toString())
        .replace('{styleInstruction}', styleInstruction)
        .replace('{genreInstruction}', genreInstruction)
        .replace('{languageInstruction}', languageInstruction)
        .replace('{customInstruction}', customInstruction)
        .replace('{sceneContent}', sceneContent);
    } else {
      prompt = `Create a title for the following scene. The title should be up to ${titleSettings.maxWords} words \n` +
        `${styleInstruction}\n${genreInstruction}\n${languageInstruction}${customInstruction}\n\nScene content (only this one scene):\n${sceneContent}\n\nRespond only with the title, without further explanations or quotation marks.`;
    }

    let provider: string | null = null; let actualModelId: string | null = null;
    const [prov, ...parts] = modelToUse.split(':'); provider = prov; actualModelId = parts.join(':');
    const useGemini = (provider === 'gemini' && geminiAvailable) || (provider !== 'gemini' && provider !== 'openrouter' && geminiAvailable && !openRouterAvailable);
    const useOpenRouter = (provider === 'openrouter' && openRouterAvailable) || (provider !== 'gemini' && provider !== 'openrouter' && openRouterAvailable);
    if (provider !== 'gemini' && provider !== 'openrouter') actualModelId = modelToUse;

    const finalize = async (title: string) => {
      title = (title || '').trim().replace(/^\s*"|"\s*$/g, '');
      if (!title) return;
      const current = this.story(); if (!current) return;
      const updatedChapters = current.chapters.map(ch => ch.id === chapterId ? {
        ...ch,
        scenes: ch.scenes.map(sc => sc.id === sceneId ? { ...sc, title, updatedAt: new Date() } : sc),
        updatedAt: new Date()
      } : ch);
      this.story.set({ ...current, chapters: updatedChapters, updatedAt: new Date() });
      await this.storyService.updateScene(current.id, chapterId, sceneId, { title });
      this.promptManager.refresh();
      clearTimeout(timeoutId);
      this.generatingTitle.update(set => {
        const newSet = new Set(set);
        newSet.delete(sceneId);
        return newSet;
      });
    };

    if (useGemini) {
      this.geminiApi.generateText(prompt, { model: actualModelId!, maxTokens: 200, temperature: titleSettings.temperature })
        .subscribe({
          next: async (response) => {
            const cand = response.candidates?.[0];
            const text = cand?.content?.parts?.[0]?.text?.trim() || '';
            await finalize(text);
          },
          error: (error) => {
            console.error('Error generating scene title:', error);
            clearTimeout(timeoutId);
            this.generatingTitle.update(set => {
              const newSet = new Set(set);
              newSet.delete(sceneId);
              return newSet;
            });
            alert(this.describeGeminiError(error));
          }
        });
    } else if (useOpenRouter) {
      this.openRouterApi.generateText(prompt, { model: actualModelId!, maxTokens: 200, temperature: titleSettings.temperature })
        .subscribe({
          next: async (response) => {
            const text = response.choices?.[0]?.message?.content?.trim() || '';
            await finalize(text);
          },
          error: (error) => {
            console.error('Error generating scene title:', error);
            clearTimeout(timeoutId);
            this.generatingTitle.update(set => {
              const newSet = new Set(set);
              newSet.delete(sceneId);
              return newSet;
            });
            alert(this.describeOpenRouterError(error));
          }
        });
    }
  }

  private removeEmbeddedImages(content: string): string {
    let cleaned = content.replace(/<img[^>]*src="data:image\/[^"]*"[^>]*>/gi, '[Image removed]');
    cleaned = cleaned.replace(/!\[[^\]]*\]\(data:image\/[^)]*\)/gi, '[Image removed]');
    cleaned = cleaned.replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/]{1000,}={0,2}/g, '[Image data removed]');
    return cleaned;
  }

  private describeOpenRouterError(error: unknown): string {
    const err = (error || {}) as { status?: number; message?: string; error?: { error?: { message?: string }, message?: string } };
    if (!error) return 'Error generating text.';
    if (err.status === 400) return 'Invalid request. Please check your API settings.';
    if (err.status === 401) return 'Invalid API key. Please check your OpenRouter API key in settings.';
    if (err.status === 403) return 'Access denied. Your API key may not have the required permissions.';
    if (err.status === 429) return 'Rate limit reached. Please wait a moment and try again.';
    if (err.status === 500) return 'OpenRouter server error. Please try again later.';
    if (err.message?.includes('nicht aktiviert')) return err.message;
    return 'Error generating text.';
  }

  private describeGeminiError(error: unknown): string {
    const err = (error || {}) as { status?: number; message?: string };
    if (!error) return 'Error generating text.';
    if (err.status === 400) return 'Invalid request. Please check your API settings.';
    if (err.status === 401) return 'Invalid API key. Please check your Google Gemini API key in settings.';
    if (err.status === 403) return 'Access denied. Your API key may not have the required permissions.';
    if (err.status === 429) return 'Rate limit reached. Please wait a moment and try again.';
    if (err.status === 500) return 'Gemini server error. Please try again later.';
    if (err.message?.includes('nicht aktiviert')) return err.message;
    return 'Error generating text.';
  }

  // Chapter title inline editing
  editingChapterTitles: Record<string, string> = {};
  private savingChapterTitleSet = new Set<string>();

  isEditingChapterTitle(chapterId: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.editingChapterTitles, chapterId);
  }

  startEditChapterTitle(chapterId: string, current: string | undefined, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingChapterTitles = { ...this.editingChapterTitles, [chapterId]: current || '' };
  }

  cancelEditChapterTitle(chapterId: string, event?: Event): void {
    if (event) event.stopPropagation();
    const rest = { ...this.editingChapterTitles };
    delete rest[chapterId];
    this.editingChapterTitles = rest;
  }

  onEditChapterTitleChange(chapterId: string, value: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingChapterTitles = { ...this.editingChapterTitles, [chapterId]: value };
  }

  savingChapterTitle(chapterId: string): boolean {
    return this.savingChapterTitleSet.has(chapterId);
  }

  async saveChapterTitle(chapterId: string, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    const s = this.story();
    if (!s) return;
    const title = (this.editingChapterTitles[chapterId] ?? '').trim();
    if (!title) return;
    this.savingChapterTitleSet.add(chapterId);
    try {
      await this.storyService.updateChapter(s.id, chapterId, { title });
      const updatedChapters = s.chapters.map(ch => ch.id === chapterId ? { ...ch, title, updatedAt: new Date() } : ch);
      this.story.set({ ...s, chapters: updatedChapters, updatedAt: new Date() });
      this.cancelEditChapterTitle(chapterId);
    } catch (e) {
      console.error('Failed to save chapter title', e);
    } finally {
      this.savingChapterTitleSet.delete(chapterId);
    }
  }

  // TrackBy functions to preserve accordion state during updates
  trackChapterById(index: number, chapter: Chapter): string {
    return chapter.id;
  }

  trackSceneById(index: number, scene: { id: string }): string {
    return scene.id;
  }

  private indentXmlBlock(xml: string, indentation = '    '): string {
    if (!xml) return '';
    return xml
      .split('\n')
      .map(line => line ? `${indentation}${line}` : line)
      .join('\n');
  }

  private escapeXml(value: string | unknown): string {
    const str = String(value ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private calculateSummaryMinimumWords(sceneWordCount: number): number {
    const baseMinimum = 120;
    if (sceneWordCount <= 2000) return baseMinimum;
    const extraWords = sceneWordCount - 2000;
    const increments = Math.ceil(extraWords / 500);
    return baseMinimum + increments * 25;
  }

  private async scrollToScene(sceneId: string): Promise<void> {
    const element = document.getElementById(`scene-${sceneId}`);
    if (element && this.content) {
      try {
        // Get element position relative to the page
        const rect = element.getBoundingClientRect();
        const scrollElement = await this.content.getScrollElement();
        const scrollTop = scrollElement.scrollTop;

        // Calculate absolute Y position
        const yPosition = rect.top + scrollTop - 100; // 100px offset from top

        // Use Ionic's scrollToPoint for mobile compatibility
        await this.content.scrollToPoint(0, yPosition, 500);

        // Add a highlight effect
        element.classList.add('highlight');
        setTimeout(() => element.classList.remove('highlight'), 2000);
      } catch (error) {
        console.error('Error scrolling to scene:', error);
        // Fallback to standard scrollIntoView
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
}
