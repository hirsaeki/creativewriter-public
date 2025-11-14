import { Injectable } from '@angular/core';
import { EditorView } from 'prosemirror-view';
import { EditorState, Plugin } from 'prosemirror-state';
import { Schema, DOMParser, DOMSerializer, Node as ProseMirrorNode, Fragment } from 'prosemirror-model';
import { history, undo, redo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, splitBlock, deleteSelection, joinForward, selectNodeForward } from 'prosemirror-commands';

@Injectable({
  providedIn: 'root'
})
export class ProseMirrorContentService {

  /**
   * Get HTML content from editor
   */
  getHTMLContent(editorView: EditorView | null, schema: Schema): string {
    if (!editorView) return '';

    try {
      const fragment = DOMSerializer.fromSchema(schema)
        .serializeFragment(editorView.state.doc.content);

      const div = document.createElement('div');
      div.appendChild(fragment);

      return div.innerHTML;
    } catch (error) {
      console.warn('Failed to serialize content, returning text content:', error);
      return this.getTextContent(editorView);
    }
  }

  /**
   * Get plain text content from editor
   */
  getTextContent(editorView: EditorView | null): string {
    if (!editorView) return '';
    return editorView.state.doc.textContent;
  }

  /**
   * Set HTML content in editor
   */
  setContent(editorView: EditorView | null, schema: Schema, content: string): void {
    if (!editorView) return;

    try {
      const div = document.createElement('div');

      // For initial content, convert to HTML
      if (content && !content.includes('<') && !content.includes('>')) {
        // Plain text - convert to paragraphs
        const paragraphs = content
          .split(/\n\n+/) // Split on double newlines
          .filter(para => para.length > 0)
          .map(para => `<p>${para}</p>`)
          .join('');
        div.innerHTML = paragraphs || '<p></p>';
      } else {
        div.innerHTML = content || '<p></p>';
      }

      const doc = DOMParser.fromSchema(schema).parse(div);
      const state = EditorState.create({
        doc,
        schema: schema,
        plugins: editorView.state.plugins
      });

      editorView.updateState(state);
    } catch (error) {
      console.warn('Failed to parse content, setting empty state:', error);
      this.setEmptyState(editorView, schema, editorView.state.plugins);
    }
  }

  /**
   * Insert content at a specific position
   */
  insertContent(
    editorView: EditorView | null,
    schema: Schema,
    content: string,
    position?: number,
    replaceSlash = false
  ): void {
    if (!editorView) return;

    const { state } = editorView;
    const pos = position ?? state.selection.from;

    try {
      const div = document.createElement('div');
      div.innerHTML = content;
      const fragment = DOMParser.fromSchema(schema).parseSlice(div);

      let tr;
      if (replaceSlash) {
        // Replace the slash with the content
        const slashPos = pos - 1;
        tr = state.tr.replaceRange(slashPos, pos, fragment);
      } else {
        // Insert at position
        tr = state.tr.replaceRange(pos, pos, fragment);
      }

      editorView.dispatch(tr);
    } catch (error) {
      console.warn('Failed to insert content:', error);
    }
  }

  /**
   * Remove slash character at a position
   */
  removeSlashAtPosition(editorView: EditorView | null, position: number): void {
    if (!editorView) return;

    try {
      const { state } = editorView;
      // Remove the slash character at the given position
      const slashPos = position - 1; // Position of the slash character

      if (slashPos >= 0 && slashPos < state.doc.content.size) {
        const tr = state.tr.delete(slashPos, position);
        editorView.dispatch(tr);
      }
    } catch (error) {
      console.error('Failed to remove slash:', error);
    }
  }

  /**
   * Get simple text content from a simple editor (preserves line breaks)
   */
  getSimpleTextContent(editorView: EditorView): string {
    if (!editorView) return '';

    const doc = editorView.state.doc;
    const paragraphTexts: string[] = [];

    // Process each paragraph separately to preserve structure
    doc.forEach((node) => {
      if (node.type.name === 'paragraph') {
        let paragraphText = '';
        node.descendants((childNode) => {
          if (childNode.isText) {
            paragraphText += childNode.text;
          } else if (childNode.type.name === 'hard_break') {
            paragraphText += '\n';
          }
        });
        paragraphTexts.push(paragraphText);
      }
    });

    // Join paragraphs with double newlines
    return paragraphTexts.join('\n\n').trim();
  }

  /**
   * Set simple text content in a simple editor (preserves line breaks)
   */
  setSimpleContent(editorView: EditorView, content: string): void {
    if (!editorView) return;

    const state = editorView.state;
    const schema = state.schema;

    // Parse content to preserve line breaks
    // Split by double newlines for paragraphs, single newlines become hard breaks
    const paragraphs = content.split('\n\n').filter(p => p.length > 0);

    if (paragraphs.length === 0) {
      // Empty content - create single empty paragraph
      const emptyParagraph = schema.nodes['paragraph'].create({}, []);
      const tr = state.tr.replaceWith(0, state.doc.content.size, emptyParagraph);
      editorView.dispatch(tr);
      return;
    }

    // Create paragraph nodes with hard breaks for single line breaks
    const paragraphNodes = paragraphs.map(paragraphText => {
      const lines = paragraphText.split('\n');
      const content: (ProseMirrorNode | null)[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) {
          content.push(schema.text(lines[i]));
        }
        // Add hard break between lines (but not after the last line)
        if (i < lines.length - 1) {
          content.push(schema.nodes['hard_break'].create());
        }
      }

      return schema.nodes['paragraph'].create({}, content.filter((n): n is ProseMirrorNode => n !== null));
    });

    // Create a fragment from all paragraphs
    const fragment = Fragment.from(paragraphNodes);

    // Replace the entire document content
    const tr = state.tr.replaceWith(0, state.doc.content.size, fragment);
    editorView.dispatch(tr);
  }

  /**
   * Set empty state for the editor
   */
  private setEmptyState(editorView: EditorView, schema: Schema, plugins: readonly Plugin[]): void {
    if (!editorView) return;

    const state = EditorState.create({
      schema: schema,
      plugins: plugins
    });

    editorView.updateState(state);
  }

  /**
   * Create simple editor plugins (used for simple text editors)
   */
  createSimpleEditorPlugins(schema: Schema, placeholder: string): Plugin[] {
    return [
      history(),
      keymap({
        'Mod-z': undo,
        'Mod-y': redo,
        'Mod-Shift-z': redo,
        'Enter': splitBlock,
        'Shift-Enter': (state, dispatch) => {
          // Create line break with Shift+Enter
          if (dispatch) {
            const hardBreak = schema.nodes['hard_break'].create();
            const tr = state.tr.replaceSelectionWith(hardBreak);
            dispatch(tr.scrollIntoView());
          }
          return true;
        },
        // Explicit Delete key binding for forward delete
        'Delete': (state, dispatch) => {
          // Try each command in sequence until one succeeds
          return deleteSelection(state, dispatch) ||
                 joinForward(state, dispatch) ||
                 selectNodeForward(state, dispatch);
        },
        'Mod-Delete': (state, dispatch) => {
          return deleteSelection(state, dispatch) ||
                 joinForward(state, dispatch) ||
                 selectNodeForward(state, dispatch);
        }
      }),
      keymap(baseKeymap),
      new Plugin({
        props: {
          attributes: {
            'data-placeholder': placeholder || 'Enter text...'
          }
        }
      })
    ];
  }
}
