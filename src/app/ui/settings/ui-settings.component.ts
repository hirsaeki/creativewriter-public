import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonCard, IonCardHeader, IonCardTitle, IonCardContent
} from '@ionic/angular/standalone';
import { Settings } from '../../core/models/settings.interface';
import { ColorPickerComponent } from '../components/color-picker.component';
import { BackgroundSelectorComponent } from '../components/background-selector.component';
import { BackgroundUploadComponent } from '../components/background-upload.component';
import { BackgroundService } from '../../shared/services/background.service';
import { CustomBackground } from '../../shared/services/synced-custom-background.service';

@Component({
  selector: 'app-ui-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    ColorPickerComponent, BackgroundSelectorComponent, BackgroundUploadComponent
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Appearance</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="appearance-section">
          <h3>Text Color</h3>
          <p class="appearance-description">
            This color is used for text in the story editor and Beat AI input.
          </p>
          <app-color-picker 
            [color]="settings.appearance.textColor"
            (colorChange)="onTextColorChange($event)">
          </app-color-picker>
        </div>
        
        <div class="appearance-section">
          <app-background-selector 
            [selectedBackgroundImage]="settings.appearance.backgroundImage"
            (backgroundImageChange)="onBackgroundImageChange($event)">
          </app-background-selector>
        </div>
        
        <div class="appearance-section">
          <app-background-upload
            (backgroundUploaded)="onBackgroundUploaded($event)">
          </app-background-upload>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    :host {
      display: block;
    }

    .appearance-section {
      padding: 0.5rem 0;
    }

    .appearance-section h3 {
      color: #f8f9fa;
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .appearance-description {
      color: #adb5bd;
      font-size: 0.9rem;
      margin-bottom: 1rem;
      line-height: 1.4;
    }
  `]
})
export class UiSettingsComponent {
  private backgroundService = inject(BackgroundService);

  @Input() settings!: Settings;
  @Output() settingsChange = new EventEmitter<void>();

  onTextColorChange(color: string): void {
    // Update local settings first to track changes
    this.settings.appearance.textColor = color;
    this.settingsChange.emit();
  }

  onBackgroundImageChange(backgroundImage: string): void {
    // Update local settings first to track changes
    this.settings.appearance.backgroundImage = backgroundImage;
    this.settingsChange.emit();
    
    // Set preview background for immediate visual feedback
    this.backgroundService.setPreviewBackground(backgroundImage);
  }

  onBackgroundUploaded(customBackground: CustomBackground): void {
    // Automatically select the newly uploaded background
    const customId = `custom:${customBackground._id}`;
    this.onBackgroundImageChange(customId);
  }
}
