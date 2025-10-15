import { Component, Input, Output, EventEmitter, AfterViewInit, OnInit, OnChanges, OnDestroy, SimpleChanges, ChangeDetectorRef, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonList, IonItem, IonButton, IonIcon, IonInput,
  IonBadge, ActionSheetController, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronForward, chevronDown, add, trash, createOutline, close
} from 'ionicons/icons';
import { Story, Chapter, Scene } from '../../models/story.interface';
import { StoryService } from '../../services/story.service';
import { StoryStatsService } from '../../services/story-stats.service';
import { PromptManagerService } from '../../../shared/services/prompt-manager.service';
import { Subscription } from 'rxjs';
import { SceneCreateFromOutlineComponent } from '../scene-create-from-outline/scene-create-from-outline.component';

@Component({
  selector: 'app-story-structure',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonList, IonItem, IonButton, IonIcon, IonInput,
    IonBadge
  ],
  templateUrl: './story-structure.component.html',
  styleUrls: ['./story-structure.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StoryStructureComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  private storyService = inject(StoryService);
  private cdr = inject(ChangeDetectorRef);
  private promptManager = inject(PromptManagerService);
  private router = inject(Router);
  private actionSheetCtrl = inject(ActionSheetController);
  private modalCtrl = inject(ModalController);
  private storyStats = inject(StoryStatsService);

  @Input() story!: Story;
  @Input() activeChapterId: string | null = null;
  @Input() activeSceneId: string | null = null;
  @Output() sceneSelected = new EventEmitter<{chapterId: string, sceneId: string}>();
  @Output() closeSidebar = new EventEmitter<void>();
  
  expandedChapters = new Set<string>();
  isEditingTitle = new Set<string>();
  private originalTitles = new Map<string, string>();
  private subscription = new Subscription();

  constructor() {
    addIcons({
      chevronForward, chevronDown, add, trash, createOutline, close
    });
  }

  ngOnInit() {
    // Auto-expand chapter containing active scene
    this.expandActiveChapter();
  }

  ngOnChanges(changes: SimpleChanges) {
    // When activeChapterId or activeSceneId changes, expand the relevant chapter
    if (changes['activeChapterId'] || changes['activeSceneId']) {
      this.expandActiveChapter();
      // Auto-scroll to active scene when active scene changes
      setTimeout(() => this.scrollToActiveScene(), 100);
    }
  }

  ngAfterViewInit() {
    // Auto-scroll to active scene when component loads
    this.scrollToActiveScene();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
  
  private expandActiveChapter(): void {
    if (!this.story?.chapters) return;
    
    // If we have an active chapter ID, expand it
    if (this.activeChapterId) {
      this.expandedChapters.add(this.activeChapterId);
      return;
    }
    
    // If we have an active scene ID, find and expand its chapter
    if (this.activeSceneId) {
      for (const chapter of this.story.chapters) {
        if (chapter.scenes.some(scene => scene.id === this.activeSceneId)) {
          this.expandedChapters.add(chapter.id);
          return;
        }
      }
    }
    
    // Fallback: expand first chapter if no active chapter/scene
    if (this.story.chapters.length > 0) {
      this.expandedChapters.add(this.story.chapters[0].id);
    }
  }

  trackChapter(index: number, chapter: Chapter): string {
    return chapter.id;
  }

  trackScene(index: number, scene: Scene): string {
    return scene.id;
  }

  toggleChapter(chapterId: string): void {
    if (this.expandedChapters.has(chapterId)) {
      this.expandedChapters.delete(chapterId);
    } else {
      this.expandedChapters.add(chapterId);
    }
  }

  async addChapter(): Promise<void> {
    await this.storyService.addChapter(this.story.id);
    // Refresh story data
    const updatedStory = await this.storyService.getStory(this.story.id);
    if (updatedStory) {
      this.story = updatedStory;
      // Auto-expand new chapter
      const newChapter = this.story.chapters[this.story.chapters.length - 1];
      this.expandedChapters.add(newChapter.id);
    }
  }

  async updateChapter(chapter: Chapter): Promise<void> {
    await this.storyService.updateChapter(this.story.id, chapter.id, { title: chapter.title });
    // Refresh prompt manager when chapter title changes
    this.promptManager.refresh();
  }

  async deleteChapter(chapterId: string, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.story.chapters.length <= 1) {
      alert('A story must have at least one chapter.');
      return;
    }
    
    if (confirm('Really delete chapter? All scenes will be lost.')) {
      await this.storyService.deleteChapter(this.story.id, chapterId);
      const updatedStory = await this.storyService.getStory(this.story.id);
      if (updatedStory) {
      const wasActive = this.activeChapterId === chapterId;
      this.story = updatedStory;
      this.expandedChapters.delete(chapterId);
        // If the deleted chapter was active, select a sensible fallback
        if (wasActive && this.story.chapters.length > 0) {
          const fallbackChapter = this.story.chapters[Math.min(0, this.story.chapters.length - 1)];
          const fallbackScene = fallbackChapter.scenes?.[0];
          if (fallbackScene) {
            this.selectScene(fallbackChapter.id, fallbackScene.id);
          }
        }
        // Refresh prompt manager and mark for check
        this.promptManager.refresh();
        this.cdr.markForCheck();
      }
    }
  }

  async addScene(chapterId: string): Promise<void> {
    // Offer choice: empty or generate from outline
    const sheet = await this.actionSheetCtrl.create({
      header: 'Create Scene',
      subHeader: 'Choose how to create the new scene',
      buttons: [
        {
          text: 'Empty scene',
          role: 'empty',
          icon: 'add',
          handler: async () => {
            await this.createEmptyScene(chapterId);
          }
        },
        {
          text: 'Generate from outline (AI)',
          role: 'ai',
          icon: 'sparkles-outline',
          handler: async () => {
            await this.openCreateFromOutlineModal(chapterId);
          }
        },
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  private async createEmptyScene(chapterId: string): Promise<void> {
    await this.storyService.addScene(this.story.id, chapterId);
    const updatedStory = await this.storyService.getStory(this.story.id);
    if (updatedStory) {
      this.story = updatedStory;
      const chapter = this.story.chapters.find(c => c.id === chapterId);
      if (chapter) {
        const newScene = chapter.scenes[chapter.scenes.length - 1];
        this.selectScene(chapterId, newScene.id);
      }
    }
  }

  private async openCreateFromOutlineModal(chapterId: string): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: SceneCreateFromOutlineComponent,
      componentProps: {
        storyId: this.story.id,
        chapterId
      },
      cssClass: 'scene-create-from-outline-modal'
    });

    await modal.present();
    const result = await modal.onWillDismiss<{ createdSceneId?: string; chapterId?: string }>();
    if (result.data?.createdSceneId && result.data?.chapterId) {
      const updatedStory = await this.storyService.getStory(this.story.id);
      if (updatedStory) {
        this.story = updatedStory;
        this.selectScene(result.data.chapterId, result.data.createdSceneId);
      }
    }
  }

  async updateScene(chapterId: string, scene: Scene): Promise<void> {
    await this.storyService.updateScene(this.story.id, chapterId, scene.id, { title: scene.title });
    // Refresh prompt manager when scene title changes
    this.promptManager.refresh();
  }

  async deleteScene(chapterId: string, sceneId: string, event: Event): Promise<void> {
    event.stopPropagation();
    
    if (confirm('Really delete scene?')) {
      // Find current index before deletion
      const chapterBefore = this.story.chapters.find(c => c.id === chapterId);
      const idxBefore = chapterBefore?.scenes.findIndex(s => s.id === sceneId) ?? -1;

      await this.storyService.deleteScene(this.story.id, chapterId, sceneId);
      const updatedStory = await this.storyService.getStory(this.story.id);
      if (updatedStory) {
        const wasActive = this.activeSceneId === sceneId;
        this.story = updatedStory;
        // If the deleted scene was active, choose a sensible fallback
        if (wasActive) {
          const ch = this.story.chapters.find(c => c.id === chapterId);
          const scenes = ch?.scenes || [];
          if (scenes.length > 0) {
            // Same chapter neighbor (previous index if possible, otherwise first)
            const fallbackIndex = Math.max(0, Math.min(idxBefore, scenes.length - 1));
            const fallbackScene = scenes[fallbackIndex];
            this.selectScene(chapterId, fallbackScene.id);
          } else {
            // Chapter is empty now. Try next chapters, then previous chapters, otherwise create a new empty scene
            const chapters = this.story.chapters;
            const currentIdx = chapters.findIndex(c => c.id === chapterId);
            let selected = false;

            // Search forward for the next chapter that has scenes
            for (let i = currentIdx + 1; i < chapters.length; i++) {
              const nextCh = chapters[i];
              if (nextCh.scenes && nextCh.scenes.length > 0) {
                this.selectScene(nextCh.id, nextCh.scenes[0].id);
                selected = true;
                break;
              }
            }
            // If not found, search backward
            if (!selected) {
              for (let i = currentIdx - 1; i >= 0; i--) {
                const prevCh = chapters[i];
                if (prevCh.scenes && prevCh.scenes.length > 0) {
                  const lastScene = prevCh.scenes[prevCh.scenes.length - 1];
                  this.selectScene(prevCh.id, lastScene.id);
                  selected = true;
                  break;
                }
              }
            }
            // If the entire story has no scenes, create a new empty scene in the current (now empty) chapter
            if (!selected) {
              this.storyService.addScene(this.story.id, chapterId).then(async (newScene) => {
                const refreshed = await this.storyService.getStory(this.story.id);
                if (refreshed) {
                  this.story = refreshed;
                  this.selectScene(chapterId, newScene.id);
                  this.cdr.markForCheck();
                }
              });
            }
          }
        }
        this.promptManager.refresh();
        this.cdr.markForCheck();
      }
    }
  }


  selectScene(chapterId: string, sceneId: string): void {
    this.sceneSelected.emit({ chapterId, sceneId });
  }

  isActiveScene(chapterId: string, sceneId: string): boolean {
    return this.activeChapterId === chapterId && this.activeSceneId === sceneId;
  }

  getWordCount(scene: Scene): number {
    return this.storyStats.calculateSceneWordCount(scene);
  }
  
  private isEventFromTextInput(event: KeyboardEvent): boolean {
    const isElement = (node: EventTarget | null | undefined): node is Element => {
      return !!node && (node as Element).tagName !== undefined;
    };
    const isTextLike = (el: Element): boolean => {
      const tag = el.tagName?.toLowerCase?.() || '';
      if (tag === 'input' || tag === 'textarea' || tag === 'ion-input' || tag === 'ion-textarea') return true;
      if (el instanceof HTMLElement) {
        if (el.isContentEditable) return true;
        const ce = el.getAttribute('contenteditable');
        return ce === '' || ce === 'true';
      }
      return false;
    };
    const pathTargets = (event.composedPath ? event.composedPath() : [event.target]) as EventTarget[];
    for (const t of pathTargets) {
      if (isElement(t) && isTextLike(t)) return true;
    }
    return false;
  }

  onChapterKeyDown(event: KeyboardEvent, chapterId: string): void {
    // Do not handle keys when focus is inside a text input/textarea
    if (this.isEventFromTextInput(event)) return;
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        event.stopPropagation();
        this.toggleChapter(chapterId);
        break;
      case 'ArrowRight':
        if (!this.expandedChapters.has(chapterId)) {
          event.preventDefault();
          this.expandedChapters.add(chapterId);
        }
        break;
      case 'ArrowLeft':
        if (this.expandedChapters.has(chapterId)) {
          event.preventDefault();
          this.expandedChapters.delete(chapterId);
        }
        break;
    }
  }
  
  onSceneKeyDown(event: KeyboardEvent, chapterId: string, sceneId: string): void {
    // Do not handle keys when focus is inside a text input/textarea
    if (this.isEventFromTextInput(event)) return;
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        event.stopPropagation();
        this.selectScene(chapterId, sceneId);
        break;
    }
  }
  
  onCloseSidebar(): void {
    this.closeSidebar.emit();
  }
  
  startEditingTitle(sceneId: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    
    // Find the scene to store its original title
    for (const chapter of this.story.chapters) {
      const scene = chapter.scenes.find(s => s.id === sceneId);
      if (scene) {
        this.originalTitles.set(sceneId, scene.title || '');
        break;
      }
    }
    
    this.isEditingTitle.add(sceneId);
    
    // Focus the input after Angular renders it
    setTimeout(() => {
      const inputs = document.querySelectorAll('.scene-title-input-edit');
      inputs.forEach((input: Element) => {
        if (input && 'setFocus' in input && typeof (input as { setFocus: () => void }).setFocus === 'function') {
          (input as { setFocus: () => void }).setFocus();
        }
      });
    }, 50);
  }
  
  stopEditingTitle(chapterId: string, scene: Scene): void {
    this.isEditingTitle.delete(scene.id);
    this.originalTitles.delete(scene.id);
    this.updateScene(chapterId, scene);
  }
  
  cancelEditingTitle(scene: Scene): void {
    // Restore original title
    const originalTitle = this.originalTitles.get(scene.id);
    if (originalTitle !== undefined) {
      scene.title = originalTitle;
    }
    
    this.isEditingTitle.delete(scene.id);
    this.originalTitles.delete(scene.id);
  }
  
  private scrollToActiveScene(): void {
    if (!this.activeSceneId) return;
    
    // Wait for DOM to be updated
    setTimeout(() => {
      const activeSceneElement = document.querySelector(`.scene-item.active-scene`);
      if (!activeSceneElement) return;
      
      // Find just the ion-content element - it's the scrollable container
      const ionContent = document.querySelector('.story-structure ion-content');
      
      if (ionContent) {
        // Get the scrollable element - for ion-content it's usually itself or a child
        const scrollElement = ionContent.shadowRoot?.querySelector('.inner-scroll') || ionContent;
        
        // Simple approach: get element position and scroll to center it
        const elementRect = activeSceneElement.getBoundingClientRect();
        const containerRect = scrollElement.getBoundingClientRect();
        
        // Calculate how much to scroll to center the element
        const elementCenter = elementRect.top + (elementRect.height / 2);
        const containerCenter = containerRect.top + (containerRect.height / 2);
        const scrollOffset = elementCenter - containerCenter;
        
        // Apply the scroll offset
        const currentScrollTop = scrollElement.scrollTop || 0;
        const newScrollTop = currentScrollTop + scrollOffset;
        
        // Scroll to the calculated position
        if (scrollElement.scrollTo) {
          scrollElement.scrollTo({
            top: newScrollTop,
            behavior: 'instant'
          });
        } else {
          scrollElement.scrollTop = newScrollTop;
        }
      }
      
    }, 150); // Slightly longer timeout to ensure DOM is ready
  }

  // Methods for formatting chapter and scene displays with IDs
  getChapterDisplayTitle(chapter: Chapter): string {
    return this.storyService.formatChapterDisplay(chapter);
  }

  getSceneDisplayTitle(chapter: Chapter, scene: Scene): string {
    return this.storyService.formatSceneDisplay(chapter, scene);
  }
}
