import { Component, Input, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonTextarea, IonIcon,
  IonRange, IonToggle, IonFooter, IonSpinner
} from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, sparklesOutline, sendOutline } from 'ionicons/icons';
import { ModelSelectorComponent } from '../../../shared/components/model-selector/model-selector.component';
import { SettingsService } from '../../../core/services/settings.service';
import { StoryService } from '../../services/story.service';
import { SceneGenerationService } from '../../../shared/services/scene-generation.service';

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
  private settingsService = inject(SettingsService);
  private storyService = inject(StoryService);
  private sceneGenService = inject(SceneGenerationService);

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

  constructor() {
    addIcons({ closeOutline, sparklesOutline, sendOutline });
    const s = this.settingsService.getSettings();
    this.temperature = s.openRouter?.temperature ?? 0.7;
    // Use global selectedModel if available
    // ModelSelectorComponent will initialize from settings if empty
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
      });

      // 3) Update the newly created scene with generated content
      await this.storyService.updateScene(this.storyId, this.chapterId, newScene.id, {
        content: result.content
      });

      this.modalCtrl.dismiss({ createdSceneId: newScene.id, chapterId: this.chapterId });
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

  // Language is derived in the service from story settings
}
