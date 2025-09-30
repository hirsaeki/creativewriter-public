import { Component, ChangeDetectionStrategy, OnInit, inject, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonButton, IonIcon, IonList, IonBadge, IonModal,
  IonSearchbar, IonItemDivider, IonCheckbox, IonChip, IonHeader, IonToolbar, IonTitle, IonButtons
} from '@ionic/angular/standalone';
import { IonSpinner, IonProgressBar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, search, addOutline, closeOutline, openOutline, documentTextOutline, swapHorizontal } from 'ionicons/icons';
import { AppHeaderComponent, BurgerMenuItem, HeaderAction } from '../../../../app/ui/components/app-header.component';
import { HeaderNavigationService } from '../../../../app/shared/services/header-navigation.service';
import { StoryService } from '../../../stories/services/story.service';
import { Story } from '../../../stories/models/story.interface';
import { CharacterConsistencyAnalysisService } from '../../services/character-consistency-analysis.service';
import { GlobalCharacterConsistencyReport, SceneCharacterConsistencyResult, CharacterInconsistencyType } from '../../models/character-consistency.interface';
import { SettingsService } from '../../../core/services/settings.service';
import { ModelSelectorComponent } from '../../../shared/components/model-selector/model-selector.component';
import { CharacterConsistencyCacheService, CharacterConsistencyPersist } from '../../services/character-consistency-cache.service';
import { CodexService } from '../../../stories/services/codex.service';
import { Codex, CodexCategory, CodexEntry } from '../../../stories/models/codex.interface';

@Component({
  selector: 'app-character-consistency-analyzer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ModelSelectorComponent,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonList, IonBadge, IonModal, IonSearchbar, IonItemDivider, IonCheckbox, IonChip, IonHeader, IonToolbar, IonTitle, IonButtons, IonSpinner, IonProgressBar,
    AppHeaderComponent
  ],
  templateUrl: './character-consistency-analyzer.component.html',
  styleUrls: ['./character-consistency-analyzer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CharacterConsistencyAnalyzerComponent implements OnInit {
  private headerNav = inject(HeaderNavigationService);
  private route = inject(ActivatedRoute);
  private storyService = inject(StoryService);
  private router = inject(Router);
  private analyzer = inject(CharacterConsistencyAnalysisService);
  private cache = inject(CharacterConsistencyCacheService);
  private settingsService = inject(SettingsService);
  private codexService = inject(CodexService);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  storyId = '';
  story: Story | null = null;
  codex: Codex | null = null;
  characterEntries: CodexEntry[] = [];

  results: SceneCharacterConsistencyResult[] = [];
  overview: GlobalCharacterConsistencyReport | null = null;
  isAnalyzing = false;

  selectedModel = '';

  selectedScenes: {
    chapterId: string;
    sceneId: string;
    chapterTitle: string;
    sceneTitle: string;
  }[] = [];
  showSceneSelector = false;
  sceneSearchTerm = '';

  burgerMenuItems: BurgerMenuItem[] = [];
  rightActions: HeaderAction[] = [];

  constructor() {
    addIcons({ arrowBack, search, addOutline, closeOutline, openOutline, documentTextOutline, swapHorizontal });
    this.burgerMenuItems = this.headerNav.getCommonBurgerMenuItems();
    this.rightActions = [
      {
        icon: 'swap-horizontal',
        label: 'Clichés',
        action: () => this.goToCliche(),
        showOnMobile: true,
        showOnDesktop: true,
        tooltip: 'Switch to Cliché Analyzer'
      },
      {
        icon: 'add-outline',
        label: 'Scenes',
        action: () => this.showSceneSelector = true,
        showOnMobile: true,
        showOnDesktop: true,
        tooltip: 'Select scenes to analyze'
      },
      {
        icon: 'search',
        label: 'Analyze',
        action: () => this.runAnalyze(),
        showOnMobile: true,
        showOnDesktop: true,
        tooltip: 'Analyze selected scenes for character consistency'
      }
    ];
  }

  async ngOnInit(): Promise<void> {
    this.storyId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.storyId) return;
    this.story = await this.storyService.getStory(this.storyId);

    const settings = this.settingsService.getSettings();
    this.selectedModel = settings.selectedModel || this.selectedModel;

    await this.loadCodexCharacters();

    const saved = this.cache.load(this.storyId);
    if (saved) {
      if (saved.modelId) this.selectedModel = saved.modelId;
      this.selectedScenes = [...(saved.selectedScenes || [])];
      this.results = [...(saved.results || [])];
      this.overview = saved.overview || null;
      this.cdr.markForCheck();
    }
  }

  private async loadCodexCharacters(): Promise<void> {
    try {
      const codex = await this.codexService.getOrCreateCodex(this.storyId);
      this.codex = codex;
      const charCategory: CodexCategory | undefined = codex.categories.find(c => (c.title || '').toLowerCase() === 'characters');
      this.characterEntries = charCategory?.entries || [];
    } catch {
      this.characterEntries = [];
    }
  }

  runAnalyze(): void {
    this.zone.run(() => { void this.analyze(); });
  }

  goBack(): void {
    if (this.storyId) {
      this.router.navigate(['/stories/editor', this.storyId]);
    } else {
      this.router.navigate(['/']);
    }
  }

  goToCliche(): void {
    if (!this.storyId) return;
    this.router.navigate(['/stories/inspector', this.storyId, 'cliche']);
  }

  async analyze(): Promise<void> {
    if (!this.story) return;
    if (!this.selectedModel) {
      const settings = this.settingsService.getSettings();
      this.selectedModel = settings.selectedModel || '';
    }
    if (this.selectedScenes.length === 0) {
      this.results = [];
      this.overview = null;
      this.isAnalyzing = false;
      this.cdr.markForCheck();
      return;
    }
    this.isAnalyzing = true;
    this.cdr.markForCheck();
    const results: SceneCharacterConsistencyResult[] = [];
    try {
      const selectedIds = new Set(this.selectedScenes.map(s => s.sceneId));
      for (const ch of this.story.chapters || []) {
        for (const sc of ch.scenes || []) {
          if (!selectedIds.has(sc.id)) continue;
          const sceneText = this.stripHtmlTags(sc.content || '');
          if (!sceneText) continue;
          const sceneTitle = sc.title || `C${ch.chapterNumber || ch.order}S${sc.sceneNumber || sc.order}`;
          const res = await this.analyzer.analyzeScene({
            modelId: this.selectedModel,
            sceneId: sc.id,
            sceneTitle,
            sceneText,
            codexCharacters: this.characterEntries
          });
          results.push(res);
          this.results = [...results];
          this.overview = this.buildOverview(this.results);
          this.cdr.markForCheck();
          this.persistState();
        }
      }
      this.results = results;
      this.overview = this.buildOverview(results);
    } finally {
      this.isAnalyzing = false;
      this.cdr.markForCheck();
      this.persistState();
    }
  }

  private stripHtmlTags(html: string): string {
    if (!html) return '';
    // Remove Beat AI helper nodes if present without relying on quoted attributes
    const cleanHtml = html.replace(/<div[^>]*class=[^>]*beat-ai-node[^>]*>.*?<\/div>/gs, '');
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanHtml, 'text/html');
    const textContent = doc.body.textContent || '';
    return textContent
      .replace(/🎭\s*Beat\s*AI/gi, '')
      .replace(/Prompt:\s*/gi, '')
      .replace(/BeatAIPrompt/gi, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private buildOverview(results: SceneCharacterConsistencyResult[]): GlobalCharacterConsistencyReport {
    const totals: Record<CharacterInconsistencyType, number> = { name: 0, trait: 0, relationship: 0, timeline: 0, pov: 0, other: 0 };
    const byCharacterMap = new Map<string, number>();
    for (const r of results) {
      if (!r.summary?.counts) continue;
      (Object.keys(totals) as CharacterInconsistencyType[]).forEach((k) => {
        const v = r.summary.counts[k] || 0;
        totals[k] = (totals[k] || 0) + v;
      });
      for (const i of r.issues || []) {
        const key = (i.character || 'Unknown').toLowerCase();
        byCharacterMap.set(key, (byCharacterMap.get(key) || 0) + 1);
      }
    }
    const byCharacter = Array.from(byCharacterMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    return { totals, byCharacter };
  }

  toggleSceneSelection(chapterId: string, sceneId: string): void {
    const idx = this.selectedScenes.findIndex(s => s.sceneId === sceneId);
    if (idx > -1) {
      this.selectedScenes.splice(idx, 1);
    } else {
      const chapter = this.story?.chapters.find(c => c.id === chapterId);
      const scene = chapter?.scenes.find(s => s.id === sceneId);
      if (chapter && scene) {
        this.selectedScenes.push({
          chapterId: chapter.id,
          sceneId: scene.id,
          chapterTitle: `C${chapter.chapterNumber || chapter.order}:${chapter.title}`,
          sceneTitle: `C${chapter.chapterNumber || chapter.order}S${scene.sceneNumber || scene.order}:${scene.title}`
        });
      }
    }
    this.cdr.markForCheck();
    this.persistState();
  }

  isSceneSelected(sceneId: string): boolean {
    return this.selectedScenes.some(s => s.sceneId === sceneId);
  }

  removeSceneContext(sceneId: string): void {
    const idx = this.selectedScenes.findIndex(s => s.sceneId === sceneId);
    if (idx > -1) {
      this.selectedScenes.splice(idx, 1);
      this.cdr.markForCheck();
      this.persistState();
    }
  }

  getFilteredScenes(chapter: Story['chapters'][number]): Story['chapters'][number]['scenes'] {
    if (!this.sceneSearchTerm) return chapter.scenes;
    const term = this.sceneSearchTerm.toLowerCase();
    return (chapter.scenes || []).filter(scene =>
      (scene.title || '').toLowerCase().includes(term) ||
      (scene.content || '').toLowerCase().includes(term)
    );
  }

  getScenePreview(html: string): string {
    const clean = this.stripHtmlTags(html || '');
    return clean.substring(0, 100) + (clean.length > 100 ? '...' : '');
  }

  openInEditor(result: SceneCharacterConsistencyResult, issue?: { snippet?: string }): void {
    if (!this.story) return;
    let chapterId = '';
    for (const ch of this.story.chapters) {
      if (ch.scenes?.some(sc => sc.id === result.sceneId)) {
        chapterId = ch.id;
        break;
      }
    }
    if (!chapterId) return;
    this.router.navigate(['/stories/editor', this.story.id], {
      queryParams: {
        chapterId,
        sceneId: result.sceneId,
        // Pass a snippet (if available) so the editor can highlight it
        ...(issue?.snippet ? { phrase: issue.snippet } : {})
      }
    });
  }

  private persistState(): void {
    if (!this.storyId) return;
    const payload: CharacterConsistencyPersist = {
      storyId: this.storyId,
      modelId: this.selectedModel,
      selectedScenes: this.selectedScenes.map(s => ({
        chapterId: s.chapterId,
        sceneId: s.sceneId,
        chapterTitle: s.chapterTitle,
        sceneTitle: s.sceneTitle
      })),
      results: this.results,
      overview: this.overview,
      updatedAt: Date.now()
    };
    this.cache.save(payload);
  }
}
