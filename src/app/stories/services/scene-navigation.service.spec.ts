import { TestBed } from '@angular/core/testing';
import { SceneNavigationService } from './scene-navigation.service';
import { Story } from '../models/story.interface';

describe('SceneNavigationService', () => {
  let service: SceneNavigationService;

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
            id: 'scene-1-1',
            title: 'Scene One',
            content: 'Content 1',
            order: 1,
            sceneNumber: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'scene-1-2',
            title: 'Scene Two',
            content: 'Content 2',
            order: 2,
            sceneNumber: 2,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      },
      {
        id: 'chapter-2',
        title: 'Chapter Two',
        order: 2,
        chapterNumber: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        scenes: [
          {
            id: 'scene-2-1',
            title: 'Scene Three',
            content: 'Content 3',
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
    TestBed.configureTestingModule({});
    service = TestBed.inject(SceneNavigationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('setStory', () => {
    it('should set the story and update navigation state', (done) => {
      service.navigationState$.subscribe(state => {
        if (state.totalScenes > 0) {
          expect(state.totalScenes).toBe(3);
          done();
        }
      });

      service.setStory(mockStory);
    });
  });

  describe('getTotalScenes', () => {
    it('should return 0 when no story is set', () => {
      expect(service.getTotalScenes()).toBe(0);
    });

    it('should return correct total number of scenes', () => {
      service.setStory(mockStory);
      expect(service.getTotalScenes()).toBe(3);
    });
  });

  describe('getCurrentSceneIndex', () => {
    it('should return 0 when no scene is active', () => {
      service.setStory(mockStory);
      expect(service.getCurrentSceneIndex()).toBe(0);
    });

    it('should return correct index for first scene', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-1');
      expect(service.getCurrentSceneIndex()).toBe(1);
    });

    it('should return correct index for scene in second chapter', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-2', 'scene-2-1');
      expect(service.getCurrentSceneIndex()).toBe(3);
    });
  });

  describe('getPreviousScene', () => {
    it('should return null when on first scene', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-1');
      expect(service.getPreviousScene()).toBeNull();
    });

    it('should return previous scene in same chapter', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-2');
      const prev = service.getPreviousScene();
      expect(prev).not.toBeNull();
      expect(prev?.sceneId).toBe('scene-1-1');
      expect(prev?.chapterId).toBe('chapter-1');
    });

    it('should return previous scene from previous chapter', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-2', 'scene-2-1');
      const prev = service.getPreviousScene();
      expect(prev).not.toBeNull();
      expect(prev?.sceneId).toBe('scene-1-2');
      expect(prev?.chapterId).toBe('chapter-1');
    });
  });

  describe('getNextScene', () => {
    it('should return null when on last scene', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-2', 'scene-2-1');
      expect(service.getNextScene()).toBeNull();
    });

    it('should return next scene in same chapter', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-1');
      const next = service.getNextScene();
      expect(next).not.toBeNull();
      expect(next?.sceneId).toBe('scene-1-2');
      expect(next?.chapterId).toBe('chapter-1');
    });

    it('should return next scene from next chapter', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-2');
      const next = service.getNextScene();
      expect(next).not.toBeNull();
      expect(next?.sceneId).toBe('scene-2-1');
      expect(next?.chapterId).toBe('chapter-2');
    });
  });

  describe('hasPreviousScene', () => {
    it('should return false when on first scene', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-1');
      expect(service.hasPreviousScene()).toBe(false);
    });

    it('should return true when not on first scene', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-2');
      expect(service.hasPreviousScene()).toBe(true);
    });
  });

  describe('hasNextScene', () => {
    it('should return false when on last scene', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-2', 'scene-2-1');
      expect(service.hasNextScene()).toBe(false);
    });

    it('should return true when not on last scene', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-1');
      expect(service.hasNextScene()).toBe(true);
    });
  });

  describe('getSceneIdDisplay', () => {
    it('should return empty string when no story is set', () => {
      expect(service.getSceneIdDisplay()).toBe('');
    });

    it('should return correct format for active scene', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-2');
      expect(service.getSceneIdDisplay()).toBe('C1S2');
    });

    it('should return correct format for specified scene', () => {
      service.setStory(mockStory);
      expect(service.getSceneIdDisplay('chapter-2', 'scene-2-1')).toBe('C2S1');
    });
  });

  describe('getChapterTitle', () => {
    it('should return empty string when no story is set', () => {
      expect(service.getChapterTitle()).toBe('');
    });

    it('should return correct format for active chapter', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-1');
      expect(service.getChapterTitle()).toBe('C1:Chapter One');
    });

    it('should return correct format for specified chapter', () => {
      service.setStory(mockStory);
      expect(service.getChapterTitle('chapter-2')).toBe('C2:Chapter Two');
    });
  });

  describe('getSceneTitle', () => {
    it('should return empty string when no story is set', () => {
      expect(service.getSceneTitle()).toBe('');
    });

    it('should return correct format for active scene', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-2');
      expect(service.getSceneTitle()).toBe('C1S2:Scene Two');
    });

    it('should return correct format for specified scene', () => {
      service.setStory(mockStory);
      expect(service.getSceneTitle('chapter-2', 'scene-2-1')).toBe('C2S1:Scene Three');
    });
  });

  describe('getCurrentLocation', () => {
    it('should return null when no scene is active', () => {
      service.setStory(mockStory);
      expect(service.getCurrentLocation()).toBeNull();
    });

    it('should return correct location details', () => {
      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-2');
      const location = service.getCurrentLocation();

      expect(location).not.toBeNull();
      expect(location?.chapterId).toBe('chapter-1');
      expect(location?.sceneId).toBe('scene-1-2');
      expect(location?.chapterNumber).toBe(1);
      expect(location?.sceneNumber).toBe(2);
      expect(location?.chapterTitle).toBe('Chapter One');
      expect(location?.sceneTitle).toBe('Scene Two');
    });
  });

  describe('navigationState$ observable', () => {
    it('should emit updated state when scene changes', (done) => {
      let emissionCount = 0;

      service.navigationState$.subscribe(state => {
        emissionCount++;

        if (emissionCount === 2) {
          // Second emission after setActiveScene
          expect(state.currentIndex).toBe(2);
          expect(state.hasPrevious).toBe(true);
          expect(state.hasNext).toBe(true);
          done();
        }
      });

      service.setStory(mockStory);
      service.setActiveScene('chapter-1', 'scene-1-2');
    });
  });
});
