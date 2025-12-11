import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { Node } from 'prosemirror-model';
import { CodexEntry } from '../../stories/models/codex.interface';

export interface CodexHighlightingOptions {
  codexEntries: CodexEntry[];
  storyId?: string;
}

const codexHighlightingKey = new PluginKey<DecorationSet>('codexHighlighting');

export function createCodexHighlightingPlugin(options: CodexHighlightingOptions): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: codexHighlightingKey,
    state: {
      init: (config, editorState) => {
        return findCodexMatches(editorState.doc, options.codexEntries);
      },
      apply: (tr, oldState, newState) => {
        // Only recalculate if document changed
        if (tr.docChanged) {
          return findCodexMatches(newState.doc, options.codexEntries);
        }
        return oldState;
      }
    },
    props: {
      decorations: (state) => {
        return codexHighlightingKey.getState(state);
      }
    }
  });
}

function findCodexMatches(doc: Node, codexEntries: CodexEntry[]): DecorationSet {
  const decorations: Decoration[] = [];
  
  if (!codexEntries || codexEntries.length === 0) {
    return DecorationSet.empty;
  }

  // Walk through the document to find text nodes
  doc.descendants((node: Node, pos: number) => {
    if (node.isText && node.text) {
      const text = node.text.toLowerCase();
      
      // Check each codex entry
      for (const entry of codexEntries) {
        // Check entry title
        const titleMatches = findWordMatches(text, entry.title.toLowerCase());
        for (const match of titleMatches) {
          const from = pos + match.start;
          const to = pos + match.end;
          
          decorations.push(
            Decoration.inline(from, to, {
              class: 'codex-highlight codex-title',
              title: `${entry.title} (Title)`,
              style: 'text-decoration: underline; text-decoration-style: dotted; text-decoration-color: #4dabf7; cursor: help;'
            })
          );
        }
        
        // Check entry tags
        if (entry.tags && entry.tags.length > 0) {
          for (const tag of entry.tags) {
            if (typeof tag === 'string') {
              const tagMatches = findWordMatches(text, tag.toLowerCase());
              for (const match of tagMatches) {
                const from = pos + match.start;
                const to = pos + match.end;
                
                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'codex-highlight codex-tag',
                    title: `${entry.title} - ${tag} (Tag)`,
                    style: 'text-decoration: underline; text-decoration-style: dotted; text-decoration-color: #51cf66; cursor: help;'
                  })
                );
              }
            }
          }
        }
      }
    }
    return true; // Continue traversing
  });

  return DecorationSet.create(doc, decorations);
}

function findWordMatches(text: string, searchTerm: string): { start: number, end: number }[] {
  const matches: { start: number, end: number }[] = [];
  const regex = new RegExp(`\\b${escapeRegex(searchTerm)}\\b`, 'gi');
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  return matches;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Function to update plugin with new codex entries
export function updateCodexHighlightingPlugin(view: EditorView | null, newCodexEntries: CodexEntry[]): void {
  // Guard: Check if view and view.state are valid (editor may be destroyed or not yet created)
  if (!view || !view.state) {
    return;
  }

  const plugin = codexHighlightingKey.get(view.state);
  if (plugin) {
    const newDecorations = findCodexMatches(view.state.doc, newCodexEntries);
    const tr = view.state.tr.setMeta(codexHighlightingKey, newDecorations);
    view.dispatch(tr);
  }
}