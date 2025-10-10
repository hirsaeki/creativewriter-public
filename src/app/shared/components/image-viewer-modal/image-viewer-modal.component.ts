import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-image-viewer-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-viewer-modal.component.html',
  styleUrls: ['./image-viewer-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageViewerModalComponent {
  @Input() isOpen = false;
  @Input() imageSrc: string | null = null;
  @Input() imageAlt = '';
  @Input() imageTitle = '';
  @Input() videoSrc: string | null = null;
  @Input() videoName: string | null = null;
  @Input() loadingVideo = false;

  @Output() closed = new EventEmitter<void>();
  @Output() manageVideo = new EventEmitter<void>();

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.onClose();
    }
  }

  onOverlayInteraction(event: Event): void {
    if (event instanceof KeyboardEvent) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        this.onClose();
      }
      return;
    }

    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose(): void {
    if (!this.isOpen) {
      return;
    }

    this.closed.emit();
  }

  onManageVideo(event: Event): void {
    event.stopPropagation();
    this.manageVideo.emit();
  }
}
