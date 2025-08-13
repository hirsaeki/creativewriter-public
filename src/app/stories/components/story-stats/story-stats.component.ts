import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel,
  IonGrid, IonRow, IonCol, IonChip, IonList
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  close, statsChartOutline, bookOutline, documentTextOutline, 
  timeOutline, trendingUpOutline, trendingDownOutline, layersOutline, serverOutline, analyticsOutline
} from 'ionicons/icons';
import { Story } from '../../models/story.interface';
import { StoryStatsService } from '../../services/story-stats.service';

export interface StoryStatistics {
  totalWords: number;
  chapterCounts: { 
    chapterId: string; 
    chapterTitle: string; 
    wordCount: number; 
    sceneCount: number;
    averageWordsPerScene: number;
  }[];
  totalScenes: number;
  totalChapters: number;
  averageWordsPerChapter: number;
  averageWordsPerScene: number;
  longestChapter: { title: string; wordCount: number; } | null;
  shortestChapter: { title: string; wordCount: number; } | null;
  storageUsage: {
    storySize: number;
    storySizeFormatted: string;
    storyTextSize: number;
    storyTextSizeFormatted: string;
    storyImageSize: number;
    storyImageSizeFormatted: string;
    storyImageCount: number;
    totalLocalStorage: number;
    totalLocalStorageFormatted: string;
    percentageUsed: number;
  };
}

@Component({
  selector: 'app-story-stats',
  standalone: true,
  imports: [
    CommonModule,
    IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel,
    IonGrid, IonRow, IonCol, IonChip, IonList
  ],
  templateUrl: './story-stats.component.html',
  styleUrls: ['./story-stats.component.scss']
})
export class StoryStatsComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() story: Story | null = null;
  @Output() closed = new EventEmitter<void>();

  statistics: StoryStatistics | null = null;
  showDetailedBreakdown = true; // Show detailed breakdown button

  private readonly storyStatsService = inject(StoryStatsService);

  constructor() {
    addIcons({ 
      close, statsChartOutline, bookOutline, documentTextOutline, 
      timeOutline, trendingUpOutline, trendingDownOutline, layersOutline, serverOutline, analyticsOutline
    });
  }

  ngOnInit(): void {
    if (this.story && this.isOpen) {
      this.calculateStatistics();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue && this.story) {
      this.calculateStatistics();
    }
  }


  onClose(): void {
    this.closed.emit();
  }

  private calculateStatistics(): void {
    if (!this.story) return;

    const stats = this.storyStatsService.getStoryWordCountStats(this.story);

    // Enhanced statistics
    const enhancedChapterCounts = stats.chapterCounts.map(chapter => ({
      ...chapter,
      averageWordsPerScene: chapter.sceneCount > 0 ? Math.round(chapter.wordCount / chapter.sceneCount) : 0
    }));

    // Find longest and shortest chapters
    const sortedChapters = [...enhancedChapterCounts].sort((a, b) => b.wordCount - a.wordCount);
    const longestChapter = sortedChapters.length > 0 ? {
      title: sortedChapters[0].chapterTitle,
      wordCount: sortedChapters[0].wordCount
    } : null;
    
    const shortestChapter = sortedChapters.length > 1 ? {
      title: sortedChapters[sortedChapters.length - 1].chapterTitle,
      wordCount: sortedChapters[sortedChapters.length - 1].wordCount
    } : null;

    this.statistics = {
      ...stats,
      chapterCounts: enhancedChapterCounts,
      averageWordsPerChapter: stats.totalChapters > 0 ? Math.round(stats.totalWords / stats.totalChapters) : 0,
      averageWordsPerScene: stats.totalScenes > 0 ? Math.round(stats.totalWords / stats.totalScenes) : 0,
      longestChapter,
      shortestChapter
    };
  }

  getEstimatedReadingTime(): number {
    if (!this.statistics) return 0;
    // Average reading speed: 200-250 words per minute, we use 225
    return Math.round(this.statistics.totalWords / 225);
  }

  getChapterChipColor(wordCount: number): string {
    if (!this.statistics) return 'medium';
    
    const average = this.statistics.averageWordsPerChapter;
    if (wordCount > average * 1.2) return 'success';
    if (wordCount < average * 0.8) return 'warning';
    return 'primary';
  }

  trackChapter(index: number, chapter: {chapterId: string}): string {
    return chapter.chapterId;
  }

  showProgressInfo(): boolean {
    return this.statistics !== null && this.statistics.totalWords > 0;
  }

  getNovellaStatus(): string {
    if (!this.statistics) return '0%';
    // Novella: 17,500 - 40,000 words
    const progress = Math.min(100, (this.statistics.totalWords / 17500) * 100);
    return Math.round(progress) + '%';
  }

  getNovelStatus(): string {
    if (!this.statistics) return '0%';
    // Novel: 40,000+ words
    const progress = Math.min(100, (this.statistics.totalWords / 40000) * 100);
    return Math.round(progress) + '%';
  }

  getEpicStatus(): string {
    if (!this.statistics) return '0%';
    // Epic: 200,000+ words
    const progress = Math.min(100, (this.statistics.totalWords / 200000) * 100);
    return Math.round(progress) + '%';
  }

  toggleDetailedBreakdown(): void {
    // This could open a separate detailed breakdown modal
    // For now, just show an alert with detailed info
    const breakdown = this.storyStatsService.getDetailedStorageBreakdown();
    
    let message = `Detailed Storage Analysis:\n\n`;
    message += `Total Storage: ${breakdown.totalSizeFormatted}\n\n`;
    
    message += `localStorage entries:\n`;
    breakdown.items.forEach(item => {
      message += `• ${item.description}: ${item.sizeFormatted}\n`;
    });
    
    if (breakdown.storiesBreakdown.length > 0) {
      message += `\nStories Individual:\n`;
      breakdown.storiesBreakdown.forEach(story => {
        message += `• ${story.title}: ${story.sizeFormatted} (${story.textSizeFormatted} Text + ${story.imageSizeFormatted} Images [${story.imageCount}x])\n`;
      });
    }
    
    alert(message);
  }
}