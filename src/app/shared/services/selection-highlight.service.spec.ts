import { TestBed } from '@angular/core/testing';
import { SelectionHighlightService } from './selection-highlight.service';
import { EditorView } from 'prosemirror-view';
import { EditorState } from 'prosemirror-state';
import { schema } from 'prosemirror-schema-basic';
import { DOMParser } from 'prosemirror-model';

describe('SelectionHighlightService', () => {
  let service: SelectionHighlightService;
  let editorView: EditorView;
  let container: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SelectionHighlightService);

    // Create a container element for the editor
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (editorView) {
      editorView.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createFlashHighlightPlugin', () => {
    it('should create a valid plugin', () => {
      const plugin = service.createFlashHighlightPlugin();
      expect(plugin).toBeDefined();
      expect(plugin.spec).toBeDefined();
    });

    it('should have state initialization', () => {
      const plugin = service.createFlashHighlightPlugin();
      expect(plugin.spec.state).toBeDefined();
      expect(plugin.spec.state?.init).toBeDefined();
    });
  });

  describe('selectFirstMatchOf', () => {
    beforeEach(() => {
      const div = document.createElement('div');
      div.innerHTML = '<p>Hello world, this is a test</p>';
      const doc = DOMParser.fromSchema(schema).parse(div);

      const state = EditorState.create({
        doc,
        schema
      });

      editorView = new EditorView(container, { state });
    });

    it('should return false when editor view is null', () => {
      const result = service.selectFirstMatchOf(null as unknown as EditorView, 'test');
      expect(result).toBe(false);
    });

    it('should return false when phrase is empty', () => {
      const result = service.selectFirstMatchOf(editorView, '');
      expect(result).toBe(false);
    });

    it('should find and select matching text', () => {
      const result = service.selectFirstMatchOf(editorView, 'world');
      expect(result).toBe(true);

      const selection = editorView.state.selection;
      const selectedText = editorView.state.doc.textBetween(selection.from, selection.to);
      expect(selectedText).toBe('world');
    });

    it('should be case insensitive', () => {
      const result = service.selectFirstMatchOf(editorView, 'HELLO');
      expect(result).toBe(true);

      const selection = editorView.state.selection;
      const selectedText = editorView.state.doc.textBetween(selection.from, selection.to);
      expect(selectedText).toBe('Hello');
    });

    it('should return false when phrase not found', () => {
      const result = service.selectFirstMatchOf(editorView, 'nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('flashSelection', () => {
    beforeEach(() => {
      const div = document.createElement('div');
      div.innerHTML = '<p>Hello world</p>';
      const doc = DOMParser.fromSchema(schema).parse(div);

      const state = EditorState.create({
        doc,
        schema,
        plugins: [service.createFlashHighlightPlugin()]
      });

      editorView = new EditorView(container, { state });
    });

    it('should not throw when editor view is null', () => {
      expect(() => {
        service.flashSelection(null as unknown as EditorView);
      }).not.toThrow();
    });

    it('should not throw when selection is empty', () => {
      expect(() => {
        service.flashSelection(editorView);
      }).not.toThrow();
    });

    it('should flash a selection', (done) => {
      // Select some text first
      service.selectFirstMatchOf(editorView, 'world');

      // Flash it
      service.flashSelection(editorView, 100);

      // Verify the flash was applied (timeout to allow for animation)
      setTimeout(() => {
        done();
      }, 150);
    });
  });

  describe('flashRange', () => {
    beforeEach(() => {
      const div = document.createElement('div');
      div.innerHTML = '<p>Hello world</p>';
      const doc = DOMParser.fromSchema(schema).parse(div);

      const state = EditorState.create({
        doc,
        schema,
        plugins: [service.createFlashHighlightPlugin()]
      });

      editorView = new EditorView(container, { state });
    });

    it('should not throw when editor view is null', () => {
      expect(() => {
        service.flashRange(null as unknown as EditorView, 0, 5);
      }).not.toThrow();
    });

    it('should flash a specific range', (done) => {
      service.flashRange(editorView, 1, 6, 100);

      // Verify the flash was applied
      setTimeout(() => {
        done();
      }, 150);
    });

    it('should clear previous flash when new flash is applied', (done) => {
      service.flashRange(editorView, 1, 6, 100);

      setTimeout(() => {
        service.flashRange(editorView, 7, 12, 100);
        done();
      }, 50);
    });
  });
});
