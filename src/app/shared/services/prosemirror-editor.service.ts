import { Injectable, Injector, ApplicationRef, EnvironmentInjector, inject } from '@angular/core';
import { EditorState, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { DOMParser, DOMSerializer } from 'prosemirror-model';
import { keymap } from 'prosemirror-keymap';
import { chainCommands, newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock } from 'prosemirror-commands';
import { Subject } from 'rxjs';
import { ModalController } from '@ionic/angular/standalone';
import { BeatAINodeView } from './beat-ai-nodeview';
import { ResizableImageNodeView } from './resizable-image-nodeview';
import { BeatAI, BeatAIPromptEvent } from '../../stories/models/beat-ai.interface';
import { ImageInsertResult } from '../components/image-upload-dialog.component';
import { AIRewriteModalComponent, AIRewriteResult } from '../components/ai-rewrite-modal.component';
import { ProseMirrorSchemaService } from './prosemirror-schema.service';
import { ProseMirrorPluginsService } from './prosemirror-plugins.service';
import { ProseMirrorSimpleEditorService } from './prosemirror-simple-editor.service';
import type { SimpleEditorConfig } from './prosemirror-simple-editor.service';
import { ProseMirrorBeatIntegrationService } from './prosemirror-beat-integration.service';

export type { SimpleEditorConfig } from './prosemirror-simple-editor.service';

export interface EditorConfig {
  placeholder?: string;
  onUpdate?: (content: string) => void;
  onSlashCommand?: (position: number) => void;
  onBeatPromptSubmit?: (event: BeatAIPromptEvent) => void;
  onBeatContentUpdate?: (beatData: BeatAI) => void;
  onBeatFocus?: () => void;
  onImageInsertRequest?: (position: number) => void;
  storyContext?: {
    storyId?: string;
    chapterId?: string;
    sceneId?: string;
  };
  debugMode?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ProseMirrorEditorService {
  private injector = inject(Injector);
  private modalController = inject(ModalController);
  private appRef = inject(ApplicationRef);
  private envInjector = inject(EnvironmentInjector);
  private schemaService = inject(ProseMirrorSchemaService);
  private pluginsService = inject(ProseMirrorPluginsService);
  private simpleEditorService = inject(ProseMirrorSimpleEditorService);
  private beatIntegrationService = inject(ProseMirrorBeatIntegrationService);

  private editorView: EditorView | null = null;
  private currentStoryContext: {
    storyId?: string;
    chapterId?: string;
    sceneId?: string;
  } = {};
  private debugMode = false;
  
  public contentUpdate$ = new Subject<string>();
  public slashCommand$ = new Subject<number>();

  constructor() {
    // Constructor intentionally empty - initialization handled by injected services
  }

  createEditor(element: HTMLElement, config: EditorConfig = {}): EditorView {
    if (config.storyContext) {
      this.currentStoryContext = config.storyContext;
    }

    this.debugMode = config.debugMode || false;

    const plugins = [
      ...this.pluginsService.createBasePlugins(),
      keymap({
        'Enter': chainCommands(newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock)
      }),
      this.beatIntegrationService.createBeatAIPlugin(),
      this.pluginsService.createCodexHighlightingPlugin(config),
      this.createContextMenuPlugin()
    ];

    const state = EditorState.create({
      schema: this.schemaService.editorSchema,
      plugins
    });

    this.editorView = new EditorView(element, {
      state,
      nodeViews: {
        beatAI: (node, view, getPos) => {
          const nodeView = new BeatAINodeView(
            node,
            view,
            getPos as () => number | undefined,
            this.injector,
            this.appRef,
            this.envInjector,
            config.onBeatPromptSubmit || (() => { /* no-op */ }),
            config.onBeatContentUpdate || (() => { /* no-op */ }),
            config.onBeatFocus,
            this.currentStoryContext
          );
          
          this.beatIntegrationService.registerBeatNodeView(nodeView);
          return nodeView;
        },
        image: (node, view, getPos) => new ResizableImageNodeView(node, view, getPos as () => number)
      },
      dispatchTransaction: (transaction) => {
        const newState = this.editorView!.state.apply(transaction);
        this.editorView!.updateState(newState);
        
        if (config.onUpdate) {
          const content = this.getContent();
          config.onUpdate(content);
        }
        
        this.checkSlashCommand(newState, config.onSlashCommand);
      },
      attributes: {
        class: 'prosemirror-editor main-editor',
        spellcheck: 'false'
      }
    });

    if (this.debugMode) {
      setTimeout(() => this.toggleDebugMode(true), 100);
    }

    return this.editorView;
  }

  createSimpleTextEditor(element: HTMLElement, config: SimpleEditorConfig = {}): EditorView {
    return this.simpleEditorService.createSimpleTextEditor(element, config);
  }

  setContent(content: string): void {
    if (!this.editorView) return;
    
    try {
      const div = document.createElement('div');
      
      if (content && !content.includes('<') && !content.includes('>')) {
        const paragraphs = content
          .split(/\n\n+/)
          .filter(para => para.length > 0)
          .map(para => `<p>${para}</p>`)
          .join('');
        div.innerHTML = paragraphs || '<p></p>';
      } else {
        div.innerHTML = content || '<p></p>';
      }
      
      const doc = DOMParser.fromSchema(this.schemaService.editorSchema).parse(div);
      const state = EditorState.create({
        doc,
        schema: this.schemaService.editorSchema,
        plugins: this.editorView.state.plugins
      });
      
      this.editorView.updateState(state);
    } catch (error) {
      console.error('Failed to set content:', error);
    }
  }

  getContent(): string {
    if (!this.editorView) return '';
    
    try {
      const serializer = DOMSerializer.fromSchema(this.schemaService.editorSchema);
      const dom = serializer.serializeFragment(this.editorView.state.doc.content);
      
      const div = document.createElement('div');
      div.appendChild(dom);
      
      return div.innerHTML;
    } catch (error) {
      console.error('Failed to get content:', error);
      return '';
    }
  }

  setSimpleContent(content: string): void {
    this.simpleEditorService.setSimpleContent(content);
  }

  getSimpleTextContent(): string {
    return this.simpleEditorService.getSimpleTextContent();
  }

  insertBeatAI(position?: number, replaceSlash = false, beatType: 'story' | 'scene' = 'story'): void {
    if (!this.editorView) return;
    this.beatIntegrationService.insertBeatAI(this.editorView, this.schemaService.editorSchema, position, replaceSlash, beatType);
  }

  handleBeatPromptSubmit(event: BeatAIPromptEvent): void {
    if (!this.editorView) return;
    this.beatIntegrationService.handleBeatPromptSubmit(this.editorView, event);
  }

  registerBeatNodeView(nodeView: BeatAINodeView): void {
    this.beatIntegrationService.registerBeatNodeView(nodeView);
  }

  unregisterBeatNodeView(nodeView: BeatAINodeView): void {
    this.beatIntegrationService.unregisterBeatNodeView(nodeView);
  }

  insertImage(imageData: ImageInsertResult, position?: number, replaceSlash = false): void {
    if (!this.editorView) return;
    
    try {
      const { state } = this.editorView;
      const schema = this.editorView.state.schema;
      const pos = position ?? state.selection.from;
      
      const imageNode = schema.nodes['image'].create({
        src: imageData.url || '',
        alt: imageData.alt || '',
        title: imageData.title || null,
        imageId: imageData.imageId || null,
        width: null,
        height: null
      });
      
      let tr;
      if (replaceSlash) {
        let slashPos = pos - 1;
        let foundSlash = false;
        
        for (let i = 1; i <= 10 && slashPos >= 0; i++) {
          const checkPos = pos - i;
          const textAtCheck = state.doc.textBetween(checkPos, checkPos + 1);
          
          if (textAtCheck === '/') {
            slashPos = checkPos;
            foundSlash = true;
            break;
          }
        }
        
        if (foundSlash) {
          tr = state.tr.replaceRangeWith(slashPos, slashPos + 1, imageNode);
        } else {
          tr = state.tr.replaceRangeWith(pos, pos, imageNode);
        }
      } else {
        tr = state.tr.replaceRangeWith(pos, pos, imageNode);
      }
      
      this.editorView.dispatch(tr);
    } catch (error) {
      console.error('Failed to insert image:', error);
    }
  }

  focus(): void {
    if (this.editorView) {
      this.editorView.focus();
    }
  }

  updateCodexHighlighting(): void {
    // This is handled by the plugins service through codex service subscriptions
  }

  destroy(): void {
    this.hideContextMenu();
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }
    this.simpleEditorService.destroySimpleEditor();
    this.beatIntegrationService.destroy();
  }

  clear(): void {
    if (this.editorView) {
      const { state } = this.editorView;
      const schema = this.editorView.state.schema;
      const emptyDoc = schema.nodes['doc'].create({}, [schema.nodes['paragraph'].create({})]);
      const tr = state.tr.replaceWith(0, state.doc.content.size, emptyDoc);
      this.editorView.dispatch(tr);
    }
  }

  private checkSlashCommand(state: EditorState, onSlashCommand?: (position: number) => void): void {
    if (!onSlashCommand) return;
    
    const selection = state.selection;
    const pos = selection.from;
    
    if (pos > 0) {
      const textBefore = state.doc.textBetween(pos - 1, pos);
      if (textBefore === '/') {
        const nodeBefore = state.doc.resolve(pos - 1);
        if (nodeBefore.parent.type.name === 'paragraph') {
          onSlashCommand(pos);
        }
      }
    }
  }

  private createContextMenuPlugin(): Plugin {
    
    return new Plugin({
      props: {
        handleDOMEvents: {
          contextmenu: (view, event: Event) => {
            const selection = view.state.selection;
            if (!selection.empty) {
              event.preventDefault();
              this.showContextMenu(view, event as MouseEvent);
              return true;
            }
            return false;
          },
          mousedown: () => {
            this.hideContextMenu();
            return false;
          }
        }
      }
    });
  }

  private showContextMenu(view: EditorView, event: MouseEvent): void {
    this.hideContextMenu();
    
    const selection = view.state.selection;
    if (selection.empty) return;
    
    const selectedText = view.state.doc.textBetween(selection.from, selection.to);
    if (!selectedText.trim()) return;
    
    const contextMenu = document.createElement('div');
    contextMenu.className = 'prosemirror-context-menu';
    contextMenu.style.cssText = `
      position: fixed;
      top: ${event.clientY}px;
      left: ${event.clientX}px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 1000;
      min-width: 120px;
    `;
    
    const aiRewriteItem = this.createContextMenuItem('AI Rewrite', async () => {
      await this.openAIRewriteModal(view, selectedText, selection.from, selection.to);
      this.hideContextMenu();
    });
    
    contextMenu.appendChild(aiRewriteItem);
    document.body.appendChild(contextMenu);
    
    (contextMenu as HTMLElement & { _isContextMenu: boolean })._isContextMenu = true;
  }

  private hideContextMenu(): void {
    const existingMenu = document.querySelector('.prosemirror-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
  }

  private createContextMenuItem(text: string, onClick: () => void): HTMLElement {
    const item = document.createElement('div');
    item.textContent = text;
    item.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
    `;
    
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = '#f5f5f5';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = '';
    });
    
    item.addEventListener('click', onClick);
    
    return item;
  }

  private async openAIRewriteModal(view: EditorView, selectedText: string, from: number, to: number): Promise<void> {
    const modal = await this.modalController.create({
      component: AIRewriteModalComponent,
      componentProps: {
        originalText: selectedText
      }
    });
    
    modal.onDidDismiss().then((result) => {
      if (result.data && result.role === 'confirm') {
        this.replaceSelectedText(view, result.data, from, to);
      }
    });
    
    await modal.present();
  }

  private replaceSelectedText(view: EditorView, result: AIRewriteResult, from: number, to: number): void {
    const { state } = view;
    const schema = view.state.schema;
    const newText = schema.text(result.rewrittenText);
    const tr = state.tr.replaceWith(from, to, newText);
    view.dispatch(tr);
  }

  public toggleDebugMode(enable: boolean): void {
    if (!this.editorView) return;
    
    const element = this.editorView.dom as HTMLElement;
    if (enable) {
      element.classList.add('debug-mode');
    } else {
      element.classList.remove('debug-mode');
    }
  }

  updateStoryContext(context: { storyId?: string; chapterId?: string; sceneId?: string }): void {
    this.currentStoryContext = { ...this.currentStoryContext, ...context };
  }

  getHTMLContent(): string {
    return this.getContent();
  }

  updateImageId(oldSrc: string, newImageId: string): void {
    if (!this.editorView) return;
    
    const { state } = this.editorView;
    const schema = state.schema;
    let tr = state.tr;
    
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs['src'] === oldSrc) {
        const newAttrs = { ...node.attrs, imageId: newImageId };
        const newNode = schema.nodes['image'].create(newAttrs);
        tr = tr.replaceWith(pos, pos + node.nodeSize, newNode);
      }
      return true;
    });
    
    this.editorView.dispatch(tr);
  }
}