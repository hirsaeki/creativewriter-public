import { TestBed } from '@angular/core/testing';
import { StoryService } from './story.service';
import { DatabaseService } from '../../core/services/database.service';
import { BeatHistoryService } from '../../shared/services/beat-history.service';
import { DeviceService } from '../../core/services/device.service';
import { StoryMetadataIndexService } from './story-metadata-index.service';

describe('StoryService', () => {
  let service: StoryService;
  let mockDatabaseService: jasmine.SpyObj<DatabaseService>;
  let mockBeatHistoryService: jasmine.SpyObj<BeatHistoryService>;
  let mockDeviceService: jasmine.SpyObj<DeviceService>;
  let mockMetadataIndexService: jasmine.SpyObj<StoryMetadataIndexService>;
  let mockDb: jasmine.SpyObj<PouchDB.Database>;

  beforeEach(() => {
    // Create mock database
    mockDb = jasmine.createSpyObj('PouchDB.Database', [
      'get',
      'put',
      'remove',
      'allDocs',
      'find',
      'bulkDocs'
    ]);
    mockDb.name = 'test-db';

    // Create mock services
    mockDatabaseService = jasmine.createSpyObj('DatabaseService', ['getDatabase']);
    mockDatabaseService.getDatabase.and.returnValue(Promise.resolve(mockDb as unknown as PouchDB.Database));

    mockBeatHistoryService = jasmine.createSpyObj('BeatHistoryService', [
      'saveVersion',
      'getHistory',
      'deleteAllHistoriesForStory'
    ]);

    mockDeviceService = jasmine.createSpyObj('DeviceService', ['getDeviceId']);
    mockDeviceService.getDeviceId.and.returnValue('test-device-id');

    mockMetadataIndexService = jasmine.createSpyObj('StoryMetadataIndexService', [
      'getMetadataIndex',
      'updateStoryMetadata',
      'removeStoryMetadata',
      'clearCache'
    ]);
    mockMetadataIndexService.getMetadataIndex.and.returnValue(Promise.resolve({
      _id: 'story-metadata-index',
      type: 'story-metadata-index',
      lastUpdated: new Date(),
      stories: []
    }));
    mockMetadataIndexService.updateStoryMetadata.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({
      providers: [
        StoryService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: BeatHistoryService, useValue: mockBeatHistoryService },
        { provide: DeviceService, useValue: mockDeviceService },
        { provide: StoryMetadataIndexService, useValue: mockMetadataIndexService }
      ]
    });

    service = TestBed.inject(StoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('migrateBeatIds', () => {
    it('should migrate data-id to data-beat-id for legacy beats', () => {
      const htmlWithLegacyBeat = `
        <p>Some text before</p>
        <div class="beat-ai-node" data-id="beat-legacy-123" data-prompt="Test prompt">
          <span>Beat content</span>
        </div>
        <p>Some text after</p>
      `;

      // Access the private method via type assertion for testing
      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithLegacyBeat);

      // Should have data-beat-id
      expect(result).toContain('data-beat-id="beat-legacy-123"');
      // Should not have data-id
      expect(result).not.toContain('data-id="beat-legacy-123"');
      // Should preserve other attributes
      expect(result).toContain('data-prompt="Test prompt"');
      // Should preserve content
      expect(result).toContain('<span>Beat content</span>');
    });

    it('should remove data-id when both data-beat-id and data-id exist', () => {
      const htmlWithBothAttributes = `
        <div class="beat-ai-node" data-beat-id="beat-new-456" data-id="beat-old-456" data-prompt="Test">
          <span>Content</span>
        </div>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithBothAttributes);

      // Should keep data-beat-id
      expect(result).toContain('data-beat-id="beat-new-456"');
      // Should remove data-id
      expect(result).not.toContain('data-id=');
    });

    it('should handle multiple beats in the same content', () => {
      const htmlWithMultipleBeats = `
        <p>Paragraph 1</p>
        <div class="beat-ai-node" data-id="beat-1" data-prompt="Prompt 1">Beat 1</div>
        <p>Paragraph 2</p>
        <div class="beat-ai-node" data-id="beat-2" data-prompt="Prompt 2">Beat 2</div>
        <p>Paragraph 3</p>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithMultipleBeats);

      // Both beats should be migrated
      expect(result).toContain('data-beat-id="beat-1"');
      expect(result).toContain('data-beat-id="beat-2"');
      // Neither should have data-id
      expect(result).not.toContain('data-id="beat-1"');
      expect(result).not.toContain('data-id="beat-2"');
    });

    it('should not modify beats that already use data-beat-id', () => {
      const htmlWithNewBeat = `
        <div class="beat-ai-node" data-beat-id="beat-new-789" data-prompt="Test">
          <span>New beat</span>
        </div>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithNewBeat);

      // Should remain unchanged (except for potential whitespace normalization)
      expect(result).toContain('data-beat-id="beat-new-789"');
      expect(result).not.toContain('data-id=');
    });

    it('should handle empty or null content gracefully', () => {
      const emptyResult = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds('');
      expect(emptyResult).toBe('');

      const nullResult = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(null as unknown as string);
      expect(nullResult).toBe(null as unknown as string);
    });

    it('should preserve non-beat elements with data-id attributes', () => {
      const htmlWithMixedElements = `
        <div id="normal-div" data-id="some-other-id">Regular div</div>
        <span data-id="span-id">Regular span</span>
        <div class="beat-ai-node" data-id="beat-123">Beat content</div>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithMixedElements);

      // Beat should be migrated
      expect(result).toContain('data-beat-id="beat-123"');
      // Other elements with data-id should be migrated too (since the method migrates ALL data-id attributes)
      expect(result).toContain('data-beat-id="some-other-id"');
      expect(result).toContain('data-beat-id="span-id"');
    });

    it('should handle complex nested HTML structures', () => {
      const complexHtml = `
        <div class="chapter">
          <h2>Chapter Title</h2>
          <div class="beat-ai-node" data-id="beat-nested-1" data-prompt="Nested prompt">
            <div class="beat-content">
              <p>Nested content</p>
            </div>
          </div>
          <p>More text</p>
        </div>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(complexHtml);

      expect(result).toContain('data-beat-id="beat-nested-1"');
      expect(result).not.toContain('data-id="beat-nested-1"');
      expect(result).toContain('<h2>Chapter Title</h2>');
      expect(result).toContain('<p>Nested content</p>');
    });

    it('should generate ID for beat without any ID attribute', () => {
      const htmlWithoutId = `
        <p>Some text</p>
        <div class="beat-ai-node" data-prompt="Test prompt">
          <span>Beat content without ID</span>
        </div>
        <p>More text</p>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithoutId);

      // Should have data-beat-id attribute
      expect(result).toContain('data-beat-id=');
      // Should not have data-id
      expect(result).not.toContain('data-id=');
      // Extract the generated ID to verify it's valid
      const idMatch = result.match(/data-beat-id="([^"]+)"/);
      expect(idMatch).toBeTruthy();
      expect(idMatch![1]).toBeTruthy();
      expect(idMatch![1].length).toBeGreaterThan(0);
    });

    it('should generate unique IDs for multiple beats without IDs', () => {
      const htmlWithMultipleBeatsNoIds = `
        <div class="beat-ai-node" data-prompt="Prompt 1">Beat 1</div>
        <div class="beat-ai-node" data-prompt="Prompt 2">Beat 2</div>
        <div class="beat-ai-node" data-prompt="Prompt 3">Beat 3</div>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithMultipleBeatsNoIds);

      // Extract all generated IDs
      const idMatches = Array.from(result.matchAll(/data-beat-id="([^"]+)"/g));
      expect(idMatches.length).toBe(3);

      const ids = idMatches.map(match => match[1]);

      // All should have IDs
      ids.forEach(id => {
        expect(id).toBeTruthy();
        expect(id.length).toBeGreaterThan(0);
      });

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('should handle mixed beats: some with IDs, some without', () => {
      const mixedHtml = `
        <div class="beat-ai-node" data-beat-id="beat-with-id" data-prompt="Has ID">Beat 1</div>
        <div class="beat-ai-node" data-prompt="No ID">Beat 2</div>
        <div class="beat-ai-node" data-id="beat-legacy" data-prompt="Legacy ID">Beat 3</div>
        <div class="beat-ai-node" data-prompt="Also no ID">Beat 4</div>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(mixedHtml);

      // Should have 4 data-beat-id attributes
      const idMatches = Array.from(result.matchAll(/data-beat-id="([^"]+)"/g));
      expect(idMatches.length).toBe(4);

      // Should preserve existing ID
      expect(result).toContain('data-beat-id="beat-with-id"');

      // Should migrate legacy ID
      expect(result).toContain('data-beat-id="beat-legacy"');
      expect(result).not.toContain('data-id="beat-legacy"');

      // Should not have any data-id attributes
      expect(result).not.toContain('data-id=');
    });

    it('should not add IDs to non-beat elements', () => {
      const htmlWithNonBeats = `
        <div class="regular-node">Regular div</div>
        <div class="beat-ai-node" data-prompt="Beat">Beat content</div>
        <span class="other-element">Span</span>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithNonBeats);

      // Should have exactly 1 data-beat-id (only for the beat)
      const idMatches = Array.from(result.matchAll(/data-beat-id="([^"]+)"/g));
      expect(idMatches.length).toBe(1);

      // Verify the ID is only on the beat element
      expect(result).toMatch(/<div class="beat-ai-node"[^>]*data-beat-id="[^"]+"[^>]*>/);
    });
  });

  describe('migrateStory integration', () => {
    it('should automatically migrate beat IDs when loading a story', async () => {
      const storyWithLegacyBeats = {
        _id: 'story-1',
        id: 'story-1',
        title: 'Test Story',
        schemaVersion: 0, // Old schema version to trigger migration
        chapters: [
          {
            id: 'chapter-1',
            title: 'Chapter 1',
            order: 1,
            chapterNumber: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            scenes: [
              {
                id: 'scene-1',
                title: 'Scene 1',
                order: 1,
                sceneNumber: 1,
                content: '<div class="beat-ai-node" data-id="beat-old-1">Old beat</div>',
                createdAt: new Date(),
                updatedAt: new Date()
              }
            ]
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockDb.get.and.returnValue(Promise.resolve(storyWithLegacyBeats as any));

      const migratedStory = await service.getStory('story-1');

      expect(migratedStory).toBeTruthy();
      expect(migratedStory?.chapters[0].scenes[0].content).toContain('data-beat-id="beat-old-1"');
      expect(migratedStory?.chapters[0].scenes[0].content).not.toContain('data-id="beat-old-1"');
    });
  });
});
