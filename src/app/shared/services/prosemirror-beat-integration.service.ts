import { Injectable, inject } from '@angular/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Node as ProseMirrorNode, DOMParser } from 'prosemirror-model';
import { BeatAIService } from './beat-ai.service';
import { BeatAINodeView } from './beat-ai-nodeview';
import { BeatAI, BeatAIPromptEvent } from '../../stories/models/beat-ai.interface';

@Injectable({
  providedIn: 'root'
})
export class ProseMirrorBeatIntegrationService {
  private beatAIService = inject(BeatAIService);
  
  private beatNodeViews = new Set<BeatAINodeView>();
  private beatStreamingPositions = new Map<string, number>();

  createBeatAIPlugin(): Plugin {
    return new Plugin({
      key: new PluginKey('beatAI'),
      state: {
        init: () => ({}),
        apply: (tr, value) => value
      }
    });
  }

  insertBeatAI(editorView: EditorView, schema: import('prosemirror-model').Schema, position?: number, replaceSlash = false, beatType: 'story' | 'scene' = 'story'): void {
    if (!editorView) return;
    
    try {
      const { state } = editorView;
      const pos = position ?? state.selection.from;
      
      const beatData = this.beatAIService.createNewBeat(beatType);
      const beatNode = schema.nodes['beatAI'].create({
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
          tr = state.tr.replaceRangeWith(slashPos, slashPos + 1, beatNode);
        } else {
          console.warn('No slash found, inserting at current position');
          tr = state.tr.replaceRangeWith(pos, pos, beatNode);
        }
      } else {
        tr = state.tr.replaceRangeWith(pos, pos, beatNode);
      }
      
      editorView.dispatch(tr);
    } catch (error) {
      console.error('Failed to insert Beat AI node:', error);
    }
  }

  handleBeatPromptSubmit(editorView: EditorView, event: BeatAIPromptEvent): void {
    if (!editorView) return;
    
    if (event.action === 'deleteAfter') {
      this.deleteContentAfterBeat(editorView, event.beatId);
      return;
    }
    
    this.updateBeatNode(editorView, event.beatId, { 
      isGenerating: true, 
      generatedContent: '',
      prompt: event.prompt || '' 
    });
    
    const beatNodePosition = this.findBeatNodePosition(editorView, event.beatId);
    if (beatNodePosition === null) return;
    
    let accumulatedContent = '';
    let isFirstChunk = true;
    
    const generationSubscription = this.beatAIService.generation$.subscribe(generationEvent => {
      if (generationEvent.beatId !== event.beatId) return;
      
      if (!generationEvent.isComplete && generationEvent.chunk) {
        accumulatedContent += generationEvent.chunk;
        
        if (generationEvent.chunk) {
          this.appendContentAfterBeatNode(editorView, event.beatId, generationEvent.chunk, isFirstChunk);
          isFirstChunk = false;
        }
      } else if (generationEvent.isComplete) {
        this.updateBeatNode(editorView, event.beatId, { 
          isGenerating: false,
          generatedContent: accumulatedContent,
          prompt: event.prompt || ''
        });
        this.beatStreamingPositions.delete(event.beatId);
        generationSubscription.unsubscribe();
      }
    });
    
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
        this.updateBeatNode(editorView, event.beatId, { 
          isGenerating: false,
          generatedContent: finalContent,
          prompt: event.prompt || ''
        });
      },
      error: (error) => {
        console.error('Beat generation failed:', error);
        
        this.appendContentAfterBeatNode(editorView, event.beatId, 'Error during generation. Please try again.', true);
        
        this.updateBeatNode(editorView, event.beatId, { 
          isGenerating: false,
          generatedContent: 'Error during generation. Please try again.',
          prompt: event.prompt || ''
        });
        
        generationSubscription.unsubscribe();
      }
    });
  }

  registerBeatNodeView(nodeView: BeatAINodeView): void {
    this.beatNodeViews.add(nodeView);
  }

  unregisterBeatNodeView(nodeView: BeatAINodeView): void {
    this.beatNodeViews.delete(nodeView);
  }

  private updateBeatNode(editorView: EditorView, beatId: string, updates: Partial<BeatAI>): void {
    if (!editorView) return;
    
    const { state } = editorView;
    let nodePos: number | null = null;
    let targetNode: ProseMirrorNode | null = null;
    
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'beatAI' && node.attrs['id'] === beatId) {
        nodePos = pos;
        targetNode = node;
        return false;
      }
      return true;
    });
    
    if (nodePos !== null && targetNode !== null) {
      const node = targetNode as ProseMirrorNode;
      const updatedAttrs = { ...node.attrs, ...updates };
      const newNode = node.type.create(updatedAttrs, node.content);
      const tr = state.tr.replaceWith(nodePos, nodePos + node.nodeSize, newNode);
      editorView.dispatch(tr);
    }
  }

  private findBeatNodePosition(editorView: EditorView, beatId: string): number | null {
    const { state } = editorView;
    let position: number | null = null;
    
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'beatAI' && node.attrs['id'] === beatId) {
        position = pos;
        return false;
      }
      return true;
    });
    
    return position;
  }

  private deleteContentAfterBeat(editorView: EditorView, beatId: string): void {
    const beatPosition = this.findBeatNodePosition(editorView, beatId);
    if (beatPosition === null) return;
    
    const { state } = editorView;
    
    const beatNode = state.doc.nodeAt(beatPosition);
    if (!beatNode || beatNode.type.name !== 'beatAI') return;
    
    const startPos = beatPosition + beatNode.nodeSize;
    let endPos = startPos;
    
    state.doc.descendants((node, pos) => {
      if (pos >= startPos) {
        if (node.type.name === 'beatAI') {
          return false;
        }
        if (this.isGeneratedContent(node)) {
          endPos = pos + node.nodeSize;
        }
      }
      return true;
    });
    
    if (endPos > startPos) {
      const tr = state.tr.delete(startPos, endPos);
      editorView.dispatch(tr);
    }
  }

  private appendContentAfterBeatNode(editorView: EditorView, beatId: string, newContent: string, isFirstChunk = false): void {
    if (!editorView || !newContent.trim()) return;
    
    const { state } = editorView;
    const beatPosition = this.findBeatNodePosition(editorView, beatId);
    if (beatPosition === null) return;
    
    let insertPosition: number;
    
    if (isFirstChunk || !this.beatStreamingPositions.has(beatId)) {
      const beatNode = state.doc.nodeAt(beatPosition);
      if (!beatNode) return;
      
      insertPosition = beatPosition + beatNode.nodeSize;
      this.beatStreamingPositions.set(beatId, insertPosition);
    } else {
      insertPosition = this.beatStreamingPositions.get(beatId)!;
    }
    
    if (newContent.includes('<') && newContent.includes('>')) {
      this.insertHtmlContent(editorView, beatId, newContent, insertPosition);
    } else {
      this.insertTextAtPosition(editorView, insertPosition, newContent);
      this.beatStreamingPositions.set(beatId, insertPosition + newContent.length);
    }
  }

  private insertHtmlContent(editorView: EditorView, beatId: string, htmlContent: string, position: number): void {
    const { state } = editorView;
    const schema = editorView.state.schema;
    
    try {
      const div = document.createElement('div');
      div.innerHTML = htmlContent;
      
      const parser = DOMParser.fromSchema(schema);
      const fragment = parser.parse(div);
      if (fragment && fragment.content.size > 0) {
        const tr = state.tr.insert(position, fragment.content);
        editorView.dispatch(tr);
        
        this.beatStreamingPositions.set(beatId, position + fragment.content.size);
      }
    } catch (error) {
      console.error('Failed to insert HTML content:', error);
      this.insertTextAtPosition(editorView, position, htmlContent.replace(/<[^>]*>/g, ''));
    }
  }

  private insertTextAtPosition(editorView: EditorView, position: number, text: string): void {
    const { state } = editorView;
    const schema = editorView.state.schema;
    
    try {
      const textNode = schema.text(text);
      const tr = state.tr.insert(position, textNode);
      editorView.dispatch(tr);
    } catch (error) {
      console.error('Failed to insert text at position:', error);
    }
  }

  private isGeneratedContent(node: ProseMirrorNode): boolean {
    return node.type.name === 'paragraph' && 
           node.attrs && 
           node.attrs['data-generated'] === 'true';
  }

  destroy(): void {
    this.beatNodeViews.clear();
    this.beatStreamingPositions.clear();
  }
}