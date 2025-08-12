import { Component, Output, EventEmitter, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard, IonCardContent, IonButton, IonIcon, IonItem, IonLabel,
  IonNote, IonText, IonThumbnail, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  cloudUploadOutline, imageOutline, trashOutline, checkmarkCircleOutline,
  warningOutline, closeCircleOutline, cropOutline
} from 'ionicons/icons';
import { ImageCropperModalComponent } from './image-cropper-modal.component';

export interface ImageUploadResult {
  base64Data: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [
    CommonModule,
    IonCard, IonCardContent, IonButton, IonIcon, IonItem, IonLabel,
    IonNote, IonText, IonThumbnail
  ],
  template: `
    <ion-card class="image-upload-card">
      <ion-card-content>
        <!-- Upload Area -->
        <div 
          class="upload-area"
          [class.dragging]="isDragging"
          [class.has-image]="currentImage"
          (click)="triggerFileInput()"
          (keydown)="onKeyDown($event)"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          tabindex="0"
          role="button"
          [attr.aria-label]="currentImage ? 'Change cover image' : 'Upload cover image'">
          
          <!-- No Image State -->
          <div *ngIf="!currentImage" class="upload-prompt">
            <ion-icon name="cloud-upload-outline" class="upload-icon"></ion-icon>
            <ion-text>
              <h3>Upload Cover Image</h3>
              <p>Click or drag an image here</p>
            </ion-text>
            <ion-note>JPG, PNG, WebP • Max. 5MB</ion-note>
          </div>

          <!-- Image Preview -->
          <div *ngIf="currentImage" class="image-preview">
            <ion-thumbnail class="preview-thumbnail">
              <img [src]="currentImage" [alt]="fileName || 'Cover image'" />
            </ion-thumbnail>
            <div class="image-info">
              <ion-text>
                <h4>{{ fileName }}</h4>
                <p>{{ formatFileSize(fileSize) }}</p>
              </ion-text>
              <div class="image-actions">
                <ion-button 
                  fill="clear" 
                  size="small" 
                  color="danger"
                  (click)="removeImage($event)">
                  <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
                </ion-button>
              </div>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <ion-item *ngIf="errorMessage" class="error-item">
          <ion-icon name="warning-outline" color="danger" slot="start"></ion-icon>
          <ion-label color="danger">{{ errorMessage }}</ion-label>
        </ion-item>

        <!-- Success Message -->
        <ion-item *ngIf="successMessage" class="success-item">
          <ion-icon name="checkmark-circle-outline" color="success" slot="start"></ion-icon>
          <ion-label color="success">{{ successMessage }}</ion-label>
        </ion-item>

        <!-- Hidden File Input -->
        <input
          #fileInput
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          (change)="onFileSelected($event)"
          style="display: none;">
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .image-upload-card {
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.3) 0%, rgba(15, 15, 15, 0.3) 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      backdrop-filter: blur(8px) saturate(120%);
      -webkit-backdrop-filter: blur(8px) saturate(120%);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
      --color: #f8f9fa;
    }

    .image-upload-card:hover {
      background: linear-gradient(135deg, rgba(25, 25, 25, 0.4) 0%, rgba(20, 20, 20, 0.4) 100%);
      border-color: rgba(71, 118, 230, 0.3);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      transform: translateY(-2px);
    }

    .upload-area {
      border: 2px dashed rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background: rgba(30, 30, 30, 0.2);
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .upload-area:hover {
      border-color: rgba(71, 118, 230, 0.5);
      background: rgba(30, 30, 30, 0.3);
    }

    .upload-area:focus {
      outline: none;
      border-color: rgba(71, 118, 230, 0.7);
      background: rgba(30, 30, 30, 0.3);
      box-shadow: 0 0 0 2px rgba(71, 118, 230, 0.3);
    }

    .upload-area.dragging {
      border-color: #4776e6;
      background: rgba(71, 118, 230, 0.1);
      transform: scale(1.02);
    }

    .upload-area.has-image {
      padding: 1rem;
      min-height: auto;
    }

    .upload-prompt {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .upload-icon {
      font-size: 3rem;
      color: rgba(71, 118, 230, 0.7);
      margin-bottom: 0.5rem;
    }

    .upload-prompt h3 {
      color: #f8f9fa;
      margin: 0;
      font-size: 1.2rem;
      font-weight: 600;
    }

    .upload-prompt p {
      color: #adb5bd;
      margin: 0;
      font-size: 0.95rem;
    }

    .upload-prompt ion-note {
      color: #6c757d;
      font-size: 0.85rem;
    }

    .image-preview {
      display: flex;
      align-items: center;
      gap: 1rem;
      text-align: left;
      width: 100%;
    }

    .preview-thumbnail {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.2);
      flex-shrink: 0;
    }

    .preview-thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .image-info {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .image-info h4 {
      color: #f8f9fa;
      margin: 0 0 0.25rem 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .image-info p {
      color: #adb5bd;
      margin: 0;
      font-size: 0.85rem;
    }

    .image-actions {
      display: flex;
      gap: 0.5rem;
    }

    .error-item {
      --background: rgba(220, 53, 69, 0.1);
      --border-color: rgba(220, 53, 69, 0.3);
      margin-top: 1rem;
      border-radius: 8px;
    }

    .success-item {
      --background: rgba(25, 135, 84, 0.1);
      --border-color: rgba(25, 135, 84, 0.3);
      margin-top: 1rem;
      border-radius: 8px;
    }

    @media (max-width: 768px) {
      .upload-area {
        padding: 1.5rem;
        min-height: 150px;
      }

      .upload-icon {
        font-size: 2.5rem;
      }

      .upload-prompt h3 {
        font-size: 1.1rem;
      }

      .image-preview {
        flex-direction: column;
        text-align: center;
        gap: 0.75rem;
      }

      .image-info {
        width: 100%;
        flex-direction: column;
        gap: 0.5rem;
      }
    }
  `]
})
export class ImageUploadComponent {
  @Input() currentImage: string | null = null;
  @Input() fileName: string | null = null;
  @Input() fileSize = 0;
  @Output() imageSelected = new EventEmitter<ImageUploadResult>();
  @Output() imageRemoved = new EventEmitter<void>();

  isDragging = false;
  errorMessage = '';
  successMessage = '';

  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  private modalController = inject(ModalController);

  constructor() {
    addIcons({ 
      cloudUploadOutline, imageOutline, trashOutline, checkmarkCircleOutline,
      warningOutline, closeCircleOutline, cropOutline
    });
  }

  triggerFileInput(): void {
    if (this.currentImage) return; // Don't trigger if image already exists
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fileInput?.click();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.triggerFileInput();
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

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (this.currentImage) return; // Don't allow drop if image already exists

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  private async processFile(file: File): Promise<void> {
    this.clearMessages();

    // Validate file type
    if (!this.allowedTypes.includes(file.type)) {
      this.errorMessage = 'Nur JPG, PNG und WebP Dateien sind erlaubt.';
      return;
    }

    // Validate file size
    if (file.size > this.maxFileSize) {
      this.errorMessage = 'The file is too large. Maximum: 5MB';
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      if (result) {
        // Open cropper modal
        const modal = await this.modalController.create({
          component: ImageCropperModalComponent,
          componentProps: {
            imageBase64: result,
            initialAspectRatio: 3/4 // Default portrait aspect ratio
          },
          cssClass: 'image-cropper-modal'
        });

        await modal.present();
        const { data } = await modal.onDidDismiss();

        if (data?.croppedImage) {
          const base64Data = data.croppedImage.split(',')[1]; // Remove data URL prefix
          
          const uploadResult: ImageUploadResult = {
            base64Data,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type
          };

          this.successMessage = 'Bild erfolgreich zugeschnitten und hochgeladen!';
          this.imageSelected.emit(uploadResult);

          // Clear success message after 3 seconds
          setTimeout(() => {
            this.successMessage = '';
          }, 3000);
        }
      }
    };

    reader.onerror = () => {
      this.errorMessage = 'Error reading the file.';
    };

    reader.readAsDataURL(file);
  }

  removeImage(event: Event): void {
    event.stopPropagation();
    this.clearMessages();
    this.imageRemoved.emit();
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}