import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular/standalone';
import { ImageService, ImageUploadResult } from '../services/image.service';
import { ImageCropperModalComponent } from './image-cropper-modal.component';
import imageCompression from 'browser-image-compression';

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
              <div class="image-actions">
                <button class="crop-btn" (click)="cropImage()" title="Crop Image">✂️</button>
                <button class="remove-btn" (click)="removeUploadedImage()" title="Remove">✕</button>
              </div>
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
          <div class="compression-settings" *ngIf="uploadPreview">
            <label>
              Image Quality:
              <input 
                type="range" 
                min="0.1" 
                max="1" 
                step="0.1" 
                [(ngModel)]="compressionQuality"
                class="quality-slider">
              <span class="quality-value">{{ Math.round(compressionQuality * 100) }}%</span>
            </label>
            
            <label>
              Max Width (px):
              <input 
                type="number" 
                [(ngModel)]="maxWidth"
                min="100"
                max="2000"
                placeholder="1200"
                class="size-input">
            </label>
          </div>
          
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
          
          <div *ngIf="originalSize && compressedSize" class="size-info">
            <small>
              Original: {{ formatFileSize(originalSize) }} → 
              Compressed: {{ formatFileSize(compressedSize) }} 
              ({{ getSizeReduction() }}% reduction)
            </small>
          </div>
        </div>

        <!-- Dialog Actions -->
        <div class="dialog-actions">
          <button class="cancel-btn" (click)="cancel()">Cancel</button>
          <button 
            class="insert-btn" 
            [disabled]="!canInsert()"
            (click)="insert()">
            Insert
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

    .image-actions {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      display: flex;
      gap: 0.5rem;
    }

    .crop-btn, .remove-btn {
      width: 2rem;
      height: 2rem;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .crop-btn {
      background: rgba(40, 167, 69, 0.9);
      color: white;
    }

    .crop-btn:hover {
      background: #28a745;
    }

    .remove-btn {
      background: rgba(220, 53, 69, 0.9);
      color: white;
      font-size: 1.2rem;
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

    .compression-settings {
      margin-bottom: 1rem;
      padding: 1rem;
      background: #1e1e1e;
      border: 1px solid #404040;
      border-radius: 4px;
    }

    .compression-settings label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .quality-slider {
      flex: 1;
      height: 4px;
      background: #404040;
      outline: none;
      border-radius: 2px;
    }

    .quality-value {
      min-width: 40px;
      text-align: right;
      font-weight: bold;
      color: #28a745;
    }

    .size-input {
      max-width: 120px !important;
    }

    .size-info {
      margin-top: 0.5rem;
      padding: 0.5rem;
      background: #1e1e1e;
      border-radius: 4px;
      text-align: center;
    }

    .size-info small {
      color: #adb5bd;
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
  
  // Compression settings
  compressionQuality = 0.8;
  maxWidth = 1200;
  originalSize = 0;
  compressedSize = 0;
  Math = Math;

  private readonly imageService = inject(ImageService);
  private readonly modalController = inject(ModalController);

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
    this.originalSize = file.size;
    
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
    this.originalSize = 0;
    this.compressedSize = 0;
  }

  async cropImage(): Promise<void> {
    if (!this.uploadPreview) return;

    try {
      const modal = await this.modalController.create({
        component: ImageCropperModalComponent,
        componentProps: {
          imageBase64: this.uploadPreview,
          initialAspectRatio: 0 // Free aspect ratio
        },
        cssClass: 'image-cropper-modal'
      });

      await modal.present();
      const { data } = await modal.onWillDismiss();
      
      if (data?.croppedImage) {
        // Convert the cropped base64 back to a File
        const croppedFile = await this.base64ToFile(data.croppedImage, this.uploadedFile?.name || 'cropped-image.jpg');
        this.handleFile(croppedFile);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
      alert('Error cropping image. Please try again.');
    }
  }

  private async base64ToFile(base64: string, filename: string): Promise<File> {
    const response = await fetch(base64);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getSizeReduction(): number {
    if (!this.originalSize || !this.compressedSize) return 0;
    return Math.round(((this.originalSize - this.compressedSize) / this.originalSize) * 100);
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
        // Compress the image before uploading
        const compressedFile = await this.compressImage(this.uploadedFile);
        
        // Convert to base64 for local storage and get both URL and ID
        const uploadResult: ImageUploadResult = await this.imageService.uploadImageWithId(compressedFile);
        imageUrl = uploadResult.url;
        imageId = uploadResult.imageId;
      } else {
        imageUrl = this.imageUrl;
        // External URL images don't have IDs from our system
        imageId = undefined;
      }

      this.imageInserted.emit({
        url: imageUrl,
        alt: this.altText || 'Image',
        title: this.titleText || undefined,
        imageId: imageId
      });
    } catch (error) {
      console.error('Error inserting image:', error);
      alert('Error inserting image. Please try again.');
    }
  }

  private async compressImage(file: File): Promise<File> {
    try {
      const options = {
        maxSizeMB: 1, // Max 1MB after compression
        maxWidthOrHeight: this.maxWidth,
        useWebWorker: true,
        initialQuality: this.compressionQuality,
        preserveExif: false
      };

      const compressedFile = await imageCompression(file, options);
      this.compressedSize = compressedFile.size;
      
      console.log('Original size:', this.formatFileSize(file.size));
      console.log('Compressed size:', this.formatFileSize(compressedFile.size));
      
      return compressedFile;
    } catch (error) {
      console.error('Error compressing image:', error);
      // If compression fails, return original file
      return file;
    }
  }

  cancel(): void {
    this.cancelled.emit();
  }
}