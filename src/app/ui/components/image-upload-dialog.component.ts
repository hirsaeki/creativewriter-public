import { ChangeDetectorRef, Component, DestroyRef, ElementRef, EventEmitter, Output, ViewChild, ViewRef, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular/standalone';
import { ImageService, ImageUploadResult } from '../../shared/services/image.service';
import { ImageCropperModalComponent } from './image-cropper-modal.component';
import imageCompression from 'browser-image-compression';

type ProcessingStage = 'prepare' | 'compressing' | 'uploading' | 'finalizing';

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
      <div 
        class="dialog-content"
        role="button"
        tabindex="0"
        (click)="$event.stopPropagation()"
        (keyup.enter)="$event.stopPropagation()"
        [attr.aria-busy]="isProcessing">
        <div class="processing-overlay" *ngIf="isProcessing">
          <div class="processing-container" role="status" aria-live="polite">
            <div class="processing-spinner" aria-hidden="true"></div>
            <p>{{ processingMessage }}</p>
          </div>
        </div>
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
          
          <div *ngIf="originalSize" class="size-info">
            <div class="size-comparison">
              <div class="size-item">
                <span class="size-label">Original:</span>
                <span class="size-value">{{ formatFileSize(originalSize) }}</span>
              </div>
              
              <div class="size-item" *ngIf="compressedSize > 0">
                <span class="size-label">Compressed:</span>
                <span class="size-value">{{ formatFileSize(compressedSize) }}</span>
              </div>
              
              <div class="size-item" *ngIf="!compressedSize">
                <span class="size-label">Estimated:</span>
                <span class="size-value estimated">{{ formatFileSize(getEstimatedSize()) }}</span>
              </div>
              
              <div class="size-item" *ngIf="getSizeReduction() > 0 || getEstimatedReduction() > 0">
                <span class="size-label">Reduction:</span>
                <span class="size-value" [class.good-compression]="(getSizeReduction() || getEstimatedReduction()) > 30">
                  {{ getSizeReduction() || getEstimatedReduction() }}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Dialog Actions -->
        <div class="dialog-actions">
          <button class="cancel-btn" (click)="cancel()">Cancel</button>
          <button 
            class="insert-btn" 
            [disabled]="!canInsert() || isProcessing"
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
      overflow-x: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      position: relative;
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
      margin-top: 0.8rem;
      padding: 0.8rem;
      background: #1e1e1e;
      border-radius: 8px;
      text-align: left;
    }

    .size-comparison {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .size-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }

    .size-label {
      font-weight: 500;
      color: rgba(255, 255, 255, 0.7);
    }

    .size-value {
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    }

    .size-value.estimated {
      color: rgba(255, 255, 255, 0.6);
      font-style: italic;
    }

    .size-value.good-compression {
      color: #28a745;
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

    .processing-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
      backdrop-filter: blur(4px);
      pointer-events: all;
    }

    .processing-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      background: rgba(26, 26, 26, 0.9);
      border: 1px solid #404040;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }

    .processing-container p {
      margin: 0;
      color: #e0e0e0;
      font-size: 0.95rem;
      font-weight: 500;
    }

    .processing-spinner {
      width: 42px;
      height: 42px;
      border: 4px solid rgba(255, 255, 255, 0.2);
      border-top-color: #28a745;
      border-radius: 50%;
      animation: processing-spin 1s linear infinite;
    }

    @keyframes processing-spin {
      to {
        transform: rotate(360deg);
      }
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
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

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
  isProcessing = false;
  processingStage: ProcessingStage | null = null;

  private readonly imageService = inject(ImageService);
  private readonly modalController = inject(ModalController);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private viewDestroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.viewDestroyed = true;
    });
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      await this.handleFile(input.files[0]);
    }
    this.resetFileInput(input);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      await this.handleFile(event.dataTransfer.files[0]);
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

  private async handleFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    this.uploadedFile = file;
    this.originalSize = file.size;
    this.activeTab = 'upload';
    this.imageUrl = '';
    this.urlPreview = null;
    this.compressedSize = 0;
    if (!this.altText) {
      this.altText = this.buildAltText(file.name);
    }
    this.uploadPreview = null;

    try {
      const preview = await this.readFileAsDataURL(file);
      this.commitState(() => {
        this.uploadPreview = preview;
      });
    } catch (error) {
      console.error('Error reading image file', error);
      this.commitState(() => {
        alert('Error loading the image preview. Please try again.');
        this.removeUploadedImage();
      });
    }
  }

  private resetFileInput(input?: HTMLInputElement | null): void {
    const target = input ?? this.fileInput?.nativeElement ?? null;
    if (target) {
      target.value = '';
    }
  }

  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.onabort = () => reject(new Error('File reading was aborted'));
      reader.readAsDataURL(file);
    });
  }

  private commitState(mutator: () => void): void {
    if (this.viewDestroyed) {
      return;
    }
    this.zone.run(() => {
      if (this.viewDestroyed) {
        return;
      }
      mutator();
      const viewRef = this.cdr as ViewRef;
      if (!viewRef.destroyed) {
        viewRef.detectChanges();
      }
    });
  }

  private beginProcessing(stage: ProcessingStage): void {
    this.commitState(() => {
      this.isProcessing = true;
      this.processingStage = stage;
    });
  }

  private updateProcessingStage(stage: ProcessingStage): void {
    this.commitState(() => {
      if (!this.isProcessing) {
        return;
      }
      this.processingStage = stage;
    });
  }

  private endProcessing(): void {
    this.commitState(() => {
      this.isProcessing = false;
      this.processingStage = null;
    });
  }

  get processingMessage(): string {
    switch (this.processingStage) {
      case 'compressing':
        return 'Compressing image...';
      case 'uploading':
        return 'Uploading image...';
      case 'finalizing':
        return 'Finishing up...';
      case 'prepare':
      default:
        return 'Preparing image...';
    }
  }

  private buildAltText(filename: string): string {
    const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '');
    return nameWithoutExtension
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Image';
  }

  removeUploadedImage(): void {
    this.uploadedFile = null;
    this.uploadPreview = null;
    this.originalSize = 0;
    this.compressedSize = 0;
    this.resetFileInput();
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
        await this.handleFile(croppedFile);
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

  getEstimatedSize(): number {
    if (!this.originalSize) return 0;
    // Rough estimation based on quality setting
    // WebP typically achieves 25-35% size reduction at quality 0.8
    // JPEG achieves 10-20% size reduction at quality 0.8
    const qualityMultiplier = this.compressionQuality;
    const formatReduction = 0.7; // Assume 30% reduction for WebP format
    return Math.round(this.originalSize * qualityMultiplier * formatReduction);
  }

  getEstimatedReduction(): number {
    if (!this.originalSize) return 0;
    const estimated = this.getEstimatedSize();
    return Math.round(((this.originalSize - estimated) / this.originalSize) * 100);
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
    if (!this.canInsert() || this.isProcessing) return;

    this.beginProcessing('prepare');

    try {
      let imageUrl: string;
      let imageId: string | undefined;

      if (this.activeTab === 'upload' && this.uploadedFile) {
        this.updateProcessingStage('compressing');
        const compressedFile = await this.compressImage(this.uploadedFile);

        this.updateProcessingStage('uploading');
        const uploadResult: ImageUploadResult = await this.imageService.uploadImageWithId(compressedFile);
        imageUrl = uploadResult.url;
        imageId = uploadResult.imageId;
      } else {
        imageUrl = this.imageUrl;
        // External URL images don't have IDs from our system
        imageId = undefined;
      }

      this.updateProcessingStage('finalizing');
      this.imageInserted.emit({
        url: imageUrl,
        alt: this.altText || 'Image',
        title: this.titleText || undefined,
        imageId: imageId
      });
    } catch (error) {
      console.error('Error inserting image:', error);
      alert('Error inserting image. Please try again.');
    } finally {
      this.endProcessing();
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
