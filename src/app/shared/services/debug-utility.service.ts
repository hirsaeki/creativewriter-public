import { Injectable } from '@angular/core';
import { EditorView } from 'prosemirror-view';

@Injectable({
  providedIn: 'root'
})
export class DebugUtilityService {
  private debugMode = false;

  /**
   * Toggle debug mode on/off for an editor view
   */
  toggleDebugMode(editorView: EditorView | null, enabled: boolean): void {
    if (!editorView) return;

    this.debugMode = enabled;

    if (enabled) {
      // Add debug class to the parent element that contains .ProseMirror
      const editorContainer = editorView.dom.parentElement;
      if (editorContainer) {
        editorContainer.classList.add('pm-debug-mode');
      }

      // Add styles if not already present
      if (!document.getElementById('pm-debug-styles')) {
        const style = document.createElement('style');
        style.id = 'pm-debug-styles';
        style.textContent = `
          .pm-debug-mode .ProseMirror {
            position: relative;
            background: rgba(255, 255, 255, 0.02);
          }
          .pm-debug-mode .ProseMirror > * {
            position: relative;
            border: 1px dashed rgba(255, 255, 255, 0.3) !important;
            margin: 2px !important;
          }
          .pm-debug-mode .ProseMirror > p::before {
            content: "paragraph";
            position: absolute;
            top: -18px;
            left: 0;
            font-size: 10px;
            color: #ffa500;
            background: rgba(0, 0, 0, 0.9);
            padding: 2px 4px;
            border-radius: 2px;
            z-index: 1000;
            pointer-events: none;
          }
          .pm-debug-mode .ProseMirror > h1::before,
          .pm-debug-mode .ProseMirror > h2::before,
          .pm-debug-mode .ProseMirror > h3::before,
          .pm-debug-mode .ProseMirror > h4::before,
          .pm-debug-mode .ProseMirror > h5::before,
          .pm-debug-mode .ProseMirror > h6::before {
            content: "heading";
            position: absolute;
            top: -18px;
            left: 0;
            font-size: 10px;
            color: #ffa500;
            background: rgba(0, 0, 0, 0.9);
            padding: 2px 4px;
            border-radius: 2px;
            z-index: 1000;
            pointer-events: none;
          }
          .pm-debug-mode .ProseMirror > div.beat-ai-node::before {
            content: "beatAI";
            position: absolute;
            top: -18px;
            left: 0;
            font-size: 10px;
            color: #ffa500;
            background: rgba(0, 0, 0, 0.9);
            padding: 2px 4px;
            border-radius: 2px;
            z-index: 1000;
            pointer-events: none;
          }
          .pm-debug-mode .ProseMirror > ul::before,
          .pm-debug-mode .ProseMirror > ol::before {
            content: "list";
            position: absolute;
            top: -18px;
            left: 0;
            font-size: 10px;
            color: #ffa500;
            background: rgba(0, 0, 0, 0.9);
            padding: 2px 4px;
            border-radius: 2px;
            z-index: 1000;
            pointer-events: none;
          }
          .pm-debug-mode .ProseMirror > blockquote::before {
            content: "blockquote";
            position: absolute;
            top: -18px;
            left: 0;
            font-size: 10px;
            color: #ffa500;
            background: rgba(0, 0, 0, 0.9);
            padding: 2px 4px;
            border-radius: 2px;
            z-index: 1000;
            pointer-events: none;
          }
          .pm-debug-mode .ProseMirror > img::before {
            content: "image";
            position: absolute;
            top: -18px;
            left: 0;
            font-size: 10px;
            color: #ffa500;
            background: rgba(0, 0, 0, 0.9);
            padding: 2px 4px;
            border-radius: 2px;
            z-index: 1000;
            pointer-events: none;
          }
          .pm-debug-mode .ProseMirror > div.beat-end-marker {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            background: rgba(255, 0, 128, 0.2);
            border: 2px dashed #ff0080 !important;
            padding: 4px 8px;
            margin: 4px 0 !important;
            position: relative;
          }
          .pm-debug-mode .ProseMirror > div.beat-end-marker::before {
            content: "beatEndMarker [" attr(data-beat-id) "]";
            position: absolute;
            top: -18px;
            left: 0;
            font-size: 10px;
            color: #ff0080;
            background: rgba(0, 0, 0, 0.9);
            padding: 2px 4px;
            border-radius: 2px;
            z-index: 1000;
            pointer-events: none;
          }
          .pm-debug-mode .ProseMirror > div.beat-end-marker::after {
            content: "⬆ generated content above | pre-existing text below ⬇";
            font-size: 10px;
            color: #ff0080;
            font-style: italic;
          }
          /* Inline elements */
          .pm-debug-mode .ProseMirror strong {
            border: 1px dotted rgba(255, 165, 0, 0.5) !important;
            padding: 0 2px;
          }
          .pm-debug-mode .ProseMirror em {
            border: 1px dotted rgba(255, 165, 0, 0.5) !important;
            padding: 0 2px;
          }
          .pm-debug-mode .ProseMirror code {
            border: 1px dotted rgba(255, 165, 0, 0.5) !important;
          }
        `;
        document.head.appendChild(style);
      }
    } else {
      // Remove debug mode
      const editorContainer = editorView.dom.parentElement;
      if (editorContainer) {
        editorContainer.classList.remove('pm-debug-mode');
      }
    }
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugMode(): boolean {
    return this.debugMode;
  }
}
