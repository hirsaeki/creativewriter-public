import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, videocamOutline, imagesOutline } from 'ionicons/icons';
import { Story } from '../../models/story.interface';
import { ImageService } from '../../../shared/services/image.service';
import { VideoService } from '../../../shared/services/video.service';
import { ImageViewerModalComponent } from '../../../shared/components/image-viewer-modal/image-viewer-modal.component';

interface MediaItem {
  imageId: string;
  imageSrc: string;
  hasVideo: boolean;
  videoId?: string;
  imageAlt?: string;
}

@Component({
  selector: 'app-story-media-gallery',
  standalone: true,
  imports: [
    CommonModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonSpinner,
    ImageViewerModalComponent
  ],
  templateUrl: './story-media-gallery.component.html',
  styleUrls: ['./story-media-gallery.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StoryMediaGalleryComponent implements OnInit, OnChanges {
  @Input() story: Story | null = null;
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();

  mediaItems: MediaItem[] = [];
  isLoading = false;
  selectedMediaItem: MediaItem | null = null;
  showImageViewer = false;
  loadingVideo = false;
  selectedVideoSrc: string | null = null;
  selectedVideoName: string | null = null;

  private imageService = inject(ImageService);
  private videoService = inject(VideoService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({ close, videocamOutline, imagesOutline });
  }

  ngOnInit(): void {
    if (this.isOpen && this.story) {
      void this.loadMediaItems();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.story) {
      void this.loadMediaItems();
    }
  }

  async loadMediaItems(): Promise<void> {
    if (!this.story) {
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    try {
      // Load all images from the database
      const allImages = await this.imageService.getAllImages();

      // Load images and check for videos
      const items: MediaItem[] = [];

      for (const image of allImages) {
        // Check if this image has an associated video
        const video = await this.videoService.getVideoForImage(image.id);

        items.push({
          imageId: image.id,
          imageSrc: this.imageService.getImageDataUrl(image),
          hasVideo: !!video,
          videoId: video?.id,
          imageAlt: image.name
        });
      }

      this.mediaItems = items;
    } catch (error) {
      console.error('Error loading media items:', error);
      this.mediaItems = [];
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async onMediaItemClick(item: MediaItem): Promise<void> {
    this.selectedMediaItem = item;

    // If there's an associated video, load it
    if (item.hasVideo && item.videoId) {
      this.loadingVideo = true;
      this.cdr.markForCheck();

      try {
        const video = await this.videoService.getVideo(item.videoId);
        if (video) {
          this.selectedVideoSrc = this.videoService.getVideoDataUrl(video);
          this.selectedVideoName = video.name;
        }
      } catch (error) {
        console.error('Error loading video:', error);
        this.selectedVideoSrc = null;
        this.selectedVideoName = null;
      } finally {
        this.loadingVideo = false;
        this.cdr.markForCheck();
      }
    } else {
      this.selectedVideoSrc = null;
      this.selectedVideoName = null;
    }

    this.showImageViewer = true;
    this.cdr.markForCheck();
  }

  onImageViewerClosed(): void {
    this.showImageViewer = false;
    this.selectedMediaItem = null;
    this.selectedVideoSrc = null;
    this.selectedVideoName = null;
    this.cdr.markForCheck();
  }

  onClose(): void {
    this.closed.emit();
  }

  onModalDidDismiss(): void {
    this.closed.emit();
  }
}
