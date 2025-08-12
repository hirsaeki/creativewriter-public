import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { IonIcon, IonGrid, IonRow, IonCol, IonText, IonCard, IonCardContent, IonButton, IonAlert } from '@ionic/angular/standalone';
import { checkmarkCircle, trashOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { SettingsService } from '../../core/services/settings.service';
import { SyncedCustomBackgroundService, CustomBackgroundOption } from '../services/synced-custom-background.service';

interface BackgroundOption {
  filename: string;
  displayName: string;
  previewPath: string;
}

@Component({
  selector: 'app-background-selector',
  standalone: true,
  imports: [
    CommonModule,
    IonIcon,
    IonGrid,
    IonRow,
    IonCol,
    IonText,
    IonCard,
    IonCardContent,
    IonButton,
    IonAlert
  ],
  template: `
    <div class="background-selector">
      <h3>Select Background</h3>
      
      <!-- Standard Backgrounds -->
      <div class="section-header">
        <h4>Standard Backgrounds</h4>
      </div>
      
      <ion-grid>
        <ion-row>
          <!-- Default option (no background) -->
          <ion-col size="6" size-md="4" size-lg="3">
            <ion-card 
              [class.selected]="selectedBackground() === 'none'"
              (click)="selectBackground('none')"
              button
            >
              <ion-card-content class="preview-card">
                <div class="preview-container no-background">
                  <div class="no-bg-placeholder">
                    <ion-text>No Background</ion-text>
                  </div>
                </div>
                <div class="background-name">Standard</div>
                <ion-icon 
                  *ngIf="selectedBackground() === 'none'"
                  name="checkmark-circle"
                  class="selected-icon"
                ></ion-icon>
              </ion-card-content>
            </ion-card>
          </ion-col>

          <!-- Standard background image options -->
          <ion-col 
            size="6" 
            size-md="4" 
            size-lg="3"
            *ngFor="let background of backgroundOptions"
          >
            <ion-card 
              [class.selected]="selectedBackground() === background.filename"
              (click)="selectBackground(background.filename)"
              button
            >
              <ion-card-content class="preview-card">
                <div class="preview-container">
                  <img 
                    [src]="background.previewPath" 
                    [alt]="background.displayName"
                    class="background-preview"
                    loading="lazy"
                  />
                </div>
                <div class="background-name">{{ background.displayName }}</div>
                <ion-icon 
                  *ngIf="selectedBackground() === background.filename"
                  name="checkmark-circle"
                  class="selected-icon"
                ></ion-icon>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>

      <!-- Custom Backgrounds Section -->
      <div class="section-header" *ngIf="customBackgrounds().length > 0">
        <h4>My Backgrounds</h4>
        <ion-text color="medium">
          <small>{{ customBackgrounds().length }} custom backgrounds</small>
        </ion-text>
      </div>
      
      <ion-grid *ngIf="customBackgrounds().length > 0">
        <ion-row>
          <ion-col 
            size="6" 
            size-md="4" 
            size-lg="3"
            *ngFor="let customBg of customBackgrounds()"
          >
            <ion-card 
              [class.selected]="selectedBackground() === 'custom:' + customBg.id"
              (click)="selectBackground('custom:' + customBg.id)"
              button
            >
              <ion-card-content class="preview-card custom-card">
                <div class="preview-container">
                  <img 
                    [src]="customBg.blobUrl" 
                    [alt]="customBg.name"
                    class="background-preview"
                    loading="lazy"
                  />
                  
                  <!-- Delete button -->
                  <ion-button 
                    fill="clear" 
                    size="small" 
                    color="danger"
                    class="delete-button"
                    (click)="confirmDeleteCustomBackground($event, customBg)"
                  >
                    <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
                  </ion-button>
                </div>
                <div class="background-name">{{ customBg.name }}</div>
                <div class="background-size">{{ formatFileSize(customBg.size) }}</div>
                <ion-icon 
                  *ngIf="selectedBackground() === 'custom:' + customBg.id"
                  name="checkmark-circle"
                  class="selected-icon"
                ></ion-icon>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>

      <!-- Empty state for custom backgrounds -->
      <div class="empty-custom-backgrounds" *ngIf="customBackgrounds().length === 0">
        <ion-text color="medium">
          <p>No custom backgrounds available yet.</p>
          <p>Upload your own images via the settings.</p>
        </ion-text>
      </div>

      <!-- Delete Confirmation Alert -->
      <ion-alert
        [isOpen]="showDeleteAlert"
        header="Delete Background?"
        [message]="deleteMessage"
        [buttons]="deleteButtons"
        (didDismiss)="cancelDelete()"
      ></ion-alert>
    </div>
  `,
  styles: [`
    .background-selector {
      padding: 1rem;
    }

    .background-selector h3 {
      color: var(--ion-color-primary);
      margin-bottom: 1rem;
      font-size: 1.2rem;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 1.5rem 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--ion-color-light-shade);
    }

    .section-header h4 {
      color: var(--ion-color-primary);
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .section-header:first-of-type {
      margin-top: 0;
    }

    .preview-card {
      position: relative;
      padding: 0.75rem;
      text-align: center;
    }

    .preview-container {
      position: relative;
      width: 100%;
      height: 80px;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 0.5rem;
      border: 2px solid var(--ion-color-medium);
      transition: border-color 0.2s ease;
    }

    .background-preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .no-background {
      background: linear-gradient(45deg, 
        var(--ion-color-light) 25%, 
        transparent 25%), 
      linear-gradient(-45deg, 
        var(--ion-color-light) 25%, 
        transparent 25%), 
      linear-gradient(45deg, 
        transparent 75%, 
        var(--ion-color-light) 75%), 
      linear-gradient(-45deg, 
        transparent 75%, 
        var(--ion-color-light) 75%);
      background-size: 10px 10px;
      background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .no-bg-placeholder {
      background: rgba(var(--ion-color-dark-rgb), 0.8);
      color: var(--ion-color-light);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
    }

    .background-name {
      font-size: 0.8rem;
      color: var(--ion-color-medium-shade);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .selected {
      --background: var(--ion-color-primary-tint);
    }

    .selected .preview-container {
      border-color: var(--ion-color-primary);
    }

    .selected .background-name {
      color: var(--ion-color-primary);
      font-weight: 600;
    }

    .selected-icon {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      color: var(--ion-color-primary);
      font-size: 1.2rem;
    }

    .custom-card {
      position: relative;
    }

    .delete-button {
      position: absolute;
      top: 0.25rem;
      left: 0.25rem;
      z-index: 10;
      opacity: 0;
      transition: opacity 0.2s ease;
      --background: rgba(0, 0, 0, 0.7);
      --color: white;
      width: 28px;
      height: 28px;
    }

    .custom-card:hover .delete-button {
      opacity: 1;
    }

    .background-size {
      font-size: 0.7rem;
      color: var(--ion-color-medium-shade);
      text-align: center;
      margin-top: 0.25rem;
    }

    .empty-custom-backgrounds {
      text-align: center;
      padding: 2rem;
      background: var(--ion-color-light-tint);
      border-radius: 8px;
      margin-top: 1rem;
    }

    .empty-custom-backgrounds p {
      margin: 0.5rem 0;
      font-size: 0.9rem;
    }

    ion-card {
      margin: 0.25rem;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    ion-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    @media (max-width: 768px) {
      .preview-container {
        height: 60px;
      }
      
      .background-name {
        font-size: 0.7rem;
      }
      
      .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.25rem;
      }
      
      .delete-button {
        opacity: 1;
        width: 24px;
        height: 24px;
      }
    }
  `]
})
export class BackgroundSelectorComponent implements OnInit, OnChanges {
  private http = inject(HttpClient);

  private settingsService = inject(SettingsService);
  private customBackgroundService = inject(SyncedCustomBackgroundService);

  // Input/Output for parent component integration
  @Input() selectedBackgroundImage = 'none';
  @Output() backgroundImageChange = new EventEmitter<string>();

  // Available background images (loaded dynamically)
  backgroundOptions: BackgroundOption[] = [];

  // Signal for currently selected background
  selectedBackground = signal<string>('none');
  
  // Custom backgrounds from service
  customBackgrounds = computed(() => this.customBackgroundService.backgrounds());
  
  // Delete confirmation state
  showDeleteAlert = false;
  backgroundToDelete: CustomBackgroundOption | null = null;
  
  // Alert content
  get deleteMessage(): string {
    return this.backgroundToDelete ? 
      `Do you really want to delete "${this.backgroundToDelete.name}"?` : '';
  }
  
  deleteButtons = [
    { text: 'Cancel', role: 'cancel' },
    { text: 'Delete', role: 'destructive', handler: () => this.deleteCustomBackground() }
  ];

  constructor() {
    addIcons({ checkmarkCircle, trashOutline });
  }

  ngOnInit() {
    // Initialize with input value
    this.selectedBackground.set(this.selectedBackgroundImage);
    
    // Load available backgrounds dynamically
    this.loadAvailableBackgrounds();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Update when input changes
    if (changes['selectedBackgroundImage'] && changes['selectedBackgroundImage'].currentValue !== undefined) {
      this.selectedBackground.set(changes['selectedBackgroundImage'].currentValue);
    }
  }

  selectBackground(filename: string) {
    this.selectedBackground.set(filename);
    
    // Emit change to parent component
    this.backgroundImageChange.emit(filename);
  }
  
  confirmDeleteCustomBackground(event: Event, customBg: CustomBackgroundOption): void {
    event.stopPropagation(); // Prevent card selection
    this.backgroundToDelete = customBg;
    this.showDeleteAlert = true;
  }
  
  async deleteCustomBackground(): Promise<void> {
    if (!this.backgroundToDelete) return;
    
    try {
      await this.customBackgroundService.deleteBackground(this.backgroundToDelete.id);
      
      // If the deleted background was selected, reset to 'none'
      if (this.selectedBackground() === 'custom:' + this.backgroundToDelete.id) {
        this.selectBackground('none');
      }
      
    } catch (error) {
      console.error('Error deleting custom background:', error);
    } finally {
      this.cancelDelete();
    }
  }
  
  cancelDelete(): void {
    this.showDeleteAlert = false;
    this.backgroundToDelete = null;
  }
  
  formatFileSize(bytes: number): string {
    return this.customBackgroundService.formatFileSize(bytes);
  }

  private async loadAvailableBackgrounds() {
    // List of known image files in the backgrounds folder
    const knownBackgrounds = [
      'abstract-energy-lines.png',
      'cosmic-galaxy-burst.png', 
      'cyberpunk-anime-girl.png',
      'cyberpunk-asian-street.png',
      'cyberpunk-city-noir.png',
      'cyberpunk-neon-corridor.png',
      'dark-witch-forest.png',
      'gothic-dark-moon-woman.png',
      'medieval-castle-street.png',
      'modern-dark-apartment.png',
      'noir-theater-man.png',
      'pirate-ship-captain.png',
      'sci-fi-laboratory.png',
      'space-nebula-stars.png',
      'zombie-apocalypse-scene.png'
    ];
    
    const backgrounds: BackgroundOption[] = [];
    
    // Check which images actually exist and are accessible
    for (const filename of knownBackgrounds) {
      try {
        const img = new Image();
        const imagePath = `assets/backgrounds/${filename}`;
        
        // Test if image loads successfully
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = imagePath;
        });
        
        // If image loads successfully, add to list
        backgrounds.push({
          filename,
          displayName: this.generateDisplayName(filename),
          previewPath: imagePath
        });
        
      } catch {
        // Image doesn't exist or failed to load, skip it
        console.debug(`Background image ${filename} not found or failed to load`);
      }
    }
    
    // Sort alphabetically by display name
    this.backgroundOptions = backgrounds.sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    // If no images were found, use fallback
    if (this.backgroundOptions.length === 0) {
      console.warn('No background images found, using fallback list');
      this.backgroundOptions = this.getFallbackBackgrounds();
    }
  }

  private generateDisplayName(filename: string): string {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.(png|jpg|jpeg|webp)$/i, '');
    
    // Convert kebab-case or snake_case to readable format
    const readable = nameWithoutExt
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return readable;
  }

  private getFallbackBackgrounds(): BackgroundOption[] {
    return [
      {
        filename: 'abstract-energy-lines.png',
        displayName: 'Energie',
        previewPath: 'assets/backgrounds/abstract-energy-lines.png'
      },
      {
        filename: 'cosmic-galaxy-burst.png',
        displayName: 'Galaxie',
        previewPath: 'assets/backgrounds/cosmic-galaxy-burst.png'
      },
      {
        filename: 'cyberpunk-anime-girl.png',
        displayName: 'Cyberpunk Anime',
        previewPath: 'assets/backgrounds/cyberpunk-anime-girl.png'
      },
      {
        filename: 'cyberpunk-asian-street.png',
        displayName: 'Cyberpunk Asien',
        previewPath: 'assets/backgrounds/cyberpunk-asian-street.png'
      },
      {
        filename: 'cyberpunk-city-noir.png',
        displayName: 'Cyberpunk Noir',
        previewPath: 'assets/backgrounds/cyberpunk-city-noir.png'
      },
      {
        filename: 'cyberpunk-neon-corridor.png',
        displayName: 'Cyberpunk Korridor',
        previewPath: 'assets/backgrounds/cyberpunk-neon-corridor.png'
      },
      {
        filename: 'dark-witch-forest.png',
        displayName: 'Hexenwald',
        previewPath: 'assets/backgrounds/dark-witch-forest.png'
      },
      {
        filename: 'gothic-dark-moon-woman.png',
        displayName: 'Gothic Mond',
        previewPath: 'assets/backgrounds/gothic-dark-moon-woman.png'
      },
      {
        filename: 'medieval-castle-street.png',
        displayName: 'Mittelalter',
        previewPath: 'assets/backgrounds/medieval-castle-street.png'
      },
      {
        filename: 'modern-dark-apartment.png',
        displayName: 'Moderne Wohnung',
        previewPath: 'assets/backgrounds/modern-dark-apartment.png'
      },
      {
        filename: 'noir-theater-man.png',
        displayName: 'Noir Theater',
        previewPath: 'assets/backgrounds/noir-theater-man.png'
      },
      {
        filename: 'pirate-ship-captain.png',
        displayName: 'Pirate Captain',
        previewPath: 'assets/backgrounds/pirate-ship-captain.png'
      },
      {
        filename: 'sci-fi-laboratory.png',
        displayName: 'Sci-Fi Labor',
        previewPath: 'assets/backgrounds/sci-fi-laboratory.png'
      },
      {
        filename: 'space-nebula-stars.png',
        displayName: 'Weltraum',
        previewPath: 'assets/backgrounds/space-nebula-stars.png'
      },
      {
        filename: 'zombie-apocalypse-scene.png',
        displayName: 'Apokalypse',
        previewPath: 'assets/backgrounds/zombie-apocalypse-scene.png'
      }
    ];
  }
}