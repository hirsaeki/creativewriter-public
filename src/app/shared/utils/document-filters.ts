/**
 * Shared utility functions for filtering PouchDB documents
 */

/**
 * Determines if a document ID represents a story document.
 * Stories are documents that don't have special prefixes or start with underscore.
 *
 * @param id - The document ID to check
 * @returns true if the ID represents a story document, false otherwise
 *
 * @example
 * isStoryDocument('my-story-123') // returns true
 * isStoryDocument('_design/views') // returns false
 * isStoryDocument('video-abc123') // returns false
 * isStoryDocument('codex-xyz789') // returns false
 */
export function isStoryDocument(id: string): boolean {
  // Filter out all system documents (start with underscore)
  // This includes _design docs, _local docs (PouchDB internal state), and other system docs
  if (id.startsWith('_')) {
    return false;
  }

  // Filter out typed documents by ID pattern
  // These prefixes are used for non-story documents in the database
  if (id.match(/^(video|codex|image-video-association|beat-suggestion|beat-history)-/)) {
    return false;
  }

  return true;
}

/**
 * Filter an array of PouchDB rows to only include story documents
 *
 * @param rows - Array of PouchDB document rows to filter
 * @returns Filtered array containing only story document rows
 *
 * @example
 * const allRows = await db.allDocs();
 * const storyRows = filterStoryRows(allRows.rows);
 */
export function filterStoryRows<T extends { id: string }>(rows: T[]): T[] {
  return rows.filter(row => isStoryDocument(row.id));
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
