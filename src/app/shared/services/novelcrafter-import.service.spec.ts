import { TestBed } from '@angular/core/testing';
import { NovelCrafterImportService } from './novelcrafter-import.service';
import { StoryService } from '../../stories/services/story.service';
import { CodexService } from '../../stories/services/codex.service';

describe('NovelCrafterImportService', () => {
  let service: NovelCrafterImportService;

  beforeEach(() => {
    // Mock dependencies
    const storyServiceMock = jasmine.createSpyObj('StoryService', ['createStory', 'updateStory']);
    const codexServiceMock = jasmine.createSpyObj('CodexService', ['getOrCreateCodex', 'addCategory', 'addEntry', 'updateEntry']);

    TestBed.configureTestingModule({
      providers: [
        NovelCrafterImportService,
        { provide: StoryService, useValue: storyServiceMock },
        { provide: CodexService, useValue: codexServiceMock }
      ]
    });

    service = TestBed.inject(NovelCrafterImportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('parseNovelStructure - GitHub Issue #9 Bug Fix', () => {
    // Test fixture based on user's sample from GitHub Issue #9
    // Original structure:
    // # My Novel
    // by Me
    // ## Act 1
    // ### Part 1
    // [ REDACTED NARRATIVE ]
    // * * *
    // [ REDACTED NARRATIVE ]
    // * * *
    // ### Part 2
    // [ REST OF CHAPTER REDACTED ]

    const sampleNovelMd = `# The Adventure Begins
by Test Author

## Act 1

### Part 1

Sarah walked through the forest, her boots crunching on the fallen leaves. The autumn air was crisp and refreshing.

She paused at the old oak tree, remembering her childhood visits to this place.

* * *

The sun had shifted by the time she continued walking. A strange sound echoed through the trees.

Sarah froze, listening intently. Something was moving in the underbrush ahead.

* * *

### Part 2

Morning came quickly. Sarah woke to birdsong and the smell of pine.

She packed her belongings and prepared for another day of exploration.`;

    it('should parse all scenes with content (Issue #9 reproduction)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).parseNovelStructure(sampleNovelMd);

      // Should have 2 chapters (Part 1 and Part 2 - Act 1 is skipped as act heading)
      expect(result.chapters.length).toBe(2);

      // Part 1 should have 2 scenes (separated by * * *)
      expect(result.chapters[0].scenes.length).toBe(2);

      // Part 2 should have 1 scene
      expect(result.chapters[1].scenes.length).toBe(1);

      // CRITICAL: All scenes must have content in scene.content field
      // Scene 1: "Sarah walked through..."
      expect(result.chapters[0].scenes[0].content).toContain('Sarah walked through the forest');
      expect(result.chapters[0].scenes[0].content).toContain('She paused at the old oak tree');

      // Scene 2: "The sun had shifted..." - THIS IS THE BUG: was empty before fix
      expect(result.chapters[0].scenes[1].content).toContain('The sun had shifted');
      expect(result.chapters[0].scenes[1].content).toContain('Sarah froze, listening intently');

      // Scene 3: "Morning came quickly..." - THIS IS THE BUG: was empty before fix
      expect(result.chapters[1].scenes[0].content).toContain('Morning came quickly');
      expect(result.chapters[1].scenes[0].content).toContain('She packed her belongings');
    });

    it('should NOT put scene content into summary field after separator', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).parseNovelStructure(sampleNovelMd);

      // The bug caused content to go to summary instead of content
      // After fix, summary should be empty for all scenes
      result.chapters.forEach((chapter: { scenes: { summary: string; title: string }[] }) => {
        chapter.scenes.forEach((scene: { summary: string; title: string }) => {
          // Summary should be empty or undefined (not contain narrative)
          const summary = scene.summary || '';
          expect(summary).toBe('');
        });
      });
    });

    it('should preserve paragraph breaks in scene content', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).parseNovelStructure(sampleNovelMd);

      // First scene should have paragraph break preserved
      const scene1Content = result.chapters[0].scenes[0].content;
      expect(scene1Content).toContain('\n');

      // Verify specific paragraph separation
      expect(scene1Content).toContain('refreshing.');
      expect(scene1Content).toContain('She paused');
    });

    it('should extract story title correctly', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).parseNovelStructure(sampleNovelMd);
      expect(result.title).toBe('The Adventure Begins');
    });

    it('should skip author line', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).parseNovelStructure(sampleNovelMd);

      // Author line should not appear in any content
      const allContent = result.chapters.map((c: { scenes: { content: string }[] }) =>
        c.scenes.map((s: { content: string }) => s.content).join(' ')
      ).join(' ');

      expect(allContent).not.toContain('by Test Author');
    });

    it('should skip Act headings and not create chapters for them', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).parseNovelStructure(sampleNovelMd);

      // "Act 1" should not be a chapter title
      const chapterTitles = result.chapters.map((c: { title: string }) => c.title);
      expect(chapterTitles).not.toContain('Act 1');
    });
  });

  describe('parseNovelStructure - Additional Scene Separator Formats', () => {
    it('should handle triple asterisk separator (***)', async () => {
      const markdown = `# Novel

## Chapter 1

Scene one content here.

***

Scene two content here.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).parseNovelStructure(markdown);

      expect(result.chapters[0].scenes.length).toBe(2);
      expect(result.chapters[0].scenes[0].content).toContain('Scene one content here');
      expect(result.chapters[0].scenes[1].content).toContain('Scene two content here');
    });

    it('should handle underscore separator (___)', async () => {
      const markdown = `# Novel

## Chapter 1

Scene one.

___

Scene two.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).parseNovelStructure(markdown);

      expect(result.chapters[0].scenes.length).toBe(2);
      expect(result.chapters[0].scenes[1].content).toContain('Scene two');
    });

    it('should handle multiple chapters with multiple scenes each', async () => {
      const markdown = `# My Novel

## Chapter 1

Chapter 1, Scene 1 content.

* * *

Chapter 1, Scene 2 content.

## Chapter 2

Chapter 2, Scene 1 content.

* * *

Chapter 2, Scene 2 content.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).parseNovelStructure(markdown);

      expect(result.chapters.length).toBe(2);

      expect(result.chapters[0].scenes.length).toBe(2);
      expect(result.chapters[0].scenes[0].content).toContain('Chapter 1, Scene 1');
      expect(result.chapters[0].scenes[1].content).toContain('Chapter 1, Scene 2');

      expect(result.chapters[1].scenes.length).toBe(2);
      expect(result.chapters[1].scenes[0].content).toContain('Chapter 2, Scene 1');
      expect(result.chapters[1].scenes[1].content).toContain('Chapter 2, Scene 2');
    });
  });

  describe('parseNovelStructure - Edge Cases', () => {
    it('should handle document with no chapter markers', async () => {
      const markdown = `# My Story

Some content without chapter markers.

More content here.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).parseNovelStructure(markdown);

      // Should create a single chapter with the content
      expect(result.chapters.length).toBe(1);
      expect(result.chapters[0].scenes.length).toBeGreaterThanOrEqual(1);
    });

    it('should skip empty scenes', async () => {
      const markdown = `# Novel

## Chapter 1

Actual content here.

* * *

* * *

More content after empty separator.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).parseNovelStructure(markdown);

      // Empty scenes (between consecutive separators) should be skipped
      const allScenes = result.chapters.flatMap((c: { scenes: { content: string }[] }) => c.scenes);
      allScenes.forEach((scene: { content: string }) => {
        expect(scene.content.trim().length > 0 || (scene as { summary?: string }).summary?.trim().length).toBeTruthy();
      });
    });
  });
});
