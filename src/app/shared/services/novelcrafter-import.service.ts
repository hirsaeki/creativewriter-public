import { Injectable, inject } from '@angular/core';
import { StoryService } from '../../stories/services/story.service';
import { CodexService } from '../../stories/services/codex.service';
import { Story, Chapter, Scene } from '../../stories/models/story.interface';
import { CodexEntry } from '../../stories/models/codex.interface';
import JSZip from '@progress/jszip-esm';
import * as yaml from 'js-yaml';

export interface NovelCrafterCharacter {
  id: string;
  metadata: {
    attributes: {
      type: string;
      name: string;
      color?: string;
      aliases?: string[];
      tags?: string[];
    };
  };
  content: string;
  fields: Record<string, unknown>;
}

export interface NovelCrafterImportResult {
  story: Story;
  codexEntries: {
    characters: CodexEntry[];
    locations: CodexEntry[];
    objects: CodexEntry[];
    other: CodexEntry[];
  };
  warnings: string[];
}

@Injectable({
  providedIn: 'root'
})
export class NovelCrafterImportService {
  private readonly storyService = inject(StoryService);
  private readonly codexService = inject(CodexService);

  async importFromZip(zipFile: File): Promise<NovelCrafterImportResult> {
    const result: NovelCrafterImportResult = {
      story: {} as Story,
      codexEntries: {
        characters: [],
        locations: [],
        objects: [],
        other: []
      },
      warnings: []
    };

    try {
      // Load and extract ZIP file
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(zipFile);
      
      // Find novel.md file
      let novelContent: string | null = null;
      const codexFiles: Record<string, { content: string; path: string }[]> = {
        characters: [],
        locations: [],
        objects: [],
        other: []
      };

      // Process all files in ZIP
      console.log('=== ZIP File Analysis ===');  
      const allFiles: string[] = [];
      const mdFiles: string[] = [];
      const entryFiles: string[] = [];
      
      for (const [relativePath, zipObject] of Object.entries(zipContent.files)) {
        const fileObj = zipObject;
        if (fileObj.dir) {
          console.log(`Directory: ${relativePath}`);
          continue; // Skip directories
        }

        const fileName = relativePath.split('/').pop() || '';
        allFiles.push(relativePath);
        
        if (fileName.endsWith('.md')) {
          mdFiles.push(relativePath);
        }
        
        if (fileName === 'entry.md') {
          entryFiles.push(relativePath);
        }
        
        console.log(`File: ${relativePath} (fileName: ${fileName})`);
        
        if (fileName === 'novel.md') {
          console.log('✓ Found novel.md');
          novelContent = await fileObj.async('text');
        } else if (relativePath.includes('characters/') && fileName === 'entry.md') {
          console.log('✓ Found characters entry:', relativePath);
          const content = await fileObj.async('text');
          codexFiles['characters'].push({ content, path: relativePath });
        } else if (relativePath.includes('locations/') && fileName === 'entry.md') {
          console.log('✓ Found locations entry:', relativePath);
          const content = await fileObj.async('text');
          codexFiles['locations'].push({ content, path: relativePath });
        } else if (relativePath.includes('objects/') && fileName === 'entry.md') {
          console.log('✓ Found objects entry:', relativePath);
          const content = await fileObj.async('text');
          codexFiles['objects'].push({ content, path: relativePath });
        } else if (relativePath.includes('other/') && fileName === 'entry.md') {
          console.log('✓ Found other entry:', relativePath);
          const content = await fileObj.async('text');
          codexFiles['other'].push({ content, path: relativePath });
        } else if (fileName.endsWith('.md')) {
          console.log('⚠️ Found unmatched .md file:', relativePath);
        }
      }
      
      console.log('=== File Structure Summary ===');
      console.log('Total files:', allFiles.length);
      console.log('All files:', allFiles);
      console.log('Markdown files:', mdFiles);
      console.log('Entry.md files:', entryFiles);
      console.log('=== End ZIP File Analysis ===');
      console.log('Codex files found:', {
        characters: codexFiles['characters'].length,
        locations: codexFiles['locations'].length,
        objects: codexFiles['objects'].length,
        other: codexFiles['other'].length
      });

      if (!novelContent) {
        throw new Error('novel.md file not found in ZIP archive');
      }

      // Parse novel content
      result.story = await this.parseNovelStructure(novelContent);

      // Parse codex entries
      for (const [category, files] of Object.entries(codexFiles)) {
        for (const fileData of files) {
          try {
            const entry = this.parseCodexEntry(fileData.content, fileData.path, category);
            if (entry) {
              (result.codexEntries as Record<string, CodexEntry[]>)[category].push(entry);
            }
          } catch (error) {
            result.warnings.push(`Failed to parse ${fileData.path}: ${error}`);
          }
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to process ZIP file: ${error}`);
    }
  }

  async importFromFiles(files: FileList): Promise<NovelCrafterImportResult> {
    const result: NovelCrafterImportResult = {
      story: {} as Story,
      codexEntries: {
        characters: [],
        locations: [],
        objects: [],
        other: []
      },
      warnings: []
    };

    // Find novel.md file
    let novelFile: File | null = null;
    const codexFiles: Record<string, File[]> = {
      characters: [],
      locations: [],
      objects: [],
      other: []
    };

    // Sort files
    console.log('=== Folder Import Analysis ===');
    Array.from(files).forEach(file => {
      console.log(`File: ${file.webkitRelativePath} (name: ${file.name})`);
      
      if (file.name === 'novel.md') {
        console.log('✓ Found novel.md');
        novelFile = file;
      } else if (file.webkitRelativePath.includes('characters/') && file.name === 'entry.md') {
        console.log('✓ Found characters entry:', file.webkitRelativePath);
        codexFiles['characters'].push(file);
      } else if (file.webkitRelativePath.includes('locations/') && file.name === 'entry.md') {
        console.log('✓ Found locations entry:', file.webkitRelativePath);
        codexFiles['locations'].push(file);
      } else if (file.webkitRelativePath.includes('objects/') && file.name === 'entry.md') {
        console.log('✓ Found objects entry:', file.webkitRelativePath);
        codexFiles['objects'].push(file);
      } else if (file.webkitRelativePath.includes('other/') && file.name === 'entry.md') {
        console.log('✓ Found other entry:', file.webkitRelativePath);
        codexFiles['other'].push(file);
      } else if (file.name.endsWith('.md')) {
        console.log('⚠️ Found unmatched .md file:', file.webkitRelativePath);
      }
    });
    console.log('=== End Folder Import Analysis ===');
    console.log('Codex files found:', {
      characters: codexFiles['characters'].length,
      locations: codexFiles['locations'].length,
      objects: codexFiles['objects'].length,
      other: codexFiles['other'].length
    });

    if (!novelFile) {
      throw new Error('novel.md file not found in the uploaded files');
    }

    // Parse novel content
    const novelContent = await this.readFileAsText(novelFile);
    result.story = await this.parseNovelStructure(novelContent);

    // Parse codex entries
    for (const [category, files] of Object.entries(codexFiles)) {
      for (const file of files) {
        try {
          const entryContent = await this.readFileAsText(file);
          const entry = this.parseCodexEntry(entryContent, file.webkitRelativePath, category);
          if (entry) {
            (result.codexEntries as Record<string, CodexEntry[]>)[category].push(entry);
          }
        } catch (error) {
          result.warnings.push(`Failed to parse ${file.name}: ${error}`);
        }
      }
    }

    return result;
  }

  private async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  private async parseNovelStructure(content: string): Promise<Story> {
    console.log('=== Novel Structure Parsing ===');
    const lines = content.split('\n');
    const story: Story = {
      id: this.generateId(),
      title: 'Imported Story',
      chapters: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    let currentChapter: Chapter | null = null;
    let currentScene: Scene | null = null;
    let sceneBuffer: string[] = [];
    let summaryBuffer: string[] = [];
    let parsingState: 'content' | 'story' = 'content';
    let sceneOrder = 0;
    let titleExtracted = false;

    // Detect heading levels used in the document
    const headingLevels = this.detectHeadingLevels(lines);
    console.log('Detected heading structure:', headingLevels);

    const saveCurrentScene = () => {
      if (currentScene && currentChapter) {
        // summaryBuffer contains the actual scene summary, sceneBuffer contains the story content
        // Preserve paragraph breaks by joining with newlines
        currentScene.summary = summaryBuffer.join('\n').trim();
        currentScene.content = sceneBuffer.join('\n').trim();

        // Only save scenes that have content or summary
        if (currentScene.content || currentScene.summary) {
          currentChapter.scenes.push(currentScene);
          console.log(`✓ Saved scene: "${currentScene.title}" - Summary: ${currentScene.summary.length} chars, Content: ${currentScene.content.length} chars`);
        } else {
          console.log(`⚠️ Skipping empty scene: "${currentScene.title}"`);
        }

        sceneBuffer = [];
        summaryBuffer = [];
      }
    };

    // Helper to check if a line is a chapter heading
    const isChapterHeading = (line: string): boolean => {
      // Match various chapter heading formats:
      // ### Chapter 1, ## Chapter 1, # Chapter 1
      // ### 1, ## 1, # 1 (just numbers)
      // ### Chapter One, ## Part 1, etc.
      // Also match headings that are just titles without "Chapter" prefix
      const chapterPatterns = [
        /^#{1,4}\s+chapter\s+/i,           // # Chapter X, ## Chapter X, ### Chapter X
        /^#{1,4}\s+part\s+/i,              // # Part X, ## Part X
        /^#{1,4}\s+\d+[.:]\s*/,            // # 1: Title, ## 1. Title
        /^#{1,4}\s+[IVXLCDM]+[.:]\s*/i,    // # I: Title (Roman numerals)
      ];

      // Check using detected heading level for chapters
      if (headingLevels.chapter > 0) {
        const expectedHashes = '#'.repeat(headingLevels.chapter);
        const chapterRegex = new RegExp(`^${expectedHashes}\\s+(?!#).+`, 'i');
        if (chapterRegex.test(line)) {
          // Make sure it's not an act or scene heading
          if (headingLevels.act > 0 && line.startsWith('#'.repeat(headingLevels.act) + ' ')) {
            return false;
          }
          if (headingLevels.scene > 0 && line.startsWith('#'.repeat(headingLevels.scene) + ' ')) {
            return false;
          }
          return true;
        }
      }

      // Fallback to pattern matching
      return chapterPatterns.some(pattern => pattern.test(line));
    };

    // Helper to check if a line is a scene heading
    const isSceneHeading = (line: string): boolean => {
      if (headingLevels.scene > 0) {
        const expectedHashes = '#'.repeat(headingLevels.scene);
        const sceneRegex = new RegExp(`^${expectedHashes}\\s+(?!#).+`, 'i');
        return sceneRegex.test(line);
      }
      // Match scene patterns: #### Scene 1, #### 1, etc.
      return /^#{4,}\s+(?:scene\s+)?\d+/i.test(line);
    };

    // Helper to check if a line is an act heading (to skip)
    const isActHeading = (line: string): boolean => {
      if (headingLevels.act > 0) {
        const expectedHashes = '#'.repeat(headingLevels.act);
        const actRegex = new RegExp(`^${expectedHashes}\\s+act\\s+`, 'i');
        return actRegex.test(line);
      }
      return /^#{1,3}\s+act\s+/i.test(line);
    };

    // Helper to check for scene separators
    const isSceneSeparator = (line: string): boolean => {
      const trimmed = line.trim();
      // Match various scene separators: * * *, ***, ---, ___
      return /^\*\s*\*\s*\*$/.test(trimmed) ||
             /^\*{3,}$/.test(trimmed) ||
             /^-{3,}$/.test(trimmed) ||
             /^_{3,}$/.test(trimmed);
    };

    // Extract heading text (remove # symbols)
    const extractHeadingText = (line: string): string => {
      return line.replace(/^#+\s*/, '').trim();
    };

    for (const line of lines) {
      // Extract story title from first heading
      if (!titleExtracted && line.startsWith('#') && !line.startsWith('##')) {
        const title = extractHeadingText(line);
        if (title) {
          story.title = title;
          titleExtracted = true;
          console.log(`✓ Story title: "${story.title}"`);
          continue;
        }
      }

      // Skip author line
      if (line.toLowerCase().startsWith('by ')) {
        console.log(`⚠️ Skipping author line: "${line}"`);
        continue;
      }

      // Skip act headings
      if (isActHeading(line)) {
        console.log(`⚠️ Skipping act heading: "${line}"`);
        continue;
      }

      // Chapter detection - more flexible matching
      if (isChapterHeading(line)) {
        console.log(`✓ Chapter detected: "${line}"`);
        saveCurrentScene();

        const chapterTitle = extractHeadingText(line);
        currentChapter = {
          id: this.generateId(),
          title: chapterTitle,
          order: story.chapters.length + 1,
          chapterNumber: story.chapters.length + 1,
          scenes: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        story.chapters.push(currentChapter);
        sceneOrder = 0;
        currentScene = null;
        parsingState = 'content';
        continue;
      }

      // Scene heading detection (if document uses scene headings)
      if (headingLevels.scene > 0 && isSceneHeading(line)) {
        console.log(`✓ Scene heading detected: "${line}"`);
        saveCurrentScene();

        sceneOrder++;
        currentScene = {
          id: this.generateId(),
          title: extractHeadingText(line) || `Scene ${sceneOrder}`,
          content: '',
          order: sceneOrder,
          sceneNumber: sceneOrder,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        parsingState = 'story';
        continue;
      }

      // Story start marker - content starts after this
      if (line.trim() === '---' && parsingState === 'content') {
        console.log('✓ Story marker detected');
        parsingState = 'story';
        continue;
      }

      // Scene separator - creates a new scene
      if (isSceneSeparator(line)) {
        console.log('✓ Scene separator detected - starting new scene');
        saveCurrentScene();

        sceneOrder++;
        currentScene = {
          id: this.generateId(),
          title: `Scene ${sceneOrder}`,
          content: '',
          order: sceneOrder,
          sceneNumber: sceneOrder,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // After separator, content is story prose by default
        // NovelCrafter exports don't include summary sections after scene separators
        parsingState = 'story';
        continue;
      }

      // If we have a chapter but no scene yet, create one
      if (currentChapter && !currentScene && line.trim() !== '') {
        sceneOrder++;
        currentScene = {
          id: this.generateId(),
          title: `Scene ${sceneOrder}`,
          content: '',
          order: sceneOrder,
          sceneNumber: sceneOrder,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        console.log(`✓ Created first scene in chapter automatically`);
        parsingState = 'story'; // Assume content is story prose
      }

      // Collect content based on current state
      if (currentScene) {
        if (parsingState === 'story') {
          sceneBuffer.push(line);
        } else if (parsingState === 'content') {
          // Before any explicit markers, treat content as story prose
          // This handles the case where content appears immediately after chapter heading
          sceneBuffer.push(line);
        }
      }
    }

    // Save final scene
    saveCurrentScene();

    // If no chapters were found, create a single chapter with all content
    if (story.chapters.length === 0 && lines.length > 0) {
      console.log('⚠️ No chapters detected, creating single chapter from content');
      currentChapter = {
        id: this.generateId(),
        title: 'Chapter 1',
        order: 1,
        chapterNumber: 1,
        scenes: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Parse content as a single scene
      const contentLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('#') && titleExtracted) continue;
        if (line.toLowerCase().startsWith('by ')) continue;
        contentLines.push(line);
      }

      if (contentLines.join('').trim()) {
        const scene: Scene = {
          id: this.generateId(),
          title: 'Scene 1',
          content: contentLines.join('\n').trim(),
          order: 1,
          sceneNumber: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        currentChapter.scenes.push(scene);
      }

      if (currentChapter.scenes.length > 0) {
        story.chapters.push(currentChapter);
      }
    }

    // Fix scene order within each chapter
    story.chapters.forEach(chapter => {
      chapter.scenes.forEach((scene, index) => {
        scene.order = index + 1;
        if (scene.title.startsWith('Scene ')) {
          scene.title = `Scene ${index + 1}`;
        }
      });
    });

    console.log(`=== Parsing Complete ===`);
    console.log(`Story: "${story.title}"`);
    console.log(`Chapters: ${story.chapters.length}`);
    story.chapters.forEach((chapter, i) => {
      console.log(`  Chapter ${i + 1}: "${chapter.title}" (${chapter.scenes.length} scenes)`);
      chapter.scenes.forEach((scene, j) => {
        console.log(`    Scene ${j + 1}: "${scene.title}" - Summary: ${scene.summary?.length || 0} chars, Content: ${scene.content.length} chars`);
      });
    });

    return story;
  }

  /**
   * Detect heading levels used in the document for title, acts, chapters, and scenes
   */
  private detectHeadingLevels(lines: string[]): { title: number; act: number; chapter: number; scene: number } {
    const levels = { title: 0, act: 0, chapter: 0, scene: 0 };
    const headingCounts: Record<number, number> = {};

    // First pass: count headings at each level and identify patterns
    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        const level = match[1].length;
        const text = match[2].toLowerCase();

        headingCounts[level] = (headingCounts[level] || 0) + 1;

        // Identify specific heading types
        if (/^act\s+/i.test(text)) {
          levels.act = level;
        } else if (/^chapter\s+|^part\s+/i.test(text) || /^\d+[.:]/i.test(text)) {
          if (levels.chapter === 0 || level === levels.chapter) {
            levels.chapter = level;
          }
        } else if (/^scene\s+/i.test(text)) {
          levels.scene = level;
        }
      }
    }

    // If no explicit chapter markers, infer from heading hierarchy
    if (levels.chapter === 0) {
      const sortedLevels = Object.keys(headingCounts).map(Number).sort((a, b) => a - b);

      if (sortedLevels.length >= 1) {
        // First level is likely title, second is likely chapters
        if (sortedLevels.length === 1) {
          levels.title = sortedLevels[0];
        } else if (sortedLevels.length === 2) {
          levels.title = sortedLevels[0];
          levels.chapter = sortedLevels[1];
        } else if (sortedLevels.length >= 3) {
          levels.title = sortedLevels[0];
          // Second could be acts or chapters
          if (levels.act > 0) {
            levels.chapter = sortedLevels[2];
          } else {
            levels.chapter = sortedLevels[1];
            if (sortedLevels.length > 2) {
              levels.scene = sortedLevels[2];
            }
          }
        }
      }
    }

    // Default title to level 1 if not detected
    if (levels.title === 0) {
      levels.title = 1;
    }

    return levels;
  }

  private parseCodexEntry(content: string, filePath: string, category: string): CodexEntry | null {
    try {
      // Extract YAML frontmatter
      const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!yamlMatch) {
        console.warn(`No YAML frontmatter found in ${filePath}`);
        return null;
      }

      const yamlContent = yamlMatch[1];
      const markdownContent = content.substring(yamlMatch[0].length).trim();

      // Parse YAML using js-yaml library
      const parsedYaml = yaml.load(yamlContent) as Record<string, unknown>;
      if (!parsedYaml) {
        console.warn(`Failed to parse YAML in ${filePath}`);
        return null;
      }

      // Extract fields (if they exist)
      const fields = (parsedYaml as Record<string, unknown>)['fields'] || {};
      
      // Map to our codex entry format
      const codexEntry: CodexEntry = {
        id: this.generateId(),
        categoryId: '', // Will be set when creating categories
        title: (parsedYaml as Record<string, unknown>)['name'] as string || 'Unnamed Entry',
        content: markdownContent,
        tags: Array.isArray((parsedYaml as Record<string, unknown>)['tags']) ? (parsedYaml as Record<string, unknown>)['tags'] as string[] : [],
        metadata: {
          originalType: (parsedYaml as Record<string, unknown>)['type'],
          originalId: this.extractIdFromPath(filePath),
          color: (parsedYaml as Record<string, unknown>)['color'],
          aliases: Array.isArray((parsedYaml as Record<string, unknown>)['aliases']) ? (parsedYaml as Record<string, unknown>)['aliases'] : [],
          alwaysIncludeInContext: (parsedYaml as Record<string, unknown>)['alwaysIncludeInContext'],
          doNotTrack: (parsedYaml as Record<string, unknown>)['doNotTrack'],
          noAutoInclude: (parsedYaml as Record<string, unknown>)['noAutoInclude']
        },
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Handle Story Role field
      if ((fields as Record<string, unknown>)['Story Role']) {
        const storyRoleField = (fields as Record<string, unknown>)['Story Role'];
        const storyRole = Array.isArray(storyRoleField) 
          ? (storyRoleField[0] as string) 
          : (storyRoleField as string);
        codexEntry.metadata!['storyRole'] = storyRole;
      }

      // Convert other fields to custom fields
      const customFields: { id: string; name: string; value: string }[] = [];
      Object.entries(fields).forEach(([key, value]) => {
        if (key !== 'Story Role') {
          customFields.push({
            id: this.generateId(),
            name: key,
            value: Array.isArray(value) ? value.join(', ') : String(value)
          });
        }
      });

      if (customFields.length > 0) {
        codexEntry.metadata!['customFields'] = customFields;
      }

      console.log(`Successfully parsed codex entry: ${codexEntry.title} (${category})`);
      return codexEntry;
      
    } catch (error) {
      console.error(`Error parsing codex entry ${filePath}:`, error);
      return null;
    }
  }

  private extractIdFromPath(path: string): string {
    const parts = path.split('/');
    const folderName = parts[parts.length - 2];
    return folderName || 'unknown';
  }

  async importToStory(importResult: NovelCrafterImportResult): Promise<string> {
    // Create the story
    const newStory = await this.storyService.createStory();
    
    // Update story with imported data
    newStory.title = importResult.story.title;
    newStory.chapters = importResult.story.chapters;
    await this.storyService.updateStory(newStory);
    
    const storyId = newStory.id;

    // Create codex and categories
    const codex = await this.codexService.getOrCreateCodex(storyId);
    
    // Map categories
    const categoryMapping: Record<string, string> = {};
    
    // Characters -> Characters
    if (importResult.codexEntries.characters.length > 0) {
      let charCategory = codex.categories.find(c => c.title === 'Characters');
      if (!charCategory) {
        charCategory = await this.codexService.addCategory(storyId, {
          title: 'Characters',
          icon: '👤',
          description: 'Imported characters from NovelCrafter'
        });
      }
      categoryMapping['characters'] = charCategory.id;
    }

    // Locations -> Locations
    if (importResult.codexEntries.locations.length > 0) {
      let locCategory = codex.categories.find(c => c.title === 'Locations');
      if (!locCategory) {
        locCategory = await this.codexService.addCategory(storyId, {
          title: 'Locations',
          icon: '🏰',
          description: 'Imported locations from NovelCrafter'
        });
      }
      categoryMapping['locations'] = locCategory.id;
    }

    // Objects -> Objects
    if (importResult.codexEntries.objects.length > 0) {
      let objCategory = codex.categories.find(c => c.title === 'Objects');
      if (!objCategory) {
        objCategory = await this.codexService.addCategory(storyId, {
          title: 'Objects',
          icon: '⚔️',
          description: 'Imported objects from NovelCrafter'
        });
      }
      categoryMapping['objects'] = objCategory.id;
    }

    // Other -> Notes
    if (importResult.codexEntries.other.length > 0) {
      let noteCategory = codex.categories.find(c => c.title === 'Notes');
      if (!noteCategory) {
        noteCategory = await this.codexService.addCategory(storyId, {
          title: 'Notes',
          icon: '📝',
          description: 'Imported notes from NovelCrafter'
        });
      }
      categoryMapping['other'] = noteCategory.id;
    }

    // Add entries to categories
    for (const [category, entries] of Object.entries(importResult.codexEntries)) {
      const categoryId = categoryMapping[category];
      if (categoryId) {
        for (const entry of entries) {
          entry.categoryId = categoryId;
          const addedEntry = await this.codexService.addEntry(storyId, categoryId, {
            title: entry.title,
            content: entry.content
          });
          
          // Update the entry with metadata
          await this.codexService.updateEntry(storyId, categoryId, addedEntry.id, {
            ...addedEntry,
            metadata: entry.metadata,
            tags: entry.tags
          });
        }
      }
    }

    return storyId;
  }

  private isCodexEntry(relativePath: string, fileName: string, category: string): boolean {
    const pathLower = relativePath.toLowerCase();
    const categoryLower = category.toLowerCase();
    const categoryPlural = categoryLower + 's';
    const categorySingular = categoryLower.replace(/s$/, '');
    
    // Check if it's a markdown file - expand beyond just 'entry.md'
    if (!fileName.endsWith('.md')) {
      return false;
    }
    
    // Multiple patterns to check:
    // 1. /characters/, /locations/, /objects/, /other/ (current pattern)
    // 2. /codex/characters/, /codex/locations/, etc.
    // 3. /character/, /location/, /object/ (singular)
    // 4. Any path that contains the category name
    
    const patterns = [
      `/${categoryPlural}/`,       // /characters/
      `/${categorySingular}/`,     // /character/
      `/codex/${categoryPlural}/`, // /codex/characters/
      `/codex/${categorySingular}/`, // /codex/character/
      `/${categoryLower}/`,        // generic match
    ];
    
    // Special handling for 'other' category
    if (category === 'other') {
      patterns.push('/notes/', '/misc/', '/miscellaneous/', '/others/');
    }
    
    // Check if path matches any of the patterns
    const pathMatches = patterns.some(pattern => pathLower.includes(pattern));
    
    // Also check if it's specifically an 'entry.md' file (preferred)
    // const isEntryFile = fileName === 'entry.md'; // Unused variable
    
    // Accept any .md file in matching paths
    return pathMatches;
  }

  private generateId(): string {
    return 'import-' + Math.random().toString(36).substring(2, 11);
  }
}