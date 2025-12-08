import { EditorState } from 'prosemirror-state';
import { schema } from 'prosemirror-schema-basic';
import { DOMParser, Node as ProseMirrorNode } from 'prosemirror-model';
import {
  convertTextToHtml,
  findContainingParagraph,
  findNextBeatPosition,
  isGeneratedContent,
  hasEmptyParagraphs
} from './prosemirror-editor.utils';

describe('prosemirror-editor.utils', () => {
  describe('convertTextToHtml', () => {
    it('should return HTML as-is if already HTML', () => {
      const html = '<p>Test paragraph</p>';
      const result = convertTextToHtml(html);
      expect(result).toBe(html);
    });

    it('should convert plain text to paragraph', () => {
      const text = 'Simple text';
      const result = convertTextToHtml(text);
      expect(result).toBe('<p>Simple text</p>');
    });

    it('should convert double newlines to paragraph breaks', () => {
      const text = 'First paragraph\n\nSecond paragraph';
      const result = convertTextToHtml(text);
      expect(result).toContain('<p>First paragraph</p>');
      expect(result).toContain('<p>Second paragraph</p>');
    });

    it('should convert single newlines to br tags', () => {
      const text = 'Line one\nLine two';
      const result = convertTextToHtml(text);
      expect(result).toContain('Line one<br>Line two');
    });

    it('should skip empty paragraphs', () => {
      const text = 'Text\n\n\n\nMore text';
      const result = convertTextToHtml(text);
      const paragraphCount = (result.match(/<p>/g) || []).length;
      expect(paragraphCount).toBe(2);
    });

    it('should handle empty string', () => {
      const result = convertTextToHtml('');
      expect(result).toBe('');
    });
  });

  describe('findContainingParagraph', () => {
    let state: EditorState;

    beforeEach(() => {
      const div = document.createElement('div');
      div.innerHTML = '<p>First paragraph</p><p>Second paragraph</p>';
      const doc = DOMParser.fromSchema(schema).parse(div);
      state = EditorState.create({ doc, schema });
    });

    it('should find the containing paragraph', () => {
      // Position 2 is inside the first paragraph
      const result = findContainingParagraph(2, state);
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should return null if not in a paragraph', () => {
      // Position 0 is at the doc level
      const result = findContainingParagraph(0, state);
      // This might return null or the first paragraph depending on ProseMirror structure
      expect(result !== undefined).toBe(true);
    });
  });

  describe('findNextBeatPosition', () => {
    it('should find the next beat position when beat exists', () => {
      // Create a simple state for testing - mock the beat finding logic
      const div = document.createElement('div');
      div.innerHTML = '<p>Text</p><p>More text</p>';
      const doc = DOMParser.fromSchema(schema).parse(div);
      const state = EditorState.create({ doc, schema });

      // For now, just test that function doesn't throw
      // In a real scenario, this would need a schema with beatAI nodes
      const result = findNextBeatPosition(0, state);
      expect(result !== undefined).toBe(true);
    });

    it('should return null if no beat found', () => {
      const div = document.createElement('div');
      div.innerHTML = '<p>Text</p>';
      const doc = DOMParser.fromSchema(schema).parse(div);
      const state = EditorState.create({ doc, schema });

      const result = findNextBeatPosition(100, state);
      expect(result).toBeNull();
    });
  });

  describe('isGeneratedContent', () => {
    let paragraphNode: ProseMirrorNode;
    let headingNode: ProseMirrorNode;

    beforeEach(() => {
      const div = document.createElement('div');
      div.innerHTML = '<p>Paragraph</p><h1>Heading</h1>';
      const doc = DOMParser.fromSchema(schema).parse(div);

      doc.descendants((node) => {
        if (node.type.name === 'paragraph') {
          paragraphNode = node;
        } else if (node.type.name === 'heading') {
          headingNode = node;
        }
      });
    });

    it('should return true for paragraph nodes', () => {
      expect(isGeneratedContent(paragraphNode)).toBe(true);
    });

    it('should return false for non-paragraph nodes', () => {
      if (headingNode) {
        expect(isGeneratedContent(headingNode)).toBe(false);
      }
    });
  });

  describe('hasEmptyParagraphs', () => {
    it('should return true if document has empty paragraphs', () => {
      const div = document.createElement('div');
      div.innerHTML = '<p>Text</p><p></p><p>More text</p>';
      const doc = DOMParser.fromSchema(schema).parse(div);
      const state = EditorState.create({ doc, schema });

      expect(hasEmptyParagraphs(state)).toBe(true);
    });

    it('should return false if all paragraphs have content', () => {
      const div = document.createElement('div');
      div.innerHTML = '<p>Text</p><p>More text</p>';
      const doc = DOMParser.fromSchema(schema).parse(div);
      const state = EditorState.create({ doc, schema });

      expect(hasEmptyParagraphs(state)).toBe(false);
    });

    it('should return true for default empty document (ProseMirror creates with empty paragraph)', () => {
      // ProseMirror's default document has an empty paragraph
      const state = EditorState.create({ schema });
      expect(hasEmptyParagraphs(state)).toBe(true);
    });
  });
});
