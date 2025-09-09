import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
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

@Component({
  selector: 'app-cliche-analyzer',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
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

  storyId = '';
  story: Story | null = null;
  findings: { sceneId: string; sceneLabel: string; phrase: string }[] = [];

  burgerMenuItems: BurgerMenuItem[] = [];
  rightActions: HeaderAction[] = [];

  constructor() {
    addIcons({ arrowBack, search });
    // Reuse common items so navigation stays consistent
    this.burgerMenuItems = this.headerNav.getCommonBurgerMenuItems();
    this.rightActions = [{
      icon: 'search',
      label: 'Analyze',
      action: () => this.analyze(),
      showOnMobile: true,
      showOnDesktop: true,
      tooltip: 'Analyze story for clichés'
    }];
  }

  async ngOnInit(): Promise<void> {
    this.storyId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.storyId) return;
    this.story = await this.storyService.getStory(this.storyId);
    this.analyze();
  }

  goBack(): void {
    // Navigate back to the story editor if we have a story, else to list
    if (this.storyId) {
      this.router.navigate(['/stories/editor', this.storyId]);
    } else {
      this.headerNav.goToStoryList();
    }
  }

  analyze(): void {
    const story = this.story;
    if (!story) { this.findings = []; return; }
    const lang = story.settings?.language || 'en';
    const patterns = this.getClichePatterns(lang);

    const results: { sceneId: string; sceneLabel: string; phrase: string }[] = [];
    story.chapters?.forEach(ch => {
      ch.scenes?.forEach(sc => {
        const text = this.stripHtmlTags(sc.content || '');
        const sentences = this.splitSentences(text);
        const sceneLabel = `C${ch.chapterNumber || ch.order}S${sc.sceneNumber || sc.order}`;
        sentences.forEach(s => {
          patterns.forEach(re => {
            let m: RegExpExecArray | null;
            // reset lastIndex for global regex
            re.lastIndex = 0;
            while ((m = re.exec(s)) !== null) {
              const phrase = m[0];
              results.push({ sceneId: sc.id, sceneLabel, phrase });
              // avoid duplicate matches of same phrase in same sentence position
              if (!re.global) { break; }
            }
          });
        });
      });
    });
    // De-duplicate identical scene+phrase pairs
    const seen = new Set<string>();
    this.findings = results.filter(r => {
      const key = `${r.sceneId}|${r.phrase.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
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

  private splitSentences(text: string): string[] {
    if (!text) return [];
    // Basic sentence splitter that respects ., !, ?, … and quotes
    const parts = text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?…]["\]'}»”)]?)(?:\s+|$)/u)
      .map(s => s.trim())
      .filter(Boolean);
    return parts;
  }

  private getClichePatterns(lang: string): RegExp[] {
    const en = [
      /\b(at the end of the day)\b/gi,
      /\b(love at first sight)\b/gi,
      /\b(stronger than ever)\b/gi,
      /\b(out of the blue)\b/gi,
      /\b(all of a sudden)\b/gi,
      /\b(suddenly)\b/g,
      /\b(before (?:he|she|they) knew it)\b/gi,
      /\b(it was a dark and stormy night)\b/gi,
      /\b(heart(?:s)? (?:was|were)?\s*pounding)\b/gi,
      /\b(cold sweat)\b/gi,
      /\b(every fiber of (?:his|her|their) being)\b/gi
    ];
    const de = [
      /\b(am ende des tages)\b/gi,
      /\b(liebe auf den ersten blick)\b/gi,
      /\b(wie aus heiterem himmel)\b/gi,
      /\b(stärker als je zuvor)\b/gi,
      /\b(plötzlich)\b/g,
      /\b(schlug (?:ihr|sein) herz.*? (?:bis zum hals))\b/gi,
      /\b(kalter schweiß)\b/gi
    ];
    if (lang === 'de') return de;
    if (lang === 'en') return en;
    // For unknown/custom, check both sets
    return [...en, ...de];
  }
}
