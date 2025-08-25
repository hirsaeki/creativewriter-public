import { Injectable, Injector, ApplicationRef, EnvironmentInjector, inject } from '@angular/core';
import { EditorState, Transaction, Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema, DOMParser, DOMSerializer, Node as ProseMirrorNode, Fragment, Slice } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, splitBlock, chainCommands, newlineInCode, createParagraphNear, liftEmptyBlock } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { Subject } from 'rxjs';
import { ModalController } from '@ionic/angular/standalone';
import { BeatAINodeView } from './beat-ai-nodeview';
import { ResizableImageNodeView } from './resizable-image-nodeview';
import { BeatAI, BeatAIPromptEvent } from '../../stories/models/beat-ai.interface';
import { BeatAIService } from './beat-ai.service';
import { ImageInsertResult } from '../components/image-upload-dialog.component';
import { PromptManagerService } from './prompt-manager.service';
import { createCodexHighlightingPlugin, updateCodexHighlightingPlugin } from './codex-highlighting-plugin';
import { CodexEntry } from '../../stories/models/codex.interface';
import { CodexService } from '../../stories/services/codex.service';
import { AIRewriteModalComponent, AIRewriteResult } from '../components/ai-rewrite-modal.component';

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
export class ProseMirrorEditorService {
  private injector = inject(Injector);
  private modalController = inject(ModalController);
  private appRef = inject(ApplicationRef);
  private envInjector = inject(EnvironmentInjector);
  private beatAIService = inject(BeatAIService);
  private promptManager = inject(PromptManagerService);
  private codexService = inject(CodexService);

  private editorView: EditorView | null = null;
  private simpleEditorView: EditorView | null = null; // Separate view for beat input
  private editorSchema: Schema;
  private currentStoryContext: {
    storyId?: string;
    chapterId?: string;
    sceneId?: string;
  } = {};
  private beatNodeViews = new Set<BeatAINodeView>();
  private beatStreamingPositions = new Map<string, number>();
  private debugMode = false;
  
  public contentUpdate$ = new Subject<string>();
  public slashCommand$ = new Subject<number>();

  constructor() {
    // Create schema with basic nodes, list support, and beat AI node
    const baseNodes = addListNodes(schema.spec.nodes, 'paragraph block*', 'block');
    
    // Add image and beat AI nodes to schema
    const extendedNodes = baseNodes.append({
      image: {
        attrs: {
          src: { default: '' },
          alt: { default: '' },
          title: { default: null },
          imageId: { default: null },
          width: { default: null },
          height: { default: null }
        },
        inline: false,
        group: 'block',
        draggable: true,
        parseDOM: [{
          tag: 'img[src]',
          getAttrs: (dom: Element) => ({
            src: dom.getAttribute('src'),
            alt: dom.getAttribute('alt') || '',
            title: dom.getAttribute('title') || null,
            imageId: dom.getAttribute('data-image-id') || null,
            width: dom.getAttribute('width') || null,
            height: dom.getAttribute('height') || null
          })
        }],
        toDOM: (node: ProseMirrorNode) => {
          const attrs: Record<string, string> = {
            src: node.attrs['src'],
            alt: node.attrs['alt']
          };
          
          // Build style string
          let style = 'display: block; margin: 1rem auto;';
          
          if (node.attrs['width'] && node.attrs['height']) {
            style += ` width: ${node.attrs['width']}px; height: ${node.attrs['height']}px;`;
          } else {
            style += ' max-width: 100%; height: auto;';
          }
          
          attrs['style'] = style;
          
          if (node.attrs['title']) {
            attrs['title'] = node.attrs['title'];
          }
          
          if (node.attrs['imageId']) {
            attrs['data-image-id'] = node.attrs['imageId'];
            attrs['class'] = 'image-id-' + node.attrs['imageId'];
          }
          
          if (node.attrs['width']) {
            attrs['width'] = node.attrs['width'];
          }
          
          if (node.attrs['height']) {
            attrs['height'] = node.attrs['height'];
          }
          
          return ['img', attrs];
        }
      },
      beatAI: {
        attrs: {
          id: { default: '' },
          prompt: { default: '' },
          generatedContent: { default: '' },
          isGenerating: { default: false },
          isEditing: { default: false },
          createdAt: { default: '' },
          updatedAt: { default: '' },
          wordCount: { default: 400 },
          beatType: { default: 'story' },
          model: { default: '' },
          selectedScenes: { default: '' },
          includeStoryOutline: { default: true }
        },
        group: 'block',
        atom: true,
        toDOM: (node: ProseMirrorNode) => {
          const attrs = {
            class: 'beat-ai-node',
            'data-id': node.attrs['id'] || '',
            'data-prompt': node.attrs['prompt'] || '',
            'data-content': node.attrs['generatedContent'] || '',
            'data-generating': node.attrs['isGenerating'] ? 'true' : 'false',
            'data-editing': node.attrs['isEditing'] ? 'true' : 'false',
            'data-created': node.attrs['createdAt'] || '',
            'data-updated': node.attrs['updatedAt'] || '',
            'data-word-count': node.attrs['wordCount'] || 400,
            'data-beat-type': node.attrs['beatType'] || 'story',
            'data-model': node.attrs['model'] || '',
            'data-selected-scenes': node.attrs['selectedScenes'] || '',
            'data-include-story-outline': node.attrs['includeStoryOutline'] !== undefined ? node.attrs['includeStoryOutline'] : 'true'
          };
          
          // Create content to make the beat visible in saved HTML
          const content = [];
          if (node.attrs['prompt']) {
            content.push(['div', { style: 'border: 1px solid #404040; padding: 0.5rem; margin: 0.5rem 0; background: #3a3a3a; border-radius: 4px;' }, 
              ['strong', '🎭 Beat AI'],
              ['div', { style: 'color: #adb5bd; font-style: italic; margin-top: 0.25rem;' }, 'Prompt: ' + node.attrs['prompt']]
            ]);
          }
          
          return ['div', attrs, ...content] as const;
        },
        parseDOM: [{
          tag: 'div.beat-ai-node',
          getAttrs: (dom: HTMLElement) => {
            const selectedScenesStr = dom.getAttribute('data-selected-scenes') || '';
            const includeStoryOutlineStr = dom.getAttribute('data-include-story-outline') || '';
            
            const attrs = {
              id: dom.getAttribute('data-id') || '',
              prompt: dom.getAttribute('data-prompt') || '',
              generatedContent: dom.getAttribute('data-content') || '',
              isGenerating: dom.getAttribute('data-generating') === 'true',
              isEditing: dom.getAttribute('data-editing') === 'true',
              createdAt: dom.getAttribute('data-created') || '',
              updatedAt: dom.getAttribute('data-updated') || '',
              wordCount: parseInt(dom.getAttribute('data-word-count') || '400', 10),
              beatType: dom.getAttribute('data-beat-type') || 'story',
              model: dom.getAttribute('data-model') || '',
              selectedScenes: selectedScenesStr || '',
              includeStoryOutline: includeStoryOutlineStr !== '' ? (includeStoryOutlineStr === 'true') : true
            };
            
            return attrs;
          }
        }]
      }
    });

    this.editorSchema = new Schema({
      nodes: extendedNodes,
      marks: schema.spec.marks
    });
  }

  createEditor(element: HTMLElement, config: EditorConfig = {}): EditorView {
    // Store initial story context
    if (config.storyContext) {
      this.currentStoryContext = config.storyContext;
    }

    this.debugMode = config.debugMode || false;

    const plugins = [
      history(),
      keymap({
        'Mod-z': undo,
        'Mod-y': redo,
        'Mod-Shift-z': redo,
        // Explicitly use ProseMirror's native paragraph handling
        'Enter': chainCommands(newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock)
      }),
      keymap(baseKeymap),
      this.createBeatAIPlugin(),
      this.createCodexHighlightingPlugin(config),
      this.createContextMenuPlugin()
    ];


    const state = EditorState.create({
      schema: this.editorSchema,
      plugins
    });

    this.editorView = new EditorView(element, {
      state,
      nodeViews: {
        beatAI: (node, view, getPos) => new BeatAINodeView(
          node,
          view,
          getPos as () => number,
          this.injector,
          this.appRef,
          this.envInjector,
          (event: BeatAIPromptEvent) => {
            config.onBeatPromptSubmit?.(event);
          },
          (beatData: BeatAI) => {
            config.onBeatContentUpdate?.(beatData);
          },
          () => {
            config.onBeatFocus?.();
          },
          this.currentStoryContext
        ),
        image: (node, view, getPos) => new ResizableImageNodeView(
          node,
          view,
          getPos as () => number
        )
      },
      dispatchTransaction: (transaction: Transaction) => {
        const newState = this.editorView!.state.apply(transaction);
        this.editorView!.updateState(newState);
        
        // Emit content updates with lazy evaluation
        if (transaction.docChanged) {
          // Don't serialize content here - let the consumer do it when needed
          config.onUpdate?.('__content_changed__');
        }
        
        // Check for slash command
        if (transaction.docChanged || transaction.selection) {
          this.checkSlashCommand(newState, config.onSlashCommand);
        }
      },
      attributes: {
        class: 'prosemirror-editor',
        spellcheck: 'false'
      }
    });

    // Set placeholder if provided
    if (config.placeholder) {
      this.setPlaceholder(config.placeholder);
    }

    // Apply debug mode if enabled
    if (this.debugMode) {
      setTimeout(() => this.toggleDebugMode(true), 100);
    }

    return this.editorView;
  }

  createSimpleTextEditor(element: HTMLElement, config: SimpleEditorConfig = {}): EditorView {
    // Create a simple schema without beat nodes for basic text editing
    const simpleSchema = new Schema({
      nodes: {
        doc: schema.spec.nodes.get('doc')!,
        paragraph: schema.spec.nodes.get('paragraph')!,
        text: schema.spec.nodes.get('text')!,
        hard_break: schema.spec.nodes.get('hard_break')!
      },
      marks: schema.spec.marks
    });

    // Store initial story context for codex awareness
    if (config.storyContext) {
      this.currentStoryContext = config.storyContext;
    }

    // Create initial document with empty paragraph
    const initialDoc = simpleSchema.nodes['doc'].create({}, [
      simpleSchema.nodes['paragraph'].create({}, [])
    ]);
    
    const state = EditorState.create({
      doc: initialDoc,
      schema: simpleSchema,
      plugins: [
        history(),
        keymap({
          'Mod-z': undo,
          'Mod-y': redo,
          'Mod-Shift-z': redo,
          'Enter': splitBlock,
          'Shift-Enter': (state, dispatch) => {
            // Create line break with Shift+Enter
            if (dispatch) {
              const hardBreak = simpleSchema.nodes['hard_break'].create();
              const tr = state.tr.replaceSelectionWith(hardBreak);
              dispatch(tr.scrollIntoView());
            }
            return true;
          }
        }),
        keymap(baseKeymap),
        new Plugin({
          props: {
            attributes: {
              'data-placeholder': config.placeholder || 'Enter text...'
            }
          }
        }),
        // Add codex awareness plugin
        this.createCodexHighlightingPluginForCurrentStory()
      ]
    });

    // Create the editor view with proper event isolation
    this.simpleEditorView = new EditorView(element, {
      state,
      dispatchTransaction: (transaction) => {
        const newState = this.simpleEditorView!.state.apply(transaction);
        this.simpleEditorView!.updateState(newState);
        
        // Call update callback if provided
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
          // Stop event propagation to prevent main editor from handling it
          event.stopPropagation();
          return false;
        },
        touchstart: (view: EditorView, event: TouchEvent) => {
          // Stop event propagation to prevent main editor from handling it
          event.stopPropagation();
          return false;
        },
        focus: (view: EditorView, event: FocusEvent) => {
          // Stop event propagation to prevent main editor from handling it
          event.stopPropagation();
          return false;
        }
      }
    });

    // Set placeholder if provided
    if (config.placeholder) {
      this.setPlaceholder(config.placeholder);
    }

    return this.simpleEditorView;
  }

  getSimpleTextContent(): string {
    if (!this.simpleEditorView) return '';
    
    const doc = this.simpleEditorView.state.doc;
    let text = '';
    
    doc.descendants((node) => {
      if (node.isText) {
        text += node.text;
      } else if (node.type.name === 'hard_break') {
        text += '\n';
      } else if (node.type.name === 'paragraph' && text && !text.endsWith('\n')) {
        text += '\n';
      }
    });
    
    return text.trim();
  }

  private createCodexHighlightingPluginForCurrentStory(): Plugin {
    if (!this.currentStoryContext?.storyId) {
      // Return empty plugin if no story context
      return createCodexHighlightingPlugin({ codexEntries: [] });
    }

    // Get initial codex entries synchronously
    const codex = this.codexService.getCodex(this.currentStoryContext.storyId);
    let codexEntries: CodexEntry[] = [];
    
    if (codex) {
      codexEntries = this.extractAllCodexEntries(codex);
    }
    
    // Subscribe to codex changes to update highlighting dynamically
    this.codexService.codex$.subscribe(codexMap => {
      const updatedCodex = codexMap.get(this.currentStoryContext.storyId!);
      if (updatedCodex) {
        const updatedEntries = this.extractAllCodexEntries(updatedCodex);
        // Update the plugin when codex entries change (for simple text editor)
        if (this.simpleEditorView) {
          updateCodexHighlightingPlugin(this.simpleEditorView, updatedEntries);
        }
      }
    });

    return createCodexHighlightingPlugin({ 
      codexEntries,
      storyId: this.currentStoryContext.storyId
    });
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

  setContent(content: string): void {
    if (!this.editorView) return;
    
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
      
      const doc = DOMParser.fromSchema(this.editorSchema).parse(div);
      const state = EditorState.create({
        doc,
        schema: this.editorSchema,
        plugins: this.editorView.state.plugins
      });
      
      this.editorView.updateState(state);
    } catch (error) {
      console.warn('Failed to parse content, setting empty state:', error);
      this.setEmptyState();
    }
  }

  getHTMLContent(): string {
    if (!this.editorView) return '';
    
    try {
      const fragment = DOMSerializer.fromSchema(this.editorSchema)
        .serializeFragment(this.editorView.state.doc.content);
      
      const div = document.createElement('div');
      div.appendChild(fragment);
      
      // No need to process beat nodes - they already have their data in attributes
      
      return div.innerHTML;
    } catch (error) {
      console.warn('Failed to serialize content, returning text content:', error);
      return this.getTextContent();
    }
  }

  getTextContent(): string {
    if (!this.editorView) return '';
    return this.editorView.state.doc.textContent;
  }

  insertContent(content: string, position?: number, replaceSlash = false): void {
    if (!this.editorView) return;
    
    const { state } = this.editorView;
    const pos = position ?? state.selection.from;
    
    try {
      const div = document.createElement('div');
      div.innerHTML = content;
      const fragment = DOMParser.fromSchema(this.editorSchema).parseSlice(div);
      
      let tr;
      if (replaceSlash) {
        // Replace the slash with the content
        const slashPos = pos - 1;
        tr = state.tr.replaceRange(slashPos, pos, fragment);
      } else {
        // Insert at position
        tr = state.tr.replaceRange(pos, pos, fragment);
      }
      
      this.editorView.dispatch(tr);
    } catch (error) {
      console.warn('Failed to insert content:', error);
    }
  }

  removeSlashAtPosition(position: number): void {
    if (!this.editorView) return;
    
    try {
      const { state } = this.editorView;
      // Remove the slash character at the given position
      const slashPos = position - 1; // Position of the slash character
      
      if (slashPos >= 0 && slashPos < state.doc.content.size) {
        const tr = state.tr.delete(slashPos, position);
        this.editorView.dispatch(tr);
      }
    } catch (error) {
      console.error('Failed to remove slash:', error);
    }
  }

  insertBeatAI(position?: number, replaceSlash = false, beatType: 'story' | 'scene' = 'story'): void {
    if (!this.editorView) return;
    
    try {
      const { state } = this.editorView;
      const pos = position ?? state.selection.from;
      
      
      const beatData = this.beatAIService.createNewBeat(beatType);
      const beatNode = this.editorSchema.nodes['beatAI'].create({
        id: beatData.id,
        prompt: beatData.prompt,
        generatedContent: beatData.generatedContent,
        isGenerating: beatData.isGenerating,
        isEditing: beatData.isEditing,
        createdAt: beatData.createdAt.toISOString(),
        updatedAt: beatData.updatedAt.toISOString(),
        wordCount: beatData.wordCount,
        beatType: beatData.beatType,
        model: beatData.model || '',
        includeStoryOutline: beatData.includeStoryOutline
      });
      
      let tr;
      if (replaceSlash) {
        // Find the actual slash position by looking backwards from cursor position
        let slashPos = pos - 1;
        let foundSlash = false;
        
        // Look backwards up to 10 characters to find the slash
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
          // Replace the slash with the beat node
          tr = state.tr.replaceRangeWith(slashPos, slashPos + 1, beatNode);
        } else {
          console.warn('No slash found, inserting at current position');
          tr = state.tr.replaceRangeWith(pos, pos, beatNode);
        }
      } else {
        // Insert at position
        tr = state.tr.replaceRangeWith(pos, pos, beatNode);
      }
      
      this.editorView.dispatch(tr);
    } catch (error) {
      console.error('Failed to insert Beat AI node:', error);
    }
  }

  focus(): void {
    if (this.editorView) {
      this.editorView.focus();
    }
  }

  registerBeatNodeView(nodeView: BeatAINodeView): void {
    this.beatNodeViews.add(nodeView);
  }

  unregisterBeatNodeView(nodeView: BeatAINodeView): void {
    this.beatNodeViews.delete(nodeView);
  }

  destroy(): void {
    this.hideContextMenu(); // Clean up context menu
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }
    if (this.simpleEditorView) {
      this.simpleEditorView.destroy();
      this.simpleEditorView = null;
    }
    this.beatNodeViews.clear();
  }

  private setPlaceholder(placeholder: string): void {
    if (!this.editorView) return;
    
    const editorElement = this.editorView.dom as HTMLElement;
    editorElement.setAttribute('data-placeholder', placeholder);
  }

  private setEmptyState(): void {
    if (!this.editorView) return;
    
    const state = EditorState.create({
      schema: this.editorSchema,
      plugins: [
        history(),
        keymap({
          'Mod-z': undo,
          'Mod-y': redo,
          'Mod-Shift-z': redo,
          // Explicitly use ProseMirror's native paragraph handling
          'Enter': chainCommands(newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock)
        }),
        keymap(baseKeymap),
        this.createBeatAIPlugin()
      ]
    });
    
    this.editorView.updateState(state);
  }

  private createBeatAIPlugin(): Plugin {
    return new Plugin({
      key: new PluginKey('beatAI'),
      state: {
        init: () => ({}),
        apply: (tr, value) => value
      }
    });
  }

  handleBeatPromptSubmit(event: BeatAIPromptEvent): void {
    if (!this.editorView) return;
    
    // Handle delete after beat action
    if (event.action === 'deleteAfter') {
      this.deleteContentAfterBeat(event.beatId);
      return;
    }
    
    // Start generation process and update prompt
    this.updateBeatNode(event.beatId, { 
      isGenerating: true, 
      generatedContent: '',
      prompt: event.prompt || '' 
    });
    
    // Find the beat node position to insert content after it
    const beatNodePosition = this.findBeatNodePosition(event.beatId);
    if (beatNodePosition === null) return;
    
    // Content clearing is now only done through explicit delete action
    // Regeneration no longer automatically deletes content
    
    // Track accumulating content for real-time insertion
    let accumulatedContent = '';
    let isFirstChunk = true;
    
    // Subscribe to streaming generation events
    const generationSubscription = this.beatAIService.generation$.subscribe(generationEvent => {
      if (generationEvent.beatId !== event.beatId) return;
      
      if (!generationEvent.isComplete && generationEvent.chunk) {
        // Stream chunk received - append to accumulated content
        accumulatedContent += generationEvent.chunk;
        
        // For streaming, we append each chunk directly
        if (generationEvent.chunk) {
          this.appendContentAfterBeatNode(event.beatId, generationEvent.chunk, isFirstChunk);
          isFirstChunk = false;
        }
      } else if (generationEvent.isComplete) {
        // Generation completed - no need to append closing </p> as it's handled in the HTML structure
        this.updateBeatNode(event.beatId, { 
          isGenerating: false,
          generatedContent: accumulatedContent,
          prompt: event.prompt || ''
        });
        // Clean up stored position
        this.beatStreamingPositions.delete(event.beatId);
        generationSubscription.unsubscribe();
      }
    });
    
    // Generate AI content with streaming
    this.beatAIService.generateBeatContent(event.prompt || '', event.beatId, {
      wordCount: event.wordCount,
      model: event.model,
      storyId: event.storyId,
      chapterId: event.chapterId,
      sceneId: event.sceneId,
      beatPosition: beatNodePosition,
      beatType: event.beatType,
      customContext: event.customContext
    }).subscribe({
      next: (finalContent) => {
        // Final content received - ensure beat node is updated
        this.updateBeatNode(event.beatId, { 
          isGenerating: false,
          generatedContent: finalContent,
          prompt: event.prompt || ''
        });
      },
      error: (error) => {
        console.error('Beat generation failed:', error);
        
        // Insert error message
        this.appendContentAfterBeatNode(event.beatId, 'Error during generation. Please try again.', true);
        
        this.updateBeatNode(event.beatId, { 
          isGenerating: false,
          generatedContent: 'Error during generation. Please try again.',
          prompt: event.prompt || ''
        });
        
        generationSubscription.unsubscribe();
      }
    });
  }

  private updateBeatNode(beatId: string, updates: Partial<BeatAI>): void {
    if (!this.editorView) return;
    
    const { state } = this.editorView;
    let nodePos: number | null = null;
    let targetNode: ProseMirrorNode | null = null;
    
    // Find the beat node with the given ID
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'beatAI' && node.attrs['id'] === beatId) {
        nodePos = pos;
        targetNode = node;
        return false; // Stop iteration
      }
      return true;
    });
    
    if (nodePos !== null && targetNode) {
      const newAttrs = {
        ...(targetNode as ProseMirrorNode).attrs,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      const tr = state.tr.setNodeMarkup(nodePos, undefined, newAttrs);
      this.editorView.dispatch(tr);
    }
  }

  private findBeatNodePosition(beatId: string): number | null {
    if (!this.editorView) return null;
    
    const { state } = this.editorView;
    let nodePos: number | null = null;
    
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'beatAI' && node.attrs['id'] === beatId) {
        nodePos = pos;
        return false; // Stop iteration
      }
      return true;
    });
    
    return nodePos;
  }


  private deleteContentAfterBeat(beatId: string): void {
    if (!this.editorView) return;
    
    const beatPos = this.findBeatNodePosition(beatId);
    if (beatPos === null) return;
    
    const { state } = this.editorView;
    const beatNode = state.doc.nodeAt(beatPos);
    if (!beatNode) return;
    
    // Position after the beat node
    const deleteStartPos = beatPos + beatNode.nodeSize;
    
    // Delete everything from after the beat to the end of the document
    const tr = state.tr.delete(deleteStartPos, state.doc.content.size);
    
    // Dispatch the transaction
    this.editorView.dispatch(tr);
    
    // Emit content update to trigger save
    const content = this.getHTMLContent();
    this.contentUpdate$.next(content);
    
    // Refresh prompt manager to update scene context
    // This ensures that the next beat prompt will use the correct context
    setTimeout(() => {
      this.promptManager.refresh().catch(error => {
        console.error('Error refreshing prompt manager:', error);
      });
    }, 500); // Small delay to ensure content is saved first
  }


  private isGeneratedContent(node: ProseMirrorNode): boolean {
    // For streaming, we consider all paragraphs after a beat node as generated content
    // until we hit another beat node or other special content
    return node.type.name === 'paragraph';
  }

  private checkSlashCommand(state: EditorState, onSlashCommand?: (position: number) => void): void {
    const { selection } = state;
    const { from } = selection;
    
    // Get text before cursor (just 1 character)
    const textBefore = state.doc.textBetween(Math.max(0, from - 1), from);
    
    // Check if we just typed a slash
    if (textBefore === '/') {
      // Don't trigger if we're inside a beat AI node
      const nodeAtPos = state.doc.resolve(from).parent;
      const isInBeatNode = nodeAtPos.type.name === 'beatAI';
      
      if (!isInBeatNode) {
        this.slashCommand$.next(from);
        onSlashCommand?.(from);
      }
    }
  }

  updateStoryContext(storyContext: { storyId?: string; chapterId?: string; sceneId?: string }): void {
    
    // Update stored context for new nodes
    this.currentStoryContext = storyContext;
    
    if (!this.editorView) return;

    // Update all registered BeatAI node views with new context
    
    
    for (const nodeView of Array.from(this.beatNodeViews)) {
      if (nodeView && nodeView.componentRef) {
        
        // Update the nodeView's context
        nodeView.storyContext = storyContext;
        
        // Update the component instance
        nodeView.componentRef.instance.storyId = storyContext.storyId;
        nodeView.componentRef.instance.chapterId = storyContext.chapterId;
        nodeView.componentRef.instance.sceneId = storyContext.sceneId;
        
        // Force Angular to detect the changes
        nodeView.componentRef.changeDetectorRef?.markForCheck();
        nodeView.componentRef.changeDetectorRef?.detectChanges();
      }
    }
    
  }

  insertImage(imageData: ImageInsertResult, position?: number, replaceSlash = false): void {
    if (!this.editorView) return;
    
    try {
      const { state } = this.editorView;
      const pos = position ?? state.selection.from;
      
      // Create image node with optional imageId
      const imageNode = this.editorSchema.nodes['image'].create({
        src: imageData.url,
        alt: imageData.alt,
        title: imageData.title || null,
        imageId: imageData.imageId || null
      });
      
      let tr;
      if (replaceSlash) {
        // Find the actual slash position by looking backwards from cursor position
        let slashPos = pos - 1;
        let foundSlash = false;
        
        // Look backwards up to 10 characters to find the slash
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
          // Replace the slash with the image node
          tr = state.tr.replaceRangeWith(slashPos, slashPos + 1, imageNode);
        } else {
          console.warn('No slash found, inserting at current position');
          tr = state.tr.replaceRangeWith(pos, pos, imageNode);
        }
      } else {
        // Insert at position
        tr = state.tr.replaceRangeWith(pos, pos, imageNode);
      }
      
      this.editorView.dispatch(tr);
    } catch (error) {
      console.error('Failed to insert image:', error);
    }
  }

  requestImageInsert(): void {
    // This will be called by slash commands to request image insertion
    // The actual dialog will be handled by the component
  }

  /**
   * Update the image ID for an existing image in the document
   */
  updateImageId(imageSrc: string, imageId: string): void {
    if (!this.editorView) return;

    const { state, dispatch } = this.editorView;
    const { doc, tr } = state;
    
    // Find all image nodes with matching src
    let updated = false;
    doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs['src'] === imageSrc) {
        // Update the image node with the new imageId
        tr.setNodeMarkup(pos, null, {
          ...node.attrs,
          imageId: imageId
        });
        updated = true;
      }
    });

    if (updated) {
      dispatch(tr);
      console.log('Updated image ID in ProseMirror document:', imageId);
    }
  }

  private insertTextAtPosition(position: number, text: string): void {
    if (!this.editorView) return;
    
    const { state } = this.editorView;
    
    // Validate position bounds
    if (position < 0 || position > state.doc.content.size) {
      console.warn('Invalid position for text insertion:', position);
      return;
    }
    
    try {
      const tr = state.tr.insertText(text, position);
      this.editorView.dispatch(tr);
    } catch (error) {
      console.error('Failed to insert text at position:', error);
    }
  }

  private clearContentAfterBeatNode(beatId: string): void {
    if (!this.editorView) return;
    
    // Clear stored position when clearing content
    this.beatStreamingPositions.delete(beatId);
    
    const beatPos = this.findBeatNodePosition(beatId);
    if (beatPos === null) return;
    
    const { state } = this.editorView;
    const beatNode = state.doc.nodeAt(beatPos);
    if (!beatNode) return;
    
    // Position after the beat node
    const afterBeatPos = beatPos + beatNode.nodeSize;
    
    // Find the range of generated content to clear
    let endPos = afterBeatPos;
    let pos = afterBeatPos;
    
    // Look for consecutive paragraphs until we hit another beat node or end of document
    while (pos < state.doc.content.size) {
      const node = state.doc.nodeAt(pos);
      if (!node) break;
      
      // Stop if we hit another beat node
      if (node.type.name === 'beatAI') {
        break;
      }
      
      // Include paragraphs in the range to clear
      if (node.type.name === 'paragraph') {
        endPos = pos + node.nodeSize;
        pos = endPos;
      } else {
        // Stop at other node types (images, etc.)
        break;
      }
    }
    
    // Clear existing generated content
    if (endPos > afterBeatPos) {
      const tr = state.tr.delete(afterBeatPos, endPos);
      this.editorView.dispatch(tr);
    }
  }

  private replaceContentAfterBeatNode(beatId: string, newContent: string): void {
    if (!this.editorView) return;
    
    const beatPos = this.findBeatNodePosition(beatId);
    if (beatPos === null) return;
    
    const { state } = this.editorView;
    const beatNode = state.doc.nodeAt(beatPos);
    if (!beatNode) return;
    
    // Position after the beat node
    const afterBeatPos = beatPos + beatNode.nodeSize;
    
    // Find the range of generated content to replace
    let endPos = afterBeatPos;
    let pos = afterBeatPos;
    
    // Look for consecutive paragraphs until we hit another beat node or end of document
    while (pos < state.doc.content.size) {
      const node = state.doc.nodeAt(pos);
      if (!node) break;
      
      // Stop if we hit another beat node
      if (node.type.name === 'beatAI') {
        break;
      }
      
      // Include paragraphs in the range to replace
      if (node.type.name === 'paragraph') {
        endPos = pos + node.nodeSize;
        pos = endPos;
      } else {
        // Stop at other node types (images, etc.)
        break;
      }
    }
    
    // Replace the range with new content
    const textNode = state.schema.text(newContent);
    const paragraphNode = state.schema.nodes['paragraph'].create(null, [textNode]);
    const fragment = Fragment.from([paragraphNode]);
    const slice = new Slice(fragment, 0, 0);
    const tr = state.tr.replaceRange(afterBeatPos, endPos, slice);
    this.editorView.dispatch(tr);
  }

  private insertContentAfterBeatNode(beatId: string, newContent: string): void {
    if (!this.editorView) return;
    
    const beatPos = this.findBeatNodePosition(beatId);
    if (beatPos === null) return;
    
    const { state } = this.editorView;
    const beatNode = state.doc.nodeAt(beatPos);
    if (!beatNode) return;
    
    // Position after the beat node where we'll insert new content
    const insertPos = beatPos + beatNode.nodeSize;
    
    // Check if there's already generated content from this beat
    const currentContent = beatNode.attrs['generatedContent'] || '';
    
    if (currentContent) {
      // Replace only the previously generated content from this beat
      // Find the range that contains the previously generated content
      let endPos = insertPos;
      let pos = insertPos;
      
      // Calculate approximately how much content to replace based on current generated content
      const currentParagraphs = currentContent.split('\n\n').filter((p: string) => p.length > 0);
      let paragraphsToReplace = currentParagraphs.length;
      
      while (pos < state.doc.content.size && paragraphsToReplace > 0) {
        const node = state.doc.nodeAt(pos);
        if (!node) break;
        
        // Stop if we hit another beat node
        if (node.type.name === 'beatAI') {
          break;
        }
        
        // Replace paragraphs that are likely from the previous generation
        if (node.type.name === 'paragraph') {
          endPos = pos + node.nodeSize;
          pos = endPos;
          paragraphsToReplace--;
        } else {
          // Stop at other node types
          break;
        }
      }
      
      // Replace the range with new content
      const textNode = state.schema.text(newContent);
      const paragraphNode = state.schema.nodes['paragraph'].create(null, [textNode]);
      const fragment = Fragment.from([paragraphNode]);
      const slice = new Slice(fragment, 0, 0);
      const tr = state.tr.replaceRange(insertPos, endPos, slice);
      this.editorView.dispatch(tr);
    } else {
      // First generation - just insert the content
      const textNode = state.schema.text(newContent);
      const paragraphNode = state.schema.nodes['paragraph'].create(null, [textNode]);
      const fragment = Fragment.from([paragraphNode]);
      const tr = state.tr.insert(insertPos, fragment);
      this.editorView.dispatch(tr);
    }
  }

  private appendContentAfterBeatNode(beatId: string, newContent: string, isFirstChunk = false): void {
    if (!this.editorView) return;
    
    const beatPos = this.findBeatNodePosition(beatId);
    if (beatPos === null) return;
    
    const { state } = this.editorView;
    const beatNode = state.doc.nodeAt(beatPos);
    if (!beatNode) return;
    
    // Position immediately after the beat node
    const afterBeatPos = beatPos + beatNode.nodeSize;
    
    if (isFirstChunk) {
      // First chunk - create HTML with <p> wrapper and process linebreaks
      const htmlContent = '<p>' + newContent.replace(/\n/g, '</p><p>') + '</p>';
      
      // Parse HTML and insert into document
      this.insertHtmlContent(beatId, htmlContent, afterBeatPos);
    } else {
      // Subsequent chunks - process linebreaks and append to existing content
      const processedContent = newContent.replace(/\n/g, '</p><p>');
      this.appendHtmlChunk(beatId, processedContent);
    }
  }

  private insertHtmlContent(beatId: string, htmlContent: string, position: number): void {
    if (!this.editorView) return;
    
    try {
      const div = document.createElement('div');
      div.innerHTML = htmlContent;
      
      const fragment = DOMParser.fromSchema(this.editorSchema).parseSlice(div);
      const tr = this.editorView.state.tr.replaceRange(position, position, fragment);
      this.editorView.dispatch(tr);
      
      // Find the actual end position by looking for the last text node
      const newState = this.editorView.state;
      const insertedSize = fragment.content.size;
      const insertEndPos = position + insertedSize;
      
      // Find the last paragraph that was inserted and get position at end of its text content
      let endPosition = insertEndPos - 1;
      
      // Walk backwards to find the last text position
      for (let pos = insertEndPos - 1; pos >= position; pos--) {
        try {
          const $pos = newState.doc.resolve(pos);
          if ($pos.parent.type.name === 'paragraph' && $pos.parentOffset > 0) {
            endPosition = pos;
            break;
          }
        } catch {
          // Position might be invalid, continue searching
        }
      }
      
      this.beatStreamingPositions.set(beatId, endPosition);
    } catch (error) {
      console.error('Failed to insert HTML content:', error);
    }
  }

  private appendHtmlChunk(beatId: string, processedContent: string): void {
    if (!this.editorView) return;
    
    const insertPos = this.beatStreamingPositions.get(beatId);
    if (!insertPos || insertPos > this.editorView.state.doc.content.size) {
      return;
    }
    
    // Lazy cleanup: Remove empty paragraphs that might have been created by previous chunks
    this.removeLastEmptyParagraphIfExists(beatId);
    
    // Get updated position after potential cleanup
    const updatedInsertPos = this.beatStreamingPositions.get(beatId);
    if (!updatedInsertPos || updatedInsertPos > this.editorView.state.doc.content.size) {
      return;
    }
    
    // If the processed content contains </p><p>, we need to handle it specially
    if (processedContent.includes('</p><p>')) {
      // Split by paragraph boundaries
      const parts = processedContent.split('</p><p>');
      let currentPos = updatedInsertPos;
      
      // First part goes into current paragraph
      if (parts[0]) {
        // Ensure we're inserting at the end of the text content, not in the middle
        const tr1 = this.editorView.state.tr.insertText(parts[0], currentPos);
        this.editorView.dispatch(tr1);
        currentPos += parts[0].length;
      }
      
      // Remaining parts create new paragraphs
      for (let i = 1; i < parts.length; i++) {
        if (this.editorView) {
          const state = this.editorView.state;
          
          // Find the paragraph containing the current position
          const $pos = state.doc.resolve(currentPos);
          let paragraphNode = null;
          let paragraphPos = -1;
          
          // Walk up to find the paragraph
          for (let depth = $pos.depth; depth >= 0; depth--) {
            if ($pos.node(depth).type.name === 'paragraph') {
              paragraphNode = $pos.node(depth);
              paragraphPos = $pos.start(depth) - 1;
              break;
            }
          }
          
          if (paragraphNode && paragraphPos >= 0) {
            // Insert new paragraph after the current one
            const afterCurrentParagraph = paragraphPos + paragraphNode.nodeSize;
            
            // Create new paragraph with content
            const newParagraphNode = state.schema.nodes['paragraph'].create(null, 
              parts[i] ? [state.schema.text(parts[i])] : []);
            
            const tr = state.tr.insert(afterCurrentParagraph, newParagraphNode);
            this.editorView.dispatch(tr);
            
            // Update position to end of new paragraph's text content
            currentPos = afterCurrentParagraph + (parts[i] ? parts[i].length : 0) + 1; // +1 for paragraph structure
          }
        }
      }
      
      this.beatStreamingPositions.set(beatId, currentPos);
    } else {
      // Simple text append - ensure we're at the right position
      const state = this.editorView.state;
      const validPos = Math.min(updatedInsertPos, state.doc.content.size);
      
      const tr = state.tr.insertText(processedContent, validPos);
      this.editorView.dispatch(tr);
      this.beatStreamingPositions.set(beatId, validPos + processedContent.length);
    }
  }


  private findContainingParagraph(pos: number, state: EditorState): number | null {
    const $pos = state.doc.resolve(pos);
    
    // Walk up the tree to find the paragraph node
    for (let i = $pos.depth; i >= 0; i--) {
      const node = $pos.node(i);
      if (node.type.name === 'paragraph') {
        return $pos.start(i) - 1; // Return position before the paragraph
      }
    }
    
    return null;
  }

  private removeLastEmptyParagraphIfExists(beatId: string): void {
    if (!this.editorView) return;
    
    const currentPos = this.beatStreamingPositions.get(beatId);
    if (!currentPos) return;
    
    const state = this.editorView.state;
    
    try {
      // Find the current paragraph containing our position
      const $pos = state.doc.resolve(currentPos);
      let currentParagraphNode = null;
      let currentParagraphPos = -1;
      
      // Walk up to find the paragraph
      for (let depth = $pos.depth; depth >= 0; depth--) {
        if ($pos.node(depth).type.name === 'paragraph') {
          currentParagraphNode = $pos.node(depth);
          currentParagraphPos = $pos.start(depth) - 1;
          break;
        }
      }
      
      if (currentParagraphNode && currentParagraphPos >= 0) {
        // Check if current paragraph is empty (only contains whitespace or is completely empty)
        const paragraphContent = currentParagraphNode.textContent.trim();
        
        if (paragraphContent === '') {
          // This paragraph is empty, remove it
          const paragraphEndPos = currentParagraphPos + currentParagraphNode.nodeSize;
          const tr = state.tr.delete(currentParagraphPos, paragraphEndPos);
          this.editorView.dispatch(tr);
          
          // Update the stored position - move to the end of the previous paragraph or beat
          // Find the position right before where the empty paragraph was
          const newState = this.editorView.state;
          const newPos = Math.max(0, currentParagraphPos - 1);
          
          // Make sure we're at a valid position
          if (newPos < newState.doc.content.size) {
            this.beatStreamingPositions.set(beatId, newPos);
          }
        }
      }
    } catch (error) {
      // If anything goes wrong, don't crash - just log and continue
      console.warn('Failed to remove empty paragraph:', error);
    }
  }

  private createCodexHighlightingPlugin(config: EditorConfig): Plugin {
    // Get initial codex entries
    let codexEntries: CodexEntry[] = [];
    
    if (config.storyContext?.storyId) {
      this.codexService.codex$.subscribe(codexMap => {
        const codex = codexMap.get(config.storyContext!.storyId!);
        if (codex) {
          codexEntries = this.extractAllCodexEntries(codex);
          // Update the plugin when codex entries change
          if (this.editorView) {
            updateCodexHighlightingPlugin(this.editorView, codexEntries);
          }
        }
      });
    }

    return createCodexHighlightingPlugin({
      codexEntries,
      storyId: config.storyContext?.storyId
    });
  }

  private extractAllCodexEntries(codex: import('../../stories/models/codex.interface').Codex): CodexEntry[] {
    const entries: CodexEntry[] = [];
    
    if (codex.categories) {
      for (const category of codex.categories) {
        if (category.entries) {
          // Create deep copies of entries to prevent mutation
          const copiedEntries = category.entries.map(entry => ({
            ...entry,
            tags: entry.tags ? [...entry.tags] : []
          }));
          entries.push(...copiedEntries);
        }
      }
    }
    
    return entries;
  }


  toggleDebugMode(enabled: boolean): void {
    if (!this.editorView) return;
    
    this.debugMode = enabled;
    
    if (enabled) {
      // Add debug class to the parent element that contains .ProseMirror
      const editorContainer = this.editorView.dom.parentElement;
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
      const editorContainer = this.editorView.dom.parentElement;
      if (editorContainer) {
        editorContainer.classList.remove('pm-debug-mode');
      }
    }
  }

  private createContextMenuPlugin(): Plugin {

    return new Plugin({
      key: new PluginKey('contextMenu'),
      props: {
        handleDOMEvents: {
          contextmenu: (view, event) => {
            event.preventDefault();
            this.showContextMenu(view, event);
            return true;
          },
          click: () => {
            // Hide context menu on any click
            this.hideContextMenu();
            return false;
          }
        }
      }
    });
  }

  private showContextMenu(view: EditorView, event: MouseEvent): void {
    this.hideContextMenu(); // Remove any existing menu
    
    const { state } = view;
    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
    
    if (!pos) return;
    
    // Check if there's selected text
    const { from, to } = state.selection;
    const hasSelection = from !== to;
    const selectedText = hasSelection ? state.doc.textBetween(from, to) : '';
    
    // Check if there are empty paragraphs in the document
    const hasEmptyParagraphs = this.hasEmptyParagraphs(state);
    
    // Don't show menu if no empty paragraphs and no selection
    if (!hasEmptyParagraphs && !hasSelection) return;
    
    const menu = document.createElement('div');
    menu.className = 'prosemirror-context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${event.clientX}px;
      top: ${event.clientY}px;
      background: #2d2d30;
      border: 1px solid #404040;
      border-radius: 4px;
      padding: 4px 0;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      min-width: 180px;
      font-size: 13px;
      color: #cccccc;
    `;
    
    // Add AI rewrite option if text is selected
    if (hasSelection && selectedText.trim()) {
      const aiRewriteItem = this.createContextMenuItem('Rewrite with AI', () => {
        this.openAIRewriteModal(view, selectedText, from, to);
        this.hideContextMenu();
      });
      menu.appendChild(aiRewriteItem);
    }
    
    // Add empty paragraphs removal option if empty paragraphs exist
    if (hasEmptyParagraphs) {
      const removeEmptyItem = this.createContextMenuItem('Remove empty paragraphs', () => {
        this.removeEmptyParagraphs(view);
        this.hideContextMenu();
      });
      menu.appendChild(removeEmptyItem);
    }
    
    document.body.appendChild(menu);
    
    // Store reference for cleanup
    (this as unknown as { contextMenuElement: HTMLElement }).contextMenuElement = menu;
    
    // Position adjustment if menu goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${event.clientX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${event.clientY - rect.height}px`;
    }
  }

  private hideContextMenu(): void {
    const menu = (this as unknown as { contextMenuElement: HTMLElement }).contextMenuElement;
    if (menu && menu.parentNode) {
      menu.parentNode.removeChild(menu);
      (this as unknown as { contextMenuElement: HTMLElement | null }).contextMenuElement = null;
    }
  }

  private hasEmptyParagraphs(state: EditorState): boolean {
    let hasEmpty = false;
    
    state.doc.descendants((node) => {
      if (node.type.name === 'paragraph' && node.content.size === 0) {
        hasEmpty = true;
        return false; // Stop iteration
      }
      return true;
    });
    
    return hasEmpty;
  }

  private removeEmptyParagraphs(view: EditorView): void {
    const { state } = view;
    const tr = state.tr;
    const toRemove: { from: number; to: number }[] = [];
    
    // Collect all empty paragraph positions
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.content.size === 0) {
        toRemove.push({ from: pos, to: pos + node.nodeSize });
      }
      return true;
    });
    
    // Remove empty paragraphs from end to beginning to maintain position validity
    toRemove.reverse().forEach(({ from, to }) => {
      tr.delete(from, to);
    });
    
    if (toRemove.length > 0) {
      view.dispatch(tr);
      
      // Emit content update to trigger save
      const content = this.getHTMLContent();
      this.contentUpdate$.next(content);
    }
  }

  private createContextMenuItem(text: string, onClick: () => void): HTMLElement {
    const menuItem = document.createElement('div');
    menuItem.className = 'context-menu-item';
    menuItem.textContent = text;
    menuItem.style.cssText = `
      padding: 6px 12px;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    
    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.backgroundColor = '#404040';
    });
    
    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.backgroundColor = 'transparent';
    });
    
    menuItem.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    
    return menuItem;
  }

  private async openAIRewriteModal(view: EditorView, selectedText: string, from: number, to: number): Promise<void> {
    try {
      const modal = await this.modalController.create({
        component: AIRewriteModalComponent,
        componentProps: {
          selectedText,
          storyId: this.currentStoryContext?.storyId || '',
          currentChapterId: this.currentStoryContext?.chapterId || '',
          currentSceneId: this.currentStoryContext?.sceneId || ''
        },
        cssClass: 'ai-rewrite-modal'
      });

      await modal.present();
      const { data } = await modal.onDidDismiss();

      if (data?.rewrittenText) {
        this.replaceSelectedText(view, data as AIRewriteResult, from, to);
      }
    } catch (error) {
      console.error('Error opening AI rewrite modal:', error);
    }
  }

  private replaceSelectedText(view: EditorView, result: AIRewriteResult, from: number, to: number): void {
    const { state } = view;
    const tr = state.tr;
    
    // Replace the selected text with the rewritten text
    tr.insertText(result.rewrittenText, from, to);
    
    view.dispatch(tr);
    
    // Emit content update to trigger save
    const content = this.getHTMLContent();
    this.contentUpdate$.next(content);
  }
}