import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VideoService } from '../../shared/services/video.service';
import { StoredVideo } from '../../shared/models/video.interface';

@Component({
  selector: 'app-video-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="isVisible" (click)="closeModal()" (keyup.escape)="closeModal()" (keyup.enter)="closeModal()" tabindex="0">
      <div class="modal-content" (click)="$event.stopPropagation()" (keyup)="$event.stopPropagation()" tabindex="0">
        <!-- Header -->
        <div class="modal-header">
          <h3>{{ hasVideo ? 'View Video' : 'Add Video' }}</h3>
          <button class="close-btn" (click)="closeModal()" aria-label="Close">✕</button>
        </div>

        <!-- Video Display Mode -->
        <div *ngIf="hasVideo && !isUploading" class="video-section">
          <video 
            #videoPlayer
            class="video-player"
            [src]="videoDataUrl"
            controls
            preload="metadata"
            (loadedmetadata)="onVideoLoaded()"
            (error)="onVideoError()">
            Your browser does not support the video element.
          </video>
          
          <div class="video-info">
            <p class="video-name">{{ currentVideo?.name }}</p>
            <p class="video-size">{{ formatFileSize(currentVideo?.size || 0) }}</p>
          </div>

          <div class="video-actions">
            <button class="replace-btn" (click)="startUpload()">Replace Video</button>
            <button class="remove-btn" (click)="removeVideo()">Remove Video</button>
          </div>
        </div>

        <!-- Video Upload Mode -->
        <div *ngIf="!hasVideo || isUploading" class="upload-section">
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
              accept="video/*"
              style="display: none;">
            <button class="upload-btn" (click)="fileInput.click()" [disabled]="isProcessing">
              📹 Select Video
            </button>
            <p class="upload-hint">or drop video here (max. 50MB)</p>
          </div>

          <div *ngIf="uploadPreview" class="preview-section">
            <video 
              [src]="uploadPreview" 
              class="preview-video"
              controls
              preload="metadata">
              Your browser does not support the video element.
            </video>
            <button class="remove-preview-btn" (click)="removeUploadPreview()">✕</button>
          </div>

          <div *ngIf="isProcessing" class="processing-indicator">
            <div class="loading-spinner"></div>
            <p>Processing video...</p>
          </div>

          <div class="upload-actions" *ngIf="uploadPreview && !isProcessing">
            <button class="cancel-upload-btn" (click)="cancelUpload()">Cancel</button>
            <button class="save-btn" (click)="saveVideo()">Save Video</button>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer" *ngIf="!isUploading && !uploadPreview">
          <button class="close-footer-btn" (click)="closeModal()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 3000;
      outline: none;
    }

    .modal-content {
      background: #2a2a2a;
      border: 1px solid #404040;
      border-radius: 12px;
      max-width: 90vw;
      max-height: 90vh;
      width: 800px;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      outline: none;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid #404040;
    }

    .modal-header h3 {
      margin: 0;
      color: #e0e0e0;
      font-size: 1.3rem;
    }

    .close-btn {
      background: none;
      border: none;
      color: #adb5bd;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: #404040;
      color: #fff;
    }

    .video-section, .upload-section {
      padding: 1.5rem;
    }

    .video-player {
      width: 100%;
      max-height: 60vh;
      border-radius: 8px;
      background: #000;
    }

    .video-info {
      margin: 1rem 0;
      padding: 1rem;
      background: #1a1a1a;
      border-radius: 6px;
      border: 1px solid #404040;
    }

    .video-name {
      margin: 0 0 0.5rem 0;
      font-weight: 500;
      color: #e0e0e0;
      word-break: break-word;
    }

    .video-size {
      margin: 0;
      color: #adb5bd;
      font-size: 0.9rem;
    }

    .video-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
    }

    .replace-btn, .remove-btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .replace-btn {
      background: #007bff;
      color: white;
    }

    .replace-btn:hover {
      background: #0056b3;
    }

    .remove-btn {
      background: #dc3545;
      color: white;
    }

    .remove-btn:hover {
      background: #c82333;
    }

    .upload-area {
      border: 2px dashed #6c757d;
      border-radius: 12px;
      padding: 3rem;
      text-align: center;
      transition: all 0.3s;
      background: #1a1a1a;
    }

    .upload-area.dragover {
      border-color: #28a745;
      background: rgba(40, 167, 69, 0.1);
    }

    .upload-btn {
      padding: 1rem 2rem;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1.1rem;
      transition: all 0.2s;
    }

    .upload-btn:hover:not(:disabled) {
      background: #218838;
      transform: translateY(-1px);
    }

    .upload-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .upload-hint {
      margin: 1rem 0 0 0;
      color: #adb5bd;
      font-size: 0.95rem;
    }

    .preview-section {
      position: relative;
      margin: 1.5rem 0;
      border: 1px solid #404040;
      border-radius: 8px;
      overflow: hidden;
    }

    .preview-video {
      width: 100%;
      max-height: 400px;
      background: #000;
    }

    .remove-preview-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      width: 2.5rem;
      height: 2.5rem;
      background: rgba(220, 53, 69, 0.9);
      color: white;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .remove-preview-btn:hover {
      background: #dc3545;
      transform: scale(1.1);
    }

    .processing-indicator {
      text-align: center;
      padding: 2rem;
      color: #adb5bd;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #404040;
      border-top: 4px solid #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem auto;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .upload-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      margin-top: 1rem;
    }

    .cancel-upload-btn, .save-btn {
      padding: 0.5rem 1.5rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .cancel-upload-btn {
      background: #6c757d;
      color: white;
    }

    .cancel-upload-btn:hover {
      background: #5a6268;
    }

    .save-btn {
      background: #28a745;
      color: white;
    }

    .save-btn:hover {
      background: #218838;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid #404040;
      text-align: center;
    }

    .close-footer-btn {
      padding: 0.5rem 1.5rem;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .close-footer-btn:hover {
      background: #5a6268;
    }

    @media (max-width: 768px) {
      .modal-content {
        width: 95vw;
        max-height: 95vh;
      }

      .modal-header, .video-section, .upload-section {
        padding: 1rem;
      }

      .upload-area {
        padding: 2rem 1rem;
      }

      .video-actions, .upload-actions {
        flex-direction: column;
      }

      .video-player {
        max-height: 50vh;
      }
    }
  `]
})
export class VideoModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isVisible = false;
  @Input() imageId: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() videoAssociated = new EventEmitter<{ imageId: string; videoId: string }>();

  @ViewChild('videoPlayer') videoPlayer?: ElementRef<HTMLVideoElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  private videoService = inject(VideoService);

  // State
  currentVideo: StoredVideo | null = null;
  hasVideo = false;
  isUploading = false;
  isProcessing = false;
  isDragging = false;

  // Upload state
  uploadedFile: File | null = null;
  uploadPreview: string | null = null;

  // Computed properties
  get videoDataUrl(): string {
    return this.currentVideo ? this.videoService.getVideoDataUrl(this.currentVideo) : '';
  }

  async ngOnInit(): Promise<void> {
    console.log('VideoModal ngOnInit with imageId:', this.imageId);
    if (this.imageId) {
      await this.loadVideoForImage();
    }
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    console.log('VideoModal ngOnChanges:', changes);
    
    // Check if imageId changed and the component is visible
    if (changes['imageId'] && this.isVisible && this.imageId) {
      console.log('ImageId changed to:', this.imageId, 'loading video...');
      await this.loadVideoForImage();
    }
    
    // Reset state when modal becomes visible with a new imageId
    if (changes['isVisible']) {
      if (this.isVisible && this.imageId) {
        console.log('Modal became visible with imageId:', this.imageId);
        await this.loadVideoForImage();
      } else if (!this.isVisible) {
        // Reset state when modal is hidden
        console.log('Modal hidden, resetting state');
        this.resetModalState();
      }
    }
  }

  ngOnDestroy(): void {
    this.pauseVideo();
    this.cleanupPreview();
  }

  private async loadVideoForImage(): Promise<void> {
    if (!this.imageId) return;

    try {
      console.log('Loading video for image ID:', this.imageId);
      this.currentVideo = await this.videoService.getVideoForImage(this.imageId);
      this.hasVideo = !!this.currentVideo;
      console.log('Found video for image:', !!this.currentVideo, this.currentVideo);
    } catch (error) {
      console.error('Error loading video:', error);
      this.hasVideo = false;
    }
  }

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
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      alert('Video is too large. Maximum size: 50MB');
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

  removeUploadPreview(): void {
    this.uploadedFile = null;
    this.uploadPreview = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  async saveVideo(): Promise<void> {
    if (!this.uploadedFile || !this.imageId) return;

    this.isProcessing = true;

    try {
      const videoId = await this.videoService.uploadVideo(this.uploadedFile);
      const success = await this.videoService.associateImageWithVideo(this.imageId, videoId);

      if (success) {
        this.videoAssociated.emit({ imageId: this.imageId, videoId });
        await this.loadVideoForImage();
        this.cleanupUpload();
        this.isUploading = false;
      } else {
        throw new Error('Error linking image and video');
      }
    } catch (error) {
      console.error('Error saving video:', error);
      alert('Error saving video. Please try again.');
    } finally {
      this.isProcessing = false;
    }
  }

  startUpload(): void {
    this.isUploading = true;
  }

  cancelUpload(): void {
    this.cleanupUpload();
    this.isUploading = false;
  }

  async removeVideo(): Promise<void> {
    if (!this.imageId || !this.currentVideo) return;

    const confirmed = confirm('Do you really want to remove the link between image and video?');
    if (!confirmed) return;

    try {
      await this.videoService.removeImageVideoAssociation(this.imageId);
      this.currentVideo = null;
      this.hasVideo = false;
    } catch (error) {
      console.error('Error removing association:', error);
      alert('Error removing association.');
    }
  }

  closeModal(): void {
    this.pauseVideo();
    this.cleanupUpload();
    this.isUploading = false;
    this.closed.emit();
  }

  onVideoLoaded(): void {
    // Video loaded successfully
  }

  onVideoError(): void {
    console.error('Error loading video');
    alert('Error loading video.');
  }

  private pauseVideo(): void {
    if (this.videoPlayer?.nativeElement) {
      this.videoPlayer.nativeElement.pause();
    }
  }

  private cleanupUpload(): void {
    this.uploadedFile = null;
    this.uploadPreview = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  private cleanupPreview(): void {
    if (this.uploadPreview) {
      URL.revokeObjectURL(this.uploadPreview);
    }
  }

  private resetModalState(): void {
    this.currentVideo = null;
    this.hasVideo = false;
    this.isUploading = false;
    this.isProcessing = false;
    this.isDragging = false;
    this.uploadedFile = null;
    this.uploadPreview = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
