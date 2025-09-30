import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonToggle, IonTextarea, IonRange
} from '@ionic/angular/standalone';
import { NgSelectModule } from '@ng-select/ng-select';
import { Settings } from '../../core/models/settings.interface';
import { ModelOption } from '../../core/models/model.interface';

@Component({
  selector: 'app-scene-generation-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonToggle, IonTextarea, IonRange],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Scene Generation from Outline</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-item>
          <ion-label>Default Target Length (words)</ion-label>
          <ion-range [(ngModel)]="settings.sceneGenerationFromOutline.wordCount"
                     (ngModelChange)="settingsChange.emit()"
                     min="200" max="25000" step="100" slot="end">
            <ion-label slot="start">200</ion-label>
            <ion-label slot="end">25000</ion-label>
          </ion-range>
        </ion-item>

        <ion-item>
          <ion-label>Creativity (Temperature)</ion-label>
          <ion-range [(ngModel)]="settings.sceneGenerationFromOutline.temperature"
                     (ngModelChange)="settingsChange.emit()"
                     min="0" max="1.5" step="0.1" snaps="true" slot="end">
            <ion-label slot="start">0</ion-label>
            <ion-label slot="end">1.5</ion-label>
          </ion-range>
        </ion-item>

        <ion-item>
          <ion-label>Include Story Outline/Context</ion-label>
          <ion-toggle [(ngModel)]="settings.sceneGenerationFromOutline.includeStoryOutline"
                      (ngModelChange)="settingsChange.emit()" slot="end"></ion-toggle>
        </ion-item>

        <ion-item *ngIf="settings.sceneGenerationFromOutline.includeStoryOutline">
          <ion-label>Use Full Text (otherwise summaries)</ion-label>
          <ion-toggle [(ngModel)]="settings.sceneGenerationFromOutline.useFullStoryContext"
                      (ngModelChange)="settingsChange.emit()" slot="end"></ion-toggle>
        </ion-item>

        <ion-item>
          <ion-label>Include Codex</ion-label>
          <ion-toggle [(ngModel)]="settings.sceneGenerationFromOutline.includeCodex"
                      (ngModelChange)="settingsChange.emit()" slot="end"></ion-toggle>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Additional Instructions (optional)</ion-label>
          <ion-textarea [(ngModel)]="settings.sceneGenerationFromOutline.customInstruction"
                        (ngModelChange)="settingsChange.emit()" rows="3" auto-grow="true"
                        placeholder="e.g., Maintain a noir tone; avoid explicit content"></ion-textarea>
        </ion-item>

        <ion-item>
          <ion-label>Use Custom Prompt Template</ion-label>
          <ion-toggle [(ngModel)]="settings.sceneGenerationFromOutline.useCustomPrompt"
                      (ngModelChange)="settingsChange.emit()" slot="end"></ion-toggle>
        </ion-item>

        <ion-item *ngIf="settings.sceneGenerationFromOutline.useCustomPrompt">
          <ion-label position="stacked">
            Custom Prompt Template
            <p class="prompt-help">
              Placeholders: {{ '{' }}storyTitle{{ '}' }}, {{ '{' }}systemMessage{{ '}' }}, {{ '{' }}codexEntries{{ '}' }}, {{ '{' }}storySoFar{{ '}' }}, {{ '{' }}sceneOutline{{ '}' }}, {{ '{' }}wordCount{{ '}' }}, {{ '{' }}languageInstruction{{ '}' }}, {{ '{' }}customInstruction{{ '}' }}
            </p>
          </ion-label>
          <ion-textarea [(ngModel)]="settings.sceneGenerationFromOutline.customPrompt"
                        (ngModelChange)="settingsChange.emit()" rows="12" auto-grow="true"></ion-textarea>
        </ion-item>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    :host { display: block; }
    .prompt-help {
      margin-top: 0.5rem;
      font-size: 0.8rem;
      color: var(--ion-color-medium);
      font-style: italic;
    }
  `]
})
export class SceneGenerationSettingsComponent {
  @Input() settings!: Settings;
  @Input() combinedModels: ModelOption[] = [];
  @Input() loadingModels = false;
  @Input() modelsDisabled = false;

  @Output() settingsChange = new EventEmitter<void>();
}
