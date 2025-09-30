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
import { ClicheAnalysisService } from '../../services/cliche-analysis.service';
import { SceneClicheResult, GlobalClicheReport, ClicheFindingType } from '../../models/cliche-analysis.interface';
import { SettingsService } from '../../../core/services/settings.service';
import { ModelSelectorComponent } from '../../../shared/components/model-selector/model-selector.component';
import { ClicheAnalysisCacheService, ClicheAnalysisPersist } from '../../services/cliche-analysis-cache.service';

@Component({
  selector: 'app-cliche-analyzer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ModelSelectorComponent,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonList, IonBadge, IonModal, IonSearchbar, IonItemDivider, IonCheckbox, IonChip, IonHeader, IonToolbar, IonTitle, IonButtons, IonSpinner, IonProgressBar,
    AppHeaderComponent
  ],
  templateUrl: './cliche-analyzer.component.html',
  styleUrls: ['./cliche-analyzer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClicheAnalyzerComponent implements OnInit {
  private headerNav = inject(HeaderNavigationService);
  private route = inject(ActivatedRoute);
  private storyService = inject(StoryService);
  private router = inject(Router);
  private clicheService = inject(ClicheAnalysisService);
  private cache = inject(ClicheAnalysisCacheService);
  private settingsService = inject(SettingsService);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  storyId = '';
  story: Story | null = null;
  results: SceneClicheResult[] = [];
  overview: GlobalClicheReport | null = null;
  isAnalyzing = false;

  selectedModel = '';

  // Scene selection state (similar to Scene Chat)
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
    // Reuse common items so navigation stays consistent
    this.burgerMenuItems = this.headerNav.getCommonBurgerMenuItems();
    this.rightActions = [
      {
        icon: 'swap-horizontal',
        label: 'Characters',
        action: () => this.goToCharacters(),
        showOnMobile: true,
        showOnDesktop: true,
        tooltip: 'Switch to Character Consistency Analyzer'
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
        tooltip: 'Analyze selected scenes for clichés'
      }
    ];
  }

  async ngOnInit(): Promise<void> {
    this.storyId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.storyId) return;
    this.story = await this.storyService.getStory(this.storyId);
    // Initialize selected model from global settings if available
    const settings = this.settingsService.getSettings();
    this.selectedModel = settings.selectedModel || this.selectedModel;

    // Try to restore previous analysis state for this story
    const saved = this.cache.load(this.storyId);
    if (saved) {
      // Restore model if available
      if (saved.modelId) this.selectedModel = saved.modelId;
      // Restore selected scenes
      this.selectedScenes = [...(saved.selectedScenes || [])];
      // Restore results/overview
      this.results = [...(saved.results || [])];
      this.overview = saved.overview || null;
      this.cdr.markForCheck();
    }
  }

  runAnalyze(): void {
    // Ensure we execute within Angular zone so OnPush detects changes
    this.zone.run(() => {
      void this.analyze();
    });
  }

  goBack(): void {
    // Navigate back to the story editor if we have a story, else to list
    if (this.storyId) {
      this.router.navigate(['/stories/editor', this.storyId]);
    } else {
      this.headerNav.goToStoryList();
    }
  }

  goToCharacters(): void {
    if (!this.storyId) return;
    this.router.navigate(['/stories/inspector', this.storyId, 'characters']);
  }

  async analyze(): Promise<void> {
    const story = this.story;
    if (!story) { this.results = []; this.overview = null; return; }
    if (!this.selectedModel) {
      // Fallback to global settings
      const settings = this.settingsService.getSettings();
      this.selectedModel = settings.selectedModel || '';
    }
    // Require explicit scene selection: if none selected, do nothing
    if (this.selectedScenes.length === 0) {
      this.results = [];
      this.overview = null;
      this.isAnalyzing = false;
      this.cdr.markForCheck();
      return;
    }
    this.isAnalyzing = true;
    this.cdr.markForCheck();
    const results: SceneClicheResult[] = [];
    try {
      const selectedIds = new Set(this.selectedScenes.map(s => s.sceneId));
      for (const ch of story.chapters || []) {
        for (const sc of ch.scenes || []) {
          if (!selectedIds.has(sc.id)) continue;
          const sceneText = this.stripHtmlTags(sc.content || '');
          if (!sceneText) continue;
          const sceneTitle = sc.title || `C${ch.chapterNumber || ch.order}S${sc.sceneNumber || sc.order}`;
          const res = await this.clicheService.analyzeScene({
            modelId: this.selectedModel,
            sceneId: sc.id,
            sceneTitle,
            sceneText
          });
          results.push(res);
          // Update UI incrementally after each scene
          this.results = [...results];
          this.overview = this.buildOverview(this.results);
          this.cdr.markForCheck();

          // Persist progress so users can navigate away and back
          this.persistState();
        }
      }
      this.results = results;
      this.overview = this.buildOverview(results);
    } finally {
      this.isAnalyzing = false;
      this.cdr.markForCheck();
      // Final persist
      this.persistState();
    }
  }

  private extractPlainText(story: Story | null): string {
    if (!story) return '';
    let text = '';
    // Legacy content
    const anyStory = story as unknown as { content?: string };
    if (anyStory.content) {
      text += this.stripHtmlTags(anyStory.content) + '\n';
    }
    // Chapters/scenes
    if (Array.isArray(story.chapters)) {
      story.chapters.forEach(ch => {
        ch.scenes?.forEach(sc => {
          if (sc.content) text += this.stripHtmlTags(sc.content) + '\n';
        });
      });
    }
    return text.trim();
  }

  private stripHtmlTags(html: string): string {
    if (!html) return '';
    const cleanHtml = html.replace(/<div[^>]*class="beat-ai-node"[^>]*>.*?<\/div>/gs, '');
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

  private buildOverview(results: SceneClicheResult[]): GlobalClicheReport {
    const totals: Record<ClicheFindingType, number> = { cliche: 0, idiom: 0, redundancy: 0, buzzword: 0, stereotype: 0 };
    const phraseCounts = new Map<string, number>();
    for (const r of results) {
      if (!r.summary?.counts) continue;
      (Object.keys(totals) as ClicheFindingType[]).forEach((k) => {
        const v = r.summary.counts[k] || 0;
        totals[k] = (totals[k] || 0) + v;
      });
      for (const f of r.findings || []) {
        const key = f.phrase.toLowerCase();
        phraseCounts.set(key, (phraseCounts.get(key) || 0) + 1);
      }
    }
    
    const topPhrases = Array.from(phraseCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([phrase, count]) => ({ phrase, count }));
    return { totals, topPhrases };
  }

  // Scene selection helpers
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
    // Persist selection changes
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

  openInEditor(result: SceneClicheResult, finding: { phrase: string }): void {
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
        phrase: finding.phrase
      }
    });
  }

  private persistState(): void {
    if (!this.storyId) return;
    const payload: ClicheAnalysisPersist = {
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
