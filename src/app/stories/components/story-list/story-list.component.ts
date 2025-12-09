import { Component, OnInit, OnDestroy, TemplateRef, ViewChild, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonChip, IonIcon, IonButton,
  IonContent, IonLabel, IonSpinner, ActionSheetController, ToastController
} from '@ionic/angular/standalone';
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { addIcons } from 'ionicons';
import { add, download, settings, statsChart, trash, create, images, menu, close, reorderThree, swapVertical, move, appsOutline, cloudDownload, warning, checkmarkCircle, alertCircle, sync } from 'ionicons/icons';
import { StoryService } from '../../services/story.service';
import { StoryMetadata } from '../../models/story-metadata.interface';
import { StoryMetadataIndexService } from '../../services/story-metadata-index.service';
import { StoryLanguage } from '../../../ui/components/language-selection-dialog/language-selection-dialog.component';
import { NarrativePerspective } from '../../models/story.interface';
import { SyncStatusComponent } from '../../../ui/components/sync-status.component';
import { LoginComponent } from '../../../ui/components/login.component';
import { AuthService, User } from '../../../core/services/auth.service';
import { AppHeaderComponent, BurgerMenuItem, HeaderAction } from '../../../ui/components/app-header.component';
import { HeaderNavigationService } from '../../../shared/services/header-navigation.service';
import { VersionService } from '../../../core/services/version.service';
import { DatabaseService, SyncStatus } from '../../../core/services/database.service';

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
  private metadataIndexService = inject(StoryMetadataIndexService);
  private router = inject(Router);
  private authService = inject(AuthService);
  private headerNavService = inject(HeaderNavigationService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  private actionSheetCtrl = inject(ActionSheetController);
  private toastCtrl = inject(ToastController);
  private databaseService = inject(DatabaseService);
  private destroy$ = new Subject<void>();
  versionService = inject(VersionService);
  private lastSyncTime: Date | undefined;

  @ViewChild('burgerMenuFooter', { static: true }) burgerMenuFooter!: TemplateRef<unknown>;
  stories: StoryMetadata[] = [];
  currentUser: User | null = null;
  fabMenuOpen = false;
  burgerMenuItems: BurgerMenuItem[] = [];
  rightActions: HeaderAction[] = [];
  reorderingEnabled = false;
  isLoadingStories = true;

  // Sync status for loading indicator
  syncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    isSync: false
  };
  isSyncingInitialData = false;

  // Pagination support
  pageSize = 50;  // Load 50 stories at a time
  currentPage = 0;
  totalStories = 0;
  hasMoreStories = false;
  isLoadingMore = false;

  // Missing stories check
  missingStoriesInfo: { localCount: number; remoteCount: number } | null = null;
  isCheckingMissingStories = false;
  isSyncingMissingStories = false;

  constructor() {
    // Register Ionic icons
    addIcons({ add, download, settings, statsChart, trash, create, images, menu, close, reorderThree, swapVertical, move, appsOutline, cloudDownload, warning, checkmarkCircle, alertCircle, sync });
  }

  /**
   * Get the count of missing stories (remote - local)
   * Used in template to avoid repeated calculations
   */
  get missingStoriesCount(): number {
    return this.missingStoriesInfo
      ? this.missingStoriesInfo.remoteCount - this.missingStoriesInfo.localCount
      : 0;
  }

  ngOnInit(): void {
    // Clear active story for selective sync - when at story list, sync all stories
    this.databaseService.setActiveStoryId(null);

    // Subscribe to user changes FIRST (before initial load)
    // This prevents duplicate loads on initialization
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        // Reload stories when user changes (different database)
        this.isLoadingStories = true;
        this.loadStories().then(() => {
          this.setupRightActions();
          this.isLoadingStories = false;
          this.cdr.markForCheck();
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
        this.syncStatus = status;

        // Determine if we're in initial sync state (no stories + syncing/connecting)
        this.isSyncingInitialData = this.stories.length === 0 &&
                                     (status.isSync || status.isConnecting || false);

        // Check if sync just completed (has lastSync and it's different from our last known sync)
        if (status.lastSync && (!this.lastSyncTime || status.lastSync > this.lastSyncTime)) {
          this.lastSyncTime = status.lastSync;
          // Reload stories when sync brings in new changes
          this.loadStories().then(() => {
            // Explicitly trigger change detection since we use OnPush strategy
            this.cdr.markForCheck();
          });
        } else {
          // Trigger change detection for sync status updates
          this.cdr.markForCheck();
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
    if (reset) {
      this.currentPage = 0;
      this.stories = [];
      this.isLoadingStories = true;
    } else {
      this.isLoadingMore = true;
    }

    try {
      // BUGFIX: Wait for initial sync to complete if database is fresh
      // This prevents race condition where we try to load before metadata index has synced
      if (reset && this.syncStatus.isSync) {
        console.info('[StoryList] Waiting for initial sync to complete before loading metadata index');
        await this.waitForInitialSync();
      }

      // Load story metadata from index (lightweight)
      const index = await this.metadataIndexService.getMetadataIndex();

      // Sort stories by order field (ascending), then by updatedAt (descending)
      const sortedStories = [...index.stories].sort((a, b) => {
        // First sort by order if both have it
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        // Stories with order come before those without
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        // Fall back to updatedAt (newest first)
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });

      // Implement pagination on metadata
      const startIndex = this.currentPage * this.pageSize;
      const endIndex = startIndex + this.pageSize;
      const newStories = sortedStories.slice(startIndex, endIndex);

      // Get total count
      if (reset) {
        this.totalStories = sortedStories.length;
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

      // Update initial sync status based on loaded stories
      this.isSyncingInitialData = this.stories.length === 0 &&
                                   (this.syncStatus.isSync || this.syncStatus.isConnecting || false);

      // Check for missing stories after loading (only on reset/initial load)
      if (reset && this.stories.length > 0) {
        this.checkForMissingStories();
      }

    } catch (error) {
      console.error('[StoryList] Failed to load metadata index, falling back to full stories:', error);
      // Fallback to loading full stories if metadata index fails
      try {
        const newStories = await this.storyService.getAllStories(
          this.pageSize,
          this.currentPage * this.pageSize
        );

        if (reset) {
          this.totalStories = await this.storyService.getTotalStoriesCount();
        }

        // Map Story to StoryMetadata for display
        const metadata: StoryMetadata[] = newStories.map(story => ({
          id: story.id,
          title: story.title,
          coverImageThumbnail: story.coverImage,
          previewText: this.storyService.getStoryPreview(story),
          chapterCount: story.chapters.length,
          sceneCount: story.chapters.reduce((sum, ch) => sum + ch.scenes.length, 0),
          wordCount: this.storyService.getWordCount(story),
          createdAt: story.createdAt,
          updatedAt: story.updatedAt,
          order: story.order
        }));

        if (reset) {
          this.stories = metadata;
        } else {
          this.stories = [...this.stories, ...metadata];
        }

        const loadedCount = (this.currentPage + 1) * this.pageSize;
        this.hasMoreStories = loadedCount < this.totalStories && newStories.length === this.pageSize;

      } catch (fallbackError) {
        console.error('[StoryList] Fallback loading also failed:', fallbackError);
        throw fallbackError;
      }
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

  /**
   * Wait for initial sync to complete (used after browser data deletion)
   * BUGFIX: Prevents race condition where we try to load metadata index
   * before it has synced from remote
   */
  private async waitForInitialSync(timeoutMs = 60000): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let syncSubscription: Subscription | null = null;

      const checkAndResolve = () => {
        if (syncSubscription) {
          syncSubscription.unsubscribe();
        }
        resolve();
      };

      // Subscribe to sync status changes
      syncSubscription = this.databaseService.syncStatus$.subscribe(status => {
        // Check timeout
        if (Date.now() - startTime >= timeoutMs) {
          console.warn('[StoryList] Initial sync wait timed out, proceeding anyway');
          checkAndResolve();
          return;
        }

        // Wait for sync to complete (not syncing and has synced at least once)
        if (!status.isSync && !status.isConnecting && status.lastSync) {
          console.info('[StoryList] Initial sync completed, loading metadata index');
          checkAndResolve();
        }
      });

      // Hard timeout as backup
      setTimeout(() => {
        console.warn('[StoryList] Hard timeout reached for initial sync wait');
        checkAndResolve();
      }, timeoutMs);
    });
  }

  async drop(event: CdkDragDrop<StoryMetadata[]>): Promise<void> {
    if (event.previousIndex !== event.currentIndex) {
      // Move item in local array
      moveItemInArray(this.stories, event.previousIndex, event.currentIndex);

      try {
        // Update the order field for each story based on new position
        const updatedStories = this.stories.map((story, index) => ({
          ...story,
          order: index
        }));

        // Update metadata index with new order
        for (const story of updatedStories) {
          // Load full story, update order, save
          const fullStory = await this.storyService.getStory(story.id);
          if (fullStory) {
            fullStory.order = story.order;
            await this.storyService.updateStory(fullStory);
          }
        }

        this.stories = updatedStories;
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
    // Show POV selection action sheet
    const povSheet = await this.actionSheetCtrl.create({
      header: 'Select Narrative Perspective',
      subHeader: 'Choose the point of view for your story. This can be changed later in story settings.',
      cssClass: 'pov-selection-action-sheet',
      buttons: [
        {
          text: 'Third Person Limited (Recommended)',
          data: { pov: 'third-person-limited' },
          handler: () => this.createStoryWithSettings(language as StoryLanguage, 'third-person-limited')
        },
        {
          text: 'First Person',
          data: { pov: 'first-person' },
          handler: () => this.createStoryWithSettings(language as StoryLanguage, 'first-person')
        },
        {
          text: 'Third Person Omniscient',
          data: { pov: 'third-person-omniscient' },
          handler: () => this.createStoryWithSettings(language as StoryLanguage, 'third-person-omniscient')
        },
        {
          text: 'Second Person',
          data: { pov: 'second-person' },
          handler: () => this.createStoryWithSettings(language as StoryLanguage, 'second-person')
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });

    await povSheet.present();
  }

  private async createStoryWithSettings(language: StoryLanguage, pov: NarrativePerspective): Promise<void> {
    const newStory = await this.storyService.createStory(language, pov);
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

  getStoryPreview(story: StoryMetadata): string {
    // Metadata already includes preview text
    return story.previewText;
  }

  getWordCount(story: StoryMetadata): number {
    // Metadata already includes word count
    return story.wordCount;
  }

  getCoverImageUrl(story: StoryMetadata): string | null {
    if (!story.coverImageThumbnail) return null;
    return `data:image/png;base64,${story.coverImageThumbnail}`;
  }

  trackByStoryId(index: number, story: StoryMetadata): string {
    return story.id;
  }

  /**
   * Get loading message based on current state
   */
  getLoadingMessage(): string {
    if (this.isSyncingInitialData) {
      if (this.syncStatus.isConnecting) {
        return 'Connecting to cloud storage...';
      }
      if (this.syncStatus.syncProgress) {
        const progress = this.syncStatus.syncProgress;
        if (progress.pendingDocs !== undefined && progress.pendingDocs > 0) {
          return `Syncing ${progress.pendingDocs} ${progress.pendingDocs === 1 ? 'story' : 'stories'}...`;
        }
        if (progress.docsProcessed > 0) {
          return `Syncing stories (${progress.docsProcessed} loaded)...`;
        }
      }
      return 'Syncing stories from cloud...';
    }
    return 'Loading stories...';
  }

  /**
   * Get loading subtext for additional context
   */
  getLoadingSubtext(): string | null {
    if (this.isSyncingInitialData) {
      return 'First time loading may take a moment';
    }
    return null;
  }

  /**
   * Check if there are stories in the remote database that are missing locally
   */
  async checkForMissingStories(): Promise<void> {
    if (this.isCheckingMissingStories) {
      return;
    }

    this.isCheckingMissingStories = true;
    try {
      const result = await this.databaseService.checkForMissingStories();

      if (result && result.hasMissing) {
        this.missingStoriesInfo = {
          localCount: result.localCount,
          remoteCount: result.remoteCount
        };
      } else {
        this.missingStoriesInfo = null;
      }

      this.cdr.markForCheck();
    } catch (error) {
      console.error('[StoryList] Error checking for missing stories:', error);
    } finally {
      this.isCheckingMissingStories = false;
    }
  }

  /**
   * Sync missing stories from remote database
   */
  async syncMissingStories(): Promise<void> {
    if (this.isSyncingMissingStories) {
      return;
    }

    this.isSyncingMissingStories = true;
    this.cdr.markForCheck();

    try {
      // Trigger a manual pull to get missing stories
      const result = await this.databaseService.forcePull();

      // Clear the missing stories banner
      this.missingStoriesInfo = null;

      // Reload stories to show the newly synced ones
      await this.loadStories();

      // Show success toast
      const toast = await this.toastCtrl.create({
        message: `Successfully synced ${result.docsProcessed} document${result.docsProcessed === 1 ? '' : 's'} from cloud`,
        duration: 3000,
        position: 'bottom',
        color: 'success',
        icon: 'checkmark-circle'
      });
      await toast.present();
    } catch (error) {
      console.error('[StoryList] Error syncing missing stories:', error);

      // Show error toast
      const toast = await this.toastCtrl.create({
        message: 'Failed to sync stories. Please check your connection and try again.',
        duration: 4000,
        position: 'bottom',
        color: 'danger',
        icon: 'alert-circle',
        buttons: [
          {
            text: 'Dismiss',
            role: 'cancel'
          }
        ]
      });
      await toast.present();
    } finally {
      this.isSyncingMissingStories = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Dismiss the missing stories banner
   */
  dismissMissingStoriesBanner(): void {
    this.missingStoriesInfo = null;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
