import { EditorState } from 'prosemirror-state';
import { Node as ProseMirrorNode } from 'prosemirror-model';

/**
 * Convert plain text content to HTML, preserving formatting like newlines
 */
export function convertTextToHtml(content: string): string {
  // Check if content already looks like HTML (contains paragraph or other block tags)
  if (/<(p|div|h[1-6]|ul|ol|li|blockquote)[\s>]/i.test(content)) {
    return content; // Already HTML, return as-is
  }

  // Plain text content - convert newlines to paragraphs
  // Split by double newlines for paragraph breaks, single newlines become <br> within paragraphs
  const paragraphs = content.split(/\n\n+/);

  return paragraphs
    .map(para => {
      // Trim the paragraph
      const trimmed = para.trim();
      if (!trimmed) return ''; // Skip empty paragraphs

      // Replace single newlines with <br> tags within the paragraph
      const withBreaks = trimmed.replace(/\n/g, '<br>');

      return `<p>${withBreaks}</p>`;
    })
    .filter(para => para.length > 0) // Remove empty paragraphs
    .join('');
}

/**
 * Find the position of the paragraph containing the given position
 */
export function findContainingParagraph(pos: number, state: EditorState): number | null {
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

/**
 * Find the position of the next beat node after the given start position
 */
export function findNextBeatPosition(startPos: number, state: EditorState): number | null {
  let nextBeatPos: number | null = null;

  state.doc.descendants((node, pos) => {
    if (pos < startPos) {
      return true;
    }

    if (node.type.name === 'beatAI') {
      nextBeatPos = pos;
      return false;
    }

    return true;
  });

  return nextBeatPos;
}

/**
 * Check if a node is generated content (paragraph after a beat node)
 */
export function isGeneratedContent(node: ProseMirrorNode): boolean {
  // For streaming, we consider all paragraphs after a beat node as generated content
  // until we hit another beat node or other special content
  return node.type.name === 'paragraph';
}

/**
 * Check if the editor state has any empty paragraphs
 */
export function hasEmptyParagraphs(state: EditorState): boolean {
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
