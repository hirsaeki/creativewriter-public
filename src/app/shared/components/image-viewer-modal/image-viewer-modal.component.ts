import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-image-viewer-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-viewer-modal.component.html',
  styleUrls: ['./image-viewer-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageViewerModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() imageSrc: string | null = null;
  @Input() imageAlt = '';
  @Input() imageTitle = '';
  @Input() videoSrc: string | null = null;
  @Input() videoName: string | null = null;
  @Input() loadingVideo = false;

  @Output() closed = new EventEmitter<void>();
  @Output() manageVideo = new EventEmitter<void>();

  readonly minZoom = 1;
  readonly maxZoom = 4;
  readonly zoomStep = 0.25;
  zoomLevel = 1;

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imageSrc'] && !changes['imageSrc'].firstChange) {
      this.resetZoom();
    }

    if (changes['isOpen'] && !this.isOpen) {
      this.resetZoom();
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

    this.resetZoom();
    this.closed.emit();
  }

  onManageVideo(event: Event): void {
    event.stopPropagation();
    this.manageVideo.emit();
  }

  onWheel(event: WheelEvent): void {
    if (!this.isOpen) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const direction = event.deltaY < 0 ? 1 : -1;
    this.updateZoom(this.zoomLevel + direction * this.zoomStep);
  }

  onToggleZoom(): void {
    const targetZoom = this.zoomLevel >= 2 ? 1 : 2;
    this.updateZoom(targetZoom);
  }

  zoomIn(): void {
    this.updateZoom(this.zoomLevel + this.zoomStep);
  }

  zoomOut(): void {
    this.updateZoom(this.zoomLevel - this.zoomStep);
  }

  resetZoom(): void {
    this.zoomLevel = 1;
  }

  private updateZoom(level: number): void {
    const bounded = Math.min(this.maxZoom, Math.max(this.minZoom, Number(level.toFixed(2))));
    this.zoomLevel = bounded;
  }
}
