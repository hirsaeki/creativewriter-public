import { Component, ChangeDetectionStrategy, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonSearchbar, IonAccordion, IonAccordionGroup, IonItem, IonLabel,
  IonButton, IonIcon, IonChip, IonList, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonTextarea,
  IonBadge, IonSkeletonText, IonNote
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, openOutline, clipboardOutline, copyOutline, refreshOutline, createOutline, saveOutline, closeOutline } from 'ionicons/icons';
import { Story, Chapter } from '../../models/story.interface';
import { StoryService } from '../../services/story.service';
import { AppHeaderComponent, HeaderAction, BurgerMenuItem } from '../../../ui/components/app-header.component';

@Component({
  selector: 'app-story-outline-overview',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    AppHeaderComponent,
    IonContent, IonSearchbar, IonAccordion, IonAccordionGroup, IonItem, IonLabel,
    IonButton, IonIcon, IonChip, IonList, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonTextarea,
    IonBadge, IonSkeletonText, IonNote
  ],
  templateUrl: './story-outline-overview.component.html',
  styleUrls: ['./story-outline-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StoryOutlineOverviewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private storyService = inject(StoryService);

  // Header config
  leftActions: HeaderAction[] = [];
  rightActions: HeaderAction[] = [];
  burgerMenuItems: BurgerMenuItem[] = [];

  // Data
  story = signal<Story | null>(null);
  query = signal('');
  onlyWithSummary = signal<boolean>(false);

  // UI state
  loading = signal<boolean>(true);
  expanded = signal<Set<string>>(new Set());
  expandedArray = computed<string[]>(() => Array.from(this.expanded()));

  // Derived view model
  filteredChapters = computed<Chapter[]>(() => {
    const s = this.story();
    if (!s) return [] as Chapter[];
    const q = this.query().toLowerCase().trim();
    const onlySumm = this.onlyWithSummary();
    const chapters = Array.isArray(s.chapters) ? s.chapters : [];
    return chapters.map((ch) => ({
      ...ch,
      scenes: ch.scenes.filter(sc => {
        if (onlySumm && !sc.summary) return false;
        if (!q) return true;
        const hay = `${ch.title}\n${sc.title}\n${sc.summary || ''}`.toLowerCase();
        return hay.includes(q);
      })
    })).filter(ch => ch.scenes.length > 0);
  });

  constructor() {
    addIcons({ arrowBack, openOutline, clipboardOutline, copyOutline, refreshOutline, createOutline, saveOutline, closeOutline });
  }

  async ngOnInit(): Promise<void> {
    const storyId = this.route.snapshot.paramMap.get('id');
    if (!storyId) {
      this.router.navigate(['/']);
      return;
    }
    await this.loadStory(storyId);
    this.setupHeader(storyId);
  }

  private async loadStory(id: string) {
    this.loading.set(true);
    try {
      const s = await this.storyService.getStory(id);
      if (!s) {
        this.router.navigate(['/']);
        return;
      }
      this.story.set(s);
      // Expand all chapters by default for quick overview
      const all = new Set<string>(s.chapters.map(c => c.id));
      this.expanded.set(all);
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
        if (!sc.summary && this.onlyWithSummary()) continue;
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
}
