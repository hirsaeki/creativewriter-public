import { Injectable } from '@angular/core';
import { EditorView } from 'prosemirror-view';
import { BeatAINodeView } from './beat-ai-nodeview';
import { StoryContext } from './prosemirror-editor.interfaces';

@Injectable({
  providedIn: 'root'
})
export class EditorStateService {
  private beatNodeViews = new Set<BeatAINodeView>();
  private codexSubscriptions = new Map<EditorView, { unsubscribe: () => void }>();

  /**
   * Register a beat node view
   */
  registerBeatNodeView(nodeView: BeatAINodeView): void {
    this.beatNodeViews.add(nodeView);
  }

  /**
   * Unregister a beat node view
   */
  unregisterBeatNodeView(nodeView: BeatAINodeView): void {
    this.beatNodeViews.delete(nodeView);
  }

  /**
   * Get all registered beat node views
   */
  getBeatNodeViews(): Set<BeatAINodeView> {
    return this.beatNodeViews;
  }

  /**
   * Clear all beat node views
   */
  clearBeatNodeViews(): void {
    this.beatNodeViews.clear();
  }

  /**
   * Update story context for all beat node views
   */
  updateStoryContext(storyContext: StoryContext): void {
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

  /**
   * Store a codex subscription for an editor view
   */
  storeCodexSubscription(editorView: EditorView, subscription: { unsubscribe: () => void }): void {
    this.codexSubscriptions.set(editorView, subscription);
  }

  /**
   * Clean up an editor view and its subscriptions
   */
  cleanupEditorView(editorView: EditorView | null): void {
    if (!editorView) return;

    // Clean up subscriptions for this editor
    const subscription = this.codexSubscriptions.get(editorView);
    if (subscription) {
      subscription.unsubscribe();
      this.codexSubscriptions.delete(editorView);
    }
  }

  /**
   * Destroy all editor state
   */
  destroy(): void {
    // Clear all subscriptions
    for (const subscription of this.codexSubscriptions.values()) {
      subscription.unsubscribe();
    }
    this.codexSubscriptions.clear();
    this.beatNodeViews.clear();
  }
}
