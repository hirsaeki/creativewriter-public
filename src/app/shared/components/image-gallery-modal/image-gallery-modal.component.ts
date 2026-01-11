import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, downloadOutline, chevronBack, chevronForward } from 'ionicons/icons';
import { GeneratedImage } from '../../services/image-providers/image-provider.interface';

@Component({
  selector: 'app-image-gallery-modal',
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
    IonContent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './image-gallery-modal.component.html',
  styleUrls: ['./image-gallery-modal.component.scss']
})
export class ImageGalleryModalComponent implements OnDestroy {
  @Input() isOpen = false;
  @Input() images: GeneratedImage[] = [];
  @Input() initialIndex = 0;
  @Input() prompt = '';

  @Output() closed = new EventEmitter<void>();

  @ViewChild(IonModal) modal?: IonModal;
  @ViewChild('swiperRef') swiperRef?: ElementRef;

  currentIndex = 0;
  private slideChangeHandler?: () => void;
  private eventsInitialized = false;
  private rafId: number | null = null;

  constructor() {
    addIcons({ close, downloadOutline, chevronBack, chevronForward });
  }

  ngOnDestroy(): void {
    // Cancel any pending requestAnimationFrame
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.removeEventListeners();
  }

  private setupSwiperEvents(): void {
    if (this.eventsInitialized) return;

    const swiperEl = this.swiperRef?.nativeElement;
    if (swiperEl) {
      this.slideChangeHandler = () => {
        this.currentIndex = swiperEl.swiper?.activeIndex ?? 0;
      };
      swiperEl.addEventListener('slidechange', this.slideChangeHandler);
      this.eventsInitialized = true;
    }
  }

  private removeEventListeners(): void {
    const swiperEl = this.swiperRef?.nativeElement;
    if (swiperEl && this.slideChangeHandler) {
      swiperEl.removeEventListener('slidechange', this.slideChangeHandler);
      this.slideChangeHandler = undefined;
      this.eventsInitialized = false;
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.onClose();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.previousSlide();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.nextSlide();
        break;
    }
  }

  onModalWillPresent(): void {
    this.currentIndex = this.initialIndex;
    // Wait for swiper to initialize, then set initial slide
    this.initializeSwiperWithRetry();
  }

  private initializeSwiperWithRetry(attempts = 0): void {
    const maxAttempts = 10;
    const swiperEl = this.swiperRef?.nativeElement;

    if (swiperEl?.swiper) {
      this.rafId = null; // Clear RAF ID on success
      swiperEl.swiper.slideTo(this.initialIndex, 0);
      this.setupSwiperEvents();
    } else if (attempts < maxAttempts) {
      // Use requestAnimationFrame for better performance than setTimeout
      // Store the RAF ID so we can cancel it on component destruction
      this.rafId = requestAnimationFrame(() => {
        this.initializeSwiperWithRetry(attempts + 1);
      });
    }
  }

  onModalDidDismiss(): void {
    this.closed.emit();
  }

  onClose(): void {
    if (this.modal) {
      void this.modal.dismiss();
    } else {
      this.closed.emit();
    }
  }

  previousSlide(): void {
    const swiperEl = this.swiperRef?.nativeElement;
    if (swiperEl?.swiper) {
      swiperEl.swiper.slidePrev();
    }
  }

  nextSlide(): void {
    const swiperEl = this.swiperRef?.nativeElement;
    if (swiperEl?.swiper) {
      swiperEl.swiper.slideNext();
    }
  }

  downloadCurrent(): void {
    if (this.images.length === 0) return;
    const image = this.images[this.currentIndex];
    if (!image) return;

    const link = document.createElement('a');
    link.href = image.url;
    link.download = `generated-image-${this.currentIndex + 1}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  onSlideChange(event: Event): void {
    const swiperEl = event.target as HTMLElement & { swiper?: { activeIndex: number } };
    if (swiperEl?.swiper) {
      this.currentIndex = swiperEl.swiper.activeIndex;
    }
  }
}
