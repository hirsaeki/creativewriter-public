import { Injectable } from '@angular/core';

/**
 * Convert a PNG filename to WebP format for better performance.
 * Stored filenames remain as .png for backward compatibility.
 * Case-insensitive and only replaces at end of string.
 */
export function convertToWebP(filename: string): string {
  return filename.replace(/\.png$/i, '.webp');
}

export interface OptimizedImageSource {
  src: string;
  format: 'webp' | 'png' | 'jpeg';
  size?: number;
}

export interface ImageLoadResult {
  success: boolean;
  src: string;
  format: string;
  loadTime: number;
  size?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImageOptimizationService {
  private supportedFormats = new Set<string>();
  private formatCheckCache = new Map<string, boolean>();
  private imageLoadCache = new Map<string, ImageLoadResult>();

  // LRU cache configuration - limit cache size to prevent memory leaks
  private readonly MAX_CACHE_SIZE = 100;

  constructor() {
    this.detectSupportedFormats();
  }

  /**
   * Get the best image source based on browser support and size
   */
  getOptimizedImageSrc(basePath: string, originalFormat = 'png'): OptimizedImageSource[] {
    const baseName = basePath.replace(/\.[^/.]+$/, '');
    const sources: OptimizedImageSource[] = [];

    // Add WebP if supported (best compression)
    if (this.supportsWebP()) {
      sources.push({
        src: `${baseName}.webp`,
        format: 'webp'
      });
    }

    // Add original format as fallback
    sources.push({
      src: basePath,
      format: originalFormat as 'webp' | 'png' | 'jpeg'
    });

    return sources;
  }

  /**
   * Preload critical images for better performance
   */
  preloadImage(src: string): Promise<ImageLoadResult> {
    // Check cache first - move to end to mark as recently used (LRU)
    if (this.imageLoadCache.has(src)) {
      const cachedResult = this.imageLoadCache.get(src)!;
      // Move to end of map to mark as most recently used
      this.imageLoadCache.delete(src);
      this.imageLoadCache.set(src, cachedResult);
      return Promise.resolve(cachedResult);
    }

    const startTime = performance.now();
    
    return new Promise((resolve) => {
      const img = new Image();
      
      const handleLoad = () => {
        const loadTime = performance.now() - startTime;
        const result: ImageLoadResult = {
          success: true,
          src,
          format: this.getImageFormat(src),
          loadTime,
          size: this.estimateImageSize(img)
        };

        // Cache the result with LRU eviction
        this.setCacheEntry(src, result);
        resolve(result);
      };

      const handleError = () => {
        const loadTime = performance.now() - startTime;
        const result: ImageLoadResult = {
          success: false,
          src,
          format: this.getImageFormat(src),
          loadTime
        };

        // Cache the error result too with LRU eviction
        this.setCacheEntry(src, result);
        resolve(result);
      };
      
      img.onload = handleLoad;
      img.onerror = handleError;
      
      // Set loading strategy
      img.loading = 'eager'; // For preloading
      img.src = src;
    });
  }

  /**
   * Load image with progressive enhancement
   */
  loadImageProgressively(sources: OptimizedImageSource[]): Promise<ImageLoadResult> {
    if (sources.length === 0) {
      return Promise.reject(new Error('No image sources provided'));
    }

    // Try each source in order of preference
    const trySource = async (index: number): Promise<ImageLoadResult> => {
      if (index >= sources.length) {
        throw new Error('All image sources failed to load');
      }

      try {
        const result = await this.preloadImage(sources[index].src);
        if (result.success) {
          return result;
        }
        // If this source failed, try the next one
        return trySource(index + 1);
      } catch {
        // Try next source on error
        return trySource(index + 1);
      }
    };

    return trySource(0);
  }

  /**
   * Check if browser supports WebP format
   */
  supportsWebP(): boolean {
    if (this.formatCheckCache.has('webp')) {
      return this.formatCheckCache.get('webp')!;
    }
    
    // This is a simple check - in production you might want to use more comprehensive detection
    const supported = this.supportedFormats.has('webp');
    this.formatCheckCache.set('webp', supported);
    return supported;
  }

  /**
   * Check if browser supports AVIF format
   */
  supportsAvif(): boolean {
    if (this.formatCheckCache.has('avif')) {
      return this.formatCheckCache.get('avif')!;
    }
    
    const supported = this.supportedFormats.has('avif');
    this.formatCheckCache.set('avif', supported);
    return supported;
  }

  /**
   * Get performance metrics for loaded images
   */
  getPerformanceMetrics(): Record<string, ImageLoadResult> {
    const metrics: Record<string, ImageLoadResult> = {};
    this.imageLoadCache.forEach((result, src) => {
      metrics[src] = result;
    });
    return metrics;
  }

  /**
   * Clear image cache (useful for memory management)
   */
  clearCache(): void {
    this.imageLoadCache.clear();
    this.formatCheckCache.clear();
  }

  /**
   * Set cache entry with LRU eviction to prevent memory leaks
   */
  private setCacheEntry(src: string, result: ImageLoadResult): void {
    // If entry already exists, delete it first to update its position (most recently used)
    if (this.imageLoadCache.has(src)) {
      this.imageLoadCache.delete(src);
    }

    // Evict oldest entries if cache is at capacity
    while (this.imageLoadCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.imageLoadCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.imageLoadCache.delete(oldestKey);
      } else {
        break;
      }
    }

    this.imageLoadCache.set(src, result);
  }

  private detectSupportedFormats(): void {
    // Check WebP support
    this.checkFormatSupport('webp', 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA');
    
    // Check AVIF support  
    this.checkFormatSupport('avif', 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=');
  }

  private checkFormatSupport(format: string, testDataUrl: string): void {
    const img = new Image();
    img.onload = () => {
      if (img.width === 1 && img.height === 1) {
        this.supportedFormats.add(format);
      }
    };
    img.onerror = () => {
      // Format not supported
    };
    img.src = testDataUrl;
  }

  private getImageFormat(src: string): string {
    const extension = src.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'webp': return 'webp';
      case 'avif': return 'avif';
      case 'jpg':
      case 'jpeg': return 'jpeg';
      case 'png': return 'png';
      case 'gif': return 'gif';
      default: return 'unknown';
    }
  }

  private estimateImageSize(img: HTMLImageElement): number {
    // Rough estimation based on dimensions and typical compression ratios
    const pixels = img.naturalWidth * img.naturalHeight;
    const bytesPerPixel = 3; // RGB
    const compressionRatio = 0.3; // Typical for optimized images
    return Math.round(pixels * bytesPerPixel * compressionRatio);
  }
}