# Sync Architecture Documentation Index

This folder contains comprehensive documentation of the Creative Writer application's PouchDB/CouchDB synchronization architecture, data models, and device tracking systems.

## Documents Included

### 1. SYNC_ARCHITECTURE.md (Main Comprehensive Guide)
**Size:** 728 lines / 23 KB  
**Best for:** In-depth understanding and implementation reference

**Contents:**
- Complete overview of PouchDB/CouchDB sync system
- All database and data model interfaces
- Device identification and tracking implementation
- Version history and revision tracking
- Snapshot backup system (server-side)
- Sync logging and operation tracking
- Database maintenance and cleanup procedures
- Document filtering and counting strategies
- Network configuration and online/offline detection
- Architectural patterns and design decisions
- Sync flow diagrams
- Data structure examples with JSON
- Complete file location listing
- Future enhancement opportunities

**Key Sections:**
- Section 1: Core Sync Services
- Section 2: Story & Data Models
- Section 3: Story Service Operations
- Section 4: User Authentication & Database Switching
- Section 5: Change Tracking & Sync Status
- Section 6: Manual Sync & Replication
- Section 7: Device Identification (currently minimal/none)
- Section 8: Version History & Revision Tracking
- Section 9: Snapshots (Server-Side Backups)
- Section 10: Sync Logging
- Section 11: Database Maintenance
- Section 12: Document Filtering
- Section 13: Network Configuration
- Section 14: Architectural Patterns
- Section 15: Sync Flow Diagram
- Section 16: Data Structure Examples
- Section 17: File Locations
- Section 18: Enhancement Opportunities

---

### 2. SYNC_ARCHITECTURE_QUICK_REFERENCE.md (Quick Lookup)
**Size:** 430 lines / 9.5 KB  
**Best for:** Quick reference during development, debugging, and common tasks

**Contents:**
- Services and file locations (quick overview)
- Database naming conventions
- Data flow diagrams
- Sync mechanics at a glance
- Document filtering strategy
- Metadata tracked across the system
- Performance optimizations
- Common operations and code patterns
- Data integrity and conflict handling
- Troubleshooting reference
- User database isolation model
- Multi-device sync architecture
- Observable streams documentation
- Quick debug checklist

**Perfect for:**
- Finding service locations quickly
- Understanding naming conventions
- Common code patterns and examples
- Troubleshooting checklist
- Observable streams reference
- Quick debug reference

---

## Quick Navigation by Topic

### For Understanding the Sync System
1. Start with **SYNC_ARCHITECTURE.md** Section 1 & 14 (Core services & patterns)
2. Review **SYNC_ARCHITECTURE_QUICK_REFERENCE.md** (Data flow diagram)
3. Study **SYNC_ARCHITECTURE.md** Section 15 (Sync flow diagram)

### For Device Identification & Tracking
1. **SYNC_ARCHITECTURE.md** Section 7 (Device identification)
   - Currently: Minimal/Device-Agnostic implementation
   - User-centric data model (no device ID)
   - Multi-device sync via user database

### For Data Models & Interfaces
1. **SYNC_ARCHITECTURE.md** Section 2 (Story models)
2. **SYNC_ARCHITECTURE.md** Section 8 (Beat version history)
3. **SYNC_ARCHITECTURE.md** Section 9 (Snapshots)
4. **SYNC_ARCHITECTURE.md** Section 16 (JSON examples)

### For Implementing Sync Features
1. **SYNC_ARCHITECTURE_QUICK_REFERENCE.md** - Common operations section
2. **SYNC_ARCHITECTURE.md** - Relevant service section
3. Review actual service files for implementation details

### For Troubleshooting
1. **SYNC_ARCHITECTURE_QUICK_REFERENCE.md** - Quick debug checklist
2. **SYNC_ARCHITECTURE_QUICK_REFERENCE.md** - Troubleshooting reference
3. **SYNC_ARCHITECTURE.md** - Detailed error handling sections

### For Performance Optimization
1. **SYNC_ARCHITECTURE_QUICK_REFERENCE.md** - Performance optimizations
2. **SYNC_ARCHITECTURE.md** - Section 11 (Database maintenance)
3. **SYNC_ARCHITECTURE.md** - Section 3 (Story service optimizations)

---

## Key Files Referenced in Documentation

### Core Services
- `/home/nos/dev/creativewriter/src/app/core/services/database.service.ts`
- `/home/nos/dev/creativewriter/src/app/core/services/auth.service.ts`
- `/home/nos/dev/creativewriter/src/app/core/services/sync-logger.service.ts`
- `/home/nos/dev/creativewriter/src/app/core/services/version.service.ts`

### Story Services
- `/home/nos/dev/creativewriter/src/app/stories/services/story.service.ts`
- `/home/nos/dev/creativewriter/src/app/stories/services/snapshot.service.ts`
- `/home/nos/dev/creativewriter/src/app/shared/services/beat-history.service.ts`
- `/home/nos/dev/creativewriter/src/app/shared/services/database-backup.service.ts`

### Models & Interfaces
- `/home/nos/dev/creativewriter/src/app/stories/models/story.interface.ts`
- `/home/nos/dev/creativewriter/src/app/stories/models/beat-version-history.interface.ts`
- `/home/nos/dev/creativewriter/src/app/core/models/settings.interface.ts`

### Utilities
- `/home/nos/dev/creativewriter/src/app/shared/utils/document-filters.ts`

---

## Critical Architecture Insights

### User-Centric, Device-Agnostic Design
- Each user has completely isolated database
- Multi-device sync handled via user database (not device-specific)
- No device ID tracking in current implementation
- Can be extended in future if needed

### Multi-Tier Storage Strategy
- **PouchDB (Local)**: Stories, chapters, scenes, codex, beat history
- **CouchDB (Remote)**: Same as local + snapshots (filtered from sync)
- **Local Storage**: Sync logs, user session
- **Memory**: Caches for preview/word count, beat history

### Separation of Concerns
- Beat history: Local-only database (performance)
- Snapshots: Server-only, accessed via HTTP (point-in-time backups)
- Sync logs: localStorage only (operation tracking)
- Main data: Bidirectional PouchDB/CouchDB sync

### Data Integrity
- PouchDB revision tracking (_rev)
- Automatic conflict resolution (latest revision wins)
- Manual recovery via snapshots
- Beat version history for content comparison

---

## Development Quick Start

### 1. Understanding the Flow
```
User Login → Database Switch → PouchDB Init → Live Sync Setup → Monitor Events
```

### 2. Common Operations
```typescript
// Get all stories
const stories = await storyService.getAllStories();

// Create story
const story = await storyService.createStory('en');

// Update story (auto-syncs)
story.title = 'New Title';
await storyService.updateStory(story);

// Monitor sync
databaseService.syncStatus$.subscribe(status => {
  console.log(status.isSync, status.lastSync);
});

// Save beat version
const versionId = await beatHistoryService.saveVersion(
  beatId, storyId, { content, prompt, model, beatType, wordCount }
);
```

### 3. Debug Checklist
- User logged in? `authService.getCurrentUser()`
- Sync active? `databaseService.syncStatus$`
- Remote available? `snapshotService.checkSnapshotAvailability()`
- Storage ok? `databaseService.checkStorageHealth()`

---

## Database Naming Reference

```
User-Specific (named user):
  creative-writer-stories-alice
  creative-writer-stories-bob

Anonymous (local-only):
  creative-writer-stories-anonymous

Beat Version History (local-only):
  beat-histories
```

---

## Document Type Reference

```
Stories:           { no 'type' field, has 'chapters' }
Codex:             { type: 'codex' }
Videos:            { type: 'video' }
Beat History:      { type: 'beat-history' }
Snapshots:         { type: 'story-snapshot' }  [NOT synced]
```

---

## Performance Metrics

### Optimizations in Place
- `allDocs()` queries instead of `find()` for speed
- Live sync with retry (no polling)
- Preview/word count caching
- Beat history 5-minute cache TTL
- Background cleanup and indexing
- Auto-pruning (max 10 versions per beat)
- EventEmitter limit: 20 listeners

### Storage Considerations
- Local database limited by browser IndexedDB quota
- Server-side snapshots unlimited
- Beat history stored locally only
- Compaction support for cleanup
- Storage health monitoring

---

## Future Enhancement Opportunities

1. **Device ID Tracking** - For analytics and multi-device management
2. **Selective Sync** - Choose which documents to sync
3. **Compression** - Reduce storage size
4. **Conflict Resolution UI** - Visual diff for concurrent edits
5. **Offline Snapshot** - Auto-save before going offline
6. **Revision History UI** - Full PouchDB revision tracking interface
7. **Sync Statistics** - Enhanced metrics and analytics
8. **Advanced Permissions** - Fine-grained sync control

---

## Related Documentation

- **CLAUDE.md** - Project instructions and guidelines
- **README.md** - General project information
- **snapshot-service/README.md** - Snapshot service details

---

## Summary

The Creative Writer sync architecture is a sophisticated, production-grade system featuring:
- **Bidirectional live sync** between local and remote databases
- **User-specific isolation** for privacy and scalability
- **Server-side snapshots** for point-in-time backups
- **Comprehensive logging** of all operations
- **Device-agnostic design** with cross-device support
- **Automatic cleanup** and storage management

This documentation provides complete understanding of how the system works, where things are located, and how to work with the sync infrastructure.

