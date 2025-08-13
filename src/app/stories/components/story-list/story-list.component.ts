import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonChip, IonIcon, IonButton, 
  IonContent, IonLabel
} from '@ionic/angular/standalone';
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { addIcons } from 'ionicons';
import { add, download, settings, statsChart, trash, create, images, menu, close, reorderThree, swapVertical, move, appsOutline } from 'ionicons/icons';
import { StoryService } from '../../services/story.service';
import { Story } from '../../models/story.interface';
import { SyncStatusComponent } from '../../../shared/components/sync-status.component';
import { LoginComponent } from '../../../shared/components/login.component';
import { AuthService, User } from '../../../core/services/auth.service';
import { AppHeaderComponent, BurgerMenuItem, HeaderAction } from '../../../shared/components/app-header.component';
import { HeaderNavigationService } from '../../../shared/services/header-navigation.service';
import { VersionService } from '../../../core/services/version.service';

@Component({
  selector: 'app-story-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonChip, IonIcon, IonButton, 
    IonContent, IonLabel,
    CdkDropList, CdkDrag,
    SyncStatusComponent, LoginComponent, AppHeaderComponent
  ],
  templateUrl: './story-list.component.html',
  styleUrls: ['./story-list.component.scss']
})
export class StoryListComponent implements OnInit {
  private storyService = inject(StoryService);
  private router = inject(Router);
  private authService = inject(AuthService);
  private headerNavService = inject(HeaderNavigationService);
  versionService = inject(VersionService);

  @ViewChild('burgerMenuFooter', { static: true }) burgerMenuFooter!: TemplateRef<unknown>;
  stories: Story[] = [];
  currentUser: User | null = null;
  fabMenuOpen = false;
  burgerMenuItems: BurgerMenuItem[] = [];
  rightActions: HeaderAction[] = [];
  reorderingEnabled = false;

  constructor() {
    // Register Ionic icons
    addIcons({ add, download, settings, statsChart, trash, create, images, menu, close, reorderThree, swapVertical, move, appsOutline });
  }

  ngOnInit(): void {
    this.loadStories().then(() => {
      // Setup right actions after stories are loaded
      this.setupRightActions();
    });
    
    // Subscribe to user changes
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      // Reload stories when user changes (different database)
      this.loadStories().then(() => {
        this.setupRightActions();
      });
    });
    
    // Subscribe to version changes and setup right actions when version is available
    this.versionService.version$.subscribe(version => {
      if (version) {
        this.setupRightActions();
      }
    });
    
    // Setup burger menu items
    this.setupBurgerMenu();
  }
  
  private setupRightActions(): void {
    this.rightActions = [];
    
    // Add reorder toggle button if there are multiple stories
    if (this.stories.length > 1) {
      this.rightActions.push({
        icon: 'apps-outline',
        action: () => this.toggleReordering(),
        showOnMobile: true,
        showOnDesktop: true,
        cssClass: this.reorderingEnabled ? 'reorder-active' : '',
        tooltip: this.reorderingEnabled ? 'End sorting' : 'Sort stories'
      });
    }
    
    // Add version chip (version is guaranteed to be available when this is called)
    this.rightActions.push({
      icon: '',
      chipContent: this.versionService.getShortVersion(),
      chipColor: 'medium',
      action: () => { /* No action needed for version chip */ },
      showOnMobile: true,
      showOnDesktop: true,
      showVersionTooltip: true
    });
  }

  logout(): void {
    if (confirm('Do you really want to sign out? Local changes will be preserved.')) {
      this.authService.logout();
    }
  }

  async loadStories(): Promise<void> {
    this.stories = await this.storyService.getAllStories();
  }

  async drop(event: CdkDragDrop<Story[]>): Promise<void> {
    if (event.previousIndex !== event.currentIndex) {
      // Move item in local array
      moveItemInArray(this.stories, event.previousIndex, event.currentIndex);
      
      try {
        // Persist the new order to the database
        await this.storyService.reorderStories(this.stories);
      } catch (error) {
        console.error('Failed to save story order:', error);
        // Reload stories to reset to previous state if save fails
        await this.loadStories();
      }
    }
  }
  
  toggleReordering(): void {
    this.reorderingEnabled = !this.reorderingEnabled;
    // Update the header actions to reflect the new state
    this.setupRightActions();
    
    // Optionally show feedback when toggling reorder mode
    if (this.reorderingEnabled) {
      console.log('Reordering mode enabled - drag stories to reorder');
    } else {
      console.log('Reordering mode disabled - click stories to open');
    }
  }

  toggleFabMenu(): void {
    this.fabMenuOpen = !this.fabMenuOpen;
  }

  onBurgerMenuToggle(): void {
    // Handle burger menu state changes if needed
  }
  
  private setupBurgerMenu(): void {
    this.burgerMenuItems = [
      ...this.headerNavService.getStoryBurgerMenuItems()
    ];
  }

  async createNewStory(): Promise<void> {
    this.fabMenuOpen = false;
    const newStory = await this.storyService.createStory();
    this.router.navigate(['/stories/editor', newStory.id]);
  }

  openStory(storyId: string): void {
    this.router.navigate(['/stories/editor', storyId]);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  goToAILogger(): void {
    this.router.navigate(['/logs']);
  }

  importNovelCrafter(): void {
    this.fabMenuOpen = false;
    this.router.navigate(['/stories/import/novelcrafter']);
  }

  goToImageGeneration(): void {
    this.fabMenuOpen = false;
    this.router.navigate(['/stories/image-generation']);
  }

  async deleteStory(event: Event, storyId: string): Promise<void> {
    event.stopPropagation();
    if (confirm('Do you really want to delete this story?')) {
      await this.storyService.deleteStory(storyId);
      await this.loadStories();
    }
  }

  getStoryPreview(story: Story): string {
    // For legacy stories with content
    if (story.content) {
      const cleanContent = this.stripHtmlTags(story.content);
      return cleanContent.length > 150 ? cleanContent.substring(0, 150) + '...' : cleanContent;
    }
    
    // For new chapter/scene structure
    if (story.chapters && story.chapters.length > 0 && story.chapters[0].scenes && story.chapters[0].scenes.length > 0) {
      const firstScene = story.chapters[0].scenes[0];
      const content = firstScene.content || '';
      const cleanContent = this.stripHtmlTags(content);
      return cleanContent.length > 150 ? cleanContent.substring(0, 150) + '...' : cleanContent;
    }
    
    return 'No content yet...';
  }

  getWordCount(story: Story): number {
    // For legacy stories with content
    if (story.content) {
      const cleanContent = this.stripHtmlTags(story.content);
      return cleanContent.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
    
    // For new chapter/scene structure - count all scenes
    let totalWords = 0;
    if (story.chapters) {
      story.chapters.forEach(chapter => {
        if (chapter.scenes) {
          chapter.scenes.forEach(scene => {
            const content = scene.content || '';
            const cleanContent = this.stripHtmlTags(content);
            totalWords += cleanContent.trim().split(/\s+/).filter(word => word.length > 0).length;
          });
        }
      });
    }
    
    return totalWords;
  }

  getCoverImageUrl(story: Story): string | null {
    if (!story.coverImage) return null;
    return `data:image/png;base64,${story.coverImage}`;
  }

  private stripHtmlTags(html: string): string {
    if (!html) return '';
    
    // First remove Beat AI nodes completely (they are editor-only components)
    const cleanHtml = html.replace(/<div[^>]*class="beat-ai-node"[^>]*>.*?<\/div>/gs, '');
    
    // Create a temporary DOM element to safely strip remaining HTML tags
    const div = document.createElement('div');
    div.innerHTML = cleanHtml;
    
    // Get text content and normalize whitespace
    const textContent = div.textContent || div.innerText || '';
    
    // Remove any remaining Beat AI artifacts that might appear as plain text
    return textContent
      .replace(/🎭\s*Beat\s*AI/gi, '')
      .replace(/Prompt:\s*/gi, '')
      .replace(/BeatAIPrompt/gi, '')
      .trim()
      .replace(/\s+/g, ' '); // Normalize whitespace
  }
}