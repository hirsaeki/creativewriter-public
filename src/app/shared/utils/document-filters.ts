/**
 * Shared utility functions for filtering PouchDB documents
 */

/**
 * Determines if a document represents a story document.
 * Stories are documents that don't have a type field and have a chapters field.
 * This matches the filtering logic used in StoryService.
 *
 * @param doc - The document to check (with _id and optional type/chapters fields)
 * @returns true if the document represents a story, false otherwise
 *
 * @example
 * isStoryDocument({ _id: 'story-123', chapters: [] }) // returns true
 * isStoryDocument({ _id: '_design/views' }) // returns false
 * isStoryDocument({ _id: 'video-abc', type: 'video' }) // returns false
 * isStoryDocument({ _id: 'beat-history-xyz', type: 'beat-history' }) // returns false
 */
export function isStoryDocument(doc: { _id?: string; id?: string; type?: string; chapters?: unknown }): boolean {
  const docId = doc._id || doc.id;

  // Filter out all system documents (start with underscore)
  // This includes _design docs, _local docs (PouchDB internal state), and other system docs
  if (docId && docId.startsWith('_')) {
    return false;
  }

  // If document has a type field, it's not a story
  // Stories don't have a type field - other documents (video, codex, beat-history, etc.) do
  if (doc.type) {
    return false;
  }

  // Must have chapters field to be a story
  // This is the key identifier for story documents
  if (!doc.chapters) {
    return false;
  }

  return true;
}

/**
 * Filter an array of PouchDB rows to only include story documents
 * IMPORTANT: Requires rows to have the 'doc' field populated (use include_docs: true in allDocs)
 *
 * @param rows - Array of PouchDB document rows to filter (must have doc field)
 * @returns Filtered array containing only story document rows
 *
 * @example
 * const allRows = await db.allDocs({ include_docs: true });
 * const storyRows = filterStoryRows(allRows.rows);
 */
export function filterStoryRows<T extends { id: string; doc?: unknown }>(rows: T[]): T[] {
  return rows.filter(row => {
    if (!row.doc) {
      return false;
    }
    return isStoryDocument(row.doc as { _id?: string; id?: string; type?: string; chapters?: unknown });
  });
}

/**
 * Count the number of story documents in a PouchDB rows array
 *
 * @param rows - Array of PouchDB document rows to count
 * @returns Number of story documents
 *
 * @example
 * const allRows = await db.allDocs();
 * const storyCount = countStories(allRows.rows);
 */
export function countStories<T extends { id: string }>(rows: T[]): number {
  return filterStoryRows(rows).length;
}
