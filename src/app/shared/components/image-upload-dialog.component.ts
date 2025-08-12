import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImageService, ImageUploadResult } from '../services/image.service';

export interface ImageInsertResult {
  url: string;
  alt: string;
  title?: string;
  imageId?: string;
}

@Component({
  selector: 'app-image-upload-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dialog-overlay" role="button" tabindex="0" (click)="cancel()" (keyup.escape)="cancel()">
      <div class="dialog-content" role="button" tabindex="0" (click)="$event.stopPropagation()" (keyup.enter)="$event.stopPropagation()">
        <h3>Insert Image</h3>
        
        <div class="upload-tabs">
          <button 
            class="tab-button" 
            [class.active]="activeTab === 'upload'"
            (click)="activeTab = 'upload'">
            Upload
          </button>
          <button 
            class="tab-button" 
            [class.active]="activeTab === 'url'"
            (click)="activeTab = 'url'">
            URL
          </button>
        </div>

        <div class="tab-content">
          <!-- Upload Tab -->
          <div *ngIf="activeTab === 'upload'" class="upload-section">
            <div 
              class="upload-area"
              [class.dragover]="isDragging"
              (drop)="onDrop($event)"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)">
              <input 
                type="file" 
                #fileInput
                (change)="onFileSelected($event)"
                accept="image/*"
                style="display: none;">
              <button class="upload-btn" (click)="fileInput.click()">
                📁 Select File
              </button>
              <p class="upload-hint">or drop file here</p>
            </div>
            
            <div *ngIf="uploadPreview" class="preview-section">
              <img [src]="uploadPreview" alt="Preview">
              <button class="remove-btn" (click)="removeUploadedImage()">✕</button>
            </div>
          </div>

          <!-- URL Tab -->
          <div *ngIf="activeTab === 'url'" class="url-section">
            <input 
              type="url" 
              class="url-input"
              [(ngModel)]="imageUrl"
              placeholder="https://example.com/image.jpg"
              (input)="onUrlChange()">
            
            <div *ngIf="urlPreview" class="preview-section">
              <img [src]="urlPreview" alt="Preview" (error)="onImageError()">
            </div>
          </div>
        </div>

        <!-- Image Details -->
        <div class="image-details" *ngIf="uploadPreview || urlPreview">
          <label>
            Alt text (for accessibility):
            <input 
              type="text" 
              [(ngModel)]="altText"
              placeholder="Description of the image">
          </label>
          
          <label>
            Title (optional):
            <input 
              type="text" 
              [(ngModel)]="titleText"
              placeholder="Image title">
          </label>
        </div>

        <!-- Dialog Actions -->
        <div class="dialog-actions">
          <button class="cancel-btn" (click)="cancel()">Cancel</button>
          <button 
            class="insert-btn" 
            [disabled]="!canInsert()"
            (click)="insert()">
            Einfügen
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .dialog-content {
      background: #2a2a2a;
      border: 1px solid #404040;
      border-radius: 8px;
      padding: 1.5rem;
      max-width: 500px;
      width: 90vw;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }

    h3 {
      margin: 0 0 1rem 0;
      color: #e0e0e0;
      font-size: 1.2rem;
    }

    .upload-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .tab-button {
      flex: 1;
      padding: 0.5rem 1rem;
      background: #3a3a3a;
      border: 1px solid #404040;
      color: #adb5bd;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .tab-button:hover {
      background: #404040;
    }

    .tab-button.active {
      background: #4a4a4a;
      color: #fff;
      border-color: #6c757d;
    }

    .tab-content {
      margin-bottom: 1rem;
    }

    .upload-area {
      border: 2px dashed #6c757d;
      border-radius: 8px;
      padding: 2rem;
      text-align: center;
      transition: all 0.3s;
    }

    .upload-area.dragover {
      border-color: #28a745;
      background: rgba(40, 167, 69, 0.1);
    }

    .upload-btn {
      padding: 0.5rem 1rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }

    .upload-btn:hover {
      background: #0056b3;
    }

    .upload-hint {
      margin: 0.5rem 0 0 0;
      color: #adb5bd;
      font-size: 0.9rem;
    }

    .url-input {
      width: 100%;
      padding: 0.5rem;
      background: #1a1a1a;
      border: 1px solid #404040;
      color: #fff;
      border-radius: 4px;
      font-size: 1rem;
    }

    .preview-section {
      position: relative;
      margin-top: 1rem;
      border: 1px solid #404040;
      border-radius: 4px;
      overflow: hidden;
    }

    .preview-section img {
      width: 100%;
      height: auto;
      max-height: 300px;
      object-fit: contain;
      background: #1a1a1a;
    }

    .remove-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      width: 2rem;
      height: 2rem;
      background: rgba(220, 53, 69, 0.9);
      color: white;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .remove-btn:hover {
      background: #dc3545;
    }

    .image-details {
      margin-bottom: 1rem;
    }

    .image-details label {
      display: block;
      margin-bottom: 0.5rem;
      color: #adb5bd;
      font-size: 0.9rem;
    }

    .image-details input {
      width: 100%;
      padding: 0.5rem;
      margin-top: 0.25rem;
      background: #1a1a1a;
      border: 1px solid #404040;
      color: #fff;
      border-radius: 4px;
      font-size: 0.9rem;
    }

    .dialog-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }

    .cancel-btn, .insert-btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .cancel-btn {
      background: #6c757d;
      color: white;
    }

    .cancel-btn:hover {
      background: #5a6268;
    }

    .insert-btn {
      background: #28a745;
      color: white;
    }

    .insert-btn:hover:not(:disabled) {
      background: #218838;
    }

    .insert-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @media (max-width: 480px) {
      .dialog-content {
        padding: 1rem;
        width: 95vw;
      }

      h3 {
        font-size: 1.1rem;
      }

      .upload-area {
        padding: 1.5rem;
      }
    }
  `]
})
export class ImageUploadDialogComponent {
  @Output() imageInserted = new EventEmitter<ImageInsertResult>();
  @Output() cancelled = new EventEmitter<void>();

  activeTab: 'upload' | 'url' = 'upload';
  isDragging = false;
  
  // Upload state
  uploadedFile: File | null = null;
  uploadPreview: string | null = null;
  
  // URL state
  imageUrl = '';
  urlPreview: string | null = null;
  
  // Image details
  altText = '';
  titleText = '';

  private readonly imageService = inject(ImageService);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.handleFile(input.files[0]);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  private handleFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    this.uploadedFile = file;
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.uploadPreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeUploadedImage(): void {
    this.uploadedFile = null;
    this.uploadPreview = null;
  }

  onUrlChange(): void {
    // Debounce URL preview
    if (this.imageUrl) {
      this.urlPreview = this.imageUrl;
    } else {
      this.urlPreview = null;
    }
  }

  onImageError(): void {
    this.urlPreview = null;
  }

  canInsert(): boolean {
    if (this.activeTab === 'upload') {
      return !!this.uploadPreview;
    } else {
      return !!this.urlPreview;
    }
  }

  async insert(): Promise<void> {
    if (!this.canInsert()) return;

    try {
      let imageUrl: string;
      let imageId: string | undefined;

      if (this.activeTab === 'upload' && this.uploadedFile) {
        // Convert to base64 for local storage and get both URL and ID
        const uploadResult: ImageUploadResult = await this.imageService.uploadImageWithId(this.uploadedFile);
        imageUrl = uploadResult.url;
        imageId = uploadResult.imageId;
      } else {
        imageUrl = this.imageUrl;
        // External URL images don't have IDs from our system
        imageId = undefined;
      }

      this.imageInserted.emit({
        url: imageUrl,
        alt: this.altText || 'Bild',
        title: this.titleText || undefined,
        imageId: imageId
      });
    } catch (error) {
      console.error('Error inserting image:', error);
      alert('Error inserting image. Please try again.');
    }
  }

  cancel(): void {
    this.cancelled.emit();
  }
}