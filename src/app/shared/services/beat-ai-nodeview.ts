import { ComponentRef, Injector, ApplicationRef, createComponent, EnvironmentInjector } from '@angular/core';
import { EditorView, NodeView } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { BeatAIComponent } from '../../stories/components/beat-ai.component';
import { BeatAI, BeatAIPromptEvent } from '../../stories/models/beat-ai.interface';
import { ProseMirrorEditorService } from './prosemirror-editor.service';

export class BeatAINodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement | null = null;
  componentRef: ComponentRef<BeatAIComponent>; // Make public for context updates
  private beatData: BeatAI;
  storyContext: {
    storyId?: string;
    chapterId?: string;
    sceneId?: string;
  };

  constructor(
    private node: ProseMirrorNode,
    private view: EditorView,
    private getPos: () => number | undefined,
    private injector: Injector,
    private appRef: ApplicationRef,
    private envInjector: EnvironmentInjector,
    private onPromptSubmit: (event: BeatAIPromptEvent) => void,
    private onContentUpdate: (beatData: BeatAI) => void,
    private onBeatFocus?: () => void,
    storyContext?: {
      storyId?: string;
      chapterId?: string;
      sceneId?: string;
    }
  ) {
    this.storyContext = storyContext || {};
    
    // Register with ProseMirrorEditorService
    const proseMirrorService = this.injector.get(ProseMirrorEditorService);
    proseMirrorService.registerBeatNodeView(this);
    
    // Create the DOM element
    this.dom = document.createElement('div');
    this.dom.classList.add('beat-ai-wrapper');
    
    // Initialize beat data from node attributes
    this.beatData = this.createBeatDataFromNode(node);
    
    // Create Angular component
    this.componentRef = createComponent(BeatAIComponent, {
      environmentInjector: this.envInjector,
      elementInjector: this.injector
    });
    
    // Set component inputs
    this.componentRef.instance.beatData = this.beatData;
    if (this.storyContext) {
      this.componentRef.instance.storyId = this.storyContext.storyId;
      this.componentRef.instance.chapterId = this.storyContext.chapterId;
      this.componentRef.instance.sceneId = this.storyContext.sceneId;
    }
    
    // Subscribe to component outputs
    this.componentRef.instance.promptSubmit.subscribe((event: BeatAIPromptEvent) => {
      this.onPromptSubmit(event);
    });
    
    this.componentRef.instance.contentUpdate.subscribe((beatData: BeatAI) => {
      this.updateNodeAttrs(beatData);
      this.onContentUpdate(beatData);
    });
    
    this.componentRef.instance.delete.subscribe(() => {
      this.deleteNode();
    });
    
    this.componentRef.instance.beatFocus.subscribe(() => {
      // When beat AI gets focus, hide any open slash dropdown
      if (this.onBeatFocus) {
        this.onBeatFocus();
      }
    });
    
    // Attach component to application
    this.appRef.attachView(this.componentRef.hostView);
    
    // Append component DOM to our wrapper
    this.dom.appendChild(this.componentRef.location.nativeElement);
    
    // Make the node non-selectable by default but allow interaction
    this.dom.setAttribute('contenteditable', 'false');
    
    // Prevent the node from being selected when clicking on interactive elements
    this.setupEventHandlers();
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) {
      return false;
    }
    
    this.node = node;
    const newBeatData = this.createBeatDataFromNode(node);
    
    // Only update if the component is not currently generating
    // This preserves the component's isGenerating state during streaming
    if (!this.componentRef.instance.beatData.isGenerating) {
      this.beatData = newBeatData;
      this.componentRef.instance.beatData = this.beatData;
    } else {
      // During generation, only update non-state properties
      this.beatData.prompt = newBeatData.prompt;
      this.beatData.generatedContent = newBeatData.generatedContent;
      this.beatData.updatedAt = newBeatData.updatedAt;
      // Keep the existing isGenerating and isEditing states
    }
    
    return true;
  }


  stopEvent(event: Event): boolean {
    // Allow events for interactive elements (inputs, buttons, etc.)
    const target = event.target as HTMLElement;
    if (target) {
      const interactiveElements = ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'];
      const isInteractive = interactiveElements.includes(target.tagName) || 
                           target.contentEditable === 'true' ||
                           target.closest('button, input, textarea, select');
      
      if (isInteractive) {
        return true; // Stop ProseMirror from handling this event
      }
    }
    return false;
  }

  ignoreMutation(): boolean {
    // Ignore mutations inside the Angular component
    return true;
  }

  private setupEventHandlers(): void {
    // Prevent node selection when clicking on interactive elements
    this.dom.addEventListener('mousedown', (event) => {
      const target = event.target as HTMLElement;
      if (target) {
        const interactiveElements = ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'];
        const isInteractive = interactiveElements.includes(target.tagName) || 
                             target.contentEditable === 'true' ||
                             target.closest('button, input, textarea, select');
        
        if (isInteractive) {
          event.stopPropagation();
        }
      }
    });

    // Handle focus events
    this.dom.addEventListener('focusin', (event) => {
      event.stopPropagation();
    });

    // Handle input events
    this.dom.addEventListener('input', (event) => {
      event.stopPropagation();
    });
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  private createBeatDataFromNode(node: ProseMirrorNode): BeatAI {
    const attrs = node.attrs || {};
    return {
      id: attrs['id'] || this.generateId(),
      prompt: attrs['prompt'] || '',
      generatedContent: attrs['generatedContent'] || '',
      isGenerating: attrs['isGenerating'] || false,
      isEditing: attrs['isEditing'] || false,
      createdAt: attrs['createdAt'] ? new Date(attrs['createdAt']) : new Date(),
      updatedAt: attrs['updatedAt'] ? new Date(attrs['updatedAt']) : new Date(),
      wordCount: attrs['wordCount'] || 400,
      beatType: attrs['beatType'] || 'story',
      model: attrs['model'] || '',
      selectedScenes: attrs['selectedScenes'] ? JSON.parse(attrs['selectedScenes']) : undefined,
      includeStoryOutline: attrs['includeStoryOutline'] !== undefined ? attrs['includeStoryOutline'] : undefined
    };
  }

  private updateNodeAttrs(beatData: BeatAI): void {
    const pos = this.getPos();
    if (pos === undefined) return;

    const attrs: Record<string, unknown> = {
      id: beatData.id,
      prompt: beatData.prompt,
      generatedContent: beatData.generatedContent,
      isGenerating: beatData.isGenerating,
      isEditing: beatData.isEditing,
      createdAt: beatData.createdAt.toISOString(),
      updatedAt: beatData.updatedAt.toISOString(),
      wordCount: beatData.wordCount || 400,
      beatType: beatData.beatType || 'story',
      model: beatData.model || ''
    };

    // Add selectedScenes and includeStoryOutline if they exist
    if (beatData.selectedScenes !== undefined) {
      attrs['selectedScenes'] = JSON.stringify(beatData.selectedScenes);
    }
    if (beatData.includeStoryOutline !== undefined) {
      attrs['includeStoryOutline'] = beatData.includeStoryOutline;
    }

    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, attrs);
    this.view.dispatch(tr);
  }

  private deleteNode(): void {
    const pos = this.getPos();
    if (pos === undefined) return;

    const tr = this.view.state.tr.delete(pos, pos + this.node.nodeSize);
    this.view.dispatch(tr);
  }

  private generateId(): string {
    return 'beat-' + Math.random().toString(36).substr(2, 9);
  }

  destroy(): void {
    // Deregister from ProseMirrorEditorService
    const proseMirrorService = this.injector.get(ProseMirrorEditorService);
    proseMirrorService.unregisterBeatNodeView(this);
    
    // Clean up component
    if (this.componentRef) {
      this.componentRef.destroy();
    }
  }
}