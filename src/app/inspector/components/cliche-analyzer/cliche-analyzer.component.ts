import { Component, ChangeDetectionStrategy, OnInit, inject, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonList, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, search } from 'ionicons/icons';
import { AppHeaderComponent, BurgerMenuItem, HeaderAction } from '../../../../app/ui/components/app-header.component';
import { HeaderNavigationService } from '../../../../app/shared/services/header-navigation.service';
import { StoryService } from '../../../stories/services/story.service';
import { Story } from '../../../stories/models/story.interface';
import { ClicheAnalysisService } from '../../services/cliche-analysis.service';
import { SceneClicheResult, GlobalClicheReport, ClicheFindingType } from '../../models/cliche-analysis.interface';
import { SettingsService } from '../../../core/services/settings.service';
import { ModelSelectorComponent } from '../../../shared/components/model-selector/model-selector.component';

@Component({
  selector: 'app-cliche-analyzer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ModelSelectorComponent,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonButton, IonIcon, IonList, IonBadge,
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
  private settingsService = inject(SettingsService);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  storyId = '';
  story: Story | null = null;
  results: SceneClicheResult[] = [];
  overview: GlobalClicheReport | null = null;
  isAnalyzing = false;

  selectedModel = '';

  burgerMenuItems: BurgerMenuItem[] = [];
  rightActions: HeaderAction[] = [];

  constructor() {
    addIcons({ arrowBack, search });
    // Reuse common items so navigation stays consistent
    this.burgerMenuItems = this.headerNav.getCommonBurgerMenuItems();
    this.rightActions = [{
      icon: 'search',
      label: 'Analyze',
      action: () => this.runAnalyze(),
      showOnMobile: true,
      showOnDesktop: true,
      tooltip: 'Analyze story for clichés'
    }];
  }

  async ngOnInit(): Promise<void> {
    this.storyId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.storyId) return;
    this.story = await this.storyService.getStory(this.storyId);
    // Initialize selected model from global settings if available
    const settings = this.settingsService.getSettings();
    this.selectedModel = settings.selectedModel || this.selectedModel;
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

  async analyze(): Promise<void> {
    const story = this.story;
    if (!story) { this.results = []; this.overview = null; return; }
    if (!this.selectedModel) {
      // Fallback to global settings
      const settings = this.settingsService.getSettings();
      this.selectedModel = settings.selectedModel || '';
    }
    this.isAnalyzing = true;
    this.cdr.markForCheck();
    const results: SceneClicheResult[] = [];
    try {
      for (const ch of story.chapters || []) {
        for (const sc of ch.scenes || []) {
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
          this.cdr.markForCheck();
        }
      }
      this.results = results;
      this.overview = this.buildOverview(results);
    } finally {
      this.isAnalyzing = false;
      this.cdr.markForCheck();
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
}
