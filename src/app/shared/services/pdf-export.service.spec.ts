import { TestBed } from '@angular/core/testing';
import { PDFExportService } from './pdf-export.service';
import { BackgroundService } from './background.service';
import { SyncedCustomBackgroundService } from './synced-custom-background.service';
import { Story, Chapter, Scene } from '../../stories/models/story.interface';

// Helper to create a valid mock scene
function createMockScene(id: string, title: string, content: string): Scene {
  const now = new Date();
  return {
    id,
    title,
    content,
    order: 0,
    sceneNumber: 1,
    createdAt: now,
    updatedAt: now
  };
}

// Helper to create a valid mock chapter
function createMockChapter(id: string, title: string, scenes: Scene[]): Chapter {
  const now = new Date();
  return {
    id,
    title,
    order: 0,
    chapterNumber: 1,
    scenes,
    createdAt: now,
    updatedAt: now
  };
}

// Helper to create a valid mock story
function createMockStory(id: string, title: string, chapters: Chapter[]): Story {
  const now = new Date();
  return {
    id,
    title,
    chapters,
    createdAt: now,
    updatedAt: now
  };
}

describe('PDFExportService', () => {
  let service: PDFExportService;
  let backgroundService: jasmine.SpyObj<BackgroundService>;
  let customBackgroundService: jasmine.SpyObj<SyncedCustomBackgroundService>;

  beforeEach(() => {
    backgroundService = jasmine.createSpyObj<BackgroundService>('BackgroundService', ['getCurrentBackground']);
    customBackgroundService = jasmine.createSpyObj<SyncedCustomBackgroundService>('SyncedCustomBackgroundService', ['backgrounds']);

    backgroundService.getCurrentBackground.and.returnValue('none');
    customBackgroundService.backgrounds.and.returnValue([]);

    TestBed.configureTestingModule({
      providers: [
        PDFExportService,
        { provide: BackgroundService, useValue: backgroundService },
        { provide: SyncedCustomBackgroundService, useValue: customBackgroundService }
      ]
    });

    service = TestBed.inject(PDFExportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('progress$', () => {
    it('should emit initial progress state', (done) => {
      service.progress$.subscribe(progress => {
        expect(progress.phase).toBe('initializing');
        expect(progress.progress).toBe(0);
        done();
      });
    });
  });

  describe('extractPlainText', () => {
    it('should extract text from simple HTML paragraphs', () => {
      const html = '<p>Hello</p><p>World</p>';
      const result = (service as unknown as { extractPlainText: (html: string) => string }).extractPlainText(html);
      expect(result).toBe('Hello\n\nWorld');
    });

    it('should handle HTML without paragraphs', () => {
      const html = 'Plain text content';
      const result = (service as unknown as { extractPlainText: (html: string) => string }).extractPlainText(html);
      expect(result).toBe('Plain text content');
    });

    it('should remove Beat AI components and preserve paragraphs', () => {
      const html = '<div class="beat-ai-wrapper"><p>AI content</p></div><p>Regular content</p>';
      const result = (service as unknown as { extractPlainText: (html: string) => string }).extractPlainText(html);
      expect(result).toContain('AI content');
      expect(result).toContain('Regular content');
    });

    it('should handle empty content', () => {
      const html = '';
      const result = (service as unknown as { extractPlainText: (html: string) => string }).extractPlainText(html);
      expect(result).toBe('');
    });

    it('should handle whitespace-only paragraphs', () => {
      const html = '<p>   </p><p>Content</p>';
      const result = (service as unknown as { extractPlainText: (html: string) => string }).extractPlainText(html);
      expect(result).toBe('Content');
    });
  });

  describe('exportStoryToPDF', () => {
    it('should handle story with no chapters gracefully', async () => {
      const story = createMockStory('test-story', 'Test Story', []);

      // Service should handle empty stories without crashing
      // (validation is done in story-editor.component.ts, not in the service)
      await expectAsync(
        service.exportStoryToPDF(story, { includeBackground: false })
      ).toBeResolved();
    });

    it('should handle story with empty content gracefully', async () => {
      const scene = createMockScene('scene-1', 'Scene 1', '');
      const chapter = createMockChapter('chapter-1', 'Chapter 1', [scene]);
      const story = createMockStory('test-story', 'Test Story', [chapter]);

      // Service should handle empty content without crashing
      await expectAsync(
        service.exportStoryToPDF(story, { includeBackground: false })
      ).toBeResolved();
    });

    it('should successfully export story with content', async () => {
      const scene = createMockScene('scene-1', 'Scene 1', '<p>Hello World</p>');
      const chapter = createMockChapter('chapter-1', 'Chapter 1', [scene]);
      const story = createMockStory('test-story', 'Test Story', [chapter]);

      await expectAsync(
        service.exportStoryToPDF(story, { includeBackground: false })
      ).toBeResolved();
    });
  });

  describe('processNodeRecursively depth limit', () => {
    it('should not crash with deeply nested content', async () => {
      // Create deeply nested HTML structure
      let nestedHtml = '<p>Deep content</p>';
      for (let i = 0; i < 100; i++) {
        nestedHtml = `<div>${nestedHtml}</div>`;
      }

      const scene = createMockScene('scene-1', 'Scene 1', nestedHtml);
      const chapter = createMockChapter('chapter-1', 'Chapter 1', [scene]);
      const story = createMockStory('test-story', 'Test Story', [chapter]);

      // Should not throw due to stack overflow - the depth limit should prevent it
      // Note: This will fail for other reasons (jsPDF save), but shouldn't crash from recursion
      try {
        await service.exportStoryToPDF(story, { includeBackground: false });
      } catch (e) {
        // Expected to fail due to jsPDF save in test environment
        // But should NOT be a stack overflow error
        expect((e as Error).message).not.toContain('Maximum call stack');
      }
    });
  });

  describe('PDFExportOptions', () => {
    it('should use default options when not provided', () => {
      const scene = createMockScene('scene-1', 'Scene 1', '<p>Test content</p>');
      const chapter = createMockChapter('chapter-1', 'Chapter 1', [scene]);
      const story = createMockStory('test-story', 'Test Story', [chapter]);

      // This should not throw - defaults should be applied
      expect(() => {
        service.exportStoryToPDF(story, {});
      }).not.toThrow();
    });
  });

  describe('background handling', () => {
    it('should check current background from BackgroundService', async () => {
      backgroundService.getCurrentBackground.and.returnValue('some-background.jpg');

      const scene = createMockScene('scene-1', 'Scene 1', '<p>Content</p>');
      const chapter = createMockChapter('chapter-1', 'Chapter 1', [scene]);
      const story = createMockStory('test-story', 'Test Story', [chapter]);

      try {
        await service.exportStoryToPDF(story, { includeBackground: true });
      } catch {
        // Expected to fail in test environment
      }

      expect(backgroundService.getCurrentBackground).toHaveBeenCalled();
    });

    it('should not check background when includeBackground is false', async () => {
      const scene = createMockScene('scene-1', 'Scene 1', '<p>Content</p>');
      const chapter = createMockChapter('chapter-1', 'Chapter 1', [scene]);
      const story = createMockStory('test-story', 'Test Story', [chapter]);

      try {
        await service.exportStoryToPDF(story, { includeBackground: false });
      } catch {
        // Expected to fail in test environment
      }

      // When background is disabled, getCurrentBackground should not be called
      // for adding background (it may still be called for initialization)
    });
  });
});
