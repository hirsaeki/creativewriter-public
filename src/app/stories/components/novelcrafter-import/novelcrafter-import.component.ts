import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NovelCrafterImportService, NovelCrafterImportResult } from '../../../shared/services/novelcrafter-import.service';

@Component({
  selector: 'app-novelcrafter-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './novelcrafter-import.component.html',
  styleUrls: ['./novelcrafter-import.component.scss']
})
export class NovelCrafterImportComponent {
  private router = inject(Router);
  private importService = inject(NovelCrafterImportService);

  isDragOver = signal(false);
  isFolderDragOver = signal(false);
  isImporting = signal(false);
  importStatus = signal('');
  importResult = signal<NovelCrafterImportResult | null>(null);
  importSuccess = signal(false);
  importedStoryId = signal<string | null>(null);

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(false);
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      // Check if it's a ZIP file
      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
        this.processZipFile(files[0]);
      } else {
        this.processFiles(files);
      }
    }
  }

  onFolderDragOver(event: DragEvent) {
    event.preventDefault();
    this.isFolderDragOver.set(true);
  }

  onFolderDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isFolderDragOver.set(false);
  }

  onFolderDrop(event: DragEvent) {
    event.preventDefault();
    this.isFolderDragOver.set(false);
    
    const files = event.dataTransfer?.files;
    if (files) {
      this.processFiles(files);
    }
  }

  onZipFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processZipFile(input.files[0]);
    }
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.processFiles(input.files);
    }
  }

  async processZipFile(zipFile: File) {
    this.isImporting.set(true);
    this.importStatus.set('Extracting ZIP file...');

    try {
      this.importStatus.set('Parsing novel structure...');
      const result = await this.importService.importFromZip(zipFile);
      
      this.importStatus.set('Processing codex entries...');
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.importResult.set(result);
      this.isImporting.set(false);
    } catch (error) {
      console.error('ZIP import failed:', error);
      this.importStatus.set('Import failed: ' + (error as Error).message);
      this.isImporting.set(false);
      
      // Reset after showing error
      setTimeout(() => {
        this.resetImport();
      }, 3000);
    }
  }

  async processFiles(files: FileList) {
    if (files.length === 0) {
      return;
    }

    this.isImporting.set(true);
    this.importStatus.set('Analyzing files...');

    try {
      this.importStatus.set('Parsing novel structure...');
      const result = await this.importService.importFromFiles(files);
      
      this.importStatus.set('Processing codex entries...');
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.importResult.set(result);
      this.isImporting.set(false);
    } catch (error) {
      console.error('Import failed:', error);
      this.importStatus.set('Import failed: ' + (error as Error).message);
      this.isImporting.set(false);
      
      // Reset after showing error
      setTimeout(() => {
        this.resetImport();
      }, 3000);
    }
  }

  async confirmImport() {
    const result = this.importResult();
    if (!result) return;

    this.isImporting.set(true);
    this.importStatus.set('Creating story and importing data...');

    try {
      const storyId = await this.importService.importToStory(result);
      this.importedStoryId.set(storyId);
      this.isImporting.set(false);
      this.importSuccess.set(true);
    } catch (error) {
      console.error('Import to story failed:', error);
      this.importStatus.set('Import failed: ' + (error as Error).message);
      this.isImporting.set(false);
    }
  }

  resetImport() {
    this.importResult.set(null);
    this.importSuccess.set(false);
    this.importedStoryId.set(null);
    this.isImporting.set(false);
    this.importStatus.set('');
  }

  getTotalScenes(): number {
    const result = this.importResult();
    if (!result) return 0;
    return result.story.chapters.reduce((total, chapter) => total + chapter.scenes.length, 0);
  }

  getContentPreview(content: string): string {
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }

  getCustomFieldsSlice(entry: { metadata?: { customFields?: unknown } }): unknown[] {
    const fields = entry.metadata?.['customFields'];
    return Array.isArray(fields) ? fields.slice(0, 2) : [];
  }

  getFieldName(field: unknown): string {
    return (field as { name?: string })?.name || '';
  }

  goToStory() {
    const storyId = this.importedStoryId();
    if (storyId) {
      this.router.navigate(['/stories/editor', storyId]);
    }
  }

  goToStoryList() {
    this.router.navigate(['/']);
  }
}