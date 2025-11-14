import { TestBed } from '@angular/core/testing';
import { DebugUtilityService } from './debug-utility.service';
import { EditorView } from 'prosemirror-view';
import { EditorState } from 'prosemirror-state';
import { schema } from 'prosemirror-schema-basic';

describe('DebugUtilityService', () => {
  let service: DebugUtilityService;
  let editorView: EditorView;
  let container: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DebugUtilityService);

    container = document.createElement('div');
    document.body.appendChild(container);

    const state = EditorState.create({ schema });
    editorView = new EditorView(container, { state });
  });

  afterEach(() => {
    if (editorView) {
      editorView.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    // Clean up any debug styles
    const debugStyles = document.getElementById('pm-debug-styles');
    if (debugStyles) {
      debugStyles.remove();
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('toggleDebugMode', () => {
    it('should handle null editor view gracefully', () => {
      expect(() => {
        service.toggleDebugMode(null, true);
      }).not.toThrow();
    });

    it('should add pm-debug-mode class when enabled', () => {
      service.toggleDebugMode(editorView, true);
      expect(container.classList.contains('pm-debug-mode')).toBe(true);
    });

    it('should remove pm-debug-mode class when disabled', () => {
      service.toggleDebugMode(editorView, true);
      service.toggleDebugMode(editorView, false);
      expect(container.classList.contains('pm-debug-mode')).toBe(false);
    });

    it('should inject debug styles when enabled', () => {
      service.toggleDebugMode(editorView, true);
      const styles = document.getElementById('pm-debug-styles');
      expect(styles).toBeTruthy();
    });

    it('should not inject debug styles multiple times', () => {
      service.toggleDebugMode(editorView, true);
      service.toggleDebugMode(editorView, false);
      service.toggleDebugMode(editorView, true);

      const styles = document.querySelectorAll('#pm-debug-styles');
      expect(styles.length).toBe(1);
    });
  });

  describe('isDebugMode', () => {
    it('should return false initially', () => {
      expect(service.isDebugMode()).toBe(false);
    });

    it('should return true when debug mode is enabled', () => {
      service.toggleDebugMode(editorView, true);
      expect(service.isDebugMode()).toBe(true);
    });

    it('should return false when debug mode is disabled', () => {
      service.toggleDebugMode(editorView, true);
      service.toggleDebugMode(editorView, false);
      expect(service.isDebugMode()).toBe(false);
    });
  });
});
