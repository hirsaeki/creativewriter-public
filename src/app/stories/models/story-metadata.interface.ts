/**
 * Story Metadata Index - Lightweight preview data for story list
 *
 * This interface represents a centralized index document that contains
 * preview information for all user stories, eliminating the need to
 * sync full story documents when viewing the story list.
 */

/**
 * Centralized index document containing preview data for all user stories.
 * Stored as a single document to minimize sync overhead.
 *
 * Database: One per user database
 * Document ID: 'story-metadata-index'
 * Sync: Always synced (lightweight, ~500KB for 50 stories)
 */
export interface StoryMetadataIndex {
  _id: 'story-metadata-index';  // Fixed ID - one per user database
  _rev?: string;
  type: 'story-metadata-index';
  lastUpdated: Date;
  stories: StoryMetadata[];
}

/**
 * Lightweight preview data for a single story.
 * Contains just enough information to display in the story list.
 *
 * Size: ~5-10KB per story (vs. 100-500KB for full story document)
 */
export interface StoryMetadata {
  // Core identifiers
  id: string;
  title: string;

  // Visual preview
  coverImageThumbnail?: string;  // Base64 encoded, compressed to max 200x200px, ~50KB

  // Text preview - first 5 lines or first 200 characters
  previewText: string;

  // Statistics for display
  chapterCount: number;
  sceneCount: number;
  wordCount: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Custom ordering
  order?: number;

  // Last modification tracking for sync conflict resolution
  lastModifiedBy?: {
    deviceId: string;
    deviceName: string;
    timestamp: Date;
  };
}

/**
 * Type guard to check if a document is a StoryMetadataIndex
 */
export function isStoryMetadataIndex(doc: { type?: string; _id?: string }): doc is StoryMetadataIndex {
  return doc._id === 'story-metadata-index' && doc.type === 'story-metadata-index';
}
