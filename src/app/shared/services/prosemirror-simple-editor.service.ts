import { Injectable, inject } from '@angular/core';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { splitBlock } from 'prosemirror-commands';
import { ProseMirrorSchemaService } from './prosemirror-schema.service';
import { ProseMirrorPluginsService } from './prosemirror-plugins.service';

export interface SimpleEditorConfig {
  placeholder?: string;
  onUpdate?: (content: string) => void;
  storyContext?: {
    storyId?: string;
    chapterId?: string;
    sceneId?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProseMirrorSimpleEditorService {
  private schemaService = inject(ProseMirrorSchemaService);
  private pluginsService = inject(ProseMirrorPluginsService);
  
  private simpleEditorView: EditorView | null = null;

  createSimpleTextEditor(element: HTMLElement, config: SimpleEditorConfig = {}): EditorView {
    const simpleSchema = this.schemaService.simpleSchema;
    
    const initialDoc = simpleSchema.nodes['doc'].create({}, [
      simpleSchema.nodes['paragraph'].create({}, [])
    ]);
    
    const plugins = [
      ...this.pluginsService.createSimpleEditorPlugins({
        placeholder: config.placeholder,
        storyContext: config.storyContext
      }),
      keymap({
        'Enter': splitBlock,
        'Shift-Enter': (state, dispatch) => {
          if (dispatch) {
            const hardBreak = simpleSchema.nodes['hard_break'].create();
            const tr = state.tr.replaceSelectionWith(hardBreak);
            dispatch(tr.scrollIntoView());
          }
          return true;
        }
      })
    ];
    
    const state = EditorState.create({
      doc: initialDoc,
      schema: simpleSchema,
      plugins
    });

    this.simpleEditorView = new EditorView(element, {
      state,
      dispatchTransaction: (transaction) => {
        const newState = this.simpleEditorView!.state.apply(transaction);
        this.simpleEditorView!.updateState(newState);
        
        if (config.onUpdate) {
          const content = this.getSimpleTextContent();
          config.onUpdate(content);
        }
      },
      attributes: {
        class: 'prosemirror-editor simple-text-editor',
        spellcheck: 'false'
      },
      handleDOMEvents: {
        mousedown: (view: EditorView, event: MouseEvent) => {
          event.stopPropagation();
          return false;
        },
        touchstart: (view: EditorView, event: TouchEvent) => {
          event.stopPropagation();
          return false;
        },
        focus: (view: EditorView, event: FocusEvent) => {
          event.stopPropagation();
          return false;
        }
      }
    });

    if (config.placeholder) {
      this.setPlaceholder(config.placeholder);
    }

    return this.simpleEditorView;
  }

  getSimpleTextContent(): string {
    if (!this.simpleEditorView) return '';
    
    const doc = this.simpleEditorView.state.doc;
    let content = '';
    
    doc.content.forEach((node) => {
      if (node.type.name === 'paragraph') {
        const text = node.textContent;
        if (text) {
          content += text + '\n';
        }
      }
    });
    
    return content.replace(/\n$/, '');
  }

  setSimpleContent(content: string): void {
    if (this.simpleEditorView) {
      const tr = this.simpleEditorView.state.tr.replaceWith(
        0,
        this.simpleEditorView.state.doc.content.size,
        this.simpleEditorView.state.schema.text(content)
      );
      
      this.simpleEditorView.dispatch(tr);
    }
  }

  destroySimpleEditor(): void {
    if (this.simpleEditorView) {
      this.simpleEditorView.destroy();
      this.simpleEditorView = null;
    }
  }

  private setPlaceholder(placeholder: string): void {
    if (this.simpleEditorView) {
      const element = this.simpleEditorView.dom as HTMLElement;
      element.setAttribute('data-placeholder', placeholder);
    }
  }

  getSimpleEditorView(): EditorView | null {
    return this.simpleEditorView;
  }
}