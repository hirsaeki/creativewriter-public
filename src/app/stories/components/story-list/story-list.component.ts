import { Component, OnInit, OnDestroy, TemplateRef, ViewChild, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
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

/**
 * Unified loading state for story list
 * Replaces multiple boolean flags for clearer state management
 */
export enum LoadingState {
  INITIAL = 'initial',     // App just started, no data yet
  SYNCING = 'syncing',     // Syncing stories from cloud (first-time or bootstrap)
  LOADING = 'loading',     // Loading from local database
  READY = 'ready',         // Stories loaded and ready
  EMPTY = 'empty'          // No stories exist
}

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

  // Unified loading state
  loadingState: LoadingState = LoadingState.INITIAL;

  // Backward-compatible getters for templates
  get isLoadingStories(): boolean {
    return this.loadingState === LoadingState.LOADING ||
           this.loadingState === LoadingState.INITIAL ||
           this.loadingState === LoadingState.SYNCING;
  }

  get isSyncingInitialData(): boolean {
    return this.loadingState === LoadingState.SYNCING;
  }

  // Sync status for loading indicator
  syncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    isSync: false
  };

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
        this.loadingState = LoadingState.LOADING;
        this.loadStories().then(() => {
          this.setupRightActions();
          // loadStories sets final state (READY or EMPTY)
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

        // If we're in INITIAL state and sync is active, switch to SYNCING
        if (this.loadingState === LoadingState.INITIAL &&
            (status.isSync || status.isConnecting)) {
          this.loadingState = LoadingState.SYNCING;
        }

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
      // Only set LOADING if not already SYNCING (preserve sync state)
      if (this.loadingState !== LoadingState.SYNCING) {
        this.loadingState = LoadingState.LOADING;
      }
    } else {
      this.isLoadingMore = true;
    }

    try {
      // Note: We no longer wait for initial sync here. Instead:
      // - If sync is in progress and metadata index fails, we fall back to full story load
      // - If that also fails, we trigger bootstrap sync (which properly waits)
      // - When sync completes (paused event), syncStatus$ triggers a reload automatically

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

      // Set final loading state based on whether we have stories
      if (this.stories.length > 0) {
        this.loadingState = LoadingState.READY;
        // Check for missing stories after loading (only on reset/initial load)
        if (reset) {
          this.checkForMissingStories();
        }
      } else if (this.syncStatus.isSync || this.syncStatus.isConnecting) {
        // Sync is in progress - show syncing state
        this.loadingState = LoadingState.SYNCING;
      } else if (reset && this.currentUser) {
        // No stories locally - check if remote has stories we should sync
        // This handles both fresh install and selective sync filter scenarios
        console.info('[StoryList] No stories found - checking remote for stories to sync');
        this.loadingState = LoadingState.SYNCING;
        this.cdr.markForCheck();

        const missingCheck = await this.databaseService.checkForMissingStories();
        if (missingCheck && missingCheck.remoteCount > 0) {
          console.info(`[StoryList] Remote has ${missingCheck.remoteCount} stories - triggering bootstrap sync`);
          await this.triggerBootstrapSync();
          return; // Exit - bootstrap sync handled everything
        } else {
          // Truly empty - no stories locally or remotely
          console.info('[StoryList] No stories found locally or remotely');
          this.loadingState = LoadingState.EMPTY;
        }
      } else {
        // Not logged in and no stories - show empty
        this.loadingState = LoadingState.EMPTY;
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

        // BOOTSTRAP SYNC: If local DB is empty but we have a remote connection,
        // it likely means the selective sync filter is blocking story documents.
        // Enable bootstrap mode to sync ALL documents and populate the database.
        if (newStories.length === 0 && reset && this.currentUser) {
          const missingCheck = await this.databaseService.checkForMissingStories();
          if (missingCheck && missingCheck.remoteCount > 0) {
            console.info('[StoryList] Fallback: Local DB empty but remote has stories - triggering bootstrap sync');
            this.loadingState = LoadingState.SYNCING;
            this.cdr.markForCheck();
            await this.triggerBootstrapSync();
            return; // Exit early, bootstrap sync handled everything
          }
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
      // Set final state if not already set (e.g., by bootstrap sync early return)
      if (this.loadingState === LoadingState.LOADING ||
          this.loadingState === LoadingState.INITIAL) {
        this.loadingState = this.stories.length > 0 ? LoadingState.READY : LoadingState.EMPTY;
      }
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
    switch (this.loadingState) {
      case LoadingState.SYNCING:
        if (this.syncStatus.isConnecting) {
          return 'Connecting to cloud storage...';
        }
        if (this.syncStatus.syncProgress) {
          const progress = this.syncStatus.syncProgress;
          if (progress.docsProcessed > 0) {
            return `Syncing... (${progress.docsProcessed} items)`;
          }
          if (progress.pendingDocs !== undefined && progress.pendingDocs > 0) {
            return `Syncing ${progress.pendingDocs} ${progress.pendingDocs === 1 ? 'item' : 'items'}...`;
          }
        }
        return 'Syncing stories from cloud...';
      case LoadingState.LOADING:
        return 'Loading stories...';
      case LoadingState.INITIAL:
        return 'Preparing...';
      default:
        return 'Loading...';
    }
  }

  /**
   * Get loading subtext for additional context
   */
  getLoadingSubtext(): string | null {
    if (this.loadingState === LoadingState.SYNCING) {
      return 'First time loading may take a moment';
    }
    return null;
  }

  /**
   * Trigger bootstrap sync to load all stories from remote
   * Used when local database is empty but remote has stories
   */
  private async triggerBootstrapSync(): Promise<void> {
    try {
      const result = await this.databaseService.enableBootstrapSync();
      console.info(`[StoryList] Bootstrap sync completed: ${result.docsProcessed} docs synced`);

      // Reload stories after bootstrap sync
      const bootstrappedStories = await this.storyService.getAllStories(
        this.pageSize,
        0
      );
      this.totalStories = await this.storyService.getTotalStoriesCount();

      // Map Story to StoryMetadata for display
      const bootstrappedMetadata: StoryMetadata[] = bootstrappedStories.map(story => ({
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

      this.stories = bootstrappedMetadata;
      this.hasMoreStories = bootstrappedStories.length === this.pageSize && this.totalStories > this.pageSize;

      // Rebuild the metadata index from the newly synced stories
      console.info('[StoryList] Rebuilding metadata index after bootstrap sync');
      try {
        await this.metadataIndexService.rebuildIndex(true); // force=true since we just synced
      } catch (indexError) {
        console.warn('[StoryList] Failed to rebuild metadata index:', indexError);
        // Not critical - index will be rebuilt naturally as stories are modified
      }

      // Set state based on whether bootstrap succeeded
      this.loadingState = this.stories.length > 0 ? LoadingState.READY : LoadingState.EMPTY;
    } catch (bootstrapError) {
      console.error('[StoryList] Bootstrap sync failed:', bootstrapError);
      this.loadingState = LoadingState.EMPTY;
    } finally {
      this.cdr.markForCheck();
    }
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
