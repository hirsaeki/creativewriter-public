import { Injectable } from '@angular/core';
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view';
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';

@Injectable({
  providedIn: 'root'
})
export class SelectionHighlightService {
  private flashHighlightKey = new PluginKey<DecorationSet>('flashHighlight');
  private flashTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Clear any pending flash timeout. Useful for cleanup in tests or when destroying views.
   */
  clearPendingFlash(): void {
    if (this.flashTimeoutId) {
      clearTimeout(this.flashTimeoutId);
      this.flashTimeoutId = null;
    }
  }

  /**
   * Create the flash highlight plugin
   */
  createFlashHighlightPlugin(): Plugin {
    const key = this.flashHighlightKey;
    return new Plugin({
      key,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, oldDecos: DecorationSet) => {
          let decos = oldDecos.map(tr.mapping, tr.doc);
          const meta = tr.getMeta(key);
          if (meta?.clear) {
            return DecorationSet.empty;
          }
          if (meta?.add && typeof meta.from === 'number' && typeof meta.to === 'number') {
            // Replace existing with a single new decoration
            const deco = Decoration.inline(meta.from, meta.to, { class: 'pm-flash-highlight' });
            decos = DecorationSet.empty.add(tr.doc, [deco]);
          }
          return decos;
        }
      },
      props: {
        decorations(state) {
          return key.getState(state);
        }
      }
    });
  }

  /**
   * Selects the first occurrence of the given phrase in the editor and scrolls it into view.
   * Returns true if a match was found and selection applied.
   */
  selectFirstMatchOf(editorView: EditorView, phrase: string): boolean {
    if (!editorView || !phrase) return false;

    const state = editorView.state;
    const lower = phrase.toLowerCase();
    let foundPos: { from: number; to: number } | null = null;

    state.doc.descendants((node, pos) => {
      if (foundPos) return false; // stop traversal
      if (node.isText && node.text) {
        const idx = node.text.toLowerCase().indexOf(lower);
        if (idx >= 0) {
          const from = pos + idx;
          const to = from + phrase.length;
          foundPos = { from, to };
          return false; // stop
        }
      }
      return true;
    });

    if (foundPos !== null) {
      const { from, to } = foundPos;
      const tr = state.tr.setSelection(TextSelection.create(state.doc, from, to)).scrollIntoView();
      editorView.dispatch(tr);
      editorView.focus();
      return true;
    }
    return false;
  }

  /**
   * Adds a temporary flash highlight decoration to the current selection.
   */
  flashSelection(editorView: EditorView, durationMs = 1600): void {
    if (!editorView) return;
    const { state } = editorView;
    const sel = state.selection as TextSelection;
    if (!sel || sel.empty) return;
    this.flashRange(editorView, sel.from, sel.to, durationMs);
  }

  /**
   * Adds a temporary flash highlight decoration to the specified range.
   */
  flashRange(editorView: EditorView, from: number, to: number, durationMs = 1600): void {
    if (!editorView) return;
    try {
      // Clear any pending timeout
      if (this.flashTimeoutId) {
        clearTimeout(this.flashTimeoutId);
        this.flashTimeoutId = null;
      }

      // Clear previous highlights and add new one
      let tr = editorView.state.tr.setMeta(this.flashHighlightKey, { clear: true });
      editorView.dispatch(tr);
      tr = editorView.state.tr.setMeta(this.flashHighlightKey, { add: true, from, to });
      editorView.dispatch(tr);

      // Auto-clear after duration
      this.flashTimeoutId = setTimeout(() => {
        // Check if editorView is still valid (not destroyed)
        if (!editorView || !editorView.dom || !editorView.dom.parentNode) return;
        try {
          const clearTr = editorView.state.tr.setMeta(this.flashHighlightKey, { clear: true });
          editorView.dispatch(clearTr);
        } catch {
          // View may have been destroyed, ignore
        }
      }, Math.max(300, durationMs));
    } catch (err) {
      console.warn('Failed to flash highlight:', err);
    }
  }
}
