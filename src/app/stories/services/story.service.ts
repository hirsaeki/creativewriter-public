import { Injectable, inject } from '@angular/core';
import { Story, Chapter, Scene, DEFAULT_STORY_SETTINGS } from '../models/story.interface';
import { DatabaseService } from '../../core/services/database.service';
import { getSystemMessage, getBeatGenerationTemplate } from '../../shared/resources/system-messages';
import { StoryLanguage } from '../../shared/components/language-selection-dialog/language-selection-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class StoryService {
  private readonly databaseService = inject(DatabaseService);
  private db: PouchDB.Database | null = null;

  async getAllStories(): Promise<Story[]> {
    try {
      this.db = await this.databaseService.getDatabase();
      const result = await this.db.allDocs({ 
        include_docs: true
      });
      
      const stories = result.rows
        .map((row: { doc?: unknown }) => {
          return row.doc;
        })
        .filter((doc: unknown) => {
          if (!doc) return false;
          
          const docWithType = doc as Partial<Story> & { 
            type?: string; 
            content?: string;
          };
          
          // Filter out design docs
          if (docWithType._id && docWithType._id.startsWith('_design')) {
            return false;
          }
          
          // If document has a type field, it's not a story (stories don't have type field)
          if (docWithType.type) {
            return false; // This filters out codex, video, image-video-association, etc.
          }
          
          // A story MUST have either chapters array (new format) or content (legacy format)
          const hasChapters = Array.isArray(docWithType.chapters);
          const hasLegacyContent = typeof docWithType.content === 'string';
          
          // Must have one of these story-specific structures
          if (!hasChapters && !hasLegacyContent) {
            return false;
          }
          
          // Must have an ID
          if (!docWithType.id && !docWithType._id) {
            return false;
          }
          
          // Additional validation: Check if it's an empty/abandoned story
          if (this.isEmptyStory(docWithType)) {
            console.log('Filtering out empty story:', docWithType.title || 'Untitled', docWithType._id);
            return false;
          }
          
          return true;
        })
        .map((story: unknown) => this.migrateStory(story as Story));
      
      // Sort stories by order field (if exists) or by updatedAt (descending)
      stories.sort((a, b) => {
        // If both have order, sort by order (ascending)
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        // If only one has order, it comes first
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        // Otherwise sort by updatedAt (descending - newest first)
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
        
      return stories;
    } catch (error) {
      console.error('Error fetching stories:', error);
      return [];
    }
  }

  async getStory(id: string): Promise<Story | null> {
    try {
      this.db = await this.databaseService.getDatabase();
      // Try to get by _id first, then by id
      let doc;
      try {
        doc = await this.db.get(id);
      } catch (error) {
        if ((error as { status?: number }).status === 404) {
          // Try to find by id field
          const result = await this.db.find({
            selector: { id: id }
          });
          if (result.docs && result.docs.length > 0) {
            doc = result.docs[0];
          } else {
            return null;
          }
        } else {
          throw error;
        }
      }
      const migrated = this.migrateStory(doc as Story);
      return migrated;
    } catch (error) {
      console.error('Error getting story:', error);
      return null;
    }
  }

  async createStory(language: StoryLanguage = 'en'): Promise<Story> {
    this.db = await this.databaseService.getDatabase();
    
    const firstChapter: Chapter = {
      id: this.generateId(),
      title: 'Chapter 1',
      order: 1,
      chapterNumber: 1,
      scenes: [{
        id: this.generateId(),
        title: 'Scene 1',
        content: '',
        order: 1,
        sceneNumber: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const storyId = this.generateId();
    
    // Load language-specific templates
    const [systemMessage, beatTemplate] = await Promise.all([
      getSystemMessage(language),
      getBeatGenerationTemplate(language)
    ]);
    
    const newStory: Story = {
      _id: storyId,
      id: storyId,
      title: '',
      chapters: [firstChapter],
      settings: {
        ...DEFAULT_STORY_SETTINGS,
        systemMessage: systemMessage,
        beatGenerationTemplate: beatTemplate,
        language: language
      },
      // Don't set order here - let it be undefined so it appears at top with latest updatedAt
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const response = await this.db.put(newStory);
      newStory._rev = response.rev;
      return newStory;
    } catch (error) {
      console.error('Error creating story:', error);
      throw error;
    }
  }

  async updateStory(updatedStory: Story): Promise<void> {
    try {
      this.db = await this.databaseService.getDatabase();
      // Ensure we have the latest revision
      const currentDoc = await this.db.get(updatedStory._id || updatedStory.id);
      updatedStory._rev = (currentDoc as { _rev: string })._rev;
      updatedStory._id = updatedStory._id || updatedStory.id;
      
      await this.db.put(updatedStory);
    } catch (error) {
      console.error('Error updating story:', error);
      throw error;
    }
  }

  async deleteStory(id: string): Promise<void> {
    try {
      this.db = await this.databaseService.getDatabase();
      let doc;
      try {
        doc = await this.db.get(id);
      } catch (error) {
        if ((error as { status?: number }).status === 404) {
          // Try to find by id field
          const result = await this.db.find({
            selector: { id: id }
          });
          if (result.docs && result.docs.length > 0) {
            doc = result.docs[0];
          } else {
            throw new Error('Story not found');
          }
        } else {
          throw error;
        }
      }
      await this.db.remove(doc);
    } catch (error) {
      console.error('Error deleting story:', error);
      throw error;
    }
  }

  // Migration helper for old stories
  private migrateStory(story: Partial<Story>): Story {
    const migrated: Story = {
      id: story.id || 'story-' + Date.now(),
      title: story.title || 'Untitled Story',
      chapters: story.chapters || [],
      ...story,
      createdAt: story.createdAt ? new Date(story.createdAt) : new Date(),
      updatedAt: story.updatedAt ? new Date(story.updatedAt) : new Date()
    };

    // Ensure _id is set
    if (!migrated._id && migrated.id) {
      migrated._id = migrated.id;
    }

    // Add default settings if not present or merge missing fields
    if (!migrated.settings) {
      migrated.settings = { ...DEFAULT_STORY_SETTINGS };
    } else {
      // Ensure all new settings fields are present
      migrated.settings = {
        ...DEFAULT_STORY_SETTINGS,
        ...migrated.settings
      };
      
      // Migrate old beatTemplate to beatGenerationTemplate if needed
      const settingsAny = migrated.settings as { beatTemplate?: unknown };
      if (settingsAny.beatTemplate && !migrated.settings.beatGenerationTemplate) {
        migrated.settings.beatGenerationTemplate = DEFAULT_STORY_SETTINGS.beatGenerationTemplate;
      }
      
      // Remove old beatTemplate field
      delete settingsAny.beatTemplate;
    }

    // If old story format with content field, migrate to chapter/scene structure
    if (story.content && !story.chapters) {
      const firstChapter: Chapter = {
        id: this.generateId(),
        title: 'Chapter 1',
        order: 1,
        chapterNumber: 1,
        scenes: [{
          id: this.generateId(),
          title: 'Scene 1',
          content: story.content,
          order: 1,
          sceneNumber: 1,
          createdAt: story.createdAt ? new Date(story.createdAt) : new Date(),
          updatedAt: story.updatedAt ? new Date(story.updatedAt) : new Date()
        }],
        createdAt: story.createdAt ? new Date(story.createdAt) : new Date(),
        updatedAt: story.updatedAt ? new Date(story.updatedAt) : new Date()
      };
      
      migrated.chapters = [firstChapter];
      delete migrated.content;
      
      // Migration will be automatically saved when story is next updated
    }

    // Ensure chapters have proper date objects and number fields
    if (migrated.chapters) {
      migrated.chapters = migrated.chapters.map((chapter, chapterIndex) => ({
        ...chapter,
        chapterNumber: chapter.chapterNumber || chapterIndex + 1,
        createdAt: new Date(chapter.createdAt),
        updatedAt: new Date(chapter.updatedAt),
        scenes: chapter.scenes.map((scene, sceneIndex) => ({
          ...scene,
          sceneNumber: scene.sceneNumber || sceneIndex + 1,
          createdAt: new Date(scene.createdAt),
          updatedAt: new Date(scene.updatedAt),
          summaryGeneratedAt: scene.summaryGeneratedAt ? new Date(scene.summaryGeneratedAt) : undefined
        }))
      }));
    }

    return migrated;
  }

  // Chapter operations
  async addChapter(storyId: string, title = ''): Promise<Chapter> {
    this.db = await this.databaseService.getDatabase();
    const story = await this.getStory(storyId);
    if (!story) throw new Error('Story not found');

    const chapterNumber = story.chapters.length + 1;
    const newChapter: Chapter = {
      id: this.generateId(),
      title: title || `Chapter ${chapterNumber}`,
      order: chapterNumber,
      chapterNumber: chapterNumber,
      scenes: [{
        id: this.generateId(),
        title: 'Scene 1',
        content: '',
        order: 1,
        sceneNumber: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    story.chapters.push(newChapter);
    story.updatedAt = new Date();
    await this.updateStory(story);
    
    return newChapter;
  }

  async updateChapter(storyId: string, chapterId: string, updates: Partial<Chapter>): Promise<void> {
    this.db = await this.databaseService.getDatabase();
    const story = await this.getStory(storyId);
    if (!story) return;

    const chapterIndex = story.chapters.findIndex(c => c.id === chapterId);
    if (chapterIndex === -1) return;

    story.chapters[chapterIndex] = {
      ...story.chapters[chapterIndex],
      ...updates,
      updatedAt: new Date()
    };
    story.updatedAt = new Date();
    await this.updateStory(story);
  }

  async deleteChapter(storyId: string, chapterId: string): Promise<void> {
    this.db = await this.databaseService.getDatabase();
    const story = await this.getStory(storyId);
    if (!story) return;

    story.chapters = story.chapters.filter(c => c.id !== chapterId);
    // Reorder remaining chapters and update chapter numbers
    story.chapters.forEach((chapter, index) => {
      chapter.order = index + 1;
      chapter.chapterNumber = index + 1;
    });
    story.updatedAt = new Date();
    await this.updateStory(story);
  }

  // Scene operations
  async addScene(storyId: string, chapterId: string, title = ''): Promise<Scene> {
    this.db = await this.databaseService.getDatabase();
    const story = await this.getStory(storyId);
    if (!story) throw new Error('Story not found');

    const chapter = story.chapters.find(c => c.id === chapterId);
    if (!chapter) throw new Error('Chapter not found');

    const sceneNumber = chapter.scenes.length + 1;
    const newScene: Scene = {
      id: this.generateId(),
      title: title || `Scene ${sceneNumber}`,
      content: '',
      order: sceneNumber,
      sceneNumber: sceneNumber,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    chapter.scenes.push(newScene);
    chapter.updatedAt = new Date();
    story.updatedAt = new Date();
    await this.updateStory(story);
    
    return newScene;
  }

  async updateScene(storyId: string, chapterId: string, sceneId: string, updates: Partial<Scene>): Promise<void> {
    this.db = await this.databaseService.getDatabase();
    const story = await this.getStory(storyId);
    if (!story) return;

    const chapter = story.chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    const sceneIndex = chapter.scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) return;

    chapter.scenes[sceneIndex] = {
      ...chapter.scenes[sceneIndex],
      ...updates,
      updatedAt: new Date()
    };
    chapter.updatedAt = new Date();
    story.updatedAt = new Date();
    await this.updateStory(story);
  }

  async deleteScene(storyId: string, chapterId: string, sceneId: string): Promise<void> {
    this.db = await this.databaseService.getDatabase();
    const story = await this.getStory(storyId);
    if (!story) return;

    const chapter = story.chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    chapter.scenes = chapter.scenes.filter(s => s.id !== sceneId);
    // Reorder remaining scenes and update scene numbers
    chapter.scenes.forEach((scene, index) => {
      scene.order = index + 1;
      scene.sceneNumber = index + 1;
    });
    chapter.updatedAt = new Date();
    story.updatedAt = new Date();
    await this.updateStory(story);
  }

  async getScene(storyId: string, chapterId: string, sceneId: string): Promise<Scene | null> {
    this.db = await this.databaseService.getDatabase();
    const story = await this.getStory(storyId);
    if (!story) return null;

    const chapter = story.chapters.find(c => c.id === chapterId);
    if (!chapter) return null;

    return chapter.scenes.find(s => s.id === sceneId) || null;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Check if a story is considered "empty" and should be filtered out
   */
  private isEmptyStory(story: Partial<Story> & { content?: string }): boolean {
    // Check if story has no title or just whitespace
    const hasNoTitle = !story.title || story.title.trim() === '';
    
    // Check creation date - filter out very recent empty stories (last 24 hours)
    const isRecent = story.createdAt ? 
      (Date.now() - new Date(story.createdAt).getTime()) < 24 * 60 * 60 * 1000 : false;
    
    // For legacy stories with content field
    if (story.content !== undefined) {
      const hasNoContent = !story.content || this.stripHtmlTags(story.content).trim() === '';
      // Only filter if BOTH no title AND no content AND recent
      return hasNoTitle && hasNoContent && isRecent;
    }
    
    // For new chapter/scene structure
    if (Array.isArray(story.chapters)) {
      // Check if any scene has content
      const hasContentInScenes = story.chapters.some((chapter: Chapter) => 
        chapter.scenes && chapter.scenes.some((scene: Scene) => {
          const cleanContent = this.stripHtmlTags(scene.content || '').trim();
          return cleanContent.length > 0;
        })
      );
      
      // Check if it has meaningful structure (more than default single empty scene)
      const hasOnlyDefaultStructure = story.chapters.length === 1 && 
        story.chapters[0].scenes && 
        story.chapters[0].scenes.length === 1 &&
        !this.stripHtmlTags(story.chapters[0].scenes[0].content || '').trim();
      
      // Filter out if: no title AND (no content OR only default structure) AND recent
      return hasNoTitle && (!hasContentInScenes || hasOnlyDefaultStructure) && isRecent;
    }
    
    // If no chapters and no content, consider empty
    return true;
  }

  /**
   * Strip HTML tags from content for content checking
   */
  private stripHtmlTags(html: string): string {
    if (!html) return '';
    
    // Remove Beat AI nodes completely (they are editor-only components)
    const cleanHtml = html.replace(/<div[^>]*class="beat-ai-node"[^>]*>.*?<\/div>/gs, '');
    
    // Use DOMParser for safe HTML parsing instead of innerHTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanHtml, 'text/html');
    
    // Get text content safely
    const textContent = doc.body.textContent || '';
    
    // Remove any remaining Beat AI artifacts
    return textContent
      .replace(/🎭\s*Beat\s*AI/gi, '')
      .replace(/Prompt:\s*/gi, '')
      .replace(/BeatAIPrompt/gi, '')
      .trim()
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  // Reorder stories method
  async reorderStories(stories: Story[]): Promise<void> {
    try {
      this.db = await this.databaseService.getDatabase();
      
      // Update each story with new order field
      const bulkDocs = stories.map((story, index) => ({
        ...story,
        order: index, // Save the array index as the order
        updatedAt: story.updatedAt // Keep original updatedAt
      }));

      await this.db.bulkDocs(bulkDocs);
    } catch (error) {
      console.error('Error reordering stories:', error);
      throw error;
    }
  }

  // Helper methods for formatting chapter and scene displays
  formatChapterDisplay(chapter: Chapter): string {
    return `C${chapter.chapterNumber || chapter.order}:${chapter.title}`;
  }

  formatSceneDisplay(chapter: Chapter, scene: Scene): string {
    const chapterNum = chapter.chapterNumber || chapter.order;
    const sceneNum = scene.sceneNumber || scene.order;
    return `C${chapterNum}S${sceneNum}:${scene.title}`;
  }
}