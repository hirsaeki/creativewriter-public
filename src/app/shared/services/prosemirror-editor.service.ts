import { Injectable, Injector, ApplicationRef, EnvironmentInjector, inject } from '@angular/core';
import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, chainCommands, newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { Subject, merge } from 'rxjs';
import { IonContent } from '@ionic/angular/standalone';
import { BeatAINodeView } from './beat-ai-nodeview';
import { ResizableImageNodeView } from './resizable-image-nodeview';
import { BeatAI, BeatAIPromptEvent } from '../../stories/models/beat-ai.interface';
import { ImageInsertResult } from '../../ui/components/image-upload-dialog.component';
import { EditorConfig, SimpleEditorConfig, StoryContext, BeatInfo } from './prosemirror-editor.interfaces';

// Import all sub-services
import { ProseMirrorSchemaService } from './prosemirror-schema.service';
import { SelectionHighlightService } from './selection-highlight.service';
import { ContextMenuService } from './context-menu.service';
import { DebugUtilityService } from './debug-utility.service';
import { EditorStateService } from './editor-state.service';
import { ImageOperationsService } from './image-operations.service';
import { ProseMirrorContentService } from './prosemirror-content.service';
import { ProseMirrorPluginsService } from './prosemirror-plugins.service';
import { BeatOperationsService } from './beat-operations.service';

// Re-export interfaces for backward compatibility
export type { EditorConfig, SimpleEditorConfig } from './prosemirror-editor.interfaces';

@Injectable({
  providedIn: 'root'
})
export class ProseMirrorEditorService {
  // Angular dependencies
  private injector = inject(Injector);
  private appRef = inject(ApplicationRef);
  private envInjector = inject(EnvironmentInjector);

  // Sub-services
  private schemaService = inject(ProseMirrorSchemaService);
  private selectionHighlightService = inject(SelectionHighlightService);
  private contextMenuService = inject(ContextMenuService);
  private debugService = inject(DebugUtilityService);
  private editorStateService = inject(EditorStateService);
  private imageOpsService = inject(ImageOperationsService);
  private contentService = inject(ProseMirrorContentService);
  private pluginsService = inject(ProseMirrorPluginsService);
  private beatOpsService = inject(BeatOperationsService);

  // Editor state
  private editorView: EditorView | null = null;
  private editorSchema: Schema;
  private currentStoryContext: StoryContext = {};

  // Public subjects - merge from sub-services
  public contentUpdate$ = new Subject<string>();
  public slashCommand$ = new Subject<number>();

  constructor() {
    this.editorSchema = this.schemaService.getEditorSchema();

    // Merge content updates from sub-services
    merge(
      this.contextMenuService.contentUpdate$,
      this.beatOpsService.contentUpdate$
    ).subscribe(content => this.contentUpdate$.next(content));
  }

  /**
   * Create the main editor with full features
   */
  createEditor(element: HTMLElement, config: EditorConfig = {}): EditorView {
    // Store initial story context
    if (config.storyContext) {
      this.currentStoryContext = config.storyContext;
    }

    const plugins = [
      history(),
      keymap({
        'Mod-z': undo,
        'Mod-y': redo,
        'Mod-Shift-z': redo,
        'Enter': chainCommands(newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock)
      }),
      keymap(baseKeymap),
      this.pluginsService.createBeatAIPlugin(),
      this.pluginsService.createCodexHighlightingPlugin(config, null), // Will update with editorView after creation
      this.contextMenuService.createContextMenuPlugin(() => this.getHTMLContent()),
      this.selectionHighlightService.createFlashHighlightPlugin()
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

    // Update codex plugin with actual editor view
    this.pluginsService.createCodexHighlightingPlugin(config, this.editorView);

    // Set placeholder if provided
    if (config.placeholder) {
      this.setPlaceholder(config.placeholder);
    }

    // Apply debug mode if enabled
    if (config.debugMode) {
      setTimeout(() => this.toggleDebugMode(true), 100);
    }

    return this.editorView;
  }

  /**
   * Create a simple text editor (no beats, images, etc.)
   */
  createSimpleTextEditor(element: HTMLElement, config: SimpleEditorConfig = {}): EditorView {
    const simpleSchema = this.schemaService.getSimpleSchema();

    // Create initial document with empty paragraph
    const initialDoc = simpleSchema.nodes['doc'].create({}, [
      simpleSchema.nodes['paragraph'].create({}, [])
    ]);

    const plugins = this.contentService.createSimpleEditorPlugins(simpleSchema, config.placeholder || 'Enter text...');

    // Add codex awareness plugin
    plugins.push(this.pluginsService.createCodexHighlightingPluginForSimpleEditor(config.storyContext));

    const state = EditorState.create({
      doc: initialDoc,
      schema: simpleSchema,
      plugins
    });

    // Store reference to service for use in callback
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const editorService = this;
    const editorView = new EditorView(element, {
      state,
      dispatchTransaction: function(this: EditorView, transaction) {
        const newState = this.state.apply(transaction);
        this.updateState(newState);

        // Call update callback if provided
        if (config.onUpdate) {
          const content = editorService.getSimpleTextContent(this);
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

    // Set placeholder if provided
    if (config.placeholder) {
      const editorElement = editorView.dom as HTMLElement;
      editorElement.setAttribute('data-placeholder', config.placeholder);
    }

    return editorView;
  }

  // ===== Content Operations =====

  getHTMLContent(): string {
    return this.contentService.getHTMLContent(this.editorView, this.editorSchema);
  }

  getTextContent(): string {
    return this.contentService.getTextContent(this.editorView);
  }

  setContent(content: string): void {
    this.contentService.setContent(this.editorView, this.editorSchema, content);
  }

  insertContent(content: string, position?: number, replaceSlash = false): void {
    this.contentService.insertContent(this.editorView, this.editorSchema, content, position, replaceSlash);
  }

  removeSlashAtPosition(position: number): void {
    this.contentService.removeSlashAtPosition(this.editorView, position);
  }

  getSimpleTextContent(editorView: EditorView): string {
    return this.contentService.getSimpleTextContent(editorView);
  }

  setSimpleContent(editorView: EditorView, content: string): void {
    this.contentService.setSimpleContent(editorView, content);
  }

  // ===== Beat Operations =====

  insertBeatAI(position?: number, replaceSlash = false, beatType: 'story' | 'scene' = 'story'): void {
    this.beatOpsService.insertBeatAI(this.editorView, this.editorSchema, position, replaceSlash, beatType);
  }

  handleBeatPromptSubmit(event: BeatAIPromptEvent): void {
    this.beatOpsService.handleBeatPromptSubmit(this.editorView, event, () => this.getHTMLContent());
  }

  getTextAfterBeat(beatId: string): string | null {
    return this.beatOpsService.getTextAfterBeat(this.editorView, beatId);
  }

  deleteContentAfterBeat(beatId: string): boolean {
    return this.beatOpsService.deleteContentAfterBeat(this.editorView, beatId, () => this.getHTMLContent());
  }

  /**
   * Delete only the generated content between a beat and its end marker.
   * Preserves any pre-existing text that was pushed down when the beat was inserted.
   * Falls back to deleteContentAfterBeat if no marker exists (backward compatibility).
   */
  deleteGeneratedContentOnly(beatId: string): boolean {
    return this.beatOpsService.deleteGeneratedContentOnly(this.editorView, beatId, () => this.getHTMLContent());
  }

  async switchBeatVersion(beatId: string, versionId: string): Promise<void> {
    return this.beatOpsService.switchBeatVersion(this.editorView, beatId, versionId, () => this.getHTMLContent());
  }

  extractBeatsFromEditor(): BeatInfo[] {
    return this.beatOpsService.extractBeatsFromEditor(this.editorView);
  }

  async scrollToBeat(beatId: string, ionContent?: IonContent): Promise<void> {
    return this.beatOpsService.scrollToBeat(beatId, ionContent);
  }

  // ===== Image Operations =====

  insertImage(imageData: ImageInsertResult, position?: number, replaceSlash = false): void {
    this.imageOpsService.insertImage(this.editorView, this.editorSchema, imageData, position, replaceSlash);
  }

  updateImageId(imageSrc: string, imageId: string): void {
    this.imageOpsService.updateImageId(this.editorView, imageSrc, imageId);
  }

  requestImageInsert(): void {
    // Placeholder for slash command integration
  }

  // ===== Selection & Highlighting =====

  selectFirstMatchOf(phrase: string): boolean {
    if (!this.editorView) return false;
    return this.selectionHighlightService.selectFirstMatchOf(this.editorView, phrase);
  }

  flashSelection(durationMs = 1600): void {
    if (!this.editorView) return;
    this.selectionHighlightService.flashSelection(this.editorView, durationMs);
  }

  flashRange(from: number, to: number, durationMs = 1600): void {
    if (!this.editorView) return;
    this.selectionHighlightService.flashRange(this.editorView, from, to, durationMs);
  }

  // ===== Editor State Management =====

  focus(): void {
    if (this.editorView) {
      this.editorView.focus();
    }
  }

  registerBeatNodeView(nodeView: BeatAINodeView): void {
    this.editorStateService.registerBeatNodeView(nodeView);
  }

  unregisterBeatNodeView(nodeView: BeatAINodeView): void {
    this.editorStateService.unregisterBeatNodeView(nodeView);
  }

  updateStoryContext(storyContext: StoryContext): void {
    this.currentStoryContext = storyContext;
    this.editorStateService.updateStoryContext(storyContext);
  }

  destroy(): void {
    this.contextMenuService.hideContextMenu();
    if (this.editorView) {
      this.editorStateService.cleanupEditorView(this.editorView);
      this.editorView.destroy();
      this.editorView = null;
    }
    this.editorStateService.clearBeatNodeViews();
  }

  destroySimpleEditor(editorView: EditorView): void {
    if (!editorView) return;
    this.editorStateService.cleanupEditorView(editorView);
    editorView.destroy();
  }

  // ===== Debug Mode =====

  toggleDebugMode(enabled: boolean): void {
    this.debugService.toggleDebugMode(this.editorView, enabled);
  }

  // ===== Private Helpers =====

  private setPlaceholder(placeholder: string): void {
    if (!this.editorView) return;
    const editorElement = this.editorView.dom as HTMLElement;
    editorElement.setAttribute('data-placeholder', placeholder);
  }

  private checkSlashCommand(state: EditorState, onSlashCommand?: (position: number) => void): void {
    this.pluginsService.checkSlashCommand(state, (position) => {
      this.slashCommand$.next(position);
      onSlashCommand?.(position);
    });
  }
}
