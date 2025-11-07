# Creative Writer - Sync Architecture & Database Design Summary

## Overview
The Creative Writer application implements a sophisticated distributed synchronization system using PouchDB (IndexedDB) on the client and CouchDB on the server, with user-specific databases and device-agnostic architecture.

---

## 1. CORE SYNC SERVICES & DATABASE INFRASTRUCTURE

### Primary Database Service
**Location:** `/home/nos/dev/creativewriter/src/app/core/services/database.service.ts`

**Key Responsibilities:**
- Manages PouchDB local database initialization and lifecycle
- Handles user-specific database switching on login/logout
- Implements bidirectional sync with CouchDB remote
- Monitors online/offline status
- Tracks and reports sync progress and errors
- Manages database compaction and cleanup

**Database Configuration:**
- Local: PouchDB via IndexedDB (browser-based storage)
- Remote: CouchDB (HTTP-based, REST API)
- Default anonymous database: `creative-writer-stories-anonymous`
- User-specific databases: `creative-writer-stories-{username}` (sanitized to lowercase alphanumeric)

**Sync Architecture:**
```typescript
// Bidirectional continuous sync with filtering
const handler = this.db.sync(this.remoteDb, {
  live: true,           // Continuous sync
  retry: true,          // Auto-retry on failures
  timeout: 30000,       // 30 second timeout
  filter: (doc) => {    // Filter out snapshots (server-only)
    return doc.type !== 'story-snapshot';
  }
});
```

---

## 2. STORY & DATA MODEL INTERFACES

### Story Model
**Location:** `/home/nos/dev/creativewriter/src/app/stories/models/story.interface.ts`

**Story Document Structure:**
```typescript
export interface Story {
  _id?: string;                    // PouchDB document ID
  _rev?: string;                   // PouchDB revision for conflict resolution
  id: string;                      // Duplicate field for legacy support
  title: string;
  chapters: Chapter[];             // Chapter/Scene structure
  settings?: StorySettings;        // Story-specific AI settings
  codexId?: string;                // Link to character codex
  coverImage?: string;             // Base64 encoded or URL
  order?: number;                  // Custom sort order
  schemaVersion?: number;          // Migration tracking (current: 1)
  createdAt: Date;
  updatedAt: Date;
  content?: string;                // Legacy support
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  chapterNumber: number;
  scenes: Scene[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Scene {
  id: string;
  title: string;
  content: string;                 // Editor content (HTML/ProseMirror)
  summary?: string;                // AI-generated summary
  summaryGeneratedAt?: Date;
  order: number;
  sceneNumber: number;
  createdAt: Date;
  updatedAt: Date;
}
```

**Story Settings:**
```typescript
export interface StorySettings {
  systemMessage: string;           // Claude system prompt
  beatGenerationTemplate: string;  // AI prompt template
  useFullStoryContext: boolean;    // Story context depth
  beatInstruction: 'continue' | 'stay';
  language?: 'en' | 'de' | 'fr' | 'es' | 'custom';
  favoriteModels: string[];        // Legacy quick access
  favoriteModelLists: {            // Structured favorites per feature
    beatInput: string[];
    sceneSummary: string[];
    rewrite: string[];
  };
}
```

**Schema Versioning:**
- Current version: `CURRENT_SCHEMA_VERSION = 1`
- Auto-migration on story load
- Handles legacy `content` field migration to chapter/scene structure
- Beat ID migration from `data-id` to `data-beat-id`

---

## 3. STORY SERVICE

**Location:** `/home/nos/dev/creativewriter/src/app/stories/services/story.service.ts`

**Operations:**
- `getAllStories()` - Fetch all stories with pagination
- `getTotalStoriesCount()` - Lightweight count using allDocs
- `getStory(id)` - Retrieve by _id or id field
- `createStory(language)` - Create with language-specific templates
- `updateStory()` - Update and sync to remote
- `deleteStory()` - Remove story and associated beat histories
- Chapter/Scene CRUD operations
- Story reordering with order field
- Preview generation and word counting with caching

**Performance Optimizations:**
- Preview and word count caching with cache invalidation
- Lazy database reference loading (prevents race conditions)
- Uses `allDocs()` instead of `find()` for better performance
- Filters out design docs and non-story documents
- Auto-migration handling

---

## 4. USER AUTHENTICATION & DATABASE SWITCHING

**Location:** `/home/nos/dev/creativewriter/src/app/core/services/auth.service.ts`

**User Model:**
```typescript
export interface User {
  username: string;              // Sanitized to lowercase alphanumeric
  displayName?: string;          // User-friendly display name
  lastLogin: Date;
}
```

**Authentication Modes:**
1. **Named User**: Creates database `creative-writer-stories-{username}`
2. **Local-Only Mode**: Uses `creative-writer-stories-anonymous` (no sync)
3. **Automatic Username Sanitization**: `[^a-z0-9_-]` filtered

**Database Switching:**
- Triggered by `currentUser$` observable subscription
- Stops current sync before switching
- Closes old database safely
- Initializes new database in background

---

## 5. CHANGE TRACKING & SYNC STATUS

**Location:** `/home/nos/dev/creativewriter/src/app/core/services/database.service.ts`

**Sync Status Observable:**
```typescript
export interface SyncStatus {
  isOnline: boolean;              // Navigator online status
  isSync: boolean;                // Currently syncing
  isConnecting?: boolean;         // Connecting to remote
  lastSync?: Date;                // Last successful sync
  error?: string;                 // Sync error message
  syncProgress?: {
    docsProcessed: number;
    totalDocs?: number;
    operation: 'push' | 'pull';
    currentDoc?: {
      id: string;
      type?: string;
      title?: string;
    };
    pendingDocs?: number;
  };
}
```

**Sync Events Tracked:**
- `change` - Documents synchronized (push/pull)
- `active` - Sync started, pending documents count
- `paused` - Sync caught up, waiting for changes
- `error` - Sync error occurred

**Document Filtering:**
- Automatically filters out `story-snapshot` documents (server-only)
- Snapshots accessed via separate HTTP service
- Ensures small local database footprint

---

## 6. MANUAL SYNC & REPLICATION

**Location:** `/home/nos/dev/creativewriter/src/app/core/services/database.service.ts`

**Methods:**
- `forcePush()` - Manual push to remote
- `forcePull()` - Manual pull from remote
- Progress tracking with document-level details
- 60-second timeout protection
- Sync logging and error handling

**Replication Process:**
```
1. Verify remote database connection
2. Create replication handler (push/pull)
3. Track progress by counting documents
4. Extract current document metadata
5. Update sync status and UI
6. Log operation with duration/itemCount
7. Handle timeout/errors gracefully
```

---

## 7. DEVICE IDENTIFICATION & TRACKING

**Current Implementation:** MINIMAL/NONE (Device-Agnostic Design)

**Where Device Info Would Go:**
- User database name already encodes user identity
- No explicit device ID field in current implementation
- Snapshots include optional `userId` field (unused)
- Version service tracks app version, not device version

**No Device-Specific Metadata Stored:**
- Stories are user-specific, not device-specific
- Sync works across all devices for same user
- No device registration or tracking system
- Anonymous mode supports local-only operation

**Potential Areas for Device Tracking (if needed):**
- BeatVersionHistory has `userId` field (not populated)
- StorySnapshot has `userId` field (populated from auth)
- SyncLog has optional `userId` field
- Could extend with `deviceId` field in future

---

## 8. VERSION HISTORY & REVISION TRACKING

### Beat Version History Service
**Location:** `/home/nos/dev/creativewriter/src/app/shared/services/beat-history.service.ts`

**Purpose:** Track multiple AI-generated versions of beat content

**Storage:**
- Separate local database: `beat-histories`
- NOT synced with main story database
- Local-only for performance

**Beat Version Structure:**
```typescript
export interface BeatVersion {
  versionId: string;               // Format: 'v-{timestamp}-{random}'
  content: string;                 // Full HTML content
  prompt: string;                  // User prompt used
  model: string;                   // AI model used
  beatType: 'story' | 'scene';     // Context type
  wordCount: number;
  generatedAt: Date;
  characterCount: number;
  isCurrent: boolean;              // Currently active
  selectedScenes?: Array<{         // Context scenes
    sceneId: string;
    chapterId: string;
  }>;
  includeStoryOutline?: boolean;
  action?: 'generate' | 'rewrite';
  existingText?: string;           // For rewrites
}

export interface BeatVersionHistory {
  _id: string;                     // Format: 'history-{beatId}'
  _rev?: string;
  type: 'beat-history';
  beatId: string;
  storyId: string;
  userId?: string;                 // Not currently populated
  versions: BeatVersion[];         // Max 10, auto-pruned
  createdAt: Date;
  updatedAt: Date;
}
```

**Version Management:**
- Maximum 10 versions per beat (auto-pruned)
- In-memory cache with 5-minute TTL
- Lazy loading (only loaded when requested)
- Can mark any version as current
- Delete old versions keeping only N most recent

**Operations:**
- `saveVersion()` - Add new version, auto-prune
- `getHistory()` - Load beat history with caching
- `setCurrentVersion()` - Mark version as active
- `deleteHistory()` - Remove all versions for beat
- `deleteOldVersions()` - Keep only N recent versions
- `deleteAllHistoriesForStory()` - Cleanup on story delete
- `getHistoryStats()` - Storage usage statistics

---

## 9. SNAPSHOTS - SERVER-SIDE POINT-IN-TIME BACKUPS

**Location:** `/home/nos/dev/creativewriter/src/app/stories/services/snapshot.service.ts`

**Purpose:** Automatic point-in-time backups stored server-side only

**Snapshot Model:**
```typescript
export interface StorySnapshot {
  _id: string;                     // Format: 'snapshot-{storyId}-{timestamp}-{type}'
  _rev?: string;
  type: 'story-snapshot';          // Filtered from PouchDB sync
  storyId: string;
  userId: string;                  // User who owns snapshot
  createdAt: string;               // ISO format
  retentionTier: 'granular' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'manual';
  expiresAt?: string;              // Auto-expiry date
  snapshotType: 'auto' | 'manual';
  triggeredBy: 'scheduler' | 'user' | 'event';
  reason?: string;

  snapshot: {                      // Story state at snapshot time
    title: string;
    chapters: Chapter[];
    settings?: StorySettings;
    updatedAt: Date | string;
  };

  metadata: {
    wordCount: number;
    chapterCount: number;
    sceneCount: number;
  };
}
```

**Retention Tiers:**
- `granular` - Last 4 hours (15-minute intervals)
- `hourly` - Last 24 hours
- `daily` - Last 30 days
- `weekly` - Last 12 weeks
- `monthly` - Last 12 months
- `manual` - User-created, permanent until deleted

**Sync Filtering:**
Snapshots excluded from PouchDB sync:
```typescript
filter: (doc) => doc.type !== 'story-snapshot'
```

**Operations:**
- `getSnapshotsForStory()` - HTTP query to CouchDB view
- `getSnapshotTimeline()` - Organized by retention tier
- `getSnapshot()` - Fetch individual snapshot
- `restoreFromSnapshot()` - Restore story from snapshot
- `createManualSnapshot()` - User-initiated backup
- `deleteSnapshot()` - Remove snapshot
- `checkSnapshotAvailability()` - Verify CouchDB connection

---

## 10. SYNC LOGGING & OPERATION TRACKING

**Location:** `/home/nos/dev/creativewriter/src/app/core/services/sync-logger.service.ts`

**Sync Log Structure:**
```typescript
export interface SyncLog {
  id: string;                      // 'sync-{timestamp}-{random}'
  timestamp: Date;
  type: 'upload' | 'download' | 'conflict' | 'error' | 'info';
  action: string;                  // Description
  details?: string;                // Error/conflict details
  userId?: string;                 // User involved
  itemCount?: number;              // Documents processed
  duration?: number;               // Operation duration (ms)
  status: 'success' | 'error' | 'warning' | 'info';
}
```

**Storage:**
- localStorage key: `creative-writer-sync-logs`
- Maximum 100 most recent logs
- Persisted to localStorage

**Helper Methods:**
- `logUpload(itemCount, userId, duration)` 
- `logDownload(itemCount, userId, duration)`
- `logConflict(details, userId)`
- `logError(error, userId)`
- `logInfo(action, details, userId)`
- `updateLog(logId, updates)` - Update existing log
- `clearLogs()` - Clear all logs

---

## 11. DATABASE MAINTENANCE & CLEANUP

**Location:** `/home/nos/dev/creativewriter/src/app/core/services/database.service.ts`

**Maintenance Operations:**

**Compaction:**
```typescript
async compact(): Promise<void>
// Removes deleted document revisions, reduces storage
```

**MrView Database Cleanup:**
- Automatically cleans old IndexedDB mrview (materialized view) databases
- Runs in background during database initialization
- Only removes old mrview databases, NEVER user data
- Safe: can be recreated by PouchDB if needed
- Distinguishes between:
  - Current user's mrview: preserved
  - Old user's mrview: cleaned
  - Beat histories mrview: preserved
  - Other mrview: cleaned

**Storage Monitoring:**
```typescript
async getDatabaseSize(): Promise<{ used, quota, percentage }>
async checkStorageHealth(): Promise<{ healthy, message }>
```

**Missing Story Detection:**
```typescript
async checkForMissingStories(): Promise<{
  hasMissing: boolean;
  localCount: number;
  remoteCount: number;
}>
// Compares local vs remote story counts
```

---

## 12. DOCUMENT FILTERING & COUNTING

**Location:** `/home/nos/dev/creativewriter/src/app/shared/utils/document-filters.ts`

**Story Document Identification:**
Stories are identified by:
- NO `type` field (all non-story docs have type)
- HAS `chapters` array
- HAS `_id` or `id` field

**Non-Story Document Types:**
- `codex` - Character/world building
- `video` - Video references
- `image-video-association` - Media links
- `beat-history` - Beat version history
- `story-snapshot` - Point-in-time backup

---

## 13. NETWORK & SYNC CONFIGURATION

**CouchDB Connection:**
```typescript
// Remote database setup
this.remoteDb = new Pouch(couchUrl, {
  auth: {
    username: 'admin',
    password: 'password'  // TODO: Make configurable
  }
});
```

**URL Detection Logic:**
- Development (localhost): Direct port 5984
- Reverse proxy setup (nginx): `/_db/` path prefix
- Dynamic database name: User-specific or anonymous

**Online/Offline Detection:**
- Monitors `window.online` and `window.offline` events
- Updates sync status accordingly
- Allows graceful sync resumption on reconnect

---

## 14. KEY ARCHITECTURAL PATTERNS

### 1. User-Specific Databases
Each user has isolated database with private sync:
```
User A: creative-writer-stories-alice
User B: creative-writer-stories-bob
Anonymous: creative-writer-stories-anonymous
```

### 2. Bidirectional Live Sync
- Continuous sync with automatic retry
- Filtered to exclude server-only documents
- Progress tracking with document details
- Graceful error handling

### 3. Multi-Tier Storage
- **PouchDB (Local)**: Stories, chapters, scenes, codex, beat history
- **CouchDB (Remote)**: Same as local + snapshots (filtered from sync)
- **Local Storage**: Sync logs, user session, settings
- **Memory**: Caches for preview/word count, beat history

### 4. Schema Versioning
- Stories tracked with schema version
- Auto-migration on load
- Backward compatibility maintained

### 5. Device-Agnostic
- No device ID required
- User-centric data model
- Cross-device sync via user database
- Local-only mode option

---

## 15. SYNC FLOW DIAGRAM

```
┌─────────────────┐
│   User Login    │
└────────┬────────┘
         │
         v
┌──────────────────────────┐
│ Switch User Database     │
│ (Stop old, Init new)     │
└────────┬─────────────────┘
         │
         v
┌──────────────────────────┐
│ Initialize PouchDB       │
│ (Create indexes, etc)    │
└────────┬─────────────────┘
         │
         v
┌──────────────────────────┐
│ Setup Live Sync          │
│ (PouchDB <-> CouchDB)    │
└────────┬─────────────────┘
         │
         v
┌──────────────────────────┐
│ Monitor Sync Events      │
│ - change                 │
│ - active                 │
│ - paused                 │
│ - error                  │
└────────┬─────────────────┘
         │
         v
┌──────────────────────────┐
│ Update Sync Status       │
│ (Observable)             │
└──────────────────────────┘

┌──────────────────────────┐
│ Bidirectional Filtering  │
│ Snapshot docs blocked    │
│ from PouchDB sync        │
└──────────────────────────┘

┌──────────────────────────┐
│ Snapshot Service         │
│ (HTTP queries to        │
│  CouchDB, server-side)  │
└──────────────────────────┘
```

---

## 16. DATA STRUCTURE EXAMPLE

**Story Document in PouchDB:**
```json
{
  "_id": "story-abc123",
  "_rev": "3-g9c14f6e3522688191d1ea9d02e895c0",
  "type": undefined,                    // No type = story
  "id": "story-abc123",
  "title": "My Novel",
  "schemaVersion": 1,
  "chapters": [
    {
      "id": "ch-001",
      "title": "Chapter 1",
      "order": 1,
      "chapterNumber": 1,
      "scenes": [
        {
          "id": "sc-001",
          "title": "Scene 1",
          "content": "<p>Once upon a time...</p>",
          "order": 1,
          "sceneNumber": 1,
          "createdAt": "2024-01-01T10:00:00Z",
          "updatedAt": "2024-01-01T10:00:00Z"
        }
      ],
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  ],
  "settings": {
    "systemMessage": "You are a creative assistant...",
    "beatGenerationTemplate": "...",
    "useFullStoryContext": false,
    "beatInstruction": "continue",
    "language": "en",
    "favoriteModels": ["claude-opus"],
    "favoriteModelLists": {
      "beatInput": ["claude-opus"],
      "sceneSummary": [],
      "rewrite": []
    }
  },
  "order": 0,
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T12:30:00Z"
}
```

**Beat Version History (separate database):**
```json
{
  "_id": "history-beat-xyz789",
  "_rev": "2-e7c9d8b2f3a4c6e9",
  "type": "beat-history",
  "beatId": "beat-xyz789",
  "storyId": "story-abc123",
  "userId": "alice",
  "versions": [
    {
      "versionId": "v-1704110400000-a7b3c9",
      "content": "<p>The hero walked into...</p>",
      "prompt": "Continue the story with 100 words",
      "model": "claude-opus-4",
      "beatType": "story",
      "wordCount": 100,
      "characterCount": 645,
      "generatedAt": "2024-01-01T12:00:00Z",
      "isCurrent": false,
      "action": "generate"
    },
    {
      "versionId": "v-1704110500000-d2e4f1",
      "content": "<p>The protagonist strode into...</p>",
      "prompt": "Rewrite with more descriptive language",
      "model": "claude-opus-4",
      "beatType": "story",
      "wordCount": 100,
      "characterCount": 712,
      "generatedAt": "2024-01-01T12:05:00Z",
      "isCurrent": true,
      "action": "rewrite",
      "existingText": "<p>The hero walked into...</p>"
    }
  ],
  "createdAt": "2024-01-01T12:00:00Z",
  "updatedAt": "2024-01-01T12:05:00Z"
}
```

---

## 17. IMPORTANT FILES & LOCATIONS

### Core Services
- `/home/nos/dev/creativewriter/src/app/core/services/database.service.ts` - Main sync controller
- `/home/nos/dev/creativewriter/src/app/core/services/auth.service.ts` - User management
- `/home/nos/dev/creativewriter/src/app/core/services/sync-logger.service.ts` - Sync logging
- `/home/nos/dev/creativewriter/src/app/core/services/version.service.ts` - App version tracking

### Story Services
- `/home/nos/dev/creativewriter/src/app/stories/services/story.service.ts` - Story CRUD operations
- `/home/nos/dev/creativewriter/src/app/stories/services/snapshot.service.ts` - Snapshot management
- `/home/nos/dev/creativewriter/src/app/shared/services/beat-history.service.ts` - Version history
- `/home/nos/dev/creativewriter/src/app/shared/services/database-backup.service.ts` - Import/export

### Models & Interfaces
- `/home/nos/dev/creativewriter/src/app/stories/models/story.interface.ts` - Story structure
- `/home/nos/dev/creativewriter/src/app/stories/models/beat-version-history.interface.ts` - Version history
- `/home/nos/dev/creativewriter/src/app/core/models/settings.interface.ts` - Global settings

### Utilities
- `/home/nos/dev/creativewriter/src/app/shared/utils/document-filters.ts` - Document filtering

---

## 18. FUTURE ENHANCEMENT OPPORTUNITIES

1. **Device ID Tracking**: Add optional device identification for analytics
2. **Multi-Device Sync**: Track device names and sync state per device
3. **Conflict Resolution UI**: Visual diff for concurrent edits
4. **Selective Sync**: Choose which documents to sync
5. **Offline Snapshot**: Auto-save before going offline
6. **Revision History**: Full PouchDB revision tracking UI
7. **Sync Statistics**: Enhanced metrics and analytics
8. **Compression**: Reduce storage size with content compression

---

## SUMMARY

The Creative Writer sync architecture is a **user-centric, device-agnostic system** with:
- **Bidirectional live sync** between local PouchDB and remote CouchDB
- **User-specific databases** for data isolation and privacy
- **Server-side snapshots** for automatic point-in-time backups
- **Local-only beat history** for version comparison
- **Comprehensive logging** of all sync operations
- **Automatic background cleanup** of obsolete data
- **Schema versioning** for data migration
- **Graceful offline support** with automatic reconnection

Data integrity is maintained through PouchDB's conflict resolution mechanism, filter-based document management, and comprehensive error handling.
