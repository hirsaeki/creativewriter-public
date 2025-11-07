# Story Metadata Index Specification

**Date:** 2025-11-07
**Status:** Proposed Architecture
**Priority:** High - Builds on selective sync implementation

---

## Overview

Implement a lightweight "Story Metadata Index" document that contains preview information for all stories. This eliminates the need to sync full story documents when viewing the story list, dramatically reducing memory usage and sync time.

---

## Current Problem

With the current selective sync implementation:
- **Story List View:** `setActiveStoryId(null)` → syncs ALL stories
- **Issue:** If user has 50 stories, all 50 full documents (100-500KB each) must sync
- **Total:** 5-25MB of data to display a simple list
- **Mobile Impact:** High memory usage, slow initial load

---

## Proposed Solution

### Architecture

Create a single **Story Metadata Index** document that contains:
- Story ID
- Title
- Cover image (thumbnail, not full resolution)
- Preview text (first 5 lines or ~200 characters)
- Last modified timestamp
- Chapter/scene count
- Word count

**Key Benefits:**
- Only ONE document syncs for story list (vs. ALL stories)
- Index size: ~5-10KB per story × 50 stories = 250-500KB total
- **90-98% reduction** in data transfer for story list view
- **Instant** story list loading on mobile

---

## Data Model

### Story Metadata Index Document

```typescript
/**
 * Centralized index document containing preview data for all user stories.
 * Stored as a single document to minimize sync overhead.
 */
export interface StoryMetadataIndex {
  _id: 'story-metadata-index';  // Fixed ID - one per user database
  _rev?: string;
  type: 'story-metadata-index';
  lastUpdated: Date;
  stories: StoryMetadata[];
}

/**
 * Lightweight preview data for a single story
 */
export interface StoryMetadata {
  id: string;
  title: string;

  // Cover image - compressed thumbnail (max 50KB)
  coverImageThumbnail?: string;  // Base64 encoded, max 200x200px

  // Preview text - first 5 lines or first 200 characters
  previewText: string;

  // Statistics for display
  chapterCount: number;
  sceneCount: number;
  wordCount: number;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  order?: number;  // Custom sort order

  // Last modification tracking
  lastModifiedBy?: {
    deviceId: string;
    deviceName: string;
    timestamp: Date;
  };
}
```

---

## Implementation Plan

### Phase 1: Create Metadata Index Service

**File:** `src/app/stories/services/story-metadata-index.service.ts`

```typescript
@Injectable({
  providedIn: 'root'
})
export class StoryMetadataIndexService {
  private db: PouchDB.Database;
  private metadataCache: StoryMetadataIndex | null = null;

  /**
   * Get the metadata index (from cache or database)
   */
  async getMetadataIndex(): Promise<StoryMetadataIndex> {
    if (this.metadataCache) {
      return this.metadataCache;
    }

    try {
      const doc = await this.db.get<StoryMetadataIndex>('story-metadata-index');
      this.metadataCache = doc;
      return doc;
    } catch (err) {
      if (err.status === 404) {
        // Index doesn't exist - create it
        return await this.rebuildIndex();
      }
      throw err;
    }
  }

  /**
   * Update a single story's metadata in the index
   */
  async updateStoryMetadata(story: Story): Promise<void> {
    const index = await this.getMetadataIndex();

    // Find existing entry or add new
    const existingIndex = index.stories.findIndex(s => s.id === story.id);
    const metadata = this.extractMetadata(story);

    if (existingIndex >= 0) {
      index.stories[existingIndex] = metadata;
    } else {
      index.stories.push(metadata);
    }

    index.lastUpdated = new Date();

    // Save to database
    await this.db.put(index);
    this.metadataCache = index;
  }

  /**
   * Remove a story from the index
   */
  async removeStoryMetadata(storyId: string): Promise<void> {
    const index = await this.getMetadataIndex();
    index.stories = index.stories.filter(s => s.id !== storyId);
    index.lastUpdated = new Date();
    await this.db.put(index);
    this.metadataCache = index;
  }

  /**
   * Rebuild entire index from all stories in database
   */
  async rebuildIndex(): Promise<StoryMetadataIndex> {
    const stories = await this.storyService.getAllStories();

    const index: StoryMetadataIndex = {
      _id: 'story-metadata-index',
      type: 'story-metadata-index',
      lastUpdated: new Date(),
      stories: stories.map(s => this.extractMetadata(s))
    };

    await this.db.put(index);
    this.metadataCache = index;
    return index;
  }

  /**
   * Extract metadata from full story document
   */
  private extractMetadata(story: Story): StoryMetadata {
    // Get preview text from first scene
    const previewText = this.getPreviewText(story);

    // Generate thumbnail from cover image if present
    const coverImageThumbnail = story.coverImage
      ? this.generateThumbnail(story.coverImage)
      : undefined;

    return {
      id: story.id,
      title: story.title,
      coverImageThumbnail,
      previewText,
      chapterCount: story.chapters?.length || 0,
      sceneCount: this.countScenes(story),
      wordCount: this.storyStatsService.calculateTotalStoryWordCount(story),
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
      order: story.order,
      lastModifiedBy: story.lastModifiedBy
    };
  }

  /**
   * Extract first 5 lines or 200 characters from story
   */
  private getPreviewText(story: Story): string {
    if (!story.chapters || story.chapters.length === 0) {
      return '';
    }

    const firstChapter = story.chapters[0];
    if (!firstChapter.scenes || firstChapter.scenes.length === 0) {
      return '';
    }

    const firstScene = firstChapter.scenes[0];
    const content = firstScene.content || '';

    // Strip HTML tags
    const text = content.replace(/<[^>]*>/g, '');

    // Get first 5 lines
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const first5Lines = lines.slice(0, 5).join('\n');

    // Truncate to 200 characters if longer
    if (first5Lines.length > 200) {
      return first5Lines.substring(0, 197) + '...';
    }

    return first5Lines;
  }

  /**
   * Generate thumbnail from full cover image
   */
  private generateThumbnail(base64Image: string): string {
    // TODO: Implement image resizing to 200x200px max
    // For now, return original (implement in Phase 2)
    return base64Image;
  }

  private countScenes(story: Story): number {
    return story.chapters?.reduce((total, ch) =>
      total + (ch.scenes?.length || 0), 0
    ) || 0;
  }
}
```

---

### Phase 2: Update StoryService

**File:** `src/app/stories/services/story.service.ts`

Modify to update metadata index on every story change:

```typescript
async createStory(story: Story): Promise<void> {
  // ... existing create logic ...

  // Update metadata index
  await this.metadataIndexService.updateStoryMetadata(story);
}

async updateStory(story: Story): Promise<void> {
  // ... existing update logic ...

  // Update metadata index
  await this.metadataIndexService.updateStoryMetadata(story);
}

async deleteStory(storyId: string): Promise<void> {
  // ... existing delete logic ...

  // Remove from metadata index
  await this.metadataIndexService.removeStoryMetadata(storyId);
}
```

---

### Phase 3: Update StoryListComponent

**File:** `src/app/stories/components/story-list/story-list.component.ts`

Change to load from metadata index instead of all stories:

```typescript
async loadStories(): Promise<void> {
  try {
    // NEW: Load from metadata index instead of all stories
    const metadataIndex = await this.metadataIndexService.getMetadataIndex();

    // Convert metadata to story list display format
    this.stories = metadataIndex.stories.map(meta => ({
      id: meta.id,
      title: meta.title,
      coverImage: meta.coverImageThumbnail,
      previewText: meta.previewText,
      chapterCount: meta.chapterCount,
      sceneCount: meta.sceneCount,
      wordCount: meta.wordCount,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      order: meta.order,
      // Note: Full story data not loaded
      chapters: [] // Empty - will load on demand
    }));

    this.isLoadingStories = false;
  } catch (error) {
    console.error('Error loading story metadata:', error);
    // Fallback: rebuild index from all stories
    await this.metadataIndexService.rebuildIndex();
    await this.loadStories(); // Retry
  }
}
```

---

### Phase 4: Update DatabaseService Sync Filter

**File:** `src/app/core/services/database.service.ts`

Modify filter to always sync the metadata index:

```typescript
filter: (doc: PouchDB.Core.Document<Record<string, unknown>>) => {
  const docType = (doc as { type?: string }).type;
  const docId = doc._id;

  // Always exclude snapshots
  if (docType === 'story-snapshot') {
    return false;
  }

  // ALWAYS sync the story metadata index (lightweight)
  if (docId === 'story-metadata-index') {
    return true;
  }

  // If no active story is set, DON'T sync individual stories
  // (they're not needed - we have the metadata index)
  if (!this.activeStoryId) {
    // Only sync user-wide documents when no active story
    const userWideTypes = ['custom-background', 'video', 'image-video-association'];
    return docType && userWideTypes.includes(docType);
  }

  // SELECTIVE SYNC ENABLED: Only sync active story and related documents

  // 1. Sync the active story document (stories have no type field)
  if (!docType && docId === this.activeStoryId) {
    return true;
  }

  // 2. Sync codex for the active story
  const storyId = (doc as { storyId?: string }).storyId;
  if (docType === 'codex' && storyId === this.activeStoryId) {
    return true;
  }

  // 3. Sync user-wide documents (not story-specific)
  const userWideTypes = ['custom-background', 'video', 'image-video-association'];
  if (docType && userWideTypes.includes(docType)) {
    return true;
  }

  // 4. Exclude all other documents (other stories, their codex entries, etc.)
  return false;
}
```

---

### Phase 5: Add Sync Indicator When Opening Story

**File:** `src/app/stories/components/story-editor/story-editor.component.ts`

Add busy indicator during story load:

```typescript
async loadStory(storyId: string) {
  // Show loading indicator
  this.isLoadingStory = true;
  this.loadingMessage = 'Syncing story...';

  try {
    // Set active story for sync
    this.databaseService.setActiveStoryId(storyId);

    // Wait for sync to complete (or timeout after 5 seconds)
    await this.waitForStorySynced(storyId, 5000);

    // Load story from local database
    await this.editorState.loadStory(storyId);

    this.loadingMessage = undefined;
    this.isLoadingStory = false;
  } catch (error) {
    console.error('Error loading story:', error);
    this.loadingMessage = 'Error loading story';
    // Still try to load from local cache
    await this.editorState.loadStory(storyId);
    this.isLoadingStory = false;
  }
}

/**
 * Wait for story to be synced (or timeout)
 */
private async waitForStorySynced(storyId: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      sub.unsubscribe();
      resolve(); // Timeout - proceed anyway
    }, timeoutMs);

    const sub = this.databaseService.syncStatus$.subscribe(status => {
      // Check if sync completed for our story
      if (!status.isSync && status.lastSync) {
        clearTimeout(timeout);
        sub.unsubscribe();
        resolve();
      }
    });
  });
}
```

**Template:** `story-editor.component.html`

```html
<!-- Loading indicator -->
<div *ngIf="isLoadingStory" class="loading-overlay">
  <ion-spinner></ion-spinner>
  <p>{{ loadingMessage || 'Loading story...' }}</p>
</div>
```

---

## Migration Strategy

### Step 1: Add Metadata Index Support (Non-Breaking)

1. Create `StoryMetadataIndexService`
2. Automatically create/update index on story changes
3. Don't change story list yet - still loads full stories
4. **Result:** Index builds in background, no user impact

### Step 2: Update Story List (Gradual Rollout)

1. Add feature flag: `useMetadataIndex: boolean`
2. When enabled, load from index instead of full stories
3. Test with subset of users
4. **Result:** Opt-in testing

### Step 3: Full Deployment

1. Enable for all users
2. Remove old story list loading code
3. Add automatic index rebuild on app startup if missing
4. **Result:** All users benefit from optimization

---

## Performance Comparison

### Before (Current Selective Sync)

**Story List View:**
- Syncs: ALL stories (50 stories × 200KB avg = 10MB)
- Time: 5-10 seconds on mobile
- Memory: 400-600MB
- UI: Slow, laggy scrolling

**Story Editor View:**
- Syncs: Active story only (~200KB)
- Time: 500ms-1s
- Memory: 200-300MB
- UI: Responsive

### After (Metadata Index)

**Story List View:**
- Syncs: Metadata index (500KB) + user-wide docs (1-2MB) = ~2.5MB
- Time: 1-2 seconds on mobile
- Memory: 100-150MB (80% reduction!)
- UI: Fast, smooth scrolling

**Story Editor View:**
- Syncs: Active story (~200KB)
- Time: 500ms-1s (with sync indicator)
- Memory: 200-300MB
- UI: Responsive with clear feedback

---

## Implementation Checklist

### Core Services
- [ ] Create `StoryMetadataIndexService`
- [ ] Implement `extractMetadata()` logic
- [ ] Implement `getPreviewText()` (first 5 lines)
- [ ] Implement `generateThumbnail()` (image resize)
- [ ] Add index update hooks in `StoryService`

### Sync Integration
- [ ] Update `DatabaseService` sync filter
- [ ] Always sync metadata index document
- [ ] Don't sync individual stories when at list view

### UI Updates
- [ ] Update `StoryListComponent` to load from index
- [ ] Add sync indicator to story editor
- [ ] Implement `waitForStorySynced()` logic
- [ ] Add loading states and error handling

### Migration & Testing
- [ ] Add feature flag for gradual rollout
- [ ] Create index rebuild utility
- [ ] Test with 10, 50, 100 stories
- [ ] Test on low-end mobile devices
- [ ] Test offline → online sync scenarios

### Documentation
- [ ] Update user documentation
- [ ] Add developer notes
- [ ] Document index rebuild procedure

---

## Edge Cases & Considerations

### 1. Index Out of Sync
**Problem:** Index doesn't reflect latest story changes
**Solution:**
- Auto-rebuild on app startup if lastUpdated is stale
- Add "Rebuild Index" button in settings
- Automatic verification: compare index count vs actual story count

### 2. Large Cover Images
**Problem:** Thumbnails still too large
**Solution:**
- Implement canvas-based image resizing (max 200x200px)
- JPEG compression at 60% quality
- Target: < 50KB per thumbnail

### 3. Story Preview Text Changes
**Problem:** User edits first scene, preview outdated
**Solution:**
- Update index on every save
- Use debounced update (after 5 seconds of no changes)

### 4. Multi-Device Conflicts
**Problem:** Index conflicts between devices
**Solution:**
- Use CouchDB conflict resolution
- Rebuild from source of truth (actual stories) on conflict
- Winner: Most recent lastUpdated timestamp

### 5. Initial Sync (New Device)
**Problem:** New device has no stories or index
**Solution:**
- Server always has metadata index
- First sync downloads index (fast)
- Stories load on-demand when opened

---

## Performance Targets

### Story List Load Time
- **Before:** 5-10 seconds (50 stories)
- **After:** 1-2 seconds (any number of stories)
- **Target:** < 2 seconds on 3G mobile

### Memory Usage (Story List)
- **Before:** 400-600MB
- **After:** 100-150MB
- **Target:** < 200MB

### Sync Data Volume (Story List)
- **Before:** 5-25MB (all stories)
- **After:** 500KB-2MB (index + user docs)
- **Target:** < 3MB

### User Experience
- **Before:** Long wait, no feedback, possible crash
- **After:** Fast load, clear sync indicator, stable
- **Target:** Instant feel, < 3 seconds max

---

## Future Enhancements

### Incremental Index Updates
Instead of rebuilding entire index, apply delta updates:
```typescript
// Only update changed stories
await this.metadataIndexService.updateStoryMetadata(changedStory);
```

### Server-Side Index Generation
CouchDB design document to maintain index automatically:
```javascript
// CouchDB view
function(doc) {
  if (doc.chapters) {
    emit('story-metadata-index', {
      id: doc._id,
      title: doc.title,
      preview: extractPreview(doc),
      // ...
    });
  }
}
```

### Pagination Support
For users with 500+ stories:
```typescript
interface StoryMetadataIndex {
  stories: StoryMetadata[];
  pagination: {
    total: number;
    pageSize: number;
    pages: number;
  };
}
```

---

## Conclusion

The Story Metadata Index is a critical optimization that:
- **Eliminates** the need to sync all stories for list view
- **Reduces** memory usage by 75-80% on story list
- **Improves** load time from 5-10s to 1-2s
- **Enables** smooth scrolling through large story collections
- **Provides** clear user feedback during story loading

This builds on the selective sync implementation and addresses the remaining performance bottleneck: loading the story list itself.

**Recommended Next Steps:**
1. Implement core `StoryMetadataIndexService`
2. Add update hooks to `StoryService`
3. Test with feature flag
4. Roll out to all users

---

**Status:** Ready for implementation
**Estimated Effort:** 2-3 days
**Expected Impact:** 75-80% memory reduction for story list view
