import { Directive, ElementRef, Input, OnInit, OnDestroy, inject, AfterViewInit } from '@angular/core';

@Directive({
  selector: '[appLazyImage]',
  standalone: true
})
export class LazyImageDirective implements OnInit, AfterViewInit, OnDestroy {
  private elementRef = inject(ElementRef);
  private observer?: IntersectionObserver;
  private loaded = false;
  private error = false;

  @Input('appLazyImage') lazySrc = '';
  @Input() lazyPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjNmM2YzIi8+CjxwYXRoIGQ9Im01IDVoMTR2MTRINXoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2NjYyIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxjaXJjbGUgY3g9IjkiIGN5PSI5IiByPSIyIiBmaWxsPSIjY2NjIi8+CjxwYXRoIGQ9Im05IDE3bDMtM0wxOSAxN0g5eiIgZmlsbD0iI2NjYyIvPgo8L3N2Zz4K';
  @Input() lazyErrorSrc = '';

  ngOnInit(): void {
    this.setupIntersectionObserver();
  }

  ngAfterViewInit(): void {
    // Set initial placeholder
    this.setPlaceholder();
    
    // Start observing if we have a lazy src
    if (this.lazySrc && this.observer) {
      this.observer.observe(this.elementRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupIntersectionObserver(): void {
    // Check if IntersectionObserver is available
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback for older browsers - load immediately
      this.loadImage();
      return;
    }

    const options: IntersectionObserverInit = {
      root: null, // Use viewport as root
      rootMargin: '50px', // Start loading 50px before element enters viewport
      threshold: 0.01 // Trigger when at least 1% is visible
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.loaded && !this.error) {
          this.loadImage();
        }
      });
    }, options);
  }

  private setPlaceholder(): void {
    const img = this.elementRef.nativeElement as HTMLImageElement;
    if (!img.src || img.src.startsWith('data:')) {
      img.src = this.lazyPlaceholder;
      img.classList.add('lazy-loading');
    }
  }

  private loadImage(): void {
    if (this.loaded || this.error || !this.lazySrc) return;

    const img = this.elementRef.nativeElement as HTMLImageElement;
    
    // Create a new image to preload
    const tempImg = new Image();
    
    tempImg.onload = () => {
      // Image loaded successfully
      img.src = this.lazySrc;
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-loaded');
      this.loaded = true;
      
      // Stop observing once loaded
      if (this.observer) {
        this.observer.unobserve(img);
      }
    };

    tempImg.onerror = () => {
      // Error loading image
      if (this.lazyErrorSrc) {
        img.src = this.lazyErrorSrc;
      }
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-error');
      this.error = true;
      
      // Stop observing on error
      if (this.observer) {
        this.observer.unobserve(img);
      }
    };

    // Start loading the actual image
    tempImg.src = this.lazySrc;
  }
}