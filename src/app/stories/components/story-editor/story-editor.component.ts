import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, ChangeDetectionStrategy, TemplateRef, HostListener, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonButton, IonIcon, IonSpinner,
  IonContent, IonChip, IonLabel, IonMenu, IonSplitPane, MenuController, LoadingController, ModalController, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBack, bookOutline, book, settingsOutline, statsChartOutline, statsChart,
  saveOutline, checkmarkCircleOutline, menuOutline, chevronBack, chevronForward,
  chatbubblesOutline, bugOutline, menu, close, images, documentTextOutline, heart, search,
  listOutline, list, flaskOutline, videocamOutline, timeOutline, personCircleOutline
} from 'ionicons/icons';
import { StoryService } from '../../services/story.service';
import { CodexService } from '../../services/codex.service';
import { Story, Scene } from '../../models/story.interface';
import { StoryStructureComponent } from '../story-structure/story-structure.component';
import { SlashCommandDropdownComponent } from '../slash-command-dropdown/slash-command-dropdown.component';
import { StoryStatsComponent } from '../story-stats/story-stats.component';
import { StoryMediaGalleryComponent } from '../story-media-gallery/story-media-gallery.component';
import { BeatNavigationPanelComponent } from '../beat-navigation-panel/beat-navigation-panel.component';
import { SlashCommandResult, SlashCommandAction } from '../../models/slash-command.interface';
import { Subscription, debounceTime, Subject, throttleTime } from 'rxjs';
import { ProseMirrorEditorService } from '../../../shared/services/prosemirror-editor.service';
import { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';
import { BeatAIPromptEvent } from '../../models/beat-ai.interface';
import { BeatAIService } from '../../../shared/services/beat-ai.service';
import { PromptManagerService } from '../../../shared/services/prompt-manager.service';
import { ImageUploadDialogComponent, ImageInsertResult } from '../../../ui/components/image-upload-dialog.component';
import { VideoModalComponent } from '../../../ui/components/video-modal.component';
import { ImageViewerModalComponent } from '../../../shared/components/image-viewer-modal/image-viewer-modal.component';
import { ImageVideoService, ImageClickEvent } from '../../../shared/services/image-video.service';
import { VideoService } from '../../../shared/services/video.service';
import { AppHeaderComponent, HeaderAction, BurgerMenuItem } from '../../../ui/components/app-header.component';
import { VersionTooltipComponent } from '../../../ui/components/version-tooltip.component';
import { HeaderNavigationService } from '../../../shared/services/header-navigation.service';
import { SettingsService } from '../../../core/services/settings.service';
import { StoryStatsService } from '../../services/story-stats.service';
import { VersionService } from '../../../core/services/version.service';
import { PDFExportService, PDFExportProgress } from '../../../shared/services/pdf-export.service';
import { PDFExportDialogComponent, PDFExportDialogOptions } from '../../../ui/components/pdf-export-dialog/pdf-export-dialog.component';
import { DatabaseService } from '../../../core/services/database.service';
import { SnapshotTimelineComponent } from '../snapshot-timeline/snapshot-timeline.component';
import { SceneNavigationService } from '../../services/scene-navigation.service';
import { StoryEditorStateService } from '../../services/story-editor-state.service';

@Component({
  selector: 'app-story-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonChip, IonLabel, IonButton, IonIcon, IonSpinner,
    IonMenu, IonSplitPane,
    StoryStructureComponent, SlashCommandDropdownComponent, ImageUploadDialogComponent,
    VideoModalComponent, ImageViewerModalComponent, AppHeaderComponent, StoryStatsComponent, VersionTooltipComponent,
    StoryMediaGalleryComponent, BeatNavigationPanelComponent
  ],
  templateUrl: './story-editor.component.html',
  styleUrls: ['./story-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StoryEditorComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private storyService = inject(StoryService);
  private proseMirrorService = inject(ProseMirrorEditorService);
  private beatAIService = inject(BeatAIService);
  private cdr = inject(ChangeDetectorRef);
  private promptManager = inject(PromptManagerService);
  private headerNavService = inject(HeaderNavigationService);
  private settingsService = inject(SettingsService);
  private storyStatsService = inject(StoryStatsService);
  versionService = inject(VersionService);
  private menuController = inject(MenuController);
  private pdfExportService = inject(PDFExportService);
  private imageVideoService = inject(ImageVideoService);
  private videoService = inject(VideoService);
  private loadingController = inject(LoadingController);
  private alertController = inject(AlertController);
  private databaseService = inject(DatabaseService);
  private modalController = inject(ModalController);
  private sceneNav = inject(SceneNavigationService);
  private editorState = inject(StoryEditorStateService);
  private codexService = inject(CodexService);
  private lastSyncTime: Date | undefined;

  @ViewChild('headerTitle', { static: true }) headerTitle!: TemplateRef<unknown>;
  @ViewChild('burgerMenuFooter', { static: true }) burgerMenuFooter!: TemplateRef<unknown>;
  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('editorWrapper') editorWrapper!: ElementRef<HTMLDivElement>;
  @ViewChild(IonContent, { read: IonContent, static: false }) ionContent!: IonContent;
  @ViewChild(BeatNavigationPanelComponent) beatNavPanel!: BeatNavigationPanelComponent;
  private editorView: EditorView | null = null;
  private mutationObserver: MutationObserver | null = null;

  // Template-compatible properties (synced from services)
  wordCount = 0;
  currentTextColor = '#e0e0e0';
  story: Story = {
    id: '',
    title: '',
    chapters: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  activeChapterId: string | null = null;
  activeSceneId: string | null = null;
  activeScene: Scene | null = null;
  hasUnsavedChanges = false;

  leftActions: HeaderAction[] = [];
  rightActions: HeaderAction[] = [];
  burgerMenuItems: BurgerMenuItem[] = [];

  // Slash command functionality
  showSlashDropdown = false;
  slashDropdownPosition = { top: 0, left: 0 };
  slashCursorPosition = 0;

  // Image dialog functionality
  showImageDialog = false;
  imageCursorPosition = 0;

  // Image viewer functionality
  showImageViewer = false;
  imageViewerState = {
    imageSrc: null as string | null,
    imageAlt: '',
    imageTitle: '',
    videoSrc: null as string | null,
    videoName: null as string | null,
    loadingVideo: false
  };
  videoButton = {
    visible: false,
    top: 0,
    left: 0,
    imageId: null as string | null,
    imageAlt: '',
    imageElement: null as HTMLImageElement | null
  };

  // Video modal functionality
  showVideoModal = false;
  currentImageId: string | null = null;

  // Story stats functionality
  showStoryStats = false;

  // Media gallery functionality
  showMediaGallery = false;

  // Beat navigation panel functionality
  showBeatNavPanel = false;

  // Story loading state (Phase 5: Sync indicator)
  isLoadingStory = false;
  loadingMessage = 'Loading story...';
  debugLogs: string[] = [];

  debugModeEnabled = false;
  private saveSubject = new Subject<void>();
  private contentChangeSubject = new Subject<string>();
  private subscription: Subscription = new Subscription();

  // Touch/swipe gesture properties
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private minSwipeDistance = 50;
  private maxVerticalDistance = 100;

  // Mobile keyboard handling
  private keyboardHeight = 0;
  private originalViewportHeight = 0;
  private keyboardVisible = false;

  private hideVideoButtonTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    addIcons({
      arrowBack, bookOutline, book, settingsOutline, statsChartOutline, statsChart,
      saveOutline, checkmarkCircleOutline, menuOutline, chevronBack, chevronForward,
      chatbubblesOutline, bugOutline, menu, close, images, documentTextOutline, heart, search,
      listOutline, list, flaskOutline, videocamOutline, timeOutline, personCircleOutline
    });
  }

  async ngOnInit(): Promise<void> {
    // Setup header actions first
    this.setupHeaderActions();

    // Subscribe to settings changes for text color
    this.subscription.add(
      this.settingsService.settings$.subscribe(settings => {
        this.currentTextColor = settings.appearance?.textColor || '#e0e0e0';
        this.applyTextColorToProseMirror();
        this.cdr.markForCheck();
      })
    );

    // Subscribe to image click events
    this.subscription.add(
      this.imageVideoService.imageClicked$.subscribe((event: ImageClickEvent) => {
        this.onImageClicked(event);
      })
    );

    // Subscribe to editor state changes
    this.subscription.add(
      this.editorState.state$.subscribe(state => {
        // Sync local properties from service state
        if (state.story) {
          this.story = state.story;
        }
        this.activeChapterId = state.activeChapterId;
        this.activeSceneId = state.activeSceneId;
        this.activeScene = state.activeScene;
        this.hasUnsavedChanges = state.hasUnsavedChanges;
        this.wordCount = state.wordCount;

        // Update scene navigation service when story/scene changes
        if (state.story) {
          this.sceneNav.setStory(state.story);
          if (state.activeChapterId && state.activeSceneId) {
            this.sceneNav.setActiveScene(state.activeChapterId, state.activeSceneId);
          }
        }

        this.updateHeaderActions();
        this.cdr.markForCheck();
      })
    );

    // Subscribe to route params to handle story switching
    this.subscription.add(
      this.route.paramMap.subscribe(async params => {
        const storyId = params.get('id');
        const qp = this.route.snapshot.queryParamMap;
        const preferredChapterId = qp.get('chapterId');
        const preferredSceneId = qp.get('sceneId');
        const highlightPhrase = qp.get('phrase');

        if (storyId) {
          try {
            // Phase 5: Show loading indicator and wait for story to sync
            this.isLoadingStory = true;
            this.loadingMessage = 'Loading story...';
            this.debugLogs = [];
            this.cdr.markForCheck();

            // CRITICAL: Set activeStoryId BEFORE loading so selective sync knows to sync this story
            // Without this, the sync filter won't sync the story document (only metadata index)
            this.addDebugLog(`Setting activeStoryId: ${storyId}`);
            console.info(`[StoryEditor] Setting activeStoryId to ${storyId} for selective sync`);
            this.databaseService.setActiveStoryId(storyId);

            const currentActiveId = this.databaseService.getActiveStoryId();
            this.addDebugLog(`Active story ID confirmed: ${currentActiveId}`);

            // FORCE immediate replication of the story document and its codex from remote
            // This ensures the story and codex are pulled even if live sync hasn't picked them up yet
            this.addDebugLog(`Force replicating story and codex from remote...`);
            const codexDocId = `codex_${storyId}`;
            try {
              // Replicate both story and codex in parallel
              await Promise.all([
                this.databaseService.forceReplicateDocument(storyId),
                this.databaseService.forceReplicateDocument(codexDocId).catch(() => {
                  // Codex might not exist yet for new stories - this is fine
                  console.info(`[StoryEditor] No codex found on remote for story ${storyId}`);
                })
              ]);
              this.addDebugLog(`✓ Story replicated successfully`);
            } catch (error) {
              this.addDebugLog(`⚠️ Replication failed: ${error}`);
              console.warn('[StoryEditor] Force replication failed, will wait for live sync:', error);
            }

            // Reload codex from database to ensure we have the latest version
            await this.codexService.reloadCodexFromDatabase(storyId);

            // Wait for story to be available in local database (with 10s timeout)
            await this.waitForStorySynced(storyId);

            // Update loading message
            this.loadingMessage = 'Opening story...';
            this.cdr.markForCheck();

            // Load story using editor state service
            // Note: loadStory will also call setActiveStoryId, but we need it set earlier for sync
            await this.editorState.loadStory(storyId, preferredChapterId || undefined, preferredSceneId || undefined);

            // Hide loading indicator
            this.isLoadingStory = false;
            this.cdr.markForCheck();

            // Initialize editor after story is loaded and view is available
            setTimeout(() => {
              if (this.editorContainer) {
                this.initializeProseMirrorEditor();
                // Apply text color after editor is initialized
                this.applyTextColorToProseMirror();
                // Ensure scrolling happens after editor is fully initialized and content is rendered
                // Use requestAnimationFrame to ensure DOM is updated
                requestAnimationFrame(() => {
                  setTimeout(async () => {
                    await this.scrollToEndOfContent();
                    if (highlightPhrase) {
                      // Give the editor a moment to settle then highlight
                      setTimeout(() => {
                        const ok = this.proseMirrorService.selectFirstMatchOf(highlightPhrase);
                        if (ok) {
                          this.proseMirrorService.flashSelection();
                        }
                      }, 150);
                    }
                  }, 500);
                });
              }
            }, 0);
          } catch (error) {
            console.error('Failed to load story:', error);
            // Hide loading indicator on error
            this.isLoadingStory = false;
            this.cdr.markForCheck();
            // Story not found, navigate back
            this.router.navigate(['/']);
          }
        }
      })
    );

    // Auto-save with optimized debounce
    this.subscription.add(
      this.saveSubject.pipe(
        debounceTime(3000) // Increased to 3 seconds for less frequent saving
      ).subscribe(() => {
        this.saveStory();
      })
    );

    // Handle content changes with throttling to prevent excessive updates
    this.subscription.add(
      this.contentChangeSubject.pipe(
        throttleTime(500, undefined, { leading: true, trailing: true }) // Throttle content updates to max once per 500ms
      ).subscribe(content => {
        if (this.activeScene) {
          // Check content size to prevent memory issues
          if (content.length > 5000000) { // 5MB limit
            console.warn('Content too large, truncating...');
            content = content.substring(0, 5000000);
          }
          this.editorState.updateSceneContent(content);
          this.editorState.recordUserActivity();
        }
      })
    );

    // Subscribe to streaming state to pause auto-save during generation
    this.subscription.add(
      this.beatAIService.isStreaming$.subscribe(isStreaming => {
        this.editorState.setStreamingActive(isStreaming);
        this.cdr.markForCheck();
      })
    );

    // Subscribe to sync status changes to reload story when sync completes
    this.subscription.add(
      this.databaseService.syncStatus$.subscribe(status => {
        // Check if sync just completed (has lastSync and it's different from our last known sync)
        if (status.lastSync && (!this.lastSyncTime || status.lastSync > this.lastSyncTime)) {
          this.lastSyncTime = status.lastSync;
          // Only reload if allowed by editor state service
          if (this.editorState.shouldAllowReload(5000)) {
            void this.editorState.reloadStory();
          }
        }
      })
    );


    // Add touch gesture listeners for mobile
    this.setupTouchGestures();

    // Setup mobile keyboard handling
    this.setupMobileKeyboardHandling();
  }


  ngOnDestroy(): void {
    // Save on exit if there are unsaved changes
    if (this.hasUnsavedChanges) {
      void this.saveStory();
    }
    if (this.editorView) {
      this.proseMirrorService.destroy();
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    // Cleanup image click handlers
    if (this.editorContainer?.nativeElement) {
      const containerEl = this.editorContainer.nativeElement;
      this.imageVideoService.removeImageClickHandlers(containerEl);
      containerEl.removeEventListener('pointerenter', this.handleImagePointerEnter, true);
      containerEl.removeEventListener('pointerleave', this.handleImagePointerLeave, true);
      containerEl.removeEventListener('focusin', this.handleImageFocusIn, true);
      containerEl.removeEventListener('focusout', this.handleImageFocusOut, true);
    }

    window.removeEventListener('resize', this.handleWindowViewportChange);
    window.removeEventListener('scroll', this.handleWindowViewportChange, true);

    this.cancelHideVideoButton();
    this.videoButton.visible = false;
    this.videoButton.imageElement = null;
    this.videoButton.imageId = null;

    this.subscription.unsubscribe();

    // Remove touch gesture listeners
    this.removeTouchGestures();

    // Remove keyboard adjustments
    this.removeKeyboardAdjustments();
  }

  async onSceneSelected(event: {chapterId: string, sceneId: string}): Promise<void> {
    await this.editorState.setActiveScene(event.chapterId, event.sceneId);
    this.updateEditorContent();

    // Update story context for all Beat AI components
    this.proseMirrorService.updateStoryContext({
      storyId: this.story.id,
      chapterId: this.activeChapterId || undefined,
      sceneId: this.activeSceneId || undefined
    });

    // Close menu on mobile after scene selection
    if (window.innerWidth <= 1024) {
      await this.menuController.close('story-menu');
    }
  }

  onStoryTitleChange(): void {
    this.editorState.updateStoryTitle(this.story.title);
    this.saveSubject.next();
  }

  onSceneTitleChange(): void {
    if (this.activeScene && this.activeChapterId) {
      this.editorState.updateSceneTitle(this.activeScene.title);
      this.saveSubject.next();
    }
  }

  onContentChange(): void {
    const state = this.editorState.getCurrentState();

    if (this.activeScene && this.activeChapterId && !state.isStreamingActive) {
      this.editorState.recordUserActivity();
      this.saveSubject.next();

      // Don't refresh prompt manager on every keystroke - it's too expensive
      // It will be refreshed when actually needed (when opening Beat AI)
    }
  }

  async saveStory(): Promise<void> {
    await this.editorState.saveStory();
  }

  async reloadCurrentStory(): Promise<void> {
    if (!this.story.id) return;

    try {
      // Save current scroll position
      const scrollPos = await this.ionContent?.getScrollElement().then(el => el.scrollTop);

      // Reload story using editor state service
      await this.editorState.reloadStory();

      // Update the editor content if editor exists
      if (this.activeScene) {
        this.proseMirrorService.setContent(this.activeScene.content || '');
      }

      // Restore scroll position
      if (scrollPos !== undefined) {
        setTimeout(() => {
          this.ionContent?.scrollToPoint(0, scrollPos, 0);
        }, 100);
      }

      // Trigger change detection
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error reloading story:', error);
    }
  }

  async goBack(): Promise<void> {
    // Delete-on-exit strategy for empty, untitled drafts
    if (this.isDefaultEmptyDraft()) {
      const shouldDelete = confirm('This draft has no title or content. Delete it?');
      if (shouldDelete) {
        try {
          await this.storyService.deleteStory(this.story.id);
        } catch (err) {
          console.error('Failed to delete empty draft:', err);
        }
        this.router.navigate(['/']);
        return;
      }
      // If user cancels deletion, continue with normal navigation (preserve draft)
    }

    if (this.hasUnsavedChanges) {
      await this.saveStory();
    }
    this.router.navigate(['/']);
  }

  async goToCodex(): Promise<void> {
    if (this.hasUnsavedChanges) {
      await this.saveStory();
    }
    this.router.navigate(['/stories/codex', this.story.id]);
  }

  async goToSettings(): Promise<void> {
    if (this.hasUnsavedChanges) {
      await this.saveStory();
    }
    this.router.navigate(['/stories/settings', this.story.id]);
  }

  async goToAILogs(): Promise<void> {
    if (this.hasUnsavedChanges) {
      await this.saveStory();
    }
    this.router.navigate(['/ai-logs']);
  }

  onBurgerMenuToggle(): void {
    // Handle burger menu state changes if needed
  }

  private setupHeaderActions(): void {
    // Left actions
    this.leftActions = [
      {
        icon: 'arrow-back',
        action: () => this.goBack(),
        showOnMobile: true,
        showOnDesktop: true,
        tooltip: 'Back'
      },
      {
        icon: 'list-outline',
        action: () => this.toggleSidebar(),
        showOnMobile: true,
        showOnDesktop: true,
        tooltip: 'Story structure'
      }
    ];

    // Right actions (status chips for desktop)
    this.rightActions = [
      {
        icon: 'heart',
        action: () => window.open('https://www.buymeacoffee.com/nostramo83', '_blank'),
        showOnMobile: false,
        showOnDesktop: true,
        tooltip: 'Support the project ❤️'
      },
      {
        icon: 'stats-chart-outline',
        chipContent: `${this.wordCount}w`,
        chipColor: 'medium',
        action: () => this.showStoryStatsModal(),
        showOnMobile: false,
        showOnDesktop: true,
        tooltip: 'Show story stats'
      }
    ];

    // Burger menu items with custom actions for this component
    this.burgerMenuItems = [
      {
        icon: 'document-text-outline',
        label: 'PDF Export',
        action: () => this.exportToPDF(),
        color: 'primary'
      },
      {
        icon: 'time-outline',
        label: 'Version History',
        action: () => this.openSnapshotTimeline(),
        color: 'secondary'
      },
      {
        icon: 'bug-outline',
        label: 'Debug Modus',
        action: () => this.toggleDebugMode(),
        color: 'warning'
      },
      {
        icon: 'search',
        label: 'Story Inspector',
        action: () => this.goToInspector()
      },
      {
        icon: 'flask-outline',
        label: 'Story Research',
        action: () => this.goToStoryResearch()
      },
      {
        icon: 'book-outline',
        label: 'Codex',
        action: () => this.goToCodex()
      },
      {
        icon: 'settings-outline',
        label: 'Story Settings',
        action: () => this.goToSettings()
      },
      {
        icon: 'chatbubbles-outline',
        label: 'Scene Chat',
        action: () => this.goToSceneChat()
      },
      {
        icon: 'person-circle-outline',
        label: 'Character Chat',
        action: () => this.goToCharacterChat(),
        color: 'tertiary'
      },
      {
        icon: 'stats-chart',
        label: 'AI Logs',
        action: () => this.headerNavService.goToAILogger()
      },
      {
        icon: 'images',
        label: 'Image Generation',
        action: () => this.headerNavService.goToImageGeneration()
      },
      {
        icon: 'images',
        label: 'Media Gallery',
        action: () => this.openMediaGallery(),
        color: 'secondary'
      },
      {
        icon: 'list-outline',
        label: 'Outline Overview',
        action: () => this.router.navigate(['/stories/outline', this.story.id], {
          queryParams: {
            chapterId: this.activeChapterId,
            sceneId: this.activeSceneId
          }
        })
      }
    ];
  }

  goToInspector(): void {
    this.router.navigate(['/stories/inspector', this.story.id]);
  }

  goToStoryResearch(): void {
    if (!this.story?.id) return;
    this.router.navigate(['/stories/research', this.story.id]);
  }

  goToCharacterChat(): void {
    if (!this.story?.id) return;
    this.router.navigate(['/stories/character-chat', this.story.id]);
  }

  private updateHeaderActions(): void {
    // Update the word count in the right actions
    // Note: First button is now Buy Me a Coffee (don't modify)
    if (this.rightActions.length >= 2) {
      // Update word count chip (second button)
      this.rightActions[1].chipContent = `${this.wordCount}w`;
      this.rightActions[1].action = () => this.showStoryStatsModal();
    }
  }

  /**
   * Wait for the active story to sync from remote
   * Phase 5: Provides better UX by waiting for story data to be available
   *
   * @param storyId - The ID of the story to wait for
   * @param timeoutMs - Maximum time to wait (default: 60 seconds for large databases)
   * @returns Promise that resolves when story is synced or timeout occurs
   */
  private async waitForStorySynced(storyId: string, timeoutMs = 60000): Promise<void> {
    const startTime = Date.now();
    this.addDebugLog(`Waiting for story to sync...`);
    console.info(`[StoryEditor] Waiting for story ${storyId} to sync...`);

    return new Promise((resolve) => {
      let syncSubscription: Subscription | null = null;
      let checkInterval: ReturnType<typeof setInterval> | null = null;
      let checkCount = 0;

      const cleanup = () => {
        if (syncSubscription) {
          syncSubscription.unsubscribe();
          syncSubscription = null;
        }
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
      };

      const checkTimeout = () => {
        if (Date.now() - startTime >= timeoutMs) {
          cleanup();
          const message = `Timeout after ${timeoutMs}ms (checked ${checkCount} times)`;
          this.addDebugLog(`⚠️ ${message}`);
          console.warn(`[StoryEditor] ${message}`);
          resolve(); // Timeout - proceed anyway and let loadStory handle the error
        }
      };

      // Periodically check if the story document exists
      const checkStoryExists = async () => {
        checkCount++;
        try {
          const db = await this.databaseService.getDatabase();
          await db.get(storyId);
          // Story exists!
          cleanup();
          const elapsed = Date.now() - startTime;
          const message = `✓ Story found after ${elapsed}ms`;
          this.addDebugLog(message);
          console.info(`[StoryEditor] ${message}`);
          resolve();
        } catch {
          // Story doesn't exist yet, keep waiting
          if (checkCount % 4 === 0) { // Log every 2 seconds (4 checks)
            const elapsed = Date.now() - startTime;
            this.addDebugLog(`Still waiting... (${elapsed}ms, check ${checkCount})`);
          }
          checkTimeout();
        }
      };

      // Check immediately
      void checkStoryExists();

      // Then check every 500ms
      checkInterval = setInterval(() => {
        void checkStoryExists();
      }, 500);

      // Subscribe to sync status to check when sync completes
      syncSubscription = this.databaseService.syncStatus$.subscribe(status => {
        if (checkCount === 1) { // Only log sync status once
          this.addDebugLog(`Sync status: ${status.isSync ? 'syncing' : 'idle'}, online: ${status.isOnline}`);
        }
        checkTimeout();

        // When sync completes or becomes idle, check if story exists
        if (status.lastSync && status.lastSync > new Date(startTime)) {
          void checkStoryExists();
        }
        if (!status.isSync && !status.isConnecting) {
          void checkStoryExists();
        }
      });

      // Hard timeout
      setTimeout(() => {
        cleanup();
        this.addDebugLog(`❌ Hard timeout reached`);
        console.warn(`[StoryEditor] Hard timeout reached for story ${storyId}`);
        resolve();
      }, timeoutMs);
    });
  }

  private addDebugLog(message: string): void {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    this.debugLogs.push(`[${timestamp}] ${message}`);
    // Keep only last 20 logs
    if (this.debugLogs.length > 20) {
      this.debugLogs = this.debugLogs.slice(-20);
    }
    this.cdr.markForCheck();
  }

  // Consider a story an "empty draft" only if it's in the default structure
  // (1 chapter, 1 scene), has no title, and no scene text content.
  isDefaultEmptyDraft(): boolean {
    const titleEmpty = !this.story.title || this.story.title.trim() === '';
    if (!titleEmpty) return false;

    const hasSingleChapter = Array.isArray(this.story.chapters) && this.story.chapters.length === 1;
    if (!hasSingleChapter) return false;

    const firstChapter = this.story.chapters[0];
    const hasSingleScene = Array.isArray(firstChapter.scenes) && firstChapter.scenes.length === 1;
    if (!hasSingleScene) return false;

    // Use StoryStatsService to compute total word count safely
    try {
      const totalWords = this.storyStatsService.calculateTotalStoryWordCount(this.story);
      return totalWords === 0;
    } catch {
      // Fallback: if stats service fails, perform a minimal check on the first scene
      const sceneContent = firstChapter.scenes[0]?.content || '';
      const textOnly = this.stripContentToText(sceneContent);
      return textOnly.length === 0;
    }
  }

  // Minimal HTML-to-text stripper used only as a fallback.
  private stripContentToText(html: string): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html || '', 'text/html');
      // Remove Beat AI elements if present
      const beatNodes = doc.querySelectorAll('[class*="beat-ai"], .beat-ai-node, .beat-ai-wrapper');
      beatNodes.forEach(el => el.remove());
      return (doc.body.textContent || '').trim();
    } catch {
      return (html || '').replace(/<[^>]+>/g, '').trim();
    }
  }

  // Prompt on browser refresh/close if this is an empty draft
  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    try {
      if (this.isDefaultEmptyDraft() || this.hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    } catch {
      // ignore
    }
  }

  async goToSceneChat(): Promise<void> {
    if (this.hasUnsavedChanges) {
      await this.saveStory();
    }
    // Navigate to scene chat with current story, chapter, and scene IDs
    if (this.activeChapterId && this.activeSceneId) {
      this.router.navigate(['/stories/chat', this.story.id, this.activeChapterId, this.activeSceneId]);
    } else {
      // If no scene is selected, navigate with just the story ID (scene chat can handle this)
      this.router.navigate(['/stories/chat', this.story.id, '', '']);
    }
  }

  async openSnapshotTimeline(): Promise<void> {
    // Save any unsaved changes first
    if (this.hasUnsavedChanges) {
      await this.saveStory();
    }

    const modal = await this.modalController.create({
      component: SnapshotTimelineComponent,
      componentProps: {
        storyId: this.story.id,
        storyTitle: this.story.title
      }
    });

    await modal.present();

    // Wait for modal to be dismissed and check if we need to reload
    const { data } = await modal.onWillDismiss();
    if (data?.shouldReload) {
      // Reload the story after restoration
      await this.reloadCurrentStory();
    }
  }

  getCurrentChapterTitle(): string {
    return this.sceneNav.getChapterTitle(this.activeChapterId || undefined);
  }

  getCurrentSceneTitle(): string {
    return this.sceneNav.getSceneTitle(this.activeChapterId || undefined, this.activeSceneId || undefined);
  }

  getSceneIdDisplay(): string {
    return this.sceneNav.getSceneIdDisplay(this.activeChapterId || undefined, this.activeSceneId || undefined);
  }

  async toggleSidebar(): Promise<void> {
    await this.menuController.toggle('story-menu');
    // Update the sidebar icon in left actions
    const isOpen = await this.menuController.isOpen('story-menu');
    if (this.leftActions.length > 1) {
      this.leftActions[1].icon = isOpen ? 'list' : 'list-outline';
    }
  }


  async onCloseSidebar(): Promise<void> {
    await this.menuController.close('story-menu');
  }

  private setupTouchGestures(): void {
    // Enable touch gestures for beat navigation panel
    document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
  }

  private removeTouchGestures(): void {
    document.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    document.removeEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  private handleTouchStart(event: TouchEvent): void {
    // Only enable gestures on mobile devices, not tablets
    if (window.innerWidth > 768) return;

    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  private handleTouchEnd(event: TouchEvent): void {
    // Only enable gestures on mobile devices, not tablets
    if (window.innerWidth > 768) return;

    const touch = event.changedTouches[0];
    this.touchEndX = touch.clientX;
    this.touchEndY = touch.clientY;

    this.handleSwipeGesture();
  }

  private isInteractiveElement(element: HTMLElement): boolean {
    if (!element) return false;

    // Check if element or any parent is an interactive element
    let current = element;
    while (current && current !== document.body) {
      const tagName = current.tagName.toLowerCase();

      // Check for form elements
      if (['input', 'textarea', 'select', 'button'].includes(tagName)) {
        return true;
      }

      // Check for Ion elements that are interactive
      if (tagName.startsWith('ion-') && (
        tagName.includes('input') ||
        tagName.includes('textarea') ||
        tagName.includes('button') ||
        tagName.includes('select') ||
        tagName.includes('toggle') ||
        tagName.includes('checkbox') ||
        tagName.includes('radio')
      )) {
        return true;
      }

      // Check for elements with contenteditable
      if (current.contentEditable === 'true') {
        return true;
      }

      // Check for elements with role="button" or similar
      const role = current.getAttribute('role');
      if (role && ['button', 'textbox', 'combobox', 'listbox'].includes(role)) {
        return true;
      }

      current = current.parentElement as HTMLElement;
    }

    return false;
  }

  private handleSwipeGesture(): void {
    const deltaX = this.touchEndX - this.touchStartX;
    const deltaY = Math.abs(this.touchEndY - this.touchStartY);

    // Check if it's a horizontal swipe (not vertical scroll)
    if (deltaY > this.maxVerticalDistance) return;

    // Check if swipe distance is sufficient
    if (Math.abs(deltaX) < this.minSwipeDistance) return;

    // Additional safety check: don't process gestures if touchStart coordinates are invalid
    if (this.touchStartX === undefined || this.touchStartY === undefined) return;

    // Adjust swipe sensitivity based on screen size
    const edgeThreshold = window.innerWidth <= 480 ? 30 : 50;
    const minSwipeDistance = window.innerWidth <= 480 ? 40 : this.minSwipeDistance;

    // Check if swipe distance is sufficient for this screen size
    if (Math.abs(deltaX) < minSwipeDistance) return;

    // Swipe from right edge to left (open beat nav panel)
    if (deltaX < 0 && this.touchStartX > window.innerWidth - edgeThreshold) {
      this.openBeatNavPanel();
      return;
    }

    // Swipe from left to right while panel is open (close beat nav panel)
    if (deltaX > 0 && this.showBeatNavPanel) {
      this.closeBeatNavPanel();
      return;
    }
  }

  private setupMobileKeyboardHandling(): void {
    // Only setup keyboard handling on mobile devices
    if (!this.isMobileDevice()) return;

    // Store original viewport height
    this.originalViewportHeight = window.innerHeight;

    // Listen for viewport resize events (indicates keyboard show/hide)
    window.addEventListener('resize', () => {
      this.handleViewportResize();
    });

    // iOS specific keyboard handling
    if (this.isIOS()) {
      window.addEventListener('focusin', () => {
        this.handleKeyboardShow();
      });

      window.addEventListener('focusout', () => {
        this.handleKeyboardHide();
      });
    }

    // Modern browsers: Visual Viewport API
    if ('visualViewport' in window) {
      window.visualViewport?.addEventListener('resize', () => {
        this.handleVisualViewportResize();
      });
    }
  }

  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  }

  private isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  private handleViewportResize(): void {
    if (!this.isMobileDevice()) return;

    const currentHeight = window.innerHeight;
    const heightDifference = this.originalViewportHeight - currentHeight;

    // Keyboard is likely visible if height decreased significantly
    if (heightDifference > 150) {
      this.keyboardHeight = heightDifference;
      this.keyboardVisible = true;
      this.adjustForKeyboard();
    } else {
      this.keyboardVisible = false;
      this.keyboardHeight = 0;
      this.removeKeyboardAdjustments();
    }
  }

  private handleVisualViewportResize(): void {
    if (!this.isMobileDevice() || !window.visualViewport) return;

    const viewport = window.visualViewport;
    const heightDifference = this.originalViewportHeight - viewport.height;

    if (heightDifference > 100) {
      this.keyboardHeight = heightDifference;
      this.keyboardVisible = true;
      this.adjustForKeyboard();
    } else {
      this.keyboardVisible = false;
      this.keyboardHeight = 0;
      this.removeKeyboardAdjustments();
    }
  }

  private handleKeyboardShow(): void {
    if (!this.isMobileDevice()) return;

    setTimeout(() => {
      this.keyboardVisible = true;
      this.adjustForKeyboard();
      this.scrollToActiveFocus();
    }, 300);
  }

  private handleKeyboardHide(): void {
    if (!this.isMobileDevice()) return;

    setTimeout(() => {
      this.keyboardVisible = false;
      this.removeKeyboardAdjustments();
    }, 300);
  }

  private adjustForKeyboard(): void {
    if (!this.keyboardVisible) return;

    const editorElement = this.editorContainer?.nativeElement;
    if (!editorElement) return;

    // Add keyboard-visible class to body for CSS adjustments
    document.body.classList.add('keyboard-visible');

    // Set CSS custom property for keyboard height
    document.documentElement.style.setProperty('--keyboard-height', `${this.keyboardHeight}px`);

    // Scroll to keep cursor visible
    setTimeout(() => {
      this.scrollToActiveFocus();
    }, 100);
  }

  private removeKeyboardAdjustments(): void {
    document.body.classList.remove('keyboard-visible');
    document.documentElement.style.removeProperty('--keyboard-height');
  }

  private scrollToActiveFocus(): void {
    if (!this.editorView || !this.keyboardVisible) return;

    try {
      const { state } = this.editorView;
      const { from } = state.selection;

      // Get cursor position
      const coords = this.editorView.coordsAtPos(from);

      // Calculate available space above keyboard
      const availableHeight = window.innerHeight - this.keyboardHeight;
      const targetPosition = availableHeight * 0.4; // Position cursor at 40% of available space

      // Scroll to keep cursor visible
      if (coords.top > targetPosition) {
        const scrollAmount = coords.top - targetPosition;
        window.scrollBy(0, scrollAmount);
      }

      // Also scroll the editor container if needed
      const editorElement = this.editorView.dom as HTMLElement;
      if (editorElement) {
        const contentEditor = editorElement.closest('.content-editor') as HTMLElement;
        if (contentEditor) {
          const rect = contentEditor.getBoundingClientRect();
          if (rect.bottom > availableHeight) {
            contentEditor.scrollTop += rect.bottom - availableHeight + 50;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to scroll to active focus:', error);
    }
  }


  private initializeProseMirrorEditor(): void {
    if (!this.editorContainer) return;

    this.editorView = this.proseMirrorService.createEditor(
      this.editorContainer.nativeElement,
      {
        placeholder: 'Your scene begins here...',
        onUpdate: (signal: string) => {
          // Content changed - get it only when needed
          if (signal === '__content_changed__' && this.editorView) {
            const content = this.proseMirrorService.getHTMLContent();
            this.contentChangeSubject.next(content);
          }
        },
        onSlashCommand: (position: number) => {
          this.slashCursorPosition = position;
          this.showSlashDropdownAtCursor();
        },
        onBeatPromptSubmit: (event: BeatAIPromptEvent) => {
          void this.handleBeatPromptSubmit(event);
        },
        onBeatContentUpdate: () => {
          this.handleBeatContentUpdate();
        },
        onBeatFocus: () => {
          this.hideSlashDropdown();
        },
        storyContext: {
          storyId: this.story.id,
          chapterId: this.activeChapterId || undefined,
          sceneId: this.activeSceneId || undefined
        },
        debugMode: this.debugModeEnabled
      }
    );

    // Set initial content if we have an active scene (skip scroll, will be done in ngOnInit)
    this.updateEditorContent(true);

    const containerEl = this.editorContainer.nativeElement;

    // Initialize image click handlers for image viewer functionality
    this.imageVideoService.initializeImageClickHandlers(containerEl);

    // Add auxiliary listeners for hovering/focusing images to surface video button
    containerEl.addEventListener('pointerenter', this.handleImagePointerEnter, true);
    containerEl.addEventListener('pointerleave', this.handleImagePointerLeave, true);
    containerEl.addEventListener('focusin', this.handleImageFocusIn, true);
    containerEl.addEventListener('focusout', this.handleImageFocusOut, true);

    window.addEventListener('resize', this.handleWindowViewportChange);
    window.addEventListener('scroll', this.handleWindowViewportChange, true);

    // Add click listener to hide dropdown when clicking in editor
    this.editorContainer.nativeElement.addEventListener('click', () => {
      if (this.showSlashDropdown) {
        setTimeout(() => this.hideSlashDropdown(), 100);
      }
    });

    // Add mobile keyboard handling to editor
    if (this.isMobileDevice()) {
      this.editorContainer.nativeElement.addEventListener('focus', () => {
        setTimeout(() => this.scrollToActiveFocus(), 300);
      }, true);

      this.editorContainer.nativeElement.addEventListener('input', () => {
        if (this.keyboardVisible) {
          setTimeout(() => this.scrollToActiveFocus(), 100);
        }
      });
    }
  }

  private updateEditorContent(skipScroll = false): void {
    if (this.editorView && this.activeScene) {
      this.proseMirrorService.setContent(this.activeScene.content || '');
      this.editorState.recalculateWordCount();
      this.performHideVideoButton();

      // Update image video indicators after content is loaded
      setTimeout(async () => {
        await this.updateImageVideoIndicators();
      }, 100);

      // Scroll to end of content after setting content (unless skipped)
      if (!skipScroll) {
        setTimeout(async () => {
          await this.scrollToEndOfContent();
        }, 200);
      }
    } else if (!this.activeScene) {
      // No active scene
      this.updateHeaderActions();
    }
  }

  private async scrollToEndOfContent(): Promise<void> {
    if (!this.editorView) {
      return;
    }


    try {
      const { state } = this.editorView;
      const { doc } = state;

      // Find a valid text position at the end of the document
      let endPos = doc.content.size;

      // If the document ends with a non-text node, find the last valid text position
      const lastChild = doc.lastChild;
      if (lastChild && !lastChild.isText && lastChild.isBlock) {
        // Position at the end of the last block's content
        endPos = doc.content.size - 1;
      }

      // Create selection at the end position without scrollIntoView
      const tr = state.tr.setSelection(TextSelection.near(doc.resolve(endPos)));
      this.editorView.dispatch(tr);

      // Scroll the editor view to show the cursor
      // Only focus on desktop to prevent mobile keyboard from opening
      if (!this.isMobileDevice()) {
        this.editorView.focus();
      }

      // Use IonContent's scrollToBottom method with best practices
      setTimeout(async () => {
        if (this.ionContent && this.ionContent.scrollToBottom) {
          try {
            // Auto-scroll to bottom when new content is added
            await this.ionContent.getScrollElement();


            // Use IonContent's built-in scrollToBottom method
            await this.ionContent.scrollToBottom(400);

            // Ensure cursor is visible after Ionic scroll completes
            // Use requestAnimationFrame for better timing
            requestAnimationFrame(() => {
              if (this.editorView && this.editorView.hasFocus()) {
                // Only scroll ProseMirror if it has focus
                const domAtPos = this.editorView.domAtPos(this.editorView.state.selection.anchor);
                if (domAtPos.node && domAtPos.node instanceof Element) {
                  domAtPos.node.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest'
                  });
                } else if (domAtPos.node && domAtPos.node.parentElement) {
                  // Fallback for text nodes
                  domAtPos.node.parentElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest'
                  });
                }
              }
            });
          } catch (error) {
            console.warn('Failed to scroll using IonContent:', error);

            // Fallback to manual scrolling with better implementation
            if (this.editorView) {
              const domAtPos = this.editorView.domAtPos(this.editorView.state.selection.anchor);
              if (domAtPos.node && domAtPos.node instanceof Element) {
                domAtPos.node.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }
            }
          }
        }
      }, 500); // Increased timeout for better DOM readiness
    } catch (error) {
      console.warn('Failed to scroll to end of content:', error);
    }
  }

  private showSlashDropdownAtCursor(): void {
    if (!this.editorContainer || !this.editorView) return;

    // Get the cursor position in the editor
    const { state } = this.editorView;
    const { from } = state.selection;

    // Get the DOM position of the cursor
    const coords = this.editorView.coordsAtPos(from);

    // Calculate dropdown dimensions (approximate)
    const dropdownHeight = 200; // Estimated height based on content
    const gap = 5;

    // Get viewport height
    const viewportHeight = window.innerHeight;

    // Check if there's enough space below the cursor
    const spaceBelow = viewportHeight - coords.bottom;
    const spaceAbove = coords.top;

    let top: number;

    if (spaceBelow >= dropdownHeight + gap) {
      // Enough space below - position below cursor
      top = coords.bottom + gap;
    } else if (spaceAbove >= dropdownHeight + gap) {
      // Not enough space below but enough above - position above cursor
      top = coords.top - dropdownHeight - gap;
    } else {
      // Not enough space in either direction - position where it fits better
      if (spaceBelow > spaceAbove) {
        // More space below - position below but at bottom edge
        top = Math.max(0, viewportHeight - dropdownHeight - 10);
      } else {
        // More space above - position above but at top edge
        top = 10;
      }
    }

    // Calculate dropdown position relative to viewport
    this.slashDropdownPosition = {
      top: top,
      left: coords.left
    };

    this.showSlashDropdown = true;
  }

  hideSlashDropdown(): void {
    this.showSlashDropdown = false;
  }

  onSlashCommandSelected(result: SlashCommandResult): void {
    if (!this.activeScene || !this.editorView) return;

    // Hide dropdown immediately
    this.hideSlashDropdown();

    switch (result.action) {
      case SlashCommandAction.INSERT_BEAT:
        this.proseMirrorService.insertBeatAI(this.slashCursorPosition, true, 'story');
        break;
      case SlashCommandAction.INSERT_SCENE_BEAT:
        this.proseMirrorService.insertBeatAI(this.slashCursorPosition, true, 'scene');
        break;
      case SlashCommandAction.INSERT_IMAGE:
        this.showImageDialog = true;
        this.imageCursorPosition = this.slashCursorPosition;
        break;
    }

    // Focus the editor after a brief delay to ensure the component is ready (except for image dialog)
    // Only focus on desktop to prevent mobile keyboard from opening
    if (result.action !== SlashCommandAction.INSERT_IMAGE && !this.isMobileDevice()) {
      setTimeout(() => {
        this.proseMirrorService.focus();
      }, 100);
    }
  }

  private async handleBeatPromptSubmit(event: BeatAIPromptEvent): Promise<void> {
    // Make sure dropdown is hidden when working with beat AI
    this.hideSlashDropdown();

    if (event.action === 'regenerate') {
      await this.handleBeatRegenerate(event);
      return;
    }

    if (event.action !== 'deleteAfter') {
      const persistenceSucceeded = await this.persistSceneBeforeBeatAction();
      if (!persistenceSucceeded) {
        console.error('Beat generation aborted: Failed to persist latest scene content.');
        return;
      }
    }

    // Add story context to the beat AI prompt
    const enhancedEvent: BeatAIPromptEvent = {
      ...event,
      storyId: this.story.id,
      chapterId: this.activeChapterId || undefined,
      sceneId: this.activeSceneId || undefined
    };

    const finalEvent = this.refreshCustomContext(enhancedEvent);

    // Pass the enhanced event to the ProseMirror service
    if (this.proseMirrorService) {
      this.proseMirrorService.handleBeatPromptSubmit(finalEvent);
    }
  }

  private async handleBeatRegenerate(event: BeatAIPromptEvent): Promise<void> {
    if (!this.proseMirrorService) {
      return;
    }

    // Use marker-aware deletion to preserve pre-existing text that was pushed down
    // when the beat was inserted in the middle of content
    const deleted = this.proseMirrorService.deleteGeneratedContentOnly(event.beatId);
    if (!deleted) {
      return;
    }

    const persisted = await this.persistSceneBeforeBeatAction();
    if (!persisted) {
      console.error('Beat regeneration aborted: Failed to persist scene after clearing previous content.');
      return;
    }

    const generateEvent: BeatAIPromptEvent = {
      ...event,
      action: 'generate'
    };

    const enhancedEvent: BeatAIPromptEvent = {
      ...generateEvent,
      storyId: this.story.id,
      chapterId: this.activeChapterId || undefined,
      sceneId: this.activeSceneId || undefined
    };

    const finalEvent = this.refreshCustomContext(enhancedEvent);

    this.proseMirrorService.handleBeatPromptSubmit(finalEvent);
  }

  private refreshCustomContext(event: BeatAIPromptEvent): BeatAIPromptEvent {
    if (!event.customContext) {
      return event;
    }

    const { selectedSceneContexts, includeStoryOutline } = event.customContext;

    const updatedContexts = selectedSceneContexts.map(context => {
      if (this.activeScene && context.sceneId === this.activeScene.id) {
        // Get latest content from editor and truncate at beat position if this is the current scene
        let sanitizedContent: string;

        // Check if this scene should be truncated (i.e., it contains the current beat)
        const shouldTruncate = event.beatId && this.activeScene.id === this.activeSceneId;

        if (shouldTruncate) {
          // Extract content up to the beat position
          sanitizedContent = this.extractTextBeforeBeat(this.activeScene.content || '', event.beatId);
        } else {
          // Extract full content
          sanitizedContent = this.promptManager.extractPlainTextFromHtml(this.activeScene.content || '');
        }

        return {
          ...context,
          content: sanitizedContent
        };
      }
      return context;
    });

    return {
      ...event,
      customContext: {
        includeStoryOutline,
        selectedSceneContexts: updatedContexts,
        selectedScenes: updatedContexts.map(ctx => ctx.content)
      }
    };
  }

  /**
   * Extract text content from HTML scene content, stopping at the specified beat ID
   */
  private extractTextBeforeBeat(htmlContent: string, beatId: string): string {
    if (!htmlContent) return '';

    // Parse the HTML content
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // Find the target beat node
    const targetBeat = doc.querySelector(`.beat-ai-node[data-beat-id="${beatId}"]`);
    if (targetBeat) {
      // Save parent reference BEFORE removing the beat node
      const parentParagraph = targetBeat.parentElement;

      // Remove the beat itself and all following siblings
      let currentNode: Node | null = targetBeat;
      while (currentNode) {
        const nextNode: Node | null = currentNode.nextSibling;
        currentNode.parentNode?.removeChild(currentNode);
        currentNode = nextNode;
      }

      // Also check if beat was within a paragraph and remove content after it
      if (parentParagraph?.tagName === 'P') {
        let sibling: Node | null = parentParagraph.nextSibling;
        while (sibling) {
          const nextSibling: Node | null = sibling.nextSibling;
          sibling.parentNode?.removeChild(sibling);
          sibling = nextSibling;
        }
      }
    }

    // Now extract plain text from the truncated content
    return this.promptManager.extractPlainTextFromHtml(doc.body.innerHTML);
  }

  private async persistSceneBeforeBeatAction(): Promise<boolean> {
    if (!this.editorView || !this.activeScene || !this.activeChapterId) {
      return true;
    }

    // Get latest content from editor
    const latestContent = this.proseMirrorService.getHTMLContent();

    // Update scene content if changed
    if (this.activeScene.content !== latestContent) {
      this.editorState.updateSceneContent(latestContent);
    }

    // Check if save is needed (either pending or unsaved changes)
    const state = this.editorState.getCurrentState();
    if (this.editorState.hasPendingSave() || state.hasUnsavedChanges) {
      // Save once and wait for completion
      await this.editorState.saveStory();
    }

    // Return true if save succeeded (no unsaved changes remain)
    return !this.editorState.getCurrentState().hasUnsavedChanges;
  }

  private handleBeatContentUpdate(): void {
    // Update scene content after beat generation
    this.editorState.updateSceneContent(this.proseMirrorService.getHTMLContent());
    // Trigger debounced save to persist beat-generated content
    this.saveSubject.next();
  }

  hideImageDialog(): void {
    this.showImageDialog = false;
    // Focus the editor after hiding dialog
    // Only focus on desktop to prevent mobile keyboard from opening
    if (!this.isMobileDevice()) {
      setTimeout(() => {
        this.proseMirrorService.focus();
      }, 100);
    }
  }

  onImageInserted(imageData: ImageInsertResult): void {
    if (!this.activeScene || !this.editorView) return;

    // Hide dialog
    this.hideImageDialog();

    // Insert image through ProseMirror service
    this.proseMirrorService.insertImage(imageData, this.imageCursorPosition, true);

    // If the image has an ID (from our image service), add it to the image element for video association
    if (imageData.imageId) {
      // Wait a bit for the image to be inserted into the DOM
      setTimeout(() => {
        const editorElement = this.editorContainer.nativeElement;
        const images = editorElement.querySelectorAll('img[src="' + imageData.url + '"]');

        // Find the most recently added image (should be the last one)
        if (images.length > 0) {
          const lastImage = images[images.length - 1] as HTMLImageElement;
          this.imageVideoService.addImageIdToElement(lastImage, imageData.imageId!);
        }
      }, 100);
    }

    // Focus the editor
    // Only focus on desktop to prevent mobile keyboard from opening
    if (!this.isMobileDevice()) {
      setTimeout(() => {
        this.proseMirrorService.focus();
      }, 100);
    }
  }

  // Scene Navigation Methods

  navigateToPreviousScene(): void {
    const prevScene = this.sceneNav.getPreviousScene();
    if (prevScene) {
      this.selectScene(prevScene.chapterId, prevScene.sceneId);
    }
  }

  navigateToNextScene(): void {
    const nextScene = this.sceneNav.getNextScene();
    if (nextScene) {
      this.selectScene(nextScene.chapterId, nextScene.sceneId);
    }
  }

  hasPreviousScene(): boolean {
    return this.sceneNav.hasPreviousScene();
  }

  hasNextScene(): boolean {
    return this.sceneNav.hasNextScene();
  }

  getCurrentSceneIndex(): number {
    return this.sceneNav.getCurrentSceneIndex();
  }

  getTotalScenes(): number {
    return this.sceneNav.getTotalScenes();
  }

  private async selectScene(chapterId: string, sceneId: string): Promise<void> {
    // Save current scene before switching
    if (this.hasUnsavedChanges) {
      await this.saveStory();
    }

    await this.editorState.setActiveScene(chapterId, sceneId);
    this.updateEditorContent();

    // Update story context for all Beat AI components
    this.proseMirrorService.updateStoryContext({
      storyId: this.story.id,
      chapterId: this.activeChapterId || undefined,
      sceneId: this.activeSceneId || undefined
    });

    // Force change detection
    this.cdr.markForCheck();
  }

  toggleDebugMode(): void {
    this.debugModeEnabled = !this.debugModeEnabled;

    if (this.editorView) {
      this.proseMirrorService.toggleDebugMode(this.debugModeEnabled);
    }

  }

  showStoryStatsModal(): void {
    this.showStoryStats = true;
  }

  hideStoryStats(): void {
    this.showStoryStats = false;
  }

  openMediaGallery(): void {
    this.showMediaGallery = true;
    this.cdr.markForCheck();
  }

  closeMediaGallery(): void {
    this.showMediaGallery = false;
    this.cdr.markForCheck();
  }

  private handleImagePointerEnter = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target || target.tagName.toLowerCase() !== 'img') {
      return;
    }
    this.showVideoActionButton(target as HTMLImageElement);
  };

  private handleImagePointerLeave = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target || target.tagName.toLowerCase() !== 'img') {
      return;
    }
    this.scheduleHideVideoButton();
  };

  private handleImageFocusIn = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target || target.tagName.toLowerCase() !== 'img') {
      return;
    }
    this.showVideoActionButton(target as HTMLImageElement);
  };

  private handleImageFocusOut = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target || target.tagName.toLowerCase() !== 'img') {
      return;
    }
    this.scheduleHideVideoButton();
  };

  private handleWindowViewportChange = (): void => {
    if (this.videoButton.visible && this.videoButton.imageElement) {
      this.positionVideoButton(this.videoButton.imageElement);
    }
  };

  private showVideoActionButton(imageElement: HTMLImageElement): void {
    this.cancelHideVideoButton();
    this.videoButton.imageElement = imageElement;
    this.videoButton.imageAlt = imageElement.getAttribute('alt') || 'Story image';
    this.videoButton.imageId = imageElement.getAttribute('data-image-id');
    this.positionVideoButton(imageElement);
  }

  private positionVideoButton(imageElement: HTMLImageElement): void {
    if (!this.editorWrapper) {
      return;
    }

    const wrapperRect = this.editorWrapper.nativeElement.getBoundingClientRect();
    const imageRect = imageElement.getBoundingClientRect();
    const offset = 8;
    const buttonSize = 36;

    const top = imageRect.top - wrapperRect.top + offset;
    let left = imageRect.right - wrapperRect.left - buttonSize;

    const minLeft = imageRect.left - wrapperRect.left + offset;
    if (left < minLeft) {
      left = minLeft;
    }

    this.videoButton.top = top;
    this.videoButton.left = left;
    this.videoButton.visible = true;
    this.cdr.markForCheck();
  }

  private scheduleHideVideoButton(delay = 200): void {
    this.cancelHideVideoButton();
    this.hideVideoButtonTimeout = setTimeout(() => {
      this.performHideVideoButton();
    }, delay);
  }

  private cancelHideVideoButton(): void {
    if (this.hideVideoButtonTimeout) {
      clearTimeout(this.hideVideoButtonTimeout);
      this.hideVideoButtonTimeout = null;
    }
  }

  private performHideVideoButton(): void {
    if (!this.videoButton.visible) {
      return;
    }
    this.videoButton.visible = false;
    this.videoButton.imageElement = null;
    this.videoButton.imageId = null;
    this.cdr.markForCheck();
  }

  private ensureImageHasId(imageElement: HTMLImageElement): string {
    let imageId = imageElement.getAttribute('data-image-id');
    if (!imageId || imageId === 'no-id') {
      imageId = this.generateImageId();
      this.imageVideoService.addImageIdToElement(imageElement, imageId);
      this.proseMirrorService.updateImageId(imageElement.src, imageId);
      this.editorState.recordUserActivity();
      this.saveSubject.next();
    }
    return imageId;
  }

  onImageClicked(event: ImageClickEvent): void {
    const imageElement = event.imageElement;
    const imageId = event.imageId && event.imageId !== 'no-id'
      ? event.imageId
      : this.ensureImageHasId(imageElement);

    this.currentImageId = imageId;

    const alt = imageElement.getAttribute('alt') || 'Story image';
    const title = imageElement.getAttribute('title') || alt;

    this.imageViewerState = {
      imageSrc: imageElement.src,
      imageAlt: alt,
      imageTitle: title,
      videoSrc: null,
      videoName: null,
      loadingVideo: true
    };

    this.showImageViewer = true;
    this.performHideVideoButton();
    this.cdr.markForCheck();

    void this.loadVideoForImage(imageId, imageElement);
  }

  onVideoButtonClicked(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.videoButton.imageElement) {
      return;
    }

    const ensuredImageId = this.ensureImageHasId(this.videoButton.imageElement);
    this.videoButton.imageId = ensuredImageId;
    this.currentImageId = ensuredImageId;
    this.showImageViewer = false;
    this.showVideoModal = true;
    this.performHideVideoButton();
    this.cdr.markForCheck();
  }

  onVideoButtonPointerEnter(): void {
    this.cancelHideVideoButton();
  }

  onVideoButtonPointerLeave(): void {
    this.scheduleHideVideoButton();
  }

  onVideoButtonFocus(): void {
    this.cancelHideVideoButton();
  }

  onVideoButtonBlur(): void {
    this.scheduleHideVideoButton();
  }

  hideVideoModal(): void {
    this.showVideoModal = false;
    this.currentImageId = null;
  }

  closeImageViewer(): void {
    this.showImageViewer = false;
    this.imageViewerState = {
      ...this.imageViewerState,
      loadingVideo: false
    };
    this.cdr.markForCheck();
  }

  manageVideoFromViewer(): void {
    if (!this.currentImageId && this.imageViewerState.imageSrc && this.editorContainer?.nativeElement) {
      const imageElement = this.editorContainer.nativeElement.querySelector(`img[src="${this.imageViewerState.imageSrc}"]`) as HTMLImageElement | null;
      if (imageElement) {
        const ensuredImageId = this.ensureImageHasId(imageElement);
        this.currentImageId = ensuredImageId;
        this.videoButton.imageElement = imageElement;
        this.videoButton.imageId = ensuredImageId;
      }
    }

    if (!this.currentImageId && this.videoButton.imageElement) {
      this.currentImageId = this.ensureImageHasId(this.videoButton.imageElement);
    }

    if (!this.currentImageId) {
      return;
    }

    this.showImageViewer = false;
    this.showVideoModal = true;
    this.cdr.markForCheck();
  }

  private async loadVideoForImage(imageId: string, imageElement?: HTMLImageElement | null): Promise<void> {
    this.imageViewerState = {
      ...this.imageViewerState,
      loadingVideo: true,
      videoSrc: null,
      videoName: null
    };
    this.cdr.markForCheck();

    try {
      const video = await this.videoService.getVideoForImage(imageId);
      if (video) {
        this.imageViewerState = {
          ...this.imageViewerState,
          videoSrc: this.videoService.getVideoDataUrl(video),
          videoName: video.name,
          loadingVideo: false
        };
        if (imageElement) {
          this.imageVideoService.addVideoIndicator(imageElement);
        }
      } else {
        this.imageViewerState = {
          ...this.imageViewerState,
          videoSrc: null,
          videoName: null,
          loadingVideo: false
        };
      }
    } catch (error) {
      console.error('Error loading video for image:', error);
      this.imageViewerState = {
        ...this.imageViewerState,
        videoSrc: null,
        videoName: null,
        loadingVideo: false
      };
    } finally {
      this.cdr.markForCheck();
    }
  }

  private generateImageId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  onVideoAssociated(event: { imageId: string; videoId: string }): void {
    console.log('Video associated with image:', event);

    const imageElements = this.editorContainer.nativeElement.querySelectorAll(`[data-image-id="${event.imageId}"]`);
    imageElements.forEach((imgElement: Element) => {
      if (imgElement instanceof HTMLImageElement) {
        this.imageVideoService.addVideoIndicator(imgElement);
      }
    });

    if (this.showImageViewer && this.currentImageId === event.imageId) {
      const primaryImage = imageElements[0] as HTMLImageElement | undefined;
      void this.loadVideoForImage(event.imageId, primaryImage ?? null);
    }
  }

  /**
   * Check all images in the editor for existing video associations and add indicators
   */
  private async updateImageVideoIndicators(): Promise<void> {
    if (!this.editorContainer) return;

    // Only check images that already have IDs for video associations
    const images = this.editorContainer.nativeElement.querySelectorAll('img[data-image-id]');
    console.log('Checking for video associations, found images with IDs:', images.length);

    for (const imgElement of Array.from(images)) {
      const imageId = imgElement.getAttribute('data-image-id');
      console.log('Checking image with ID:', imageId);

      if (imageId && imgElement instanceof HTMLImageElement) {
        try {
          const video = await this.videoService.getVideoForImage(imageId);
          console.log('Video found for image', imageId, ':', !!video);

          if (video) {
            this.imageVideoService.addVideoIndicator(imgElement);
            console.log('Added video indicator for image:', imageId);
          }
        } catch (error) {
          console.error('Error checking video for image:', imageId, error);
        }
      }
    }
  }

  async exportToPDF(): Promise<void> {
    let loading: HTMLIonLoadingElement | null = null;

    try {
      console.log('PDF export button clicked');

      // Show export options dialog first
      const modal = await this.modalController.create({
        component: PDFExportDialogComponent,
        cssClass: 'pdf-export-dialog-modal'
      });

      await modal.present();
      const { data, role } = await modal.onWillDismiss();

      // User cancelled
      if (role === 'cancel' || !data) {
        console.log('PDF export cancelled by user');
        return;
      }

      const exportOptions: PDFExportDialogOptions = data;
      console.log('PDF export options:', exportOptions);

      // Save any unsaved changes first
      if (this.hasUnsavedChanges) {
        console.log('Saving unsaved changes before PDF export');
        await this.saveStory();
      }

      // Validate story data
      if (!this.story) {
        throw new Error('No story loaded');
      }

      console.log('Story validation - title:', this.story.title, 'chapters:', this.story.chapters?.length);

      if (!this.story.chapters || this.story.chapters.length === 0) {
        throw new Error('Story has no chapters to export');
      }

      // Check if story has any content
      const hasContent = this.story.chapters.some(chapter =>
        chapter.scenes && chapter.scenes.length > 0 &&
        chapter.scenes.some(scene => scene.content && scene.content.trim().length > 0)
      );

      if (!hasContent) {
        throw new Error('Story has no content to export');
      }

      console.log('Exporting story to PDF:', this.story.title);
      console.log('Story chapters:', this.story.chapters.length);

      // Show progress modal
      loading = await this.loadingController.create({
        message: 'Initializing PDF export...',
        duration: 0, // Don't auto-dismiss
        cssClass: 'pdf-export-loading',
        spinner: 'lines',
        showBackdrop: true,
        backdropDismiss: false
      });

      await loading.present();

      // Subscribe to progress updates
      const progressSubscription = this.pdfExportService.progress$.subscribe(
        (progress: PDFExportProgress) => {
          if (loading) {
            const percentage = Math.round(progress.progress);
            loading.message = `${progress.message} (${percentage}%)`;
          }
        }
      );

      try {
        // Export the story to PDF with user-selected options
        await this.pdfExportService.exportStoryToPDF(this.story, {
          includeBackground: exportOptions.includeBackground,
          format: exportOptions.format,
          orientation: exportOptions.orientation
        });

        console.log('PDF export completed successfully');

        // Small delay to show completion message
        await new Promise(resolve => setTimeout(resolve, 1000));

      } finally {
        // Clean up progress subscription
        progressSubscription.unsubscribe();
      }

    } catch (error) {
      console.error('PDF export failed:', error);

      // Show user-friendly error message using Ionic AlertController
      const errorAlert = await this.alertController.create({
        header: 'PDF Export Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        buttons: ['OK'],
        cssClass: 'pdf-export-error-alert'
      });
      await errorAlert.present();
    } finally {
      // Always dismiss loading modal
      if (loading) {
        await loading.dismiss();
      }
    }
  }


  private applyTextColorToProseMirror(): void {
    setTimeout(() => {
      // Apply text color to all existing elements
      this.applyTextColorToAllElements();

      // Setup MutationObserver to watch for dynamically added Beat AI components
      this.setupMutationObserver();
    }, 100);
  }

  private applyTextColorToAllElements(): void {
    // Set CSS variable on content-editor element
    const contentEditor = document.querySelector('.content-editor');
    if (contentEditor) {
      (contentEditor as HTMLElement).style.setProperty('--editor-text-color', this.currentTextColor);
    }

    // Target the actual ProseMirror element created by the service
    const prosemirrorElement = document.querySelector('.ProseMirror.prosemirror-editor');
    if (prosemirrorElement) {
      (prosemirrorElement as HTMLElement).style.setProperty('--editor-text-color', this.currentTextColor);
      (prosemirrorElement as HTMLElement).style.color = this.currentTextColor;
    }

    // Apply to all Beat AI components
    this.applyTextColorToBeatAIElements();

  }

  private applyTextColorToBeatAIElements(): void {
    // Apply to all Beat AI containers - only set CSS custom property, let CSS handle the rest
    const beatAIContainers = document.querySelectorAll('.beat-ai-container');
    beatAIContainers.forEach((container) => {
      // Set CSS custom property
      (container as HTMLElement).style.setProperty('--beat-ai-text-color', this.currentTextColor);

      // Debug: Check if the variable is actually set
      const computedStyle = window.getComputedStyle(container as HTMLElement);
      computedStyle.getPropertyValue('--beat-ai-text-color');
    });
  }

  private setupMutationObserver(): void {
    // Disconnect existing observer if any
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    // Create new observer to watch for Beat AI components being added
    this.mutationObserver = new MutationObserver((mutations) => {
      let shouldApplyStyles = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;

              // Check if the added node is a Beat AI container or contains one
              if (element.classList?.contains('beat-ai-container') ||
                  element.querySelector?.('.beat-ai-container')) {
                shouldApplyStyles = true;
              }

              // Also check for ProseMirror elements that might be Beat AI related
              if (element.classList?.contains('ProseMirror') ||
                  element.querySelector?.('.ProseMirror')) {
                shouldApplyStyles = true;
              }
            }
          });
        }
      });

      if (shouldApplyStyles) {
        // Apply styles to newly added Beat AI elements
        // Use longer delay to ensure Angular components are fully initialized
        setTimeout(() => {
          this.applyTextColorToBeatAIElements();
        }, 200);
      }
    });

    // Start observing the editor container and its subtree
    const targetNode = document.querySelector('.content-editor') || document.body;
    this.mutationObserver.observe(targetNode, {
      childList: true,
      subtree: true
    });

  }

  getCoverImageUrl(): string | null {
    if (!this.story?.coverImage) return null;
    return `data:image/png;base64,${this.story.coverImage}`;
  }

  async openCoverPopover(event: Event): Promise<void> {
    event.stopPropagation();

    if (!this.story?.coverImage) return;

    const popoverElement = document.createElement('ion-popover');
    popoverElement.showBackdrop = true;
    popoverElement.dismissOnSelect = true;
    popoverElement.cssClass = 'cover-image-popover';
    popoverElement.event = event;

    // Create the content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'cover-popover-content';

    const img = document.createElement('img');
    img.src = this.getCoverImageUrl() || '';
    img.alt = this.story.title || 'Story cover';
    img.className = 'cover-popover-image';

    contentDiv.appendChild(img);
    popoverElement.appendChild(contentDiv);

    document.body.appendChild(popoverElement);
    await popoverElement.present();
  }

  // Beat Navigation Panel Methods
  openBeatNavPanel(): void {
    this.showBeatNavPanel = true;
    this.updateBeatList();
    this.cdr.markForCheck();
  }

  closeBeatNavPanel(): void {
    this.showBeatNavPanel = false;
    this.cdr.markForCheck();
  }

  async onBeatSelected(beatId: string): Promise<void> {
    // Close the panel first
    this.closeBeatNavPanel();

    // Small delay to let panel close animation complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Scroll to the selected beat using ProseMirror service
    // Pass IonContent to ensure header stays fixed on mobile
    await this.proseMirrorService.scrollToBeat(beatId, this.ionContent);
  }

  private updateBeatList(): void {
    // Extract beats from the current editor content
    if (!this.editorView) return;

    const beats = this.proseMirrorService.extractBeatsFromEditor();

    // Update the beat navigation panel component through ViewChild
    if (this.beatNavPanel) {
      this.beatNavPanel.updateBeats(beats);
    }
  }

}
