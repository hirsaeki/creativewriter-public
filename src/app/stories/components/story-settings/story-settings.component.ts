import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel,
  IonTextarea, IonCheckbox, IonRadio, IonRadioGroup, IonChip, IonNote,
  IonText, IonGrid, IonRow, IonCol, IonProgressBar, IonList, IonThumbnail,
  IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBack, saveOutline, refreshOutline, checkmarkCircleOutline,
  warningOutline, informationCircleOutline, codeSlashOutline,
  settingsOutline, chatboxOutline, documentTextOutline, serverOutline,
  scanOutline, trashOutline, statsChartOutline,
  copyOutline, searchOutline, closeCircleOutline, checkboxOutline,
  squareOutline, imageOutline
} from 'ionicons/icons';
import { StoryService } from '../../services/story.service';
import { Story, StorySettings, DEFAULT_STORY_SETTINGS } from '../../models/story.interface';
import { SettingsTabsComponent, TabItem } from '../../../shared/components/settings-tabs.component';
import { SettingsContentComponent } from '../../../shared/components/settings-content.component';
import { DbMaintenanceService, OrphanedImage, DatabaseStats, DuplicateImage, IntegrityIssue } from '../../../shared/services/db-maintenance.service';
import { ImageUploadComponent, ImageUploadResult } from '../../../shared/components/image-upload.component';

@Component({
  selector: 'app-story-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel,
    IonTextarea, IonCheckbox, IonRadio, IonRadioGroup, IonChip, IonNote,
    IonText, IonGrid, IonRow, IonCol, IonProgressBar, IonList, IonThumbnail,
    IonBadge,
    SettingsTabsComponent, SettingsContentComponent, ImageUploadComponent
  ],
  templateUrl: './story-settings.component.html',
  styleUrls: ['./story-settings.component.scss']
})
export class StorySettingsComponent implements OnInit {
  story: Story | null = null;
  settings: StorySettings = { ...DEFAULT_STORY_SETTINGS };
  hasUnsavedChanges = false;
  private originalSettings!: StorySettings;
  selectedTab = 'general';
  tabItems: TabItem[] = [
    { value: 'general', icon: 'information-circle-outline', label: 'General' },
    { value: 'cover-image', icon: 'image-outline', label: 'Cover Image' },
    { value: 'ai-system', icon: 'chatbox-outline', label: 'AI System' },
    { value: 'beat-config', icon: 'settings-outline', label: 'Beat Config' },
    { value: 'db-maintenance', icon: 'server-outline', label: 'DB Maintenance' }
  ];
  
  placeholders = [
    '{systemMessage}',
    '{codexEntries}',
    '{storySoFar}',
    '{storyTitle}',
    '{sceneFullText}',
    '{wordCount}',
    '{prompt}',
    '{pointOfView}',
    '{writingStyle}'
  ];

  // DB Maintenance properties
  orphanedImages: OrphanedImage[] = [];
  databaseStats: DatabaseStats | null = null;
  duplicateImages: DuplicateImage[] = [];
  integrityIssues: IntegrityIssue[] = [];
  isScanning = false;
  scanProgress = { operation: '', progress: 0, message: '' };
  selectedOrphanedImages = new Set<string>();
  selectedDuplicates = new Set<string>();

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storyService = inject(StoryService);
  private readonly dbMaintenanceService = inject(DbMaintenanceService);

  constructor() {
    addIcons({ 
      arrowBack, saveOutline, refreshOutline, checkmarkCircleOutline,
      warningOutline, informationCircleOutline, codeSlashOutline,
      settingsOutline, chatboxOutline, documentTextOutline, serverOutline,
      scanOutline, trashOutline, statsChartOutline,
      copyOutline, searchOutline, closeCircleOutline, checkboxOutline,
      squareOutline, imageOutline
    });
  }

  async ngOnInit(): Promise<void> {
    const storyId = this.route.snapshot.paramMap.get('id');
    if (storyId) {
      this.story = await this.storyService.getStory(storyId);
      if (this.story) {
        // Load existing settings or use defaults
        this.settings = this.story.settings 
          ? { ...this.story.settings } 
          : { ...DEFAULT_STORY_SETTINGS };
        this.originalSettings = { ...this.settings };
      } else {
        this.router.navigate(['/']);
      }
    }

    // Subscribe to DB maintenance progress
    this.dbMaintenanceService.operationProgress$.subscribe(progress => {
      this.scanProgress = progress;
      this.isScanning = progress.progress > 0 && progress.progress < 100;
    });
  }

  onSettingsChange(): void {
    this.hasUnsavedChanges = 
      JSON.stringify(this.settings) !== JSON.stringify(this.originalSettings);
  }

  async saveSettings(): Promise<void> {
    if (!this.story) return;

    // Update story with new settings
    this.story.settings = { ...this.settings };
    await this.storyService.updateStory(this.story);
    
    this.originalSettings = { ...this.settings };
    this.hasUnsavedChanges = false;
  }

  resetToDefaults(): void {
    if (confirm('Do you really want to reset the settings to default values?')) {
      this.settings = { ...DEFAULT_STORY_SETTINGS };
      this.onSettingsChange();
    }
  }

  goBack(): void {
    if (this.hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Do you really want to leave the page?')) {
        this.navigateBack();
      }
    } else {
      this.navigateBack();
    }
  }

  private navigateBack(): void {
    if (this.story) {
      this.router.navigate(['/stories/editor', this.story.id]);
    } else {
      this.router.navigate(['/']);
    }
  }

  // DB Maintenance methods
  async scanOrphanedImages(): Promise<void> {
    try {
      this.orphanedImages = await this.dbMaintenanceService.findOrphanedImages();
      this.selectedOrphanedImages.clear();
    } catch (error) {
      console.error('Error scanning orphaned images:', error);
    }
  }

  async loadDatabaseStats(): Promise<void> {
    try {
      this.databaseStats = await this.dbMaintenanceService.getDatabaseStats();
    } catch (error) {
      console.error('Error loading database stats:', error);
    }
  }

  async scanDuplicateImages(): Promise<void> {
    try {
      this.duplicateImages = await this.dbMaintenanceService.findDuplicateImages();
      this.selectedDuplicates.clear();
    } catch (error) {
      console.error('Error scanning duplicate images:', error);
    }
  }

  async checkIntegrity(): Promise<void> {
    try {
      this.integrityIssues = await this.dbMaintenanceService.checkStoryIntegrity();
    } catch (error) {
      console.error('Error checking integrity:', error);
    }
  }

  async compactDatabase(): Promise<void> {
    if (confirm('Do you really want to compress the database? This may take some time.')) {
      try {
        const result = await this.dbMaintenanceService.compactDatabase();
        alert(`Compression successful! ${result.saved} documents removed.`);
        await this.loadDatabaseStats(); // Refresh stats
      } catch (error) {
        console.error('Error compacting database:', error);
        alert('Error during database compression.');
      }
    }
  }

  async deleteSelectedOrphanedImages(): Promise<void> {
    const selectedIds = Array.from(this.selectedOrphanedImages);
    if (selectedIds.length === 0) return;

    if (confirm(`Do you really want to delete ${selectedIds.length} orphaned images?`)) {
      try {
        const deletedCount = await this.dbMaintenanceService.deleteOrphanedImages(selectedIds);
        alert(`${deletedCount} images successfully deleted.`);
        await this.scanOrphanedImages(); // Refresh list
        await this.loadDatabaseStats(); // Refresh stats
      } catch (error) {
        console.error('Error deleting orphaned images:', error);
        alert('Error deleting images.');
      }
    }
  }

  async deleteSelectedDuplicates(): Promise<void> {
    const selectedDuplicates = this.duplicateImages.filter(dup => 
      this.selectedDuplicates.has(dup.originalId)
    );
    
    if (selectedDuplicates.length === 0) return;

    const totalToDelete = selectedDuplicates.reduce((sum, dup) => sum + dup.duplicateIds.length, 0);
    
    if (confirm(`Do you really want to delete ${totalToDelete} duplicates?`)) {
      try {
        const deletedCount = await this.dbMaintenanceService.deleteDuplicateImages(selectedDuplicates);
        alert(`${deletedCount} duplicates successfully deleted.`);
        await this.scanDuplicateImages(); // Refresh list
        await this.loadDatabaseStats(); // Refresh stats
      } catch (error) {
        console.error('Error deleting duplicates:', error);
        alert('Error deleting duplicates.');
      }
    }
  }


  toggleOrphanedImageSelection(imageId: string): void {
    if (this.selectedOrphanedImages.has(imageId)) {
      this.selectedOrphanedImages.delete(imageId);
    } else {
      this.selectedOrphanedImages.add(imageId);
    }
  }

  toggleDuplicateSelection(originalId: string): void {
    if (this.selectedDuplicates.has(originalId)) {
      this.selectedDuplicates.delete(originalId);
    } else {
      this.selectedDuplicates.add(originalId);
    }
  }

  selectAllOrphanedImages(): void {
    this.orphanedImages.forEach(img => this.selectedOrphanedImages.add(img.id));
  }

  deselectAllOrphanedImages(): void {
    this.selectedOrphanedImages.clear();
  }

  selectAllDuplicates(): void {
    this.duplicateImages.forEach(dup => this.selectedDuplicates.add(dup.originalId));
  }

  deselectAllDuplicates(): void {
    this.selectedDuplicates.clear();
  }

  formatBytes(bytes: number): string {
    return this.dbMaintenanceService.formatBytes(bytes);
  }

  // Cover Image methods
  getCoverImageDataUrl(): string | null {
    if (!this.story?.coverImage) return null;
    return `data:image/png;base64,${this.story.coverImage}`;
  }

  getCoverImageFileName(): string | null {
    if (!this.story?.coverImage) return null;
    return 'cover-image.png'; // Default filename since we don't store original filename
  }

  getCoverImageFileSize(): number {
    if (!this.story?.coverImage) return 0;
    // Rough estimation: base64 is ~33% larger than binary
    return Math.floor((this.story.coverImage.length * 3) / 4);
  }

  onCoverImageSelected(result: ImageUploadResult): void {
    if (!this.story) return;
    
    this.story.coverImage = result.base64Data;
    this.hasUnsavedChanges = true;
  }

  onCoverImageRemoved(): void {
    if (!this.story) return;
    
    this.story.coverImage = undefined;
    this.hasUnsavedChanges = true;
  }
}