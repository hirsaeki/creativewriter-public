import { TestBed } from '@angular/core/testing';
import { EditorStateService } from './editor-state.service';
import { EditorView } from 'prosemirror-view';
import { EditorState } from 'prosemirror-state';
import { schema } from 'prosemirror-schema-basic';
import { BeatAINodeView } from './beat-ai-nodeview';

describe('EditorStateService', () => {
  let service: EditorStateService;
  let mockBeatNodeView: jasmine.SpyObj<BeatAINodeView>;
  let editorView: EditorView;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EditorStateService);

    // Create mock beat node view
    mockBeatNodeView = jasmine.createSpyObj('BeatAINodeView', ['update', 'destroy'], {
      componentRef: {
        instance: {
          storyId: '',
          chapterId: '',
          sceneId: ''
        },
        changeDetectorRef: {
          markForCheck: jasmine.createSpy('markForCheck'),
          detectChanges: jasmine.createSpy('detectChanges')
        }
      },
      storyContext: {}
    });

    // Create editor view for testing
    const container = document.createElement('div');
    const state = EditorState.create({ schema });
    editorView = new EditorView(container, { state });
  });

  afterEach(() => {
    if (editorView) {
      editorView.destroy();
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('registerBeatNodeView', () => {
    it('should register a beat node view', () => {
      service.registerBeatNodeView(mockBeatNodeView);
      const views = service.getBeatNodeViews();
      expect(views.has(mockBeatNodeView)).toBe(true);
    });

    it('should handle registering multiple node views', () => {
      const mockView2 = jasmine.createSpyObj('BeatAINodeView', ['update', 'destroy']);
      service.registerBeatNodeView(mockBeatNodeView);
      service.registerBeatNodeView(mockView2);

      const views = service.getBeatNodeViews();
      expect(views.size).toBe(2);
    });
  });

  describe('unregisterBeatNodeView', () => {
    it('should unregister a beat node view', () => {
      service.registerBeatNodeView(mockBeatNodeView);
      service.unregisterBeatNodeView(mockBeatNodeView);

      const views = service.getBeatNodeViews();
      expect(views.has(mockBeatNodeView)).toBe(false);
    });

    it('should handle unregistering a view that was not registered', () => {
      expect(() => {
        service.unregisterBeatNodeView(mockBeatNodeView);
      }).not.toThrow();
    });
  });

  describe('getBeatNodeViews', () => {
    it('should return an empty set initially', () => {
      const views = service.getBeatNodeViews();
      expect(views.size).toBe(0);
    });

    it('should return all registered views', () => {
      service.registerBeatNodeView(mockBeatNodeView);
      const views = service.getBeatNodeViews();
      expect(views.size).toBe(1);
    });
  });

  describe('clearBeatNodeViews', () => {
    it('should clear all registered views', () => {
      service.registerBeatNodeView(mockBeatNodeView);
      service.clearBeatNodeViews();

      const views = service.getBeatNodeViews();
      expect(views.size).toBe(0);
    });
  });

  describe('updateStoryContext', () => {
    it('should update story context for all registered views', () => {
      service.registerBeatNodeView(mockBeatNodeView);

      const newContext = {
        storyId: 'story-123',
        chapterId: 'chapter-456',
        sceneId: 'scene-789'
      };

      service.updateStoryContext(newContext);

      expect(mockBeatNodeView.componentRef.instance.storyId).toBe('story-123');
      expect(mockBeatNodeView.componentRef.instance.chapterId).toBe('chapter-456');
      expect(mockBeatNodeView.componentRef.instance.sceneId).toBe('scene-789');
    });

    it('should trigger change detection', () => {
      service.registerBeatNodeView(mockBeatNodeView);

      service.updateStoryContext({ storyId: 'test' });

      expect(mockBeatNodeView.componentRef.changeDetectorRef?.markForCheck).toHaveBeenCalled();
      expect(mockBeatNodeView.componentRef.changeDetectorRef?.detectChanges).toHaveBeenCalled();
    });
  });

  describe('storeCodexSubscription', () => {
    it('should store a subscription for an editor view', () => {
      const mockSubscription = { unsubscribe: jasmine.createSpy('unsubscribe') };
      service.storeCodexSubscription(editorView, mockSubscription);

      // Verify by cleaning up - should call unsubscribe
      service.cleanupEditorView(editorView);
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('cleanupEditorView', () => {
    it('should handle null editor view gracefully', () => {
      expect(() => {
        service.cleanupEditorView(null);
      }).not.toThrow();
    });

    it('should unsubscribe stored subscriptions', () => {
      const mockSubscription = { unsubscribe: jasmine.createSpy('unsubscribe') };
      service.storeCodexSubscription(editorView, mockSubscription);
      service.cleanupEditorView(editorView);

      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });

    it('should handle editor view with no subscriptions', () => {
      expect(() => {
        service.cleanupEditorView(editorView);
      }).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clear all beat node views', () => {
      service.registerBeatNodeView(mockBeatNodeView);
      service.destroy();

      const views = service.getBeatNodeViews();
      expect(views.size).toBe(0);
    });

    it('should unsubscribe all stored subscriptions', () => {
      const mockSubscription = { unsubscribe: jasmine.createSpy('unsubscribe') };
      service.storeCodexSubscription(editorView, mockSubscription);
      service.destroy();

      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });
  });
});
