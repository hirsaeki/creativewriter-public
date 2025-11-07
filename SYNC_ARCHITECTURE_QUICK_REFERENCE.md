# Sync Architecture - Quick Reference Guide

## Key Services & File Locations

### Core Database & Sync Management
```
database.service.ts                 Main sync orchestrator
├─ Manages PouchDB/CouchDB sync
├─ User database switching
├─ Sync status monitoring
├─ Manual push/pull replication
├─ Storage cleanup
└─ Location: src/app/core/services/
```

### User Authentication
```
auth.service.ts                     User session & database name
├─ User login/logout
├─ Database name generation
├─ Local-only mode support
└─ Location: src/app/core/services/
```

### Story Management
```
story.service.ts                    Story CRUD operations
├─ getAllStories()
├─ createStory()
├─ updateStory()
├─ deleteStory()
├─ Chapter/Scene operations
└─ Location: src/app/stories/services/
```

### Specialized Tracking
```
beat-history.service.ts             AI generation version history
├─ saveVersion()
├─ getHistory()
├─ setCurrentVersion()
├─ Auto-prune (max 10 versions)
└─ Location: src/app/shared/services/

snapshot.service.ts                 Server-side backups
├─ getSnapshotsForStory()
├─ restoreFromSnapshot()
├─ createManualSnapshot()
└─ Location: src/app/stories/services/

sync-logger.service.ts              Operation tracking
├─ Log uploads/downloads
├─ Track errors/conflicts
└─ Location: src/app/core/services/
```

---

## Database Naming Conventions

### PouchDB/CouchDB Databases
```
creative-writer-stories-{username}   User-specific (sanitized username)
creative-writer-stories-anonymous    Anonymous/local-only mode
beat-histories                       Beat version history (local only)
```

### Document ID Patterns
```
story documents:           No 'type' field (identifier)
chapters:                  Within story.chapters array
scenes:                    Within chapter.scenes array
codex:                     { type: 'codex' }
videos:                    { type: 'video' }
beat history:              { _id: 'history-{beatId}', type: 'beat-history' }
snapshots:                 { _id: 'snapshot-{storyId}-{timestamp}...', type: 'story-snapshot' }
```

---

## Data Flow Diagram

```
USER INTERACTION
       │
       v
┌─────────────────────┐
│  Story Service      │
│  - CRUD operations  │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  Database Service   │
│  - Query PouchDB    │
│  - Trigger sync     │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  PouchDB (Local)    │
│  - IndexedDB        │
│  - Beat histories   │
└──────────┬──────────┘
           │
           v (live sync: live=true)
┌─────────────────────┐
│  CouchDB (Remote)   │
│  - HTTP REST API    │
│  - Snapshots        │
│  - Conflict res.    │
└─────────────────────┘
```

---

## Sync Mechanics at a Glance

### Initialization
```
User Login
    ↓
Switch Database (stop old, init new)
    ↓
Create Indexes
    ↓
Setup Live Sync (background)
    ↓
Begin monitoring events
```

### Continuous Sync
```
Local change → PouchDB.put()
    ↓
Change event fires
    ↓
Sync handler detects change
    ↓
Push to CouchDB (batched)
    ↓
Update sync status
    ↓
Log operation
```

### Conflict Resolution
```
CouchDB detects conflict
    ↓
PouchDB marks revision
    ↓
Latest _rev wins
    ↓
UI refreshes from local DB
    ↓
Manually resolvable via snapshots
```

---

## Document Filtering Strategy

### What Gets Synced
- Story documents (no type field)
- Chapter/Scene data (inside stories)
- Codex entries (character/world data)
- Video references
- Media associations

### What Does NOT Get Synced
- Story snapshots (server-only, HTTP queries)
- Beat history (local-only database)
- Design documents (_design/*)
- Sync logs (localStorage only)

### Filter Code
```typescript
filter: (doc) => doc.type !== 'story-snapshot'
```

---

## Metadata Tracked

### Per Story
```
_id (PouchDB ID)
_rev (Conflict resolution)
id (Duplicate for legacy)
schemaVersion (Migration tracking)
createdAt / updatedAt
order (Custom sort)
```

### Per Beat Generation
```
versionId (Unique per version)
model (AI model used)
prompt (User input)
generatedAt (Timestamp)
wordCount / characterCount
isCurrent (Active version)
action (generate/rewrite)
```

### Per Sync Operation
```
timestamp (When it happened)
userId (Who initiated)
operation type (push/pull)
itemCount (Docs processed)
duration (ms taken)
status (success/error)
```

---

## Key Performance Optimizations

### Database Level
- `allDocs()` instead of `find()` for stories
- Live sync with retry instead of polling
- Background index creation
- Async background cleanup
- EventEmitter limit increased (20 listeners)

### Service Level
- Preview/word count caching
- Beat history 5-minute cache TTL
- Lazy database reference loading
- Non-blocking sync setup
- Batch document operations

### Storage Level
- Auto-prune beat history (max 10 versions)
- MrView database cleanup
- Compaction support
- Storage health monitoring

---

## Common Operations & Code Patterns

### Get Story by ID
```typescript
const story = await storyService.getStory(id);
```

### Create Story with Language
```typescript
const story = await storyService.createStory('de');
```

### Update and Auto-Sync
```typescript
story.title = 'New Title';
await storyService.updateStory(story);
// Auto-syncs to CouchDB
```

### Save Beat Version
```typescript
const versionId = await beatHistoryService.saveVersion(
  beatId, 
  storyId, 
  { content, prompt, model, beatType, wordCount }
);
```

### Monitor Sync Status
```typescript
databaseService.syncStatus$.subscribe(status => {
  console.log(status.isSync); // Currently syncing
  console.log(status.lastSync); // Last sync time
  console.log(status.error); // Any errors
});
```

### Manual Push
```typescript
const result = await databaseService.forcePush();
console.log(`Pushed ${result.docsProcessed} documents`);
```

---

## Data Integrity & Conflict Handling

### Automatic Conflict Resolution
- PouchDB keeps all revisions
- Latest _rev is the "winner"
- Accessible via revision history
- Snapshots provide manual backups

### Manual Recovery
- Restore from snapshot
- Revert beat to old version
- Export/import database
- Manual pull to get remote changes

### What Prevents Data Loss
- Live sync with retry
- CouchDB server-side storage
- Manual snapshots
- Beat history versions
- Database backups (export)

---

## Troubleshooting Reference

### Sync Not Working
1. Check online status: `databaseService.syncStatus$`
2. Verify CouchDB connection in browser console
3. Check for auth errors in sync logs
4. Try manual push/pull

### Missing Stories
1. Use `checkForMissingStories()`
2. Compare local vs remote counts
3. Force pull to sync remote changes
4. Check storage quota

### Conflicts
1. View all revisions (PouchDB internal)
2. Restore from snapshot
3. Revert changes if needed
4. Manual conflict resolution

### Storage Issues
1. Check `getDatabaseSize()`
2. Use `checkStorageHealth()`
3. Run `compact()`
4. Cleanup old beat versions
5. Delete unused snapshots

---

## User Database Isolation

Each user gets completely separate database:

```
Alice's Data              Bob's Data
─────────────             ──────────
creative-writer-         creative-writer-
stories-alice            stories-bob
    │                        │
    └─ Stories              └─ Stories
    └─ Codex                └─ Codex
    └─ Sync logs            └─ Sync logs
                (separate from each other)
```

**Benefits:**
- Privacy by default
- No cross-user contamination
- Scalable to many users
- Clear permissions model

---

## Multi-Device Sync Architecture

Same user, different devices:

```
Device A                   Device B
────────                   ────────
PouchDB                    PouchDB
  │ stories                  │ stories
  │                          │
  └─→ CouchDB (alice db) ←───┘
         │
      All synced
      Same data
```

**Key Point:** Data syncs per user, not per device. No device ID needed.

---

## Observable Streams

### Sync Status Stream
```typescript
syncStatus$: Observable<SyncStatus>

SyncStatus {
  isOnline: boolean
  isSync: boolean
  isConnecting?: boolean
  lastSync?: Date
  error?: string
  syncProgress?: {...}
}
```

### User Stream
```typescript
currentUser$: Observable<User | null>

User {
  username: string
  displayName?: string
  lastLogin: Date
}
```

### Logs Stream
```typescript
logs$: Observable<SyncLog[]>

Latest 100 sync operations
```

---

## Quick Debug Checklist

- [ ] Is user logged in? Check `authService.getCurrentUser()`
- [ ] What's database name? Check `authService.getUserDatabaseName()`
- [ ] Is sync active? Check `databaseService.syncStatus$`
- [ ] Any errors? Check sync logs and browser console
- [ ] Is remote available? Try `checkSnapshotAvailability()`
- [ ] Local storage ok? Check `getDatabaseSize()` and `checkStorageHealth()`
- [ ] Network ok? Check `window.navigator.onLine`
- [ ] Conflicts? Check PouchDB revision history in DevTools

