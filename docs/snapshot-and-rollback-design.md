# Story Snapshot and Rollback System - Design Document

**Status**: Design Phase
**Created**: 2025-10-22
**Author**: System Design
**Version**: 1.0

---

## Executive Summary

This document outlines the design for a snapshot and rollback mechanism for the Creative Writer application. The system will allow users to rollback stories to previous versions at specific time intervals (15 minutes ago, 1 hour ago, 1 day ago, etc.), providing version control and recovery capabilities for their creative work.

### Key Requirements
- Time-based rollback: 15 minutes, 1 hour, 1 day, 1 week, 1 month
- Minimal storage overhead through intelligent retention policies
- Seamless integration with existing PouchDB/CouchDB infrastructure
- Support for offline-first architecture with sync capabilities
- Non-intrusive to current writing workflow

---

## Problem Statement

Writers need the ability to:
1. Recover from accidental deletions or unwanted changes
2. Experiment with different narrative directions while preserving earlier versions
3. Review their writing progress over time
4. Restore specific scenes or chapters to earlier states

Current limitations:
- PouchDB/CouchDB `_rev` system is designed for conflict resolution, not version history
- No built-in mechanism for time-based rollback
- Manual versioning would be cumbersome and error-prone

---

## Research Findings

### PouchDB/CouchDB Versioning Best Practices (2025)

Based on official CouchDB documentation and community best practices:

1. **Do NOT rely on `_rev` for application-level versioning**
   - The revision system is solely for replication conflict resolution
   - Revisions are automatically pruned during compaction
   - Source: CouchDB Official Documentation

2. **Recommended Approaches**
   - Store version history explicitly within documents or as separate documents
   - Use attachments for older versions (simple and replicates well)
   - Maintain central authority on server; treat client PouchDB as read-mostly

3. **Storage Considerations**
   - Storing full document copies can waste storage
   - Consider delta/diff-based storage for text changes
   - Implement retention policies to prune old versions

### Time-Based Snapshot Systems (2025)

Industry standard practices from cloud platforms (AWS, Google Cloud, Snowflake):

1. **Common Time Intervals**
   - 15 minutes: Minimum granular interval (AWS EBS)
   - Hourly: Standard for active work sessions
   - Daily: Long-term reference points
   - Weekly/Monthly: Archive snapshots

2. **Retention Strategies**
   - Grandfather-Father-Son (GFS) backup rotation
   - Time-series pruning: more granular recent history, sparse older history
   - Automatic cleanup to prevent storage bloat

---

## Architecture Design

### Approach: Separate Snapshot Documents

We will implement a **separate document approach** where snapshots are stored as independent documents in PouchDB/CouchDB.

**Rationale:**
- Clean separation of concerns (current state vs. history)
- Easy to query and filter by time
- Straightforward sync across devices
- Flexible retention policies
- No impact on story document size

### Document Types

#### 1. Story Document (Existing)
```typescript
interface Story {
  _id: string;
  _rev?: string;
  id: string;
  title: string;
  chapters: Chapter[];
  settings?: StorySettings;
  codexId?: string;
  coverImage?: string;
  order?: number;
  schemaVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2. Snapshot Document (NEW)
```typescript
interface StorySnapshot {
  _id: string;              // snapshot-{storyId}-{timestamp}
  _rev?: string;
  type: 'story-snapshot';   // For filtering in PouchDB queries
  storyId: string;          // Reference to parent story
  snapshotType: 'auto' | 'manual';
  reason?: string;          // For manual snapshots: "Before major rewrite"

  // Snapshot metadata
  createdAt: Date;          // When snapshot was taken
  retentionTier: 'granular' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  expiresAt?: Date;         // For automatic pruning

  // Story state at snapshot time
  storyState: {
    title: string;
    chapters: Chapter[];
    settings?: StorySettings;
    updatedAt: Date;        // Story's updatedAt when snapshot was taken
  };

  // Metadata for UI
  label?: string;           // User-friendly label like "1 hour ago"
  wordCount?: number;       // For quick reference
  changesSummary?: string;  // "Added 500 words to Chapter 3"
}
```

### Snapshot Triggers

#### Automatic Snapshots
1. **Time-based (Background Service)**
   - Every 15 minutes during active editing session
   - Hourly when story is open but idle
   - Daily for all stories with recent changes

2. **Event-based**
   - Before bulk operations (import, merge chapters)
   - Before AI-generated content insertion
   - After significant milestones (chapter completion)

#### Manual Snapshots
- User-initiated via UI button
- Named snapshots for important milestones
- Before experimental changes

---

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Snapshot Service
```typescript
@Injectable({
  providedIn: 'root'
})
export class SnapshotService {
  // Create snapshot
  async createSnapshot(
    story: Story,
    type: 'auto' | 'manual',
    options?: { reason?: string; label?: string }
  ): Promise<StorySnapshot>

  // Get snapshots for a story
  async getSnapshots(
    storyId: string,
    options?: { limit?: number; before?: Date; after?: Date }
  ): Promise<StorySnapshot[]>

  // Get snapshot timeline (grouped by time periods)
  async getSnapshotTimeline(storyId: string): Promise<{
    recent: StorySnapshot[];      // Last 4 hours (15-min intervals)
    hourly: StorySnapshot[];      // Last 24 hours
    daily: StorySnapshot[];       // Last 30 days
    weekly: StorySnapshot[];      // Last 12 weeks
    monthly: StorySnapshot[];     // Last 12 months
  }>

  // Restore story from snapshot
  async restoreFromSnapshot(
    storyId: string,
    snapshotId: string,
    options?: { createBackup?: boolean }
  ): Promise<Story>

  // Compare story with snapshot
  async compareWithSnapshot(
    story: Story,
    snapshot: StorySnapshot
  ): Promise<SnapshotDiff>

  // Prune old snapshots (retention policy)
  async pruneSnapshots(storyId?: string): Promise<number>
}
```

#### 1.2 Background Snapshot Worker
```typescript
@Injectable({
  providedIn: 'root'
})
export class SnapshotSchedulerService {
  // Start monitoring story for auto-snapshots
  startMonitoring(storyId: string): void

  // Stop monitoring
  stopMonitoring(storyId: string): void

  // Run retention policy (prune old snapshots)
  runRetentionPolicy(): Promise<void>
}
```

### Phase 2: Retention Policy (GFS - Grandfather-Father-Son)

#### Retention Strategy

| Tier | Retention Period | Granularity | Purpose |
|------|-----------------|-------------|---------|
| Granular (Sons) | Last 4 hours | Every 15 minutes | Recover from immediate mistakes |
| Hourly (Fathers) | Last 24 hours | Every 1 hour | Same-day recovery |
| Daily (Grandfathers) | Last 30 days | Daily (EOD) | Recent history |
| Weekly | Last 12 weeks | Weekly (Sunday EOD) | Medium-term milestones |
| Monthly | Last 12 months | Monthly (Last day) | Long-term archive |

#### Pruning Algorithm
```typescript
async pruneSnapshots(storyId: string): Promise<number> {
  const now = new Date();
  const snapshots = await this.getSnapshots(storyId);

  // Define retention windows
  const retentionRules = [
    { tier: 'granular', maxAge: 4 * HOURS, keepEvery: 15 * MINUTES },
    { tier: 'hourly', maxAge: 24 * HOURS, keepEvery: 1 * HOUR },
    { tier: 'daily', maxAge: 30 * DAYS, keepEvery: 1 * DAY },
    { tier: 'weekly', maxAge: 12 * WEEKS, keepEvery: 1 * WEEK },
    { tier: 'monthly', maxAge: 12 * MONTHS, keepEvery: 1 * MONTH }
  ];

  const toDelete: string[] = [];

  for (const rule of retentionRules) {
    const windowSnapshots = snapshots.filter(s => {
      const age = now - s.createdAt;
      return age <= rule.maxAge && age > (previous_rule?.maxAge ?? 0);
    });

    // Keep only one snapshot per interval
    const grouped = groupByInterval(windowSnapshots, rule.keepEvery);
    for (const [interval, snaps] of grouped) {
      // Keep the latest in each interval, delete others
      const sorted = snaps.sort((a, b) => b.createdAt - a.createdAt);
      toDelete.push(...sorted.slice(1).map(s => s._id));
    }
  }

  // Delete snapshots older than maximum retention
  const expired = snapshots.filter(s =>
    (now - s.createdAt) > 12 * MONTHS
  );
  toDelete.push(...expired.map(s => s._id));

  // Perform bulk delete
  await this.bulkDelete(toDelete);
  return toDelete.length;
}
```

### Phase 3: UI Components

#### 3.1 Snapshot Timeline Component
```typescript
@Component({
  selector: 'app-snapshot-timeline',
  template: `
    <ion-list>
      <ion-list-header>Recent (Every 15 min)</ion-list-header>
      <ion-item *ngFor="let snapshot of timeline.recent">
        <ion-label>
          <h3>{{ snapshot.label }}</h3>
          <p>{{ snapshot.wordCount }} words</p>
        </ion-label>
        <ion-button (click)="restore(snapshot)">Restore</ion-button>
        <ion-button (click)="preview(snapshot)">Preview</ion-button>
      </ion-item>

      <ion-list-header>Hourly</ion-list-header>
      <!-- Similar structure for hourly, daily, weekly, monthly -->
    </ion-list>
  `
})
export class SnapshotTimelineComponent { }
```

#### 3.2 Snapshot Comparison Modal
```typescript
@Component({
  selector: 'app-snapshot-diff',
  template: `
    <div class="diff-view">
      <div class="current">
        <h3>Current Version</h3>
        {{ currentContent }}
      </div>
      <div class="snapshot">
        <h3>{{ snapshotLabel }}</h3>
        {{ snapshotContent }}
      </div>
    </div>
    <!-- Use diff library to highlight changes -->
  `
})
export class SnapshotDiffComponent { }
```

### Phase 4: Storage Optimization

#### 4.1 Delta Compression (Future Enhancement)
Instead of storing full story state, store only changes:
```typescript
interface SnapshotDelta {
  baseSnapshotId: string;
  operations: Array<{
    type: 'insert' | 'delete' | 'replace';
    path: string;        // JSONPath to changed field
    value?: unknown;
    oldValue?: unknown;
  }>;
}
```

**Trade-offs:**
- Pros: Significant storage savings (50-90% reduction)
- Cons: More complex restore logic, CPU overhead for reconstruction
- Recommendation: Implement in Phase 2 if storage becomes an issue

#### 4.2 Compression
Use browser-native compression for snapshot data:
```typescript
async createSnapshot(story: Story): Promise<StorySnapshot> {
  const storyState = this.extractSnapshotState(story);

  // Compress large text content
  if (this.estimateSize(storyState) > 100_000) {
    storyState.chapters = await this.compressChapters(storyState.chapters);
  }

  // ... rest of snapshot creation
}
```

---

## Database Schema

### PouchDB Index Strategy
```typescript
// Add to DatabaseService.initializeDatabase()
const snapshotIndexes = [
  { fields: ['type', 'storyId', 'createdAt'] },
  { fields: ['type', 'retentionTier', 'createdAt'] },
  { fields: ['type', 'expiresAt'] }  // For efficient pruning
];
```

### Storage Estimation

For a typical story:
- Average story size: 50 KB (10,000 words)
- Snapshots per day (active editing): ~50 (15-min intervals during 12-hour session)
- Storage per day (no compression): 50 KB × 50 = 2.5 MB
- Storage per day (with GFS pruning): ~500 KB (keeping 4 hours granular, then sparse)

**Annual storage per story**: ~180 MB (with aggressive pruning)
**With 100 stories**: ~18 GB (well within browser storage quotas)

---

## Migration Strategy

### Phase 1: Opt-in Feature
1. Add snapshot system alongside existing functionality
2. Enable for new stories by default
3. Provide opt-in for existing stories via settings

### Phase 2: Gradual Rollout
1. Monitor storage usage across users
2. Tune retention policies based on actual usage patterns
3. Add compression if needed

### No Breaking Changes
- Existing stories continue to work without snapshots
- Snapshots are additive functionality
- Can be disabled per-story or globally

---

## Technical Considerations

### 1. Performance
- **Snapshot creation**: <100ms for typical story (async, non-blocking)
- **Pruning**: Run during idle time or overnight
- **Restore**: <500ms including UI update

### 2. Sync Behavior
- Snapshots sync to CouchDB like any other document
- Use `type: 'story-snapshot'` for filtering
- Consider separate database for snapshots (optional, for large deployments)

### 3. Offline Support
- Snapshots created locally work offline
- Sync when connection restored
- Conflict resolution uses newest snapshot in case of sync conflicts

### 4. Storage Quotas
- Monitor browser storage via `navigator.storage.estimate()`
- Warn users at 80% quota
- Offer manual pruning or disable auto-snapshots

### 5. User Privacy
- Snapshots stay local or sync only to user's CouchDB
- No data sent to external services
- User can manually delete all snapshots

---

## User Experience Design

### Snapshot Access Points

1. **Story Editor Toolbar**
   - "Version History" button (clock icon)
   - Quick restore menu with common intervals

2. **Story List Context Menu**
   - "View Version History"
   - "Restore to Earlier Version"

3. **Story Settings**
   - Enable/disable auto-snapshots
   - Set snapshot frequency
   - Manual pruning controls

### Restore Flow
```
User clicks "Restore to 1 hour ago"
  ↓
Show preview of snapshot vs. current
  ↓
User confirms: "Restore" or "Cancel"
  ↓
Create backup snapshot of current state
  ↓
Restore snapshot content
  ↓
Show success message with undo option
```

### Visual Design
- Timeline visualization (similar to Git history)
- Word count changes per snapshot
- Preview pane with diff highlighting
- Confirmation dialogs for destructive actions

---

## Testing Strategy

### Unit Tests
- Snapshot creation and retrieval
- Pruning algorithm correctness
- Retention tier assignment
- Restore functionality

### Integration Tests
- PouchDB/CouchDB sync behavior
- Offline snapshot creation
- Conflict resolution
- Storage quota handling

### User Acceptance Tests
- Can restore to 15 minutes ago
- Can restore to 1 hour ago
- Can restore to 1 day ago
- Pruning reduces storage over time
- Snapshots survive app restart
- Snapshots sync across devices

### Performance Tests
- Snapshot creation under 100ms
- Pruning 1000 snapshots under 1 second
- Storage usage stays within quota
- No memory leaks over 8-hour session

---

## Alternative Approaches Considered

### 1. Using CouchDB `_rev` History
**Rejected**: Revisions are pruned during compaction, not reliable for long-term versioning.

### 2. Storing Snapshots as Attachments
**Rejected**: More complex API, harder to query by time, less flexible retention policies.

### 3. Event Sourcing (Store All Edits)
**Pros**: Complete audit trail, minimal storage for text changes
**Cons**: Complex reconstruction, high CPU cost, overkill for user needs
**Status**: Deferred to future enhancement

### 4. Server-Side Snapshots Only
**Rejected**: Doesn't support offline-first architecture, adds server complexity.

### 5. Operational Transform (OT) / CRDT
**Rejected**: Designed for real-time collaboration, not time-travel; unnecessary complexity.

---

## Security Considerations

1. **Data Integrity**
   - Hash snapshots to detect corruption
   - Validate snapshot structure before restore

2. **Storage Isolation**
   - Each user's snapshots stored in their database
   - No cross-user access

3. **Audit Trail**
   - Log all restore operations
   - Track who created manual snapshots and why

---

## Future Enhancements

### Phase 2 (Optional)
1. **Delta Compression**: Store only changes between snapshots
2. **Semantic Snapshots**: Auto-snapshot at chapter/scene boundaries
3. **Collaborative Snapshots**: Shared snapshots for co-authors
4. **Snapshot Annotations**: User notes on snapshots
5. **Smart Restore**: "Restore just Chapter 3 from 2 hours ago"

### Phase 3 (Advanced)
1. **Diff Visualization**: Side-by-side comparison with highlighting
2. **Snapshot Search**: Find snapshot by content or time
3. **Snapshot Export**: Save snapshot as separate story
4. **Snapshot Analytics**: Writing velocity, productivity insights

---

## Implementation Checklist

### Database & Models
- [ ] Create `StorySnapshot` interface
- [ ] Update database indexes for snapshots
- [ ] Add snapshot type to document filters

### Services
- [ ] Implement `SnapshotService`
- [ ] Implement `SnapshotSchedulerService`
- [ ] Add snapshot logic to `StoryService`
- [ ] Implement GFS retention algorithm

### UI Components
- [ ] `SnapshotTimelineComponent`
- [ ] `SnapshotDiffComponent`
- [ ] `SnapshotRestoreModalComponent`
- [ ] Add toolbar button to story editor

### Testing
- [ ] Unit tests for snapshot service
- [ ] Integration tests for pruning
- [ ] E2E tests for restore flow
- [ ] Performance tests

### Documentation
- [ ] User guide for version history
- [ ] Developer documentation
- [ ] Migration guide
- [ ] API documentation

---

## Success Metrics

1. **Adoption**: 80% of active users enable auto-snapshots
2. **Usage**: Average 5 restores per user per month
3. **Performance**: 99% of snapshots created in <100ms
4. **Reliability**: 100% successful restores (no data loss)
5. **Storage**: Average <200MB per user after 1 year
6. **User Satisfaction**: 4.5+ star rating for feature

---

## References

### Research Sources
1. CouchDB Official Documentation - Document Design Best Practices (2025)
2. PouchDB FAQ - Versioning and Replication (2025)
3. Stack Overflow - PouchDB/CouchDB Versioning for Audit Trail
4. Snowflake Snapshots for Data Versioning (Medium, April 2025)
5. LakeFS Data Versioning Guide (July 2025)
6. AWS EBS Time-Based Snapshot Copies Documentation
7. Grandfather-Father-Son Backup Strategy (Vitanium, NAKIVO)
8. Borg Deduplicating Archiver - Prune Documentation

### Related Documentation
- `/home/nos/dev/creativewriter/DATABASE_OPTIMIZATION_GUIDE.md`
- `/home/nos/dev/creativewriter/README.md`
- Current Story Service: `src/app/stories/services/story.service.ts`
- Current Database Service: `src/app/core/services/database.service.ts`

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-22 | System Design | Initial design document |

---

## Appendix A: Configuration Examples

### Snapshot Settings Interface
```typescript
interface SnapshotSettings {
  enabled: boolean;
  autoSnapshotInterval: 15 | 30 | 60;  // minutes
  retentionPolicy: {
    granularHours: number;     // default: 4
    hourlyHours: number;       // default: 24
    dailyDays: number;         // default: 30
    weeklyWeeks: number;       // default: 12
    monthlyMonths: number;     // default: 12
  };
  maxSnapshotsPerStory: number;  // hard limit (default: 500)
  enableCompression: boolean;
  warnAtStoragePercent: number;  // default: 80
}
```

### Default Configuration
```typescript
const DEFAULT_SNAPSHOT_SETTINGS: SnapshotSettings = {
  enabled: true,
  autoSnapshotInterval: 15,
  retentionPolicy: {
    granularHours: 4,
    hourlyHours: 24,
    dailyDays: 30,
    weeklyWeeks: 12,
    monthlyMonths: 12
  },
  maxSnapshotsPerStory: 500,
  enableCompression: true,
  warnAtStoragePercent: 80
};
```

---

## Appendix B: API Examples

### Creating a Snapshot
```typescript
const snapshot = await snapshotService.createSnapshot(story, 'auto', {
  label: '15 minutes ago'
});
```

### Getting Snapshots Timeline
```typescript
const timeline = await snapshotService.getSnapshotTimeline(storyId);
console.log(timeline.recent);  // Last 4 hours, 15-min intervals
console.log(timeline.hourly);  // Last 24 hours, hourly
```

### Restoring from Snapshot
```typescript
const restoredStory = await snapshotService.restoreFromSnapshot(
  storyId,
  snapshotId,
  { createBackup: true }  // Backup current state before restore
);
```

### Manual Pruning
```typescript
const deletedCount = await snapshotService.pruneSnapshots(storyId);
console.log(`Deleted ${deletedCount} old snapshots`);
```

---

**End of Document**
