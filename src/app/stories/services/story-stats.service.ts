import { Injectable } from '@angular/core';
import { Story, Scene } from '../models/story.interface';

@Injectable({
  providedIn: 'root'
})
export class StoryStatsService {


  /**
   * Calculate total word count for an entire story (all chapters and scenes)
   * Uses only saved content from localStorage/database
   * @param story The story to calculate word count for
   * @returns Total word count across all scenes from saved data
   */
  calculateTotalStoryWordCount(story: Story): number {
    if (!story || !story.chapters) {
      return 0;
    }

    let totalWordCount = 0;

    for (const chapter of story.chapters) {
      if (!chapter.scenes) continue;

      for (const scene of chapter.scenes) {
        if (scene.content) {
          const words = this.countWordsInContent(scene.content);
          totalWordCount += words;
        }
      }
    }

    return totalWordCount;
  }

  /**
   * Calculate word count for a specific scene
   * @param scene The scene to calculate word count for
   * @returns Word count for the scene
   */
  calculateSceneWordCount(scene: Scene): number {
    if (!scene || !scene.content) {
      return 0;
    }

    return this.countWordsInContent(scene.content);
  }

  /**
   * Calculate word count for a specific chapter (all its scenes)
   * Uses only saved content from localStorage/database
   * @param scenes Array of scenes in the chapter
   * @returns Total word count for the chapter from saved data
   */
  calculateChapterWordCount(scenes: Scene[]): number {
    if (!scenes) {
      return 0;
    }

    let chapterWordCount = 0;

    for (const scene of scenes) {
      if (scene.content) {
        const words = this.countWordsInContent(scene.content);
        chapterWordCount += words;
      }
    }

    return chapterWordCount;
  }

  /**
   * Count words in HTML content by stripping tags and counting words
   * @param htmlContent HTML content to count words in
   * @returns Number of words
   */
  private countWordsInContent(htmlContent: string): number {
    if (!htmlContent || htmlContent.trim() === '') {
      return 0;
    }

    // Strip HTML tags and get plain text
    const textContent = this.stripHtmlTags(htmlContent);
    
    // Split by whitespace and filter out empty strings
    const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
    
    return words.length;
  }

  /**
   * Strip HTML tags from content and return plain text, excluding Beat AI content
   * @param html HTML content
   * @returns Plain text content without formatting or Beat AI suggestions
   */
  private stripHtmlTags(html: string): string {
    // Use DOMParser for safe HTML parsing instead of innerHTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove Beat AI elements before extracting text
    const beatAIElements = doc.querySelectorAll(
      '.beat-ai-wrapper, .beat-ai-node, .beat-ai-container, .beat-ai-suggestion, ' +
      '.beat-ai-input, .ai-suggestion, .beat-suggestion, [data-beat-ai], ' +
      '[class*="beat-ai"], [class*="ai-beat"]'
    );
    
    beatAIElements.forEach(element => element.remove());
    
    // Also remove any elements with Beat AI specific attributes or content
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(element => {
      // Remove elements that contain Beat AI markers in their attributes
      if (element.getAttribute('data-type') === 'beat-ai' ||
          element.getAttribute('data-ai') === 'true' ||
          element.className.includes('beat') && element.className.includes('ai')) {
        element.remove();
      }
    });
    
    return doc.body.textContent || '';
  }

  /**
   * Calculate storage usage for a story in bytes including images
   * @param story The story to calculate storage usage for
   * @returns Object with detailed storage breakdown
   */
  calculateStorageUsage(story: Story): {
    total: number;
    textContent: number;
    images: number;
    imageCount: number;
    breakdown: {
      storyData: number;
      imageData: number;
    };
  } {
    if (!story) return {
      total: 0,
      textContent: 0,
      images: 0, 
      imageCount: 0,
      breakdown: { storyData: 0, imageData: 0 }
    };
    
    // Calculate text content size (story without base64 images)
    const storyWithoutImages = this.removeImagesFromStoryContent(story);
    const textContentSize = new Blob([JSON.stringify(storyWithoutImages)]).size;
    
    // Calculate image sizes
    let totalImageSize = 0;
    let imageCount = 0;
    
    const imageData = this.extractImageDataFromStory(story);
    imageData.forEach(img => {
      totalImageSize += img.size;
      imageCount++;
    });
    
    const totalSize = new Blob([JSON.stringify(story)]).size;
    
    return {
      total: totalSize,
      textContent: textContentSize,
      images: totalImageSize,
      imageCount,
      breakdown: {
        storyData: textContentSize,
        imageData: totalImageSize
      }
    };
  }

  /**
   * Extract image data from story content
   * @param story The story to analyze
   * @returns Array of image data with sizes
   */
  private extractImageDataFromStory(story: Story): {
    src: string;
    size: number;
    sizeFormatted: string;
    type: string;
  }[] {
    const images: {
      src: string;
      size: number;
      sizeFormatted: string;
      type: string;
    }[] = [];
    
    if (!story.chapters) return images;
    
    // Search through all scenes for base64 images
    story.chapters.forEach(chapter => {
      if (!chapter.scenes) return;
      
      chapter.scenes.forEach(scene => {
        if (!scene.content) return;
        
        // Find base64 images in HTML content
        const base64Regex = /<img[^>]*src="data:image\/([^;]+);base64,([^"]+)"/gi;
        let match;
        
        while ((match = base64Regex.exec(scene.content)) !== null) {
          const imageType = match[1]; // png, jpeg, etc.
          const base64Data = match[2];
          
          // Calculate size of base64 data (each base64 char is ~0.75 bytes)
          const imageSize = Math.round(base64Data.length * 0.75);
          
          images.push({
            src: `data:image/${imageType};base64,${base64Data.substring(0, 50)}...`,
            size: imageSize,
            sizeFormatted: this.formatBytes(imageSize),
            type: imageType.toUpperCase()
          });
        }
      });
    });
    
    return images;
  }

  /**
   * Remove image data from story content for text-only size calculation
   * @param story The story to process
   * @returns Story object without base64 image data
   */
  private removeImagesFromStoryContent(story: Story): Story {
    const storyClone = JSON.parse(JSON.stringify(story));
    
    if (!storyClone.chapters) return storyClone;
    
    storyClone.chapters.forEach((chapter: { scenes?: { content?: string }[] }) => {
      if (!chapter.scenes) return;
      
      chapter.scenes.forEach((scene: { content?: string }) => {
        if (!scene.content) return;
        
        // Replace base64 images with placeholder
        scene.content = scene.content.replace(
          /<img[^>]*src="data:image\/[^;]+;base64,[^"]+"/gi,
          '<img src="[IMAGE_PLACEHOLDER]"'
        );
      });
    });
    
    return storyClone;
  }

  /**
   * Get total localStorage usage in bytes
   * @returns Total localStorage usage in bytes
   */
  getTotalLocalStorageUsage(): number {
    let totalSize = 0;
    
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        totalSize += localStorage[key].length + key.length;
      }
    }
    
    // Convert to bytes (each character is roughly 2 bytes in UTF-16)
    return totalSize * 2;
  }

  /**
   * Get detailed breakdown of localStorage usage
   * @returns Object with detailed storage breakdown
   */
  getDetailedStorageBreakdown(): {
    totalSize: number;
    totalSizeFormatted: string;
    items: {
      key: string;
      size: number;
      sizeFormatted: string;
      type: 'story' | 'settings' | 'other';
      description: string;
    }[];
    storiesBreakdown: {
      id: string;
      title: string;
      size: number;
      sizeFormatted: string;
      wordCount: number;
      textSize: number;
      textSizeFormatted: string;
      imageSize: number;
      imageSizeFormatted: string;
      imageCount: number;
    }[];
  } {
    const items: {
      key: string;
      size: number;
      sizeFormatted: string;
      type: 'story' | 'settings' | 'other';
      description: string;
    }[] = [];

    const storiesBreakdown: {
      id: string;
      title: string;
      size: number;
      sizeFormatted: string;
      wordCount: number;
      textSize: number;
      textSizeFormatted: string;
      imageSize: number;
      imageSizeFormatted: string;
      imageCount: number;
    }[] = [];

    let totalSize = 0;

    // Analyze each localStorage item
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        const value = localStorage[key];
        const itemSize = (key.length + value.length) * 2; // UTF-16 bytes
        totalSize += itemSize;

        let type: 'story' | 'settings' | 'other' = 'other';
        let description = 'Unbekannte Daten';

        // Categorize the item
        if (key === 'creative-writer-stories') {
          type = 'story';
          description = 'Alle Stories';
          
          // Parse stories and get individual breakdown
          try {
            const stories = JSON.parse(value);
            if (Array.isArray(stories)) {
              stories.forEach(story => {
                const storageInfo = this.calculateStorageUsage(story);
                const storyWordCount = this.calculateTotalStoryWordCount(story);
                
                storiesBreakdown.push({
                  id: story.id,
                  title: story.title || 'Unbenannte Story',
                  size: storageInfo.total,
                  sizeFormatted: this.formatBytes(storageInfo.total),
                  wordCount: storyWordCount,
                  textSize: storageInfo.textContent,
                  textSizeFormatted: this.formatBytes(storageInfo.textContent),
                  imageSize: storageInfo.images,
                  imageSizeFormatted: this.formatBytes(storageInfo.images),
                  imageCount: storageInfo.imageCount
                });
              });
            }
          } catch (e) {
            console.warn('Could not parse stories for breakdown:', e);
          }
        } else if (key.includes('settings') || key.includes('config')) {
          type = 'settings';
          description = 'App Settings';
        } else if (key.includes('theme') || key.includes('color')) {
          type = 'settings';
          description = 'Design Settings';
        } else if (key.includes('user') || key.includes('auth')) {
          type = 'settings';
          description = 'Benutzer-Daten';
        } else if (key.includes('cache')) {
          type = 'other';
          description = 'Cache-Daten';
        } else if (key.startsWith('ion-')) {
          type = 'other';
          description = 'Ionic Framework Daten';
        }

        items.push({
          key,
          size: itemSize,
          sizeFormatted: this.formatBytes(itemSize),
          type,
          description
        });
      }
    }

    // Sort items by size (largest first)
    items.sort((a, b) => b.size - a.size);
    storiesBreakdown.sort((a, b) => b.size - a.size);

    return {
      totalSize,
      totalSizeFormatted: this.formatBytes(totalSize),
      items,
      storiesBreakdown
    };
  }

  /**
   * Format bytes to human readable format
   * @param bytes Number of bytes
   * @returns Formatted string (e.g., "1.2 KB", "3.4 MB")
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get word count statistics for a story
   * Uses only saved content from localStorage/database
   * @param story The story to analyze
   * @returns Object with detailed word count statistics from saved data
   */
  getStoryWordCountStats(story: Story): {
    totalWords: number;
    chapterCounts: { chapterId: string; chapterTitle: string; wordCount: number; sceneCount: number }[];
    totalScenes: number;
    totalChapters: number;
    storageUsage: {
      storySize: number;
      storySizeFormatted: string;
      storyTextSize: number;
      storyTextSizeFormatted: string;
      storyImageSize: number;
      storyImageSizeFormatted: string;
      storyImageCount: number;
      totalLocalStorage: number;
      totalLocalStorageFormatted: string;
      percentageUsed: number;
    };
  } {
    // Calculate storage usage
    const storageInfo = this.calculateStorageUsage(story);
    const totalLocalStorage = this.getTotalLocalStorageUsage();
    const localStorageLimit = 5 * 1024 * 1024; // 5MB typical limit for localStorage
    
    const stats = {
      totalWords: 0,
      chapterCounts: [] as { chapterId: string; chapterTitle: string; wordCount: number; sceneCount: number }[],
      totalScenes: 0,
      totalChapters: 0,
      storageUsage: {
        storySize: storageInfo.total,
        storySizeFormatted: this.formatBytes(storageInfo.total),
        storyTextSize: storageInfo.textContent,
        storyTextSizeFormatted: this.formatBytes(storageInfo.textContent),
        storyImageSize: storageInfo.images,
        storyImageSizeFormatted: this.formatBytes(storageInfo.images),
        storyImageCount: storageInfo.imageCount,
        totalLocalStorage,
        totalLocalStorageFormatted: this.formatBytes(totalLocalStorage),
        percentageUsed: Math.round((totalLocalStorage / localStorageLimit) * 100)
      }
    };

    if (!story || !story.chapters) {
      return stats;
    }

    stats.totalChapters = story.chapters.length;

    for (const chapter of story.chapters) {
      if (!chapter.scenes) continue;

      const chapterWordCount = this.calculateChapterWordCount(chapter.scenes);

      stats.chapterCounts.push({
        chapterId: chapter.id,
        chapterTitle: chapter.title || `Chapter ${chapter.chapterNumber || chapter.order || '?'}`,
        wordCount: chapterWordCount,
        sceneCount: chapter.scenes.length
      });

      stats.totalWords += chapterWordCount;
      stats.totalScenes += chapter.scenes.length;
    }

    return stats;
  }
}