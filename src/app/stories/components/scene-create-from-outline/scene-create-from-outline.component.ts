import { Component, Input, ChangeDetectionStrategy, inject } from '@angular/core';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonTextarea, IonIcon,
  IonRange, IonToggle, IonFooter, IonSpinner,
  ToastController, AlertController
} from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, sparklesOutline, sendOutline } from 'ionicons/icons';
import { ModelSelectorComponent } from '../../../shared/components/model-selector/model-selector.component';
import { SettingsService } from '../../../core/services/settings.service';
import { StoryService } from '../../services/story.service';
import { SceneGenerationService } from '../../../shared/services/scene-generation.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-scene-create-from-outline',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonItem, IonLabel, IonTextarea, IonIcon,
    IonRange, IonToggle, IonFooter,
    IonSpinner,
    ModelSelectorComponent
  ],
  templateUrl: './scene-create-from-outline.component.html',
  styleUrls: ['./scene-create-from-outline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SceneCreateFromOutlineComponent {
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private settingsService = inject(SettingsService);
  private storyService = inject(StoryService);
  private sceneGenService = inject(SceneGenerationService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  @Input() storyId!: string;
  @Input() chapterId!: string;

  outline = '';
  selectedModel = '';
  wordCount = 600;
  includeStoryOutline = true;
  useFullStoryContext = false; // false => summaries
  includeCodex = false;
  temperature = 0.7;
  generating = false;
  error: string | null = null;
  // Progress + cancel
  progressWords = 0;
  progressSegments = 0;
  private cancel$ = new Subject<void>();
  cancelRequested = false;

  constructor() {
    addIcons({ closeOutline, sparklesOutline, sendOutline });
    const s = this.settingsService.getSettings();
    this.temperature = s.sceneGenerationFromOutline?.temperature ?? s.openRouter?.temperature ?? 0.7;
    this.wordCount = s.sceneGenerationFromOutline?.wordCount ?? 600;
    this.includeStoryOutline = s.sceneGenerationFromOutline?.includeStoryOutline ?? true;
    this.useFullStoryContext = s.sceneGenerationFromOutline?.useFullStoryContext ?? false;
    this.includeCodex = s.sceneGenerationFromOutline?.includeCodex ?? false;
    this.selectedModel = s.sceneGenerationFromOutline?.selectedModel || '';
    // If no specific model, ModelSelectorComponent will fallback to global selectedModel
  }

  async create(): Promise<void> {
    this.error = null;
    if (!this.outline || this.outline.trim().length < 5) {
      this.error = 'Please provide a brief outline (at least a few words).';
      return;
    }
    if (!this.selectedModel) {
      this.error = 'Please select an AI model.';
      return;
    }

    this.generating = true;
    this.progressWords = 0;
    this.progressSegments = 0;
    try {
      // 1) Create placeholder scene first to obtain sceneId/order
      const newScene = await this.storyService.addScene(this.storyId, this.chapterId);

      // 2) Generate content from outline
      const result = await this.sceneGenService.generateFromOutline({
        storyId: this.storyId,
        chapterId: this.chapterId,
        sceneId: newScene.id,
        outline: this.outline,
        model: this.selectedModel,
        wordCount: this.wordCount,
        includeStoryOutline: this.includeStoryOutline,
        useFullStoryContext: this.useFullStoryContext,
        includeCodex: this.includeCodex,
        temperature: this.temperature
      }, {
        cancel$: this.cancel$,
        onProgress: ({ words, segments }) => {
          // Ensure UI updates under OnPush by running inside Angular zone
          this.zone.run(() => {
            this.progressWords = words;
            this.progressSegments = segments;
            this.cdr.markForCheck();
          });
        }
      });

      if (result.canceled) {
        // Ask whether to keep or discard partial content
        const alert = await this.alertCtrl.create({
          header: 'Generation canceled',
          message: `Keep partial content? (Segments: ${this.progressSegments}, Words: ${this.progressWords})`,
          buttons: [
            {
              text: 'Discard',
              role: 'cancel',
              handler: async () => {
                // Delete the placeholder scene
                try {
                  await this.storyService.deleteScene(this.storyId, this.chapterId, newScene.id);
                } catch (err) {
                  console.warn('Failed to delete placeholder scene after cancel:', err);
                }
                const toast = await this.toastCtrl.create({
                  message: 'Partial content discarded',
                  duration: 2000,
                  color: 'medium',
                  position: 'bottom'
                });
                await toast.present();
                this.modalCtrl.dismiss();
              }
            },
            {
              text: 'Keep',
              handler: async () => {
                await this.storyService.updateScene(this.storyId, this.chapterId, newScene.id, { content: result.content });
                const toast = await this.toastCtrl.create({
                  message: `Kept partial content (Seg: ${this.progressSegments}, Words: ${this.progressWords})`,
                  duration: 2000,
                  color: 'success',
                  position: 'bottom'
                });
                await toast.present();
                this.modalCtrl.dismiss({ createdSceneId: newScene.id, chapterId: this.chapterId });
              }
            }
          ]
        });
        await alert.present();
      } else {
        // Completed normally: save content and show toast
        await this.storyService.updateScene(this.storyId, this.chapterId, newScene.id, {
          content: result.content
        });
        const toast = await this.toastCtrl.create({
          message: `Scene generated (Seg: ${this.progressSegments}, Words: ${this.progressWords})`,
          duration: 2000,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
        this.modalCtrl.dismiss({ createdSceneId: newScene.id, chapterId: this.chapterId });
      }
    } catch (e: unknown) {
      console.error('Failed to generate scene from outline:', e);
      const message = typeof e === 'object' && e && 'message' in e ? String((e as { message?: unknown }).message) : undefined;
      this.error = message || 'Failed to generate scene.';
    } finally {
      this.generating = false;
    }
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  cancel(): void {
    if (!this.generating || this.cancelRequested) return;
    this.cancelRequested = true;
    this.cancel$.next();
  }

  // Language is derived in the service from story settings
}
