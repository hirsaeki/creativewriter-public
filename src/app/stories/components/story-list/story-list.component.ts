import { Component, OnInit, OnDestroy, TemplateRef, ViewChild, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonChip, IonIcon, IonButton,
  IonContent, IonLabel, IonSpinner, ActionSheetController
} from '@ionic/angular/standalone';
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { addIcons } from 'ionicons';
import { add, download, settings, statsChart, trash, create, images, menu, close, reorderThree, swapVertical, move, appsOutline } from 'ionicons/icons';
import { StoryService } from '../../services/story.service';
import { Story } from '../../models/story.interface';
import { StoryLanguage } from '../../../ui/components/language-selection-dialog/language-selection-dialog.component';
import { SyncStatusComponent } from '../../../ui/components/sync-status.component';
import { LoginComponent } from '../../../ui/components/login.component';
import { AuthService, User } from '../../../core/services/auth.service';
import { AppHeaderComponent, BurgerMenuItem, HeaderAction } from '../../../ui/components/app-header.component';
import { HeaderNavigationService } from '../../../shared/services/header-navigation.service';
import { VersionService } from '../../../core/services/version.service';
import { DatabaseService } from '../../../core/services/database.service';

@Component({
  selector: 'app-story-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonChip, IonIcon, IonButton,
    IonContent, IonLabel, IonSpinner,
    CdkDropList, CdkDrag,
    SyncStatusComponent, LoginComponent, AppHeaderComponent
  ],
  templateUrl: './story-list.component.html',
  styleUrls: ['./story-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StoryListComponent implements OnInit, OnDestroy {
  private storyService = inject(StoryService);
  private router = inject(Router);
  private authService = inject(AuthService);
  private headerNavService = inject(HeaderNavigationService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  private actionSheetCtrl = inject(ActionSheetController);
  private databaseService = inject(DatabaseService);
  private destroy$ = new Subject<void>();
  versionService = inject(VersionService);
  private lastSyncTime: Date | undefined;

  @ViewChild('burgerMenuFooter', { static: true }) burgerMenuFooter!: TemplateRef<unknown>;
  stories: Story[] = [];
  currentUser: User | null = null;
  fabMenuOpen = false;
  burgerMenuItems: BurgerMenuItem[] = [];
  rightActions: HeaderAction[] = [];
  reorderingEnabled = false;
  isLoadingStories = true;

  // Pagination support
  pageSize = 50;  // Load 50 stories at a time
  currentPage = 0;
  totalStories = 0;
  hasMoreStories = false;
  isLoadingMore = false;

  constructor() {
    // Register Ionic icons
    addIcons({ add, download, settings, statsChart, trash, create, images, menu, close, reorderThree, swapVertical, move, appsOutline });
  }

  ngOnInit(): void {
    console.log('[StoryList] ngOnInit started');
    const initStart = performance.now();

    // Subscribe to user changes FIRST (before initial load)
    // This prevents duplicate loads on initialization
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        console.log('[StoryList] User changed:', user?.username || 'anonymous');
        this.currentUser = user;
        // Reload stories when user changes (different database)
        this.isLoadingStories = true;
        this.loadStories().then(() => {
          this.setupRightActions();
          this.isLoadingStories = false;
          this.cdr.markForCheck();
          const elapsed = performance.now() - initStart;
          console.log(`[StoryList] Total init time: ${elapsed.toFixed(0)}ms`);
        });
      });

    // Subscribe to version changes and setup right actions when version is available
    this.versionService.version$
      .pipe(takeUntil(this.destroy$))
      .subscribe(version => {
        if (version) {
          this.setupRightActions();
          this.cdr.markForCheck();
        }
      });

    // Subscribe to sync status changes to reload stories when sync completes
    this.databaseService.syncStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        // Check if sync just completed (has lastSync and it's different from our last known sync)
        if (status.lastSync && (!this.lastSyncTime || status.lastSync > this.lastSyncTime)) {
          this.lastSyncTime = status.lastSync;
          // Reload stories when sync brings in new changes
          this.loadStories().then(() => {
            // Explicitly trigger change detection since we use OnPush strategy
            this.cdr.markForCheck();
          });
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

  async loadStories(reset = true): Promise<void> {
    const loadStart = performance.now();
    console.log('[StoryList] loadStories started, reset:', reset);

    if (reset) {
      this.currentPage = 0;
      this.stories = [];
      this.isLoadingStories = true;
    } else {
      this.isLoadingMore = true;
    }

    try {
      // Load stories for current page
      const queryStart = performance.now();
      const newStories = await this.storyService.getAllStories(
        this.pageSize,
        this.currentPage * this.pageSize
      );
      const queryTime = performance.now() - queryStart;
      console.log(`[StoryList] Query time: ${queryTime.toFixed(0)}ms, returned ${newStories.length} stories`);

      // Get total count (only on first load for efficiency)
      if (reset) {
        const countStart = performance.now();
        this.totalStories = await this.storyService.getTotalStoriesCount();
        const countTime = performance.now() - countStart;
        console.log(`[StoryList] Count query time: ${countTime.toFixed(0)}ms, total: ${this.totalStories}`);
      }

      // Append or replace stories
      if (reset) {
        this.stories = newStories;
      } else {
        this.stories = [...this.stories, ...newStories];
      }

      // Check if there are more stories to load
      const loadedCount = (this.currentPage + 1) * this.pageSize;
      this.hasMoreStories = loadedCount < this.totalStories && newStories.length === this.pageSize;

      const totalTime = performance.now() - loadStart;
      console.log(`[StoryList] loadStories completed in ${totalTime.toFixed(0)}ms`);

    } finally {
      this.isLoadingStories = false;
      this.isLoadingMore = false;
      this.cdr.markForCheck();
    }
  }

  async loadMoreStories(): Promise<void> {
    if (this.isLoadingMore || !this.hasMoreStories) {
      return;
    }

    this.currentPage++;
    await this.loadStories(false);
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
    
    // Show language selection action sheet
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Select Story Language',
      subHeader: 'Choose the language for your story. This will set the AI assistant\'s language for generating content.',
      cssClass: 'language-selection-action-sheet',
      buttons: [
        {
          text: 'English',
          data: { language: 'en' },
          handler: () => this.handleLanguageSelection('en')
        },
        {
          text: 'Deutsch',
          data: { language: 'de' },
          handler: () => this.handleLanguageSelection('de')
        },
        {
          text: 'Français', 
          data: { language: 'fr' },
          handler: () => this.handleLanguageSelection('fr')
        },
        {
          text: 'Español',
          data: { language: 'es' },
          handler: () => this.handleLanguageSelection('es')
        },
        {
          text: 'Custom Language',
          data: { language: 'custom' },
          handler: () => this.handleLanguageSelection('custom')
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    
    await actionSheet.present();
  }

  private async handleLanguageSelection(language: string): Promise<void> {
    const newStory = await this.storyService.createStory(language as StoryLanguage);
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
      this.cdr.markForCheck();
    }
  }

  getStoryPreview(story: Story): string {
    // Delegate to service for caching
    return this.storyService.getStoryPreview(story);
  }

  getWordCount(story: Story): number {
    // Delegate to service for caching
    return this.storyService.getWordCount(story);
  }

  getCoverImageUrl(story: Story): string | null {
    if (!story.coverImage) return null;
    return `data:image/png;base64,${story.coverImage}`;
  }

  trackByStoryId(index: number, story: Story): string {
    return story._id || story.id;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
