import { Injectable, inject } from '@angular/core';
import { Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { createCodexHighlightingPlugin, updateCodexHighlightingPlugin } from './codex-highlighting-plugin';
import { CodexEntry } from '../../stories/models/codex.interface';
import { CodexService } from '../../stories/services/codex.service';

export interface EditorConfig {
  placeholder?: string;
  onUpdate?: (content: string) => void;
  onSlashCommand?: (position: number) => void;
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
export class ProseMirrorPluginsService {
  private codexService = inject(CodexService);

  createBasePlugins(): Plugin[] {
    return [
      history(),
      keymap({
        'Mod-z': undo,
        'Mod-y': redo,
        'Mod-Shift-z': redo
      }),
      keymap(baseKeymap)
    ];
  }

  createSimpleEditorPlugins(config: { placeholder?: string; storyContext?: { storyId?: string } }): Plugin[] {
    const plugins: Plugin[] = [
      ...this.createBasePlugins(),
      new Plugin({
        props: {
          attributes: {
            'data-placeholder': config.placeholder || 'Enter text...'
          }
        }
      })
    ];

    if (config.storyContext?.storyId) {
      plugins.push(this.createCodexHighlightingPluginForStory(config.storyContext.storyId));
    }

    return plugins;
  }

  createCodexHighlightingPlugin(config: EditorConfig): Plugin {
    if (!config.storyContext?.storyId) {
      return createCodexHighlightingPlugin({ codexEntries: [] });
    }

    const codex = this.codexService.getCodex(config.storyContext.storyId);
    let codexEntries: CodexEntry[] = [];
    
    if (codex) {
      codexEntries = this.extractAllCodexEntries(codex);
    }

    // Subscribe to codex changes for future updates
    this.codexService.codex$.subscribe(codexMap => {
      const updatedCodex = codexMap.get(config.storyContext!.storyId!);
      if (updatedCodex) {
        // Future: Handle dynamic updates
        this.extractAllCodexEntries(updatedCodex);
      }
    });

    return createCodexHighlightingPlugin({ 
      codexEntries,
      storyId: config.storyContext.storyId
    });
  }

  private createCodexHighlightingPluginForStory(storyId: string): Plugin {
    const codex = this.codexService.getCodex(storyId);
    let codexEntries: CodexEntry[] = [];
    
    if (codex) {
      codexEntries = this.extractAllCodexEntries(codex);
    }

    return createCodexHighlightingPlugin({ 
      codexEntries,
      storyId
    });
  }

  updateCodexHighlighting(view: EditorView | null, entries: CodexEntry[]): void {
    if (view) {
      updateCodexHighlightingPlugin(view, entries);
    }
  }

  private extractAllCodexEntries(codex: import('../../stories/models/codex.interface').Codex): CodexEntry[] {
    const allEntries: CodexEntry[] = [];
    
    codex.categories.forEach(category => {
      if (category.entries) {
        allEntries.push(...category.entries);
      }
    });
    
    return allEntries;
  }
}