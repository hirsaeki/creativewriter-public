import { Injectable, inject } from '@angular/core';
import { Plugin, PluginKey, EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Subscription } from 'rxjs';
import { CodexService } from '../../stories/services/codex.service';
import { CodexEntry } from '../../stories/models/codex.interface';
import { createCodexHighlightingPlugin, updateCodexHighlightingPlugin } from './codex-highlighting-plugin';
import { EditorConfig, StoryContext } from './prosemirror-editor.interfaces';

@Injectable({
  providedIn: 'root'
})
export class ProseMirrorPluginsService {
  private codexService = inject(CodexService);

  // Track subscriptions and editor view references per story to prevent memory leaks
  private subscriptions = new Map<string, Subscription>();
  private editorViews = new Map<string, EditorView | null>();

  /**
   * Create Beat AI plugin (basic plugin for beat node support)
   */
  createBeatAIPlugin(): Plugin {
    return new Plugin({
      key: new PluginKey('beatAI'),
      state: {
        init: () => ({}),
        apply: (tr, value) => value
      }
    });
  }

  /**
   * Create codex highlighting plugin for the main editor
   */
  createCodexHighlightingPlugin(config: EditorConfig, editorView: EditorView | null): Plugin {
    // Get initial codex entries
    let codexEntries: CodexEntry[] = [];
    const storyId = config.storyContext?.storyId;

    if (storyId) {
      // Store initial editor view reference
      this.editorViews.set(storyId, editorView);

      // Clean up existing subscription if any (prevents duplicate subscriptions)
      this.cleanupCodexSubscription(storyId);

      // Create new subscription
      const subscription = this.codexService.codex$.subscribe(codexMap => {
        const codex = codexMap.get(storyId);
        if (codex) {
          codexEntries = this.extractAllCodexEntries(codex);
          // Always use latest editor view reference from the Map
          const currentView = this.editorViews.get(storyId);
          if (currentView) {
            updateCodexHighlightingPlugin(currentView, codexEntries);
          }
        }
      });

      this.subscriptions.set(storyId, subscription);
    }

    return createCodexHighlightingPlugin({
      codexEntries,
      storyId
    });
  }

  /**
   * Update the editor view reference for a story
   */
  updateEditorView(storyId: string, editorView: EditorView | null): void {
    this.editorViews.set(storyId, editorView);
  }

  /**
   * Clean up codex subscription and editor view reference for a story
   */
  cleanupCodexSubscription(storyId: string): void {
    const subscription = this.subscriptions.get(storyId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(storyId);
    }
    this.editorViews.delete(storyId);
  }

  /**
   * Create codex highlighting plugin for simple text editor
   */
  createCodexHighlightingPluginForSimpleEditor(storyContext?: StoryContext): Plugin {
    if (!storyContext?.storyId) {
      // Return empty plugin if no story context
      return createCodexHighlightingPlugin({ codexEntries: [] });
    }

    // Get initial codex entries synchronously
    const codex = this.codexService.getCodex(storyContext.storyId);
    let codexEntries: CodexEntry[] = [];

    if (codex) {
      codexEntries = this.extractAllCodexEntries(codex);
    }

    return createCodexHighlightingPlugin({
      codexEntries,
      storyId: storyContext.storyId
    });
  }

  /**
   * Extract all codex entries from a codex
   */
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

  /**
   * Check for slash command in editor state
   */
  checkSlashCommand(state: EditorState, onSlashCommand?: (position: number) => void): void {
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
        onSlashCommand?.(from);
      }
    }
  }
}
