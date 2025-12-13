import { TestBed } from '@angular/core/testing';
import { StoryEditorStateService } from './story-editor-state.service';
import { StoryService } from './story.service';
import { PromptManagerService } from '../../shared/services/prompt-manager.service';
import { StoryStatsService } from './story-stats.service';
import { Story } from '../models/story.interface';

describe('StoryEditorStateService', () => {
  let service: StoryEditorStateService;
  let storyServiceSpy: jasmine.SpyObj<StoryService>;
  let promptManagerSpy: jasmine.SpyObj<PromptManagerService>;
  let statsServiceSpy: jasmine.SpyObj<StoryStatsService>;

  const mockStory: Story = {
    id: 'story-1',
    title: 'Test Story',
    chapters: [
      {
        id: 'chapter-1',
        title: 'Chapter One',
        order: 1,
        chapterNumber: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        scenes: [
          {
            id: 'scene-1',
            title: 'Scene One',
            content: '<p>Test content</p>',
            order: 1,
            sceneNumber: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    const storyServiceSpyObj = jasmine.createSpyObj('StoryService', [
      'getStory',
      'getScene',
      'updateScene',
      'updateStory'
    ]);
    const promptManagerSpyObj = jasmine.createSpyObj('PromptManagerService', [
      'setCurrentStory'
    ]);
    const statsServiceSpyObj = jasmine.createSpyObj('StoryStatsService', [
      'calculateTotalStoryWordCount'
    ]);

    TestBed.configureTestingModule({
      providers: [
        StoryEditorStateService,
        { provide: StoryService, useValue: storyServiceSpyObj },
        { provide: PromptManagerService, useValue: promptManagerSpyObj },
        { provide: StoryStatsService, useValue: statsServiceSpyObj }
      ]
    });

    service = TestBed.inject(StoryEditorStateService);
    storyServiceSpy = TestBed.inject(StoryService) as jasmine.SpyObj<StoryService>;
    promptManagerSpy = TestBed.inject(PromptManagerService) as jasmine.SpyObj<PromptManagerService>;
    statsServiceSpy = TestBed.inject(StoryStatsService) as jasmine.SpyObj<StoryStatsService>;

    // Default spy returns
    storyServiceSpy.getStory.and.returnValue(Promise.resolve(mockStory));
    storyServiceSpy.getScene.and.returnValue(Promise.resolve(mockStory.chapters[0].scenes[0]));
    storyServiceSpy.updateScene.and.returnValue(Promise.resolve());
    storyServiceSpy.updateStory.and.returnValue(Promise.resolve());
    promptManagerSpy.setCurrentStory.and.returnValue(Promise.resolve());
    statsServiceSpy.calculateTotalStoryWordCount.and.returnValue(100);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('loadStory', () => {
    it('should load story and select last scene by default', async () => {
      await service.loadStory('story-1');

      const state = service.getCurrentState();
      expect(state.story).toEqual(mockStory);
      expect(state.activeChapterId).toBe('chapter-1');
      expect(state.activeSceneId).toBe('scene-1');
      expect(state.activeScene).toEqual(mockStory.chapters[0].scenes[0]);
      expect(promptManagerSpy.setCurrentStory).toHaveBeenCalledWith('story-1');
    });

    it('should select preferred scene if provided', async () => {
      await service.loadStory('story-1', 'chapter-1', 'scene-1');

      const state = service.getCurrentState();
      expect(state.activeChapterId).toBe('chapter-1');
      expect(state.activeSceneId).toBe('scene-1');
    });

    it('should calculate word count', async () => {
      await service.loadStory('story-1');

      const state = service.getCurrentState();
      expect(state.wordCount).toBe(100);
      expect(statsServiceSpy.calculateTotalStoryWordCount).toHaveBeenCalledWith(mockStory);
    });
  });

  describe('setActiveScene', () => {
    it('should update active scene', async () => {
      await service.loadStory('story-1');
      await service.setActiveScene('chapter-1', 'scene-1');

      const state = service.getCurrentState();
      expect(state.activeChapterId).toBe('chapter-1');
      expect(state.activeSceneId).toBe('scene-1');
      expect(state.activeScene).toEqual(mockStory.chapters[0].scenes[0]);
    });
  });

  describe('updateSceneContent', () => {
    it('should update scene content and mark as unsaved', async () => {
      await service.loadStory('story-1');
      service.updateSceneContent('<p>New content</p>');

      const state = service.getCurrentState();
      expect(state.activeScene?.content).toBe('<p>New content</p>');
      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('should recalculate word count', async () => {
      await service.loadStory('story-1');
      statsServiceSpy.calculateTotalStoryWordCount.and.returnValue(150);

      service.updateSceneContent('<p>New longer content</p>');

      const state = service.getCurrentState();
      expect(state.wordCount).toBe(150);
    });
  });

  describe('saveStory', () => {
    it('should save scene and story changes', async () => {
      await service.loadStory('story-1');
      service.updateSceneContent('<p>Updated content</p>');
      service.updateStoryTitle('Updated Title');

      // getStory is called again during save to check if title changed
      // Return a fresh copy with original title to simulate fetching from DB
      storyServiceSpy.getStory.and.returnValue(Promise.resolve({ ...mockStory, title: 'Test Story' }));

      await service.saveStory();

      expect(storyServiceSpy.updateScene).toHaveBeenCalled();
      expect(storyServiceSpy.updateStory).toHaveBeenCalled();

      const state = service.getCurrentState();
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should not save if no changes', async () => {
      await service.loadStory('story-1');

      await service.saveStory();

      expect(storyServiceSpy.updateScene).not.toHaveBeenCalled();
      expect(storyServiceSpy.updateStory).not.toHaveBeenCalled();
    });

    it('should force save even if no changes when force option is true', async () => {
      await service.loadStory('story-1');

      await service.saveStory({ force: true });

      expect(storyServiceSpy.updateScene).toHaveBeenCalled();
    });
  });

  describe('saveStory concurrent save handling', () => {
    it('should wait for ongoing save before returning when concurrent save detected', async () => {
      await service.loadStory('story-1');
      service.updateSceneContent('<p>First update</p>');

      // Create a slow save that takes time to complete
      let resolveSlowSave!: () => void;
      const slowSavePromise = new Promise<void>(resolve => {
        resolveSlowSave = resolve;
      });
      storyServiceSpy.updateScene.and.returnValue(slowSavePromise);

      // Start first save (will be slow)
      const firstSave = service.saveStory();

      // Start second save while first is in progress
      const secondSave = service.saveStory();

      // At this point, second save should be waiting
      expect(service.hasPendingSave()).toBe(true);

      // Complete the slow save
      resolveSlowSave();
      await firstSave;
      await secondSave;

      // Both saves should complete without error
      expect(service.getCurrentState().hasUnsavedChanges).toBe(false);
    });

    it('should retry save when concurrent save fails and changes remain', async () => {
      await service.loadStory('story-1');
      service.updateSceneContent('<p>Content to save</p>');

      let callCount = 0;
      storyServiceSpy.updateScene.and.callFake(() => {
        callCount++;
        if (callCount === 1) {
          // First call fails
          return Promise.reject(new Error('Database error'));
        }
        // Subsequent calls succeed
        return Promise.resolve();
      });

      // Start first save (will fail)
      const firstSave = service.saveStory().catch(() => {
        // Expected to fail
      });

      // Start second save while first is in progress
      const secondSave = service.saveStory();

      await firstSave;

      // After first save fails, hasUnsavedChanges should be true
      // and second save should eventually retry
      await secondSave;

      // updateScene should have been called more than once (retry happened)
      expect(storyServiceSpy.updateScene.calls.count()).toBeGreaterThan(1);
    });

    it('should not retry when concurrent save succeeds', async () => {
      await service.loadStory('story-1');
      service.updateSceneContent('<p>Content to save</p>');

      // Slow but successful save
      let resolveSlowSave!: () => void;
      const slowSavePromise = new Promise<void>(resolve => {
        resolveSlowSave = resolve;
      });
      storyServiceSpy.updateScene.and.returnValue(slowSavePromise);

      // Start first save
      const firstSave = service.saveStory();

      // Start second save while first is in progress
      const secondSave = service.saveStory();

      // Complete the slow save
      resolveSlowSave();
      await firstSave;
      await secondSave;

      // updateScene should only be called once (no retry needed)
      expect(storyServiceSpy.updateScene.calls.count()).toBe(1);
      expect(service.getCurrentState().hasUnsavedChanges).toBe(false);
    });

    it('should handle rapid consecutive saves correctly', async () => {
      await service.loadStory('story-1');

      // Create multiple content updates and saves rapidly
      const saves: Promise<void>[] = [];

      for (let i = 0; i < 5; i++) {
        service.updateSceneContent(`<p>Content version ${i}</p>`);
        saves.push(service.saveStory());
      }

      // All saves should complete without error
      await Promise.all(saves);

      // Final state should show no unsaved changes
      expect(service.getCurrentState().hasUnsavedChanges).toBe(false);
      // At least one save should have been executed
      expect(storyServiceSpy.updateScene).toHaveBeenCalled();
    });

    it('should have valid currentSavePromise before isSaving is set to true', async () => {
      await service.loadStory('story-1');
      service.updateSceneContent('<p>Content</p>');

      // Track state transitions
      const stateTransitions: { isSaving: boolean; hasPromise: boolean }[] = [];

      // Override updateScene to capture state at save time
      storyServiceSpy.updateScene.and.callFake(() => {
        stateTransitions.push({
          isSaving: service.getCurrentState().isSaving,
          hasPromise: service.hasPendingSave() || service.getCurrentState().isSaving
        });
        return Promise.resolve();
      });

      await service.saveStory();

      // When updateScene was called, isSaving should have been true
      expect(stateTransitions.length).toBeGreaterThan(0);
      expect(stateTransitions[0].isSaving).toBe(true);
    });

    it('should mark hasUnsavedChanges true when save fails', async () => {
      await service.loadStory('story-1');
      service.updateSceneContent('<p>Content</p>');

      storyServiceSpy.updateScene.and.returnValue(Promise.reject(new Error('Save failed')));

      try {
        await service.saveStory();
      } catch {
        // Expected to throw
      }

      // hasUnsavedChanges should be true after failure
      expect(service.getCurrentState().hasUnsavedChanges).toBe(true);
      expect(service.getCurrentState().isSaving).toBe(false);
    });
  });

  describe('recordUserActivity', () => {
    it('should update last activity time', () => {
      const beforeTime = Date.now();
      service.recordUserActivity();
      const afterTime = Date.now();

      const state = service.getCurrentState();
      expect(state.lastUserActivityTime).toBeGreaterThanOrEqual(beforeTime);
      expect(state.lastUserActivityTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('shouldAllowReload', () => {
    it('should return false if there are unsaved changes', async () => {
      await service.loadStory('story-1');
      service.updateSceneContent('<p>New content</p>');

      expect(service.shouldAllowReload(5000)).toBe(false);
    });

    it('should return false if user was recently active', async () => {
      await service.loadStory('story-1');
      service.recordUserActivity();

      expect(service.shouldAllowReload(5000)).toBe(false);
    });

    it('should return true if no changes and no recent activity', async () => {
      await service.loadStory('story-1');

      // Wait a bit to simulate inactivity
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(service.shouldAllowReload(50)).toBe(true);
    });
  });

  describe('state$ observable', () => {
    it('should emit state changes', (done) => {
      let emissionCount = 0;

      service.state$.subscribe(state => {
        emissionCount++;

        if (emissionCount === 3) {
          // Third emission after content update (1: initial, 2: loadStory, 3: updateSceneContent)
          expect(state.hasUnsavedChanges).toBe(true);
          done();
        }
      });

      service.loadStory('story-1').then(() => {
        service.updateSceneContent('<p>New content</p>');
      });
    });
  });
});
