import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, from } from 'rxjs';
import { map, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Story, Scene } from '../../stories/models/story.interface';
import { StoryService } from '../../stories/services/story.service';

export interface FlatScene {
  id: string;
  title: string;
  fullText: string; // Content without beat metadata
  summary?: string;
  chapterId: string;
  chapterTitle: string;
  sceneOrder: number;
  chapterOrder: number;
  globalOrder: number; // Overall position in story
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class PromptManagerService {
  private readonly storyService = inject(StoryService);
  
  private flatScenesSubject = new BehaviorSubject<FlatScene[]>([]);
  private currentStoryIdSubject = new BehaviorSubject<string | null>(null);
  
  public flatScenes$ = this.flatScenesSubject.asObservable();
  public currentStoryId$ = this.currentStoryIdSubject.asObservable();

  constructor() {
    this.initializeStoryWatching();
  }

  /**
   * Initialize watching for story changes
   */
  private initializeStoryWatching(): void {
    // Watch for story ID changes and update flat scenes
    this.currentStoryId$.pipe(
      switchMap(currentStoryId => {
        if (!currentStoryId) return from(Promise.resolve([]));
        return from(this.storyService.getStory(currentStoryId)).pipe(
          map(story => story ? this.buildFlatScenesList(story) : [])
        );
      }),
      distinctUntilChanged((prev, curr) => 
        JSON.stringify(prev) === JSON.stringify(curr)
      )
    ).subscribe(flatScenes => {
      this.flatScenesSubject.next(flatScenes);
    });
  }

  /**
   * Set the current story to watch
   */
  async setCurrentStory(storyId: string | null): Promise<void> {
    this.currentStoryIdSubject.next(storyId);
    
    // Clear cached data when story is set to null
    if (!storyId) {
      this.flatScenesSubject.next([]);
      return;
    }
    
    // Force immediate update
    if (storyId) {
      const story = await this.storyService.getStory(storyId);
      if (story) {
        const flatScenes = this.buildFlatScenesList(story);
        this.flatScenesSubject.next(flatScenes);
      }
    }
  }

  /**
   * Get current flat scenes list
   */
  getCurrentFlatScenes(): FlatScene[] {
    return this.flatScenesSubject.value;
  }

  /**
   * Build flat scenes list from story structure
   */
  private buildFlatScenesList(story: Story): FlatScene[] {
    
    const flatScenes: FlatScene[] = [];
    let globalOrder = 0;

    if (!story.chapters || story.chapters.length === 0) {
      return flatScenes;
    }

    // Sort chapters by order
    const sortedChapters = [...story.chapters].sort((a, b) => a.order - b.order);

    for (const chapter of sortedChapters) {
      
      if (!chapter.scenes || chapter.scenes.length === 0) continue;
      
      // Sort scenes by order within chapter
      const sortedScenes = [...chapter.scenes].sort((a, b) => a.order - b.order);

      for (const scene of sortedScenes) {
        const flatScene = {
          id: scene.id,
          title: scene.title,
          fullText: this.extractFullTextFromScene(scene),
          summary: scene.summary,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          sceneOrder: scene.order,
          chapterOrder: chapter.order,
          globalOrder: globalOrder++,
          updatedAt: scene.updatedAt
        };
        flatScenes.push(flatScene);
      }
    }

    return flatScenes;
  }

  /**
   * Extract full text content from scene, removing beat metadata
   */
  private extractFullTextFromScene(scene: Scene): string {
    if (!scene.content) return '';

    // Use DOM parser for more reliable HTML parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(scene.content, 'text/html');
    
    // Remove all beat AI wrapper elements and their contents
    const beatWrappers = doc.querySelectorAll('.beat-ai-wrapper, .beat-ai-node');
    beatWrappers.forEach(element => element.remove());
    
    // Remove beat markers and comments
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }
    
    textNodes.forEach(textNode => {
      // Remove beat markers like [Beat: description]
      textNode.textContent = textNode.textContent?.replace(/\[Beat:[^\]]*\]/g, '') || '';
    });
    
    // Remove HTML comments
    const comments = doc.evaluate('//comment()', doc, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let i = 0; i < comments.snapshotLength; i++) {
      const comment = comments.snapshotItem(i);
      if (comment && comment.textContent?.includes('Beat')) {
        comment.parentNode?.removeChild(comment);
      }
    }
    
    // Convert to text while preserving paragraph structure
    let cleanText = '';
    const paragraphs = doc.querySelectorAll('p');
    
    for (const p of Array.from(paragraphs)) {
      const text = p.textContent?.trim() || '';
      if (text) {
        cleanText += text + '\n\n';
      } else {
        // Empty paragraph becomes single newline
        cleanText += '\n';
      }
    }
    
    // If no paragraphs found, fall back to body text
    if (!paragraphs.length) {
      cleanText = doc.body.textContent || '';
    }
    
    // Clean up extra whitespace
    cleanText = cleanText.replace(/\n\s*\n\s*\n/g, '\n\n');
    cleanText = cleanText.trim();

    return cleanText;
  }

  /**
   * Get scenes up to a specific scene (for context)
   */
  getScenesUpTo(targetSceneId: string): FlatScene[] {
    const flatScenes = this.getCurrentFlatScenes();
    
    const targetIndex = flatScenes.findIndex(scene => scene.id === targetSceneId);
    
    if (targetIndex === -1) {
      return [];
    }
    
    const scenesUpTo = flatScenes.slice(0, targetIndex);
    return scenesUpTo;
  }

  /**
   * Get full story context as text
   */
  getFullStoryContext(): string {
    const scenes = this.getCurrentFlatScenes();
    return scenes.map(scene => {
      const chapterHeader = scene.sceneOrder === 0 ? `\n## ${scene.chapterTitle}\n\n` : '';
      return `${chapterHeader}${scene.fullText}`;
    }).join('\n\n');
  }

  /**
   * Get story context using summaries
   */
  getSummaryContext(): string {
    const scenes = this.getCurrentFlatScenes();
    return scenes.map(scene => {
      const chapterHeader = scene.sceneOrder === 0 ? `\n## ${scene.chapterTitle}\n\n` : '';
      const content = scene.summary || scene.fullText.substring(0, 200) + '...';
      return `${chapterHeader}${content}`;
    }).join('\n\n');
  }

  /**
   * Get context up to a specific scene
   */
  getContextUpTo(targetSceneId: string, useSummaries = false): string {
    const scenes = this.getScenesUpTo(targetSceneId);
    
    return scenes.map(scene => {
      const chapterHeader = scene.sceneOrder === 0 ? `\n## ${scene.chapterTitle}\n\n` : '';
      const content = useSummaries && scene.summary 
        ? scene.summary 
        : scene.fullText;
      return `${chapterHeader}${content}`;
    }).join('\n\n');
  }

  /**
   * Get summaries of all scenes before the current scene (cross-chapter)
   */
  getSummariesBeforeScene(targetSceneId: string): string {
    const scenes = this.getScenesUpTo(targetSceneId);
    
    return scenes
      .filter(scene => scene.summary) // Only scenes with summaries
      .map(scene => scene.summary!)
      .join('\n\n');
  }

  /**
   * Get full text of the scene immediately before the target scene (cross-chapter)
   */
  getPreviousSceneText(targetSceneId: string): string {
    const flatScenes = this.getCurrentFlatScenes();
    const targetIndex = flatScenes.findIndex(scene => scene.id === targetSceneId);
    
    if (targetIndex <= 0) return ''; // No previous scene or target not found
    
    const previousScene = flatScenes[targetIndex - 1];
    return previousScene.fullText;
  }

  /**
   * Get text content for beat prompt generation context
   * If beatId is provided: checks for text before that beat, falls back to previous scene if none
   * If no beatId: uses full scene text if available, falls back to previous scene if none
   * This ensures AI generation always has relevant context
   * @param targetSceneId The ID of the target scene
   * @param beatId Optional beat ID - if provided, only return text before this beat
   */
  async getCurrentOrPreviousSceneText(targetSceneId: string, beatId?: string): Promise<string> {
    const flatScenes = this.getCurrentFlatScenes();
    const targetIndex = flatScenes.findIndex(scene => scene.id === targetSceneId);
    
    if (targetIndex < 0) return ''; // Target scene not found
    
    const currentScene = flatScenes[targetIndex];
    
    // If beat ID is provided, check if there's text before that beat
    if (beatId) {
      const textBeforeBeat = await this.extractTextBeforeBeat(currentScene, beatId);
      if (textBeforeBeat && textBeforeBeat.trim().length > 0) {
        return textBeforeBeat;
      }
      // No text before beat, fall through to use previous scene
    } else {
      // No beat ID provided, use full scene text if available
      if (currentScene.fullText && currentScene.fullText.trim().length > 0) {
        return currentScene.fullText;
      }
    }
    
    // No text before beat or no text in current scene, use previous scene's text
    if (targetIndex > 0) {
      const previousScene = flatScenes[targetIndex - 1];
      return previousScene.fullText;
    }
    
    return ''; // No previous scene available
  }

  /**
   * Get story structure in XML format for beat generation without scene summaries
   * This is used for SceneBeat type - returns empty string for minimal context
   */
  async getStoryXmlFormatWithoutSummaries(targetSceneId: string): Promise<string> {
    // For SceneBeat, we provide minimal context by returning empty story context
    // This focuses the AI on the current scene without prior story information
    // The targetSceneId parameter is included for API consistency but not used in this implementation
    void targetSceneId; // Mark as intentionally unused
    return '';
  }

  /**
   * Get story structure in XML format for beat generation
   */
  async getStoryXmlFormat(targetSceneId: string): Promise<string> {
    const currentStoryId = this.currentStoryIdSubject.value;
    if (!currentStoryId) return '';

    const story = await this.storyService.getStory(currentStoryId);
    if (!story || !story.chapters) return '';

    let xml = '<act number="1">\n';

    const sortedChapters = [...story.chapters].sort((a, b) => a.order - b.order);

    for (const chapter of sortedChapters) {
      if (!chapter.scenes || chapter.scenes.length === 0) continue;

      xml += `  <chapter title="${this.escapeXml(chapter.title)}" number="${chapter.order}">\n`;

      const sortedScenes = [...chapter.scenes].sort((a, b) => a.order - b.order);

      for (const scene of sortedScenes) {
        // Stop before the target scene
        if (scene.id === targetSceneId) {
          xml += '  </chapter>\n';
          xml += '</act>';
          return xml;
        }

        xml += `    <scene title="${this.escapeXml(scene.title)}" number="${scene.order}">`;

        // Use summary if available, otherwise use full text
        const content = scene.summary || this.extractFullTextFromScene(scene);
        xml += this.escapeXml(content);

        xml += '</scene>\n';
      }

      xml += '  </chapter>\n';
    }

    xml += '</act>';

    return xml;
  }

  private escapeXml(text: string | unknown): string {
    // Ensure the input is a string
    const str = String(text || '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Force refresh of current story data
   */
  async refresh(): Promise<void> {
    const currentStoryId = this.currentStoryIdSubject.value;
    if (currentStoryId) {
      // Force reload from StoryService
      const story = await this.storyService.getStory(currentStoryId);
      if (story) {
        const flatScenes = this.buildFlatScenesList(story);
        // Force update by creating a new array reference to bypass distinctUntilChanged
        this.flatScenesSubject.next([...flatScenes]);
      }
    }
  }

  /**
   * Extract text content from scene until a specific beat ID is encountered
   * @param flatScene The scene to extract text from
   * @param beatId The beat ID to stop at
   * @returns Text content before the specified beat
   */
  private async extractTextBeforeBeat(flatScene: FlatScene, beatId: string): Promise<string> {
    const currentStoryId = this.currentStoryIdSubject.value;
    if (!currentStoryId) return flatScene.fullText;

    try {
      // Get the full scene with HTML content
      const scene = await this.storyService.getScene(currentStoryId, flatScene.chapterId, flatScene.id);
      if (!scene || !scene.content) return flatScene.fullText;

      // Parse the HTML content
      const parser = new DOMParser();
      const doc = parser.parseFromString(scene.content, 'text/html');
      
      // Find the target beat node
      const targetBeatNode = doc.querySelector(`.beat-ai-node[data-beat-id="${beatId}"]`);
      if (!targetBeatNode) {
        // Beat not found, return full text
        return flatScene.fullText;
      }

      // Create a temporary container and add all content before the beat
      const tempContainer = document.createElement('div');
      let currentNode = doc.body.firstChild;
      
      while (currentNode && currentNode !== targetBeatNode) {
        // Clone the node and add it to temp container
        const clonedNode = currentNode.cloneNode(true);
        tempContainer.appendChild(clonedNode);
        currentNode = currentNode.nextSibling;
      }

      // Extract clean text from the content before the beat
      return this.extractFullTextFromContent(tempContainer.innerHTML);
    } catch (error) {
      console.error('Error extracting text before beat:', error);
      return flatScene.fullText;
    }
  }

  /**
   * Extract full text content from HTML, removing beat metadata
   * This is similar to extractFullTextFromScene but works on any HTML content
   */
  private extractFullTextFromContent(htmlContent: string): string {
    if (!htmlContent) return '';

    // Use DOM parser for more reliable HTML parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Remove all beat AI wrapper elements and their contents
    const beatWrappers = doc.querySelectorAll('.beat-ai-wrapper, .beat-ai-node');
    beatWrappers.forEach(element => element.remove());
    
    // Remove beat markers and comments
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }
    
    textNodes.forEach(textNode => {
      // Remove beat markers like [Beat: description]
      textNode.textContent = textNode.textContent?.replace(/\[Beat:[^\]]*\]/g, '') || '';
    });
    
    // Remove HTML comments
    const comments = doc.evaluate('//comment()', doc, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let i = 0; i < comments.snapshotLength; i++) {
      const comment = comments.snapshotItem(i);
      if (comment && comment.textContent?.includes('Beat')) {
        comment.parentNode?.removeChild(comment);
      }
    }
    
    // Convert to text while preserving paragraph structure
    let cleanText = '';
    const paragraphs = doc.querySelectorAll('p');
    
    for (const p of Array.from(paragraphs)) {
      const text = p.textContent?.trim() || '';
      if (text) {
        cleanText += text + '\n\n';
      } else {
        // Empty paragraph becomes single newline
        cleanText += '\n';
      }
    }
    
    // If no paragraphs found, fall back to body text
    if (!paragraphs.length) {
      cleanText = doc.body.textContent || '';
    }
    
    // Clean up extra whitespace
    cleanText = cleanText.replace(/\n\s*\n\s*\n/g, '\n\n');
    cleanText = cleanText.trim();

    return cleanText;
  }

  /**
   * Public helper: Extract plain text from arbitrary HTML content, removing Beat AI nodes and metadata
   * Preserves basic paragraph breaks. Safe to use for building prompts.
   */
  public extractPlainTextFromHtml(htmlContent: string): string {
    return this.extractFullTextFromContent(htmlContent);
  }

  /**
   * Get statistics about current story
   */
  getStoryStats(): {
    totalScenes: number;
    totalChapters: number;
    totalWords: number;
    scenesWithSummaries: number;
  } {
    const scenes = this.getCurrentFlatScenes();
    const chapters = new Set(scenes.map(s => s.chapterId));
    
    return {
      totalScenes: scenes.length,
      totalChapters: chapters.size,
      totalWords: scenes.reduce((total, scene) => 
        total + (scene.fullText.split(/\s+/).length || 0), 0),
      scenesWithSummaries: scenes.filter(s => s.summary).length
    };
  }
}
