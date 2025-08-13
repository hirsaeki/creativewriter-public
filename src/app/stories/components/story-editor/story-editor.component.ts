import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, TemplateRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonButton, IonIcon, 
  IonContent, IonChip, IonLabel, IonMenu, IonSplitPane, MenuController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBack, bookOutline, book, settingsOutline, statsChartOutline, statsChart,
  saveOutline, checkmarkCircleOutline, menuOutline, chevronBack, chevronForward,
  chatbubblesOutline, bugOutline, menu, close, images, documentTextOutline
} from 'ionicons/icons';
import { StoryService } from '../../services/story.service';
import { Story, Scene } from '../../models/story.interface';
import { StoryStructureComponent } from '../story-structure/story-structure.component';
import { SlashCommandDropdownComponent } from '../slash-command-dropdown.component';
import { StoryStatsComponent } from '../story-stats.component';
import { SlashCommandResult, SlashCommandAction } from '../../models/slash-command.interface';
import { Subscription, debounceTime, Subject, throttleTime } from 'rxjs';
import { ProseMirrorEditorService } from '../../../shared/services/prosemirror-editor.service';
import { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';
import { BeatAIPromptEvent } from '../../models/beat-ai.interface';
import { BeatAIService } from '../../../shared/services/beat-ai.service';
import { PromptManagerService } from '../../../shared/services/prompt-manager.service';
import { ImageUploadDialogComponent, ImageInsertResult } from '../../../shared/components/image-upload-dialog.component';
import { VideoModalComponent } from '../../../shared/components/video-modal.component';
import { ImageVideoService, ImageClickEvent } from '../../../shared/services/image-video.service';
import { VideoService } from '../../../shared/services/video.service';
import { AppHeaderComponent, HeaderAction, BurgerMenuItem } from '../../../shared/components/app-header.component';
import { VersionTooltipComponent } from '../../../shared/components/version-tooltip.component';
import { HeaderNavigationService } from '../../../shared/services/header-navigation.service';
import { SettingsService } from '../../../core/services/settings.service';
import { StoryStatsService } from '../../services/story-stats.service';
import { VersionService } from '../../../core/services/version.service';
import { PDFExportService } from '../../../shared/services/pdf-export.service';

@Component({
  selector: 'app-story-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    IonContent, IonChip, IonLabel, IonButton, IonIcon,
    IonMenu, IonSplitPane,
    StoryStructureComponent, SlashCommandDropdownComponent, ImageUploadDialogComponent,
    VideoModalComponent, AppHeaderComponent, StoryStatsComponent, VersionTooltipComponent
  ],
  templateUrl: './story-editor.component.html',
  styleUrls: ['./story-editor.component.scss']
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

  @ViewChild('headerTitle', { static: true }) headerTitle!: TemplateRef<unknown>;
  @ViewChild('burgerMenuFooter', { static: true }) burgerMenuFooter!: TemplateRef<unknown>;
  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;
  @ViewChild(IonContent, { read: IonContent, static: false }) ionContent!: IonContent;
  private editorView: EditorView | null = null;
  private mutationObserver: MutationObserver | null = null;
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
  
  // Video modal functionality
  showVideoModal = false;
  currentImageId: string | null = null;
  
  // Story stats functionality
  showStoryStats = false;
  
  hasUnsavedChanges = false;
  debugModeEnabled = false;
  private saveSubject = new Subject<void>();
  private contentChangeSubject = new Subject<string>();
  private subscription: Subscription = new Subscription();
  private isStreamingActive = false;
  private isSaving = false;
  private pendingSave = false;
  
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

  constructor() {
    addIcons({ 
      arrowBack, bookOutline, book, settingsOutline, statsChartOutline, statsChart,
      saveOutline, checkmarkCircleOutline, menuOutline, chevronBack, chevronForward,
      chatbubblesOutline, bugOutline, menu, close, images, documentTextOutline
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
      })
    );
    
    // Subscribe to image click events
    this.subscription.add(
      this.imageVideoService.imageClicked$.subscribe((event: ImageClickEvent) => {
        this.onImageClicked(event);
      })
    );
    
    const storyId = this.route.snapshot.paramMap.get('id');
    if (storyId) {
      const existingStory = await this.storyService.getStory(storyId);
      if (existingStory) {
        this.story = { ...existingStory };
        
        // Initialize prompt manager with current story
        await this.promptManager.setCurrentStory(this.story.id);
        
        // Auto-select last scene in last chapter
        if (this.story.chapters && this.story.chapters.length > 0) {
          const lastChapter = this.story.chapters[this.story.chapters.length - 1];
          if (lastChapter.scenes && lastChapter.scenes.length > 0) {
            const lastScene = lastChapter.scenes[lastChapter.scenes.length - 1];
            this.activeChapterId = lastChapter.id;
            this.activeSceneId = lastScene.id;
            this.activeScene = lastScene;
          }
        }
        
        // Calculate initial word count for the entire story
        this.updateWordCount();
        
        // Trigger change detection to ensure template is updated
        this.cdr.detectChanges();
        
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
              }, 500);
            });
          }
        }, 0);
      } else {
        // Wenn Story nicht gefunden wird, zur Übersicht zurück
        this.router.navigate(['/']);
      }
    }

    // Auto-save mit optimiertem Debounce
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
          this.activeScene.content = content;
          this.updateWordCount();
          this.onContentChange();
        }
      })
    );
    
    // Subscribe to streaming state to pause auto-save during generation
    this.subscription.add(
      this.beatAIService.isStreaming$.subscribe(isStreaming => {
        this.isStreamingActive = isStreaming;
      })
    );

    
    // Add touch gesture listeners for mobile
    this.setupTouchGestures();
    
    // Setup mobile keyboard handling
    this.setupMobileKeyboardHandling();
  }


  ngOnDestroy(): void {
    // Beim Verlassen der Komponente noch einmal speichern
    if (this.hasUnsavedChanges) {
      this.saveStory();
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
      this.imageVideoService.removeImageClickHandlers(this.editorContainer.nativeElement);
    }
    
    this.subscription.unsubscribe();
    
    // Remove touch gesture listeners
    this.removeTouchGestures();
    
    // Remove keyboard adjustments
    this.removeKeyboardAdjustments();
  }

  async onSceneSelected(event: {chapterId: string, sceneId: string}): Promise<void> {
    this.activeChapterId = event.chapterId;
    this.activeSceneId = event.sceneId;
    this.activeScene = await this.storyService.getScene(this.story.id, event.chapterId, event.sceneId);
    this.updateEditorContent();
    
    // Update story context for all Beat AI components
    this.proseMirrorService.updateStoryContext({
      storyId: this.story.id,
      chapterId: this.activeChapterId,
      sceneId: this.activeSceneId
    });

    // Close menu on mobile after scene selection
    if (window.innerWidth <= 1024) {
      await this.menuController.close('story-menu');
    }
  }

  onStoryTitleChange(): void {
    this.hasUnsavedChanges = true;
    this.saveSubject.next();
  }

  onSceneTitleChange(): void {
    if (this.activeScene && this.activeChapterId) {
      this.hasUnsavedChanges = true;
      this.saveSubject.next();
    }
  }

  onContentChange(): void {
    if (this.activeScene && this.activeChapterId && !this.isStreamingActive) {
      this.hasUnsavedChanges = true;
      this.updateHeaderActions(); // Update header to show unsaved status
      this.saveSubject.next();
      
      // Don't refresh prompt manager on every keystroke - it's too expensive
      // It will be refreshed when actually needed (when opening Beat AI)
    } else if (this.isStreamingActive) {
      // During streaming, only mark as unsaved but don't trigger auto-save
      this.hasUnsavedChanges = true;
      this.updateHeaderActions(); // Update header to show unsaved status
    }
  }

  private async saveStory(): Promise<void> {
    // Prevent concurrent saves
    if (this.isSaving) {
      this.pendingSave = true;
      return;
    }
    
    this.isSaving = true;
    
    try {
      // Only save if we have actual changes
      if (!this.hasUnsavedChanges) {
        this.isSaving = false;
        return;
      }
      
      // Save active scene changes only (not the entire story)
      if (this.activeScene && this.activeChapterId) {
        await this.storyService.updateScene(
          this.story.id, 
          this.activeChapterId, 
          this.activeScene.id, 
          {
            title: this.activeScene.title,
            content: this.activeScene.content
          }
        );
      }
      
      // Save story title if changed
      if (this.story.title !== undefined) {
        const currentStory = await this.storyService.getStory(this.story.id);
        if (currentStory && currentStory.title !== this.story.title) {
          await this.storyService.updateStory({
            ...currentStory,
            title: this.story.title,
            updatedAt: new Date()
          });
        }
      }
      
      this.hasUnsavedChanges = false;
      this.updateHeaderActions(); // Update header to show saved status
      
      // Refresh prompt manager to get the latest scene content for Beat AI
      // Force a complete reload by resetting and re-setting the story
      await this.promptManager.setCurrentStory(null); // Clear current story
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
      await this.promptManager.setCurrentStory(this.story.id); // Re-set story to force complete reload
      
    } catch (error) {
      console.error('Error saving story:', error);
      // Re-mark as unsaved so it can be retried
      this.hasUnsavedChanges = true;
    } finally {
      this.isSaving = false;
      
      // If there was a pending save request during save, execute it
      if (this.pendingSave) {
        this.pendingSave = false;
        setTimeout(() => this.saveStory(), 100);
      }
    }
  }

  async goBack(): Promise<void> {
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
        showOnDesktop: true
      },
      {
        icon: 'book-outline',
        action: () => this.toggleSidebar(),
        showOnMobile: true,
        showOnDesktop: true
      }
    ];
    
    // Right actions (status chips for desktop)
    this.rightActions = [
      {
        icon: this.hasUnsavedChanges ? 'save-outline' : 'checkmark-circle-outline',
        chipContent: this.hasUnsavedChanges ? 'Not saved' : 'Saved',
        chipColor: this.hasUnsavedChanges ? 'warning' : 'success',
        action: () => { /* No action needed for save status indicator */ },
        showOnMobile: false,
        showOnDesktop: true
      },
      {
        icon: 'stats-chart-outline',
        chipContent: `${this.wordCount}w`,
        chipColor: 'medium',
        action: () => this.showStoryStatsModal(),
        showOnMobile: false,
        showOnDesktop: true
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
        icon: 'bug-outline',
        label: 'Debug Modus',
        action: () => this.toggleDebugMode(),
        color: 'warning'
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
        icon: 'stats-chart',
        label: 'AI Logs',
        action: () => this.headerNavService.goToAILogger()
      },
      {
        icon: 'images',
        label: 'Image Generation',
        action: () => this.headerNavService.goToImageGeneration()
      }
    ];
  }

  private updateHeaderActions(): void {
    // Update the save status and word count in the right actions
    if (this.rightActions.length >= 2) {
      // Update save status chip
      this.rightActions[0].icon = this.hasUnsavedChanges ? 'save-outline' : 'checkmark-circle-outline';
      this.rightActions[0].chipContent = this.hasUnsavedChanges ? 'Not saved' : 'Saved';
      this.rightActions[0].chipColor = this.hasUnsavedChanges ? 'warning' : 'success';
      
      // Update word count chip
      this.rightActions[1].chipContent = `${this.wordCount}w`;
      this.rightActions[1].action = () => this.showStoryStatsModal();
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

  getCurrentChapterTitle(): string {
    if (!this.activeChapterId || !this.story.chapters) return '';
    const chapter = this.story.chapters.find(c => c.id === this.activeChapterId);
    return chapter ? `C${chapter.chapterNumber || chapter.order}:${chapter.title}` : '';
  }

  getCurrentSceneTitle(): string {
    if (!this.activeScene || !this.activeChapterId || !this.story.chapters) return '';
    const chapter = this.story.chapters.find(c => c.id === this.activeChapterId);
    if (!chapter) return '';
    const chapterNum = chapter.chapterNumber || chapter.order;
    const sceneNum = this.activeScene.sceneNumber || this.activeScene.order;
    return `C${chapterNum}S${sceneNum}:${this.activeScene.title}`;
  }

  getSceneIdDisplay(): string {
    if (!this.activeScene || !this.activeChapterId || !this.story.chapters) return '';
    const chapter = this.story.chapters.find(c => c.id === this.activeChapterId);
    if (!chapter) return '';
    const chapterNum = chapter.chapterNumber || chapter.order;
    const sceneNum = this.activeScene.sceneNumber || this.activeScene.order;
    return `C${chapterNum}S${sceneNum}`;
  }

  async toggleSidebar(): Promise<void> {
    await this.menuController.toggle('story-menu');
    // Update the sidebar icon in left actions
    const isOpen = await this.menuController.isOpen('story-menu');
    if (this.leftActions.length > 1) {
      this.leftActions[1].icon = isOpen ? 'book' : 'book-outline';
    }
  }


  async onCloseSidebar(): Promise<void> {
    await this.menuController.close('story-menu');
  }
  
  private setupTouchGestures(): void {
    // Touch gestures disabled to prevent accidental sidebar closing
    return;
  }
  
  private removeTouchGestures(): void {
    document.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    document.removeEventListener('touchend', this.handleTouchEnd.bind(this));
  }
  
  private handleTouchStart(event: TouchEvent): void {
    // Only enable gestures on mobile devices, not tablets
    if (window.innerWidth > 768) return;
    
    // Ignore touches that start on interactive elements
    const target = event.target as HTMLElement;
    if (this.isInteractiveElement(target)) {
      return;
    }
    
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }
  
  private handleTouchEnd(event: TouchEvent): void {
    // Only enable gestures on mobile devices, not tablets
    if (window.innerWidth > 768) return;
    
    // Ignore touches that end on interactive elements
    const target = event.target as HTMLElement;
    if (this.isInteractiveElement(target)) {
      return;
    }
    
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
    // const edgeThreshold = window.innerWidth <= 480 ? 30 : 50; // Unused variable
    const minSwipeDistance = window.innerWidth <= 480 ? 40 : this.minSwipeDistance;
    
    // Check if swipe distance is sufficient for this screen size
    if (Math.abs(deltaX) < minSwipeDistance) return;
    
    // Ion-menu handles swipe gestures automatically
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
          this.handleBeatPromptSubmit(event);
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
    
    // Initialize image click handlers for video modal functionality
    this.imageVideoService.initializeImageClickHandlers(this.editorContainer.nativeElement);
    
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
      this.updateWordCount();
      
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
      // No active scene, reset word count
      this.wordCount = 0;
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

  private updateWordCount(): void {
    // Calculate total word count for the entire story using only saved content from localStorage
    this.wordCount = this.storyStatsService.calculateTotalStoryWordCount(this.story);
    
    // Update header actions to reflect the new word count
    this.updateHeaderActions();
    
    this.cdr.detectChanges();
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

  private handleBeatPromptSubmit(event: BeatAIPromptEvent): void {
    // Make sure dropdown is hidden when working with beat AI
    this.hideSlashDropdown();
    
    // Add story context to the beat AI prompt
    const enhancedEvent: BeatAIPromptEvent = {
      ...event,
      storyId: this.story.id,
      chapterId: this.activeChapterId || undefined,
      sceneId: this.activeSceneId || undefined
    };
    
    // Pass the enhanced event to the ProseMirror service
    if (this.proseMirrorService) {
      this.proseMirrorService.handleBeatPromptSubmit(enhancedEvent);
    }
  }

  private handleBeatContentUpdate(): void {
    // Mark as changed but don't trigger immediate save for beat updates
    // These are already saved within the content
    this.hasUnsavedChanges = true;
    this.updateWordCount();
    // Don't trigger save subject - let the regular debounce handle it
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
    const prevScene = this.getPreviousScene();
    if (prevScene) {
      this.selectScene(prevScene.chapterId, prevScene.sceneId);
    }
  }
  
  navigateToNextScene(): void {
    const nextScene = this.getNextScene();
    if (nextScene) {
      this.selectScene(nextScene.chapterId, nextScene.sceneId);
    }
  }
  
  hasPreviousScene(): boolean {
    return this.getPreviousScene() !== null;
  }
  
  hasNextScene(): boolean {
    return this.getNextScene() !== null;
  }
  
  getCurrentSceneIndex(): number {
    if (!this.activeChapterId || !this.activeSceneId) return 0;
    
    let index = 0;
    for (const chapter of this.story.chapters) {
      for (const scene of chapter.scenes) {
        index++;
        if (chapter.id === this.activeChapterId && scene.id === this.activeSceneId) {
          return index;
        }
      }
    }
    return 0;
  }
  
  getTotalScenes(): number {
    return this.story.chapters.reduce((total, chapter) => total + chapter.scenes.length, 0);
  }
  
  private getPreviousScene(): {chapterId: string, sceneId: string} | null {
    if (!this.activeChapterId || !this.activeSceneId) return null;
    
    let previousScene: {chapterId: string, sceneId: string} | null = null;
    
    for (const chapter of this.story.chapters) {
      for (const scene of chapter.scenes) {
        if (chapter.id === this.activeChapterId && scene.id === this.activeSceneId) {
          return previousScene;
        }
        previousScene = { chapterId: chapter.id, sceneId: scene.id };
      }
    }
    
    return null;
  }
  
  private getNextScene(): {chapterId: string, sceneId: string} | null {
    if (!this.activeChapterId || !this.activeSceneId) return null;
    
    let foundCurrent = false;
    
    for (const chapter of this.story.chapters) {
      for (const scene of chapter.scenes) {
        if (foundCurrent) {
          return { chapterId: chapter.id, sceneId: scene.id };
        }
        if (chapter.id === this.activeChapterId && scene.id === this.activeSceneId) {
          foundCurrent = true;
        }
      }
    }
    
    return null;
  }
  
  private async selectScene(chapterId: string, sceneId: string): Promise<void> {
    // Save current scene before switching
    if (this.hasUnsavedChanges) {
      await this.saveStory();
    }
    
    this.activeChapterId = chapterId;
    this.activeSceneId = sceneId;
    this.activeScene = await this.storyService.getScene(this.story.id, chapterId, sceneId);
    this.updateEditorContent();
    
    // Update story context for all Beat AI components
    this.proseMirrorService.updateStoryContext({
      storyId: this.story.id,
      chapterId: this.activeChapterId,
      sceneId: this.activeSceneId
    });
    
    // Force change detection
    this.cdr.detectChanges();
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

  // Video modal methods
  onImageClicked(event: ImageClickEvent): void {
    console.log('Image clicked, event:', event);
    let imageId = event.imageId;
    
    // If image has no ID, generate one now
    if (!imageId || imageId === 'no-id') {
      imageId = this.generateImageId();
      
      // Add ID to the DOM element
      this.imageVideoService.addImageIdToElement(event.imageElement, imageId);
      
      // Update the ProseMirror document with the new ID
      this.proseMirrorService.updateImageId(event.imageElement.src, imageId);
      
      // Mark as having unsaved changes since we modified the image
      this.hasUnsavedChanges = true;
      this.saveSubject.next(); // Trigger auto-save
      
      console.log('Generated new ID for existing image:', imageId);
    }
    
    console.log('Setting currentImageId to:', imageId);
    this.currentImageId = imageId;
    
    // Force change detection to ensure the binding is updated before showing modal
    this.cdr.detectChanges();
    
    console.log('After detectChanges, currentImageId is:', this.currentImageId);
    this.showVideoModal = true;
    console.log('Modal visibility set to:', this.showVideoModal);
  }

  private generateImageId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  hideVideoModal(): void {
    this.showVideoModal = false;
    this.currentImageId = null;
  }
  
  onVideoAssociated(event: { imageId: string; videoId: string }): void {
    console.log('Video associated with image:', event);
    // Video has been successfully associated with the image
    // You might want to update the UI to show that this image now has a video
    
    // Find the image element and add video indicator
    const imageElements = this.editorContainer.nativeElement.querySelectorAll(`[data-image-id="${event.imageId}"]`);
    imageElements.forEach((imgElement: Element) => {
      if (imgElement instanceof HTMLImageElement) {
        this.imageVideoService.addVideoIndicator(imgElement);
      }
    });
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
    try {
      // Save any unsaved changes first
      if (this.hasUnsavedChanges) {
        await this.saveStory();
      }

      // Show loading indicator (you can enhance this with a proper loading dialog)

      // Export the story to PDF with background
      await this.pdfExportService.exportStoryToPDF(this.story, {
        includeBackground: true,
        format: 'a4',
        orientation: 'portrait'
      });

    } catch (error) {
      console.error('PDF export failed:', error);
      // You can add proper error handling/notification here
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

}