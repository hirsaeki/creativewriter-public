# Beat Version History Feature Specification

**Created:** 2025-10-22
**Status:** Planning
**Priority:** Medium

---

## 1. Feature Overview

### Problem Statement

Currently, when users generate beat content in the story editor, they have two options:
- **Generate:** Prepends new content before existing generated text
- **Regenerate:** Deletes previous content and generates new text

**Issue:** If a regeneration produces inferior content, users cannot easily revert to the previous version. They must rely on:
- Server-side snapshots (15-minute granularity minimum)
- Manual copying of text before regenerating
- Losing good content permanently

### Proposed Solution

Implement a **Beat Version History** system that:
1. Automatically saves each generated version of beat content
2. Allows users to browse and switch between versions easily
3. Stores version history separately from story documents (lazy-loaded)
4. Provides database maintenance tools to clean up old histories
5. Optimizes for mobile performance with minimal overhead

---

## 2. User Stories

### Primary Use Cases

**US-1: Save Version History**
> As a writer, when I generate or regenerate a beat, I want the system to automatically save the previous version so I can revert if needed.

**US-2: Browse Version History**
> As a writer, I want to see a list of all previous generations for a beat, including timestamps and preview text, so I can compare versions.

**US-3: Revert to Previous Version**
> As a writer, I want to click a version in the history and have the beat content instantly switch to that version.

**US-4: Clean Up Old Histories**
> As a writer, I want to delete old beat generation histories from the database maintenance settings to free up space.

**US-5: Mobile Performance**
> As a mobile user, I want the version history feature to load quickly without impacting editor performance or increasing data usage significantly.

---

## 3. Current Implementation Analysis

### How Beat Generation Currently Works

```
┌─────────────────────────────────────────────┐
│ User enters prompt → Clicks Generate        │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────▼──────────────┐
    │ BeatAIComponent         │
    │ .generateContent()      │
    │ - Updates beatData      │
    │ - Emits promptSubmit    │
    └──────────┬──────────────┘
               │
    ┌──────────▼──────────────┐
    │ StoryEditorComponent    │
    │ .handleBeatPromptSubmit()│
    │ - Saves scene to DB     │
    │ - Enhances context      │
    └──────────┬──────────────┘
               │
    ┌──────────▼──────────────┐
    │ ProseMirrorService      │
    │ - Streams content       │
    │ - Inserts into editor   │
    └──────────┬──────────────┘
               │
    ┌──────────▼──────────────┐
    │ Database (PouchDB)      │
    │ - Saves scene.content   │
    └─────────────────────────┘
```

### Key Files & Locations

**Generation Flow:**
- `src/app/stories/components/beat-ai/beat-ai.component.ts:333-401`
- `src/app/stories/components/story-editor/story-editor.component.ts:1394-1459`
- `src/app/shared/services/prosemirror-editor.service.ts:868-955`
- `src/app/shared/services/beat-ai.service.ts:381-522`

**Data Models:**
- `src/app/stories/models/beat-ai.interface.ts` - BeatAI interface
- `src/app/stories/models/story.interface.ts` - Story/Chapter/Scene hierarchy

**Database:**
- `src/app/stories/services/story.service.ts:253-271, 512-531` - Story persistence
- `src/app/core/services/database.service.ts` - PouchDB wrapper

### Current Beat Data Structure

```typescript
interface BeatAI {
  id: string;                    // Unique identifier (e.g., 'beat-k7x2m9qwe')
  prompt: string;                // User's generation prompt
  generatedContent: string;      // Last generated content (stored but not displayed)
  isGenerating: boolean;
  isCollapsed: boolean;
  createdAt: Date;
  updatedAt: Date;
  wordCount?: number;
  beatType?: 'story' | 'scene';
  model?: string;
  selectedScenes?: { sceneId: string; chapterId: string; }[];
  includeStoryOutline?: boolean;
}
```

**Important Notes:**
- `generatedContent` attribute stores last output but isn't displayed to user
- Actual rendered text is stored as HTML paragraphs after the beat node in scene content
- Beat IDs are generated using: `'beat-' + Math.random().toString(36).substring(2, 11)`
- No version tracking currently exists - each regeneration overwrites previous content

---

## 4. Technical Research Findings

### PouchDB/CouchDB Best Practices (2025)

From research on PouchDB performance and mobile optimization:

**Separate Collections Strategy:**
- PouchDB/CouchDB supports splitting data into multiple databases for fine-grained control
- Replication can be managed independently per database
- Prevents main story documents from becoming bloated
- Lazy loading reduces initial sync time and memory usage

**Mobile Performance Considerations:**
- PouchDB performs well with ~1000 documents using startkey/endkey queries
- For very large datasets (100k+), in-memory caching may be necessary
- SQLite plugin available for Cordova/PhoneGap (better mobile performance)
- Attachment performance can be slow; prefer separate documents

**Lazy Loading Pattern:**
- Don't sync version history by default
- Load on-demand when user opens version history UI
- Use manual replication instead of continuous sync
- Consider pagination for beats with many versions

### Angular/Ionic Performance Best Practices (2025)

**Key Optimization Strategies:**
- **OnPush Change Detection:** Reduces unnecessary re-renders
- **Lazy Loading:** Load modules and data only when needed
- **Code Splitting:** Divide app into smaller chunks
- **Image Optimization:** Compress and use efficient formats
- **Virtual Scrolling:** For long lists (version history)
- **Web Workers:** For heavy computations (not applicable here)

**Mobile-Specific Considerations:**
- Minimize bundle size and initial load time
- Use hardware-accelerated transitions
- Implement efficient list rendering (ion-virtual-scroll)
- Avoid blocking UI thread during data operations
- Cache frequently accessed data in memory

---

## 5. Proposed Architecture

### 5.1 Database Schema

#### New Database: `beat-histories`

Separate PouchDB database for version history (not synced by default):

```typescript
interface BeatVersionHistory {
  _id: string;                    // Format: 'history-{beatId}'
  _rev?: string;                  // PouchDB revision
  type: 'beat-history';           // Document type identifier
  beatId: string;                 // References BeatAI.id
  storyId: string;                // Parent story ID
  userId?: string;                // Owner (for multi-user sync later)
  versions: BeatVersion[];        // Array of all versions
  createdAt: Date;                // First version created
  updatedAt: Date;                // Last version added
}

interface BeatVersion {
  versionId: string;              // Format: 'v-{timestamp}-{random}'
  content: string;                // Generated HTML content
  prompt: string;                 // Prompt used for generation
  model: string;                  // AI model used
  beatType: 'story' | 'scene';   // Context type
  wordCount: number;              // Target word count
  generatedAt: Date;              // When this version was created
  characterCount: number;         // Actual output length
  isCurrent: boolean;             // Currently active version
  selectedScenes?: Array<{        // Scene selection for this generation
    sceneId: string;
    chapterId: string;
  }>;
  includeStoryOutline?: boolean;  // Story outline toggle state
}
```

**Design Decisions:**

✅ **Store all versions in a single document per beat:**
- Pros: Single query to fetch all versions, simpler management
- Cons: Document grows over time, potential size limits
- Mitigation: Implement version limit (e.g., keep last 20 versions)

✅ **Store complete HTML content per version:**
- Pros: Fast switching, no regeneration needed
- Cons: Higher storage usage
- Mitigation: Clean up old histories, compress if needed

✅ **Separate database from stories:**
- Pros: Main story load unaffected, optional sync, easier cleanup
- Cons: Additional database to manage
- Mitigation: Single database, lazy loading

#### Modified Beat Node Attributes

Add version tracking to ProseMirror beat nodes:

```typescript
interface BeatAI {
  // ... existing fields ...
  currentVersionId?: string;      // NEW: Points to active version in history
  hasHistory?: boolean;           // NEW: Quick check if history exists
}
```

### 5.2 Service Architecture

#### New Service: `BeatHistoryService`

**Location:** `src/app/shared/services/beat-history.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class BeatHistoryService {
  private historyDb: PouchDB.Database;
  private historyCache: Map<string, BeatVersionHistory>;

  constructor(private databaseService: DatabaseService) {
    this.historyDb = new PouchDB('beat-histories');
    this.historyCache = new Map();
  }

  // Core Operations
  async saveVersion(beatId: string, versionData: Omit<BeatVersion, 'versionId'>): Promise<string>
  async getHistory(beatId: string): Promise<BeatVersionHistory | null>
  async setCurrentVersion(beatId: string, versionId: string): Promise<void>
  async deleteHistory(beatId: string): Promise<void>
  async deleteOldVersions(beatId: string, keepCount: number): Promise<void>

  // Bulk Operations
  async deleteAllHistoriesForStory(storyId: string): Promise<number>
  async deleteAllHistories(): Promise<number>
  async getHistoryStats(): Promise<{ totalHistories: number; totalVersions: number; totalSize: number }>

  // Cache Management
  private loadHistoryToCache(beatId: string): Promise<void>
  private clearCache(): void
}
```

**Key Methods Explained:**

**`saveVersion()`**
- Called after each generation completes
- Creates new version entry in history document
- Marks previous version as `isCurrent: false`
- Returns new `versionId`
- Implements version limit (auto-deletes oldest if > 20 versions)

**`getHistory()`**
- Fetches complete history for a beat
- Uses cache if available (memory optimization)
- Returns null if no history exists

**`setCurrentVersion()`**
- Updates which version is marked as current
- Does NOT modify story content (caller's responsibility)
- Used when user switches between versions

**`deleteOldVersions()`**
- Keeps most recent N versions, deletes older ones
- Used for manual cleanup or automatic pruning

#### Modified Service: `BeatAIService`

**Changes to:** `src/app/shared/services/beat-ai.service.ts`

Add version history integration:

```typescript
async generateBeatContent(
  prompt: string,
  beatId: string,
  options: GenerateBeatOptions
): Observable<string> {
  // ... existing generation logic ...

  // NEW: After generation completes
  finalize(() => {
    if (success) {
      this.saveToHistory(beatId, prompt, generatedContent, options);
    }
  })
}

private async saveToHistory(
  beatId: string,
  prompt: string,
  content: string,
  options: GenerateBeatOptions
): Promise<void> {
  const versionData = {
    content: content,
    prompt: prompt,
    model: options.model || 'unknown',
    beatType: options.beatType || 'story',
    wordCount: options.wordCount || 400,
    generatedAt: new Date(),
    characterCount: content.length,
    isCurrent: true,
    selectedScenes: options.customContext?.selectedScenes,
    includeStoryOutline: options.customContext?.includeStoryOutline
  };

  await this.beatHistoryService.saveVersion(beatId, versionData);
}
```

#### Modified Service: `ProseMirrorEditorService`

**Changes to:** `src/app/shared/services/prosemirror-editor.service.ts`

Add version switching capability:

```typescript
async switchBeatVersion(beatId: string, versionId: string): Promise<void> {
  // 1. Get version content from history
  const history = await this.beatHistoryService.getHistory(beatId);
  const version = history?.versions.find(v => v.versionId === versionId);
  if (!version) throw new Error('Version not found');

  // 2. Delete current content after beat
  await this.deleteContentAfterBeat(beatId);

  // 3. Insert version content
  await this.insertContentAfterBeat(beatId, version.content);

  // 4. Update beat node attributes
  await this.updateBeatNode(beatId, {
    currentVersionId: versionId,
    updatedAt: new Date().toISOString()
  });

  // 5. Mark version as current in history
  await this.beatHistoryService.setCurrentVersion(beatId, versionId);
}
```

### 5.3 UI Components

#### New Component: `BeatVersionHistoryModalComponent`

**Location:** `src/app/stories/components/beat-version-history-modal/`

**Modal UI Structure:**
```
┌─────────────────────────────────────────────┐
│ Beat Version History              [X]       │
├─────────────────────────────────────────────┤
│ Current Prompt: "Describe the forest..."   │
│                                             │
│ ┌───────────────────────────────────────┐  │
│ │ Version History (8 versions)          │  │
│ │                                       │  │
│ │ ┌─────────────────────────────────┐  │  │
│ │ │ ✓ v8 - Just now [CURRENT]       │  │  │
│ │ │   Model: Claude Opus            │  │  │
│ │ │   "In the deep forest, ancient  │  │  │
│ │ │    trees whispered secrets..."  │  │  │
│ │ │   [View Full] [Restore]         │  │  │
│ │ └─────────────────────────────────┘  │  │
│ │                                       │  │
│ │ ┌─────────────────────────────────┐  │  │
│ │ │   v7 - 5 minutes ago            │  │  │
│ │ │   Model: GPT-4 Turbo            │  │  │
│ │ │   "The forest loomed dark and   │  │  │
│ │ │    mysterious in the twilight..." │  │
│ │ │   [View Full] [Restore]         │  │  │
│ │ └─────────────────────────────────┘  │  │
│ │                                       │  │
│ │ ┌─────────────────────────────────┐  │  │
│ │ │   v6 - 10 minutes ago           │  │  │
│ │ │   ... (collapsed)               │  │  │
│ │ └─────────────────────────────────┘  │  │
│ │                                       │  │
│ │ [Load More Versions...]              │  │
│ └───────────────────────────────────────┘  │
│                                             │
│ [Delete All History] [Close]               │
└─────────────────────────────────────────────┘
```

**Key Features:**
- Virtual scrolling for performance (ion-virtual-scroll)
- Lazy load versions in chunks (show last 10, load more on scroll)
- Preview first 100 characters of each version
- Expand to view full content
- Clear current version indicator
- Relative timestamps (e.g., "5 minutes ago", "2 hours ago")
- Restore button to switch to that version
- Delete history option

**Template:** `beat-version-history-modal.component.html`

```html
<ion-header>
  <ion-toolbar>
    <ion-title>Beat Version History</ion-title>
    <ion-buttons slot="end">
      <ion-button (click)="dismiss()">
        <ion-icon name="close"></ion-icon>
      </ion-button>
    </ion-buttons>
  </ion-toolbar>
</ion-header>

<ion-content>
  <div class="current-prompt" *ngIf="currentPrompt">
    <ion-label>Current Prompt:</ion-label>
    <p>{{ currentPrompt }}</p>
  </div>

  <div class="version-list" *ngIf="versions.length > 0">
    <ion-label>Version History ({{ versions.length }} versions)</ion-label>

    <ion-virtual-scroll [items]="versions" approxItemHeight="120px">
      <ion-card *virtualItem="let version"
                [class.current]="version.isCurrent">
        <ion-card-header>
          <ion-card-subtitle>
            <ion-icon name="checkmark-circle" *ngIf="version.isCurrent"></ion-icon>
            {{ formatVersionLabel(version) }}
            <span class="timestamp">{{ formatTimestamp(version.generatedAt) }}</span>
          </ion-card-subtitle>
          <ion-card-title>{{ version.model }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <p class="preview" [class.expanded]="version.expanded">
            {{ version.expanded ? version.content : getPreview(version.content) }}
          </p>

          <div class="version-actions">
            <ion-button size="small" fill="clear"
                        (click)="toggleExpanded(version)">
              {{ version.expanded ? 'Show Less' : 'View Full' }}
            </ion-button>
            <ion-button size="small" fill="solid"
                        (click)="restoreVersion(version)"
                        [disabled]="version.isCurrent">
              {{ version.isCurrent ? 'Current' : 'Restore' }}
            </ion-button>
          </div>
        </ion-card-content>
      </ion-card>
    </ion-virtual-scroll>
  </div>

  <div class="empty-state" *ngIf="versions.length === 0">
    <ion-icon name="time-outline"></ion-icon>
    <p>No version history available</p>
  </div>
</ion-content>

<ion-footer>
  <ion-toolbar>
    <ion-button slot="start" fill="clear" color="danger"
                (click)="deleteHistory()"
                [disabled]="versions.length === 0">
      <ion-icon name="trash-outline" slot="start"></ion-icon>
      Delete All History
    </ion-button>
    <ion-button slot="end" (click)="dismiss()">
      Close
    </ion-button>
  </ion-toolbar>
</ion-footer>
```

**Component Class:** `beat-version-history-modal.component.ts`

```typescript
@Component({
  selector: 'app-beat-version-history-modal',
  templateUrl: './beat-version-history-modal.component.html',
  styleUrls: ['./beat-version-history-modal.component.css']
})
export class BeatVersionHistoryModalComponent implements OnInit {
  @Input() beatId!: string;
  @Input() currentPrompt!: string;

  versions: BeatVersion[] = [];
  loading = false;

  constructor(
    private modalController: ModalController,
    private beatHistoryService: BeatHistoryService,
    private proseMirrorService: ProseMirrorEditorService,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {}

  async ngOnInit() {
    await this.loadHistory();
  }

  async loadHistory() {
    this.loading = true;
    const history = await this.beatHistoryService.getHistory(this.beatId);
    if (history) {
      // Sort by newest first
      this.versions = [...history.versions].sort(
        (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()
      );
    }
    this.loading = false;
  }

  formatVersionLabel(version: BeatVersion): string {
    const index = this.versions.indexOf(version);
    return `Version ${this.versions.length - index}`;
  }

  formatTimestamp(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  getPreview(content: string): string {
    const textContent = content.replace(/<[^>]*>/g, ''); // Strip HTML
    return textContent.length > 100
      ? textContent.substring(0, 100) + '...'
      : textContent;
  }

  toggleExpanded(version: BeatVersion) {
    version.expanded = !version.expanded;
  }

  async restoreVersion(version: BeatVersion) {
    if (version.isCurrent) return;

    const alert = await this.alertController.create({
      header: 'Restore Version',
      message: 'Replace current beat content with this version?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Restore',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Restoring version...'
            });
            await loading.present();

            try {
              await this.proseMirrorService.switchBeatVersion(
                this.beatId,
                version.versionId
              );
              await this.loadHistory(); // Refresh list
            } catch (error) {
              console.error('Error restoring version:', error);
            } finally {
              await loading.dismiss();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async deleteHistory() {
    const alert = await this.alertController.create({
      header: 'Delete History',
      message: 'Delete all version history for this beat? This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            await this.beatHistoryService.deleteHistory(this.beatId);
            this.versions = [];
          }
        }
      ]
    });

    await alert.present();
  }

  dismiss() {
    this.modalController.dismiss();
  }
}
```

#### Modified Component: `BeatAIComponent`

**Changes to:** `src/app/stories/components/beat-ai/beat-ai.component.ts`

Add version history button:

```typescript
// Add to template
<ion-button
  size="small"
  fill="clear"
  (click)="openVersionHistory()"
  [disabled]="!beatData.hasHistory">
  <ion-icon name="time-outline" slot="start"></ion-icon>
  History
</ion-button>

// Add to component class
async openVersionHistory() {
  const modal = await this.modalController.create({
    component: BeatVersionHistoryModalComponent,
    componentProps: {
      beatId: this.beatData.id,
      currentPrompt: this.beatData.prompt
    },
    cssClass: 'beat-history-modal'
  });

  await modal.present();

  // Refresh beat data after modal closes
  const { data } = await modal.onDidDismiss();
  if (data?.versionChanged) {
    this.refreshBeatData();
  }
}
```

### 5.4 Settings Integration

#### Database Maintenance Section

**Location:** `src/app/settings/components/database-maintenance/database-maintenance.component.ts`

Add new cleanup options:

```typescript
async deleteAllBeatHistories() {
  const alert = await this.alertController.create({
    header: 'Delete Beat Histories',
    message: 'Delete ALL beat generation histories? Stories will not be affected, but version history will be permanently lost.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Delete All',
        role: 'destructive',
        handler: async () => {
          const loading = await this.loadingController.create({
            message: 'Deleting histories...'
          });
          await loading.present();

          try {
            const count = await this.beatHistoryService.deleteAllHistories();
            await loading.dismiss();

            const successAlert = await this.alertController.create({
              header: 'Success',
              message: `Deleted ${count} beat histories`,
              buttons: ['OK']
            });
            await successAlert.present();
          } catch (error) {
            await loading.dismiss();
            console.error('Error deleting histories:', error);
          }
        }
      }
    ]
  });

  await alert.present();
}

async getBeatHistoryStats() {
  const stats = await this.beatHistoryService.getHistoryStats();
  return {
    totalHistories: stats.totalHistories,
    totalVersions: stats.totalVersions,
    estimatedSize: this.formatBytes(stats.totalSize)
  };
}
```

**Template addition:**

```html
<ion-item-group>
  <ion-item-divider>
    <ion-label>Beat Version History</ion-label>
  </ion-item-divider>

  <ion-item>
    <ion-label>
      <h3>Beat Histories</h3>
      <p>{{ historyStats.totalHistories }} beats with history</p>
      <p>{{ historyStats.totalVersions }} total versions</p>
      <p>Estimated size: {{ historyStats.estimatedSize }}</p>
    </ion-label>
  </ion-item>

  <ion-item button (click)="deleteAllBeatHistories()">
    <ion-icon name="trash-outline" slot="start" color="danger"></ion-icon>
    <ion-label color="danger">
      Delete All Beat Histories
    </ion-label>
  </ion-item>
</ion-item-group>
```

---

## 6. Mobile Performance Optimizations

### 6.1 Lazy Loading Strategy

**Principle:** Version history is loaded ONLY when user opens the modal.

```typescript
// DON'T load during story load
async loadStory(storyId: string) {
  const story = await this.storyService.getStory(storyId);
  // ... render story ...
  // NO history loading here
}

// DO load when user requests
async openVersionHistory(beatId: string) {
  // First time: fetch from database
  const history = await this.beatHistoryService.getHistory(beatId);
  // Subsequent times: use cache
}
```

### 6.2 Caching Strategy

**In-Memory Cache with TTL:**

```typescript
private historyCache = new Map<string, {
  history: BeatVersionHistory;
  loadedAt: Date;
}>();

private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async getHistory(beatId: string): Promise<BeatVersionHistory | null> {
  // Check cache first
  const cached = this.historyCache.get(beatId);
  if (cached && Date.now() - cached.loadedAt.getTime() < this.CACHE_TTL) {
    return cached.history;
  }

  // Fetch from database
  const history = await this.historyDb.get(`history-${beatId}`);

  // Update cache
  this.historyCache.set(beatId, {
    history,
    loadedAt: new Date()
  });

  return history;
}
```

### 6.3 Version Limit

**Auto-prune old versions to prevent document bloat:**

```typescript
private MAX_VERSIONS_PER_BEAT = 10;

async saveVersion(beatId: string, versionData: Omit<BeatVersion, 'versionId'>): Promise<string> {
  // ... create version entry ...

  // Check version count
  if (history.versions.length > this.MAX_VERSIONS_PER_BEAT) {
    // Keep newest MAX_VERSIONS_PER_BEAT versions
    history.versions = history.versions
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
      .slice(0, this.MAX_VERSIONS_PER_BEAT);
  }

  // Save to database
  await this.historyDb.put(history);
}
```

**Configurable in settings:**
```typescript
interface AppSettings {
  // ... existing settings ...
  beatHistory: {
    maxVersionsPerBeat: number;    // Default: 10
    enableAutoCleanup: boolean;    // Default: true
  };
}
```

**User Decision:** Limit set to 10 versions (approved 2025-10-22)

### 6.4 Virtual Scrolling

**Use Ionic's virtual scrolling for long version lists:**

```html
<ion-virtual-scroll
  [items]="versions"
  approxItemHeight="120px"
  [headerFn]="getHeader">
  <ion-card *virtualItem="let version">
    <!-- Version content -->
  </ion-card>
</ion-virtual-scroll>
```

**Benefits:**
- Only renders visible items + buffer
- Smooth scrolling even with 100+ versions
- Minimal memory footprint

### 6.5 Database Size Monitoring

**Track storage usage:**

```typescript
async getHistoryStats(): Promise<HistoryStats> {
  const allDocs = await this.historyDb.allDocs({ include_docs: true });

  let totalVersions = 0;
  let totalSize = 0;

  allDocs.rows.forEach(row => {
    const doc = row.doc as BeatVersionHistory;
    totalVersions += doc.versions.length;
    // Estimate size (rough approximation)
    totalSize += JSON.stringify(doc).length;
  });

  return {
    totalHistories: allDocs.rows.length,
    totalVersions,
    totalSize
  };
}
```

### 6.6 Offline-First Consideration

**History database is local-only by default:**

```typescript
// Main story DB: syncs with CouchDB
this.storyDb = new PouchDB('stories');
this.storyDb.sync('http://server.com/stories', { live: true, retry: true });

// History DB: local only (no sync)
this.historyDb = new PouchDB('beat-histories');
// NO sync configured

// Optional: Sync on user request
async enableHistorySync() {
  this.historyDb.sync('http://server.com/beat-histories', {
    live: false,  // Manual sync only
    retry: false
  });
}
```

**Benefits:**
- Reduces network traffic
- Faster story loading
- History is device-specific
- Users can manually sync if needed

---

## 7. Implementation Plan

### Phase 1: Foundation (Day 1)

**Task 1.1: Database Setup**
- [ ] Create `BeatVersionHistory` and `BeatVersion` interfaces
- [ ] Create `BeatHistoryService` with core CRUD operations
- [ ] Add unit tests for service methods
- [ ] Initialize `beat-histories` database on app startup

**Task 1.2: Service Integration**
- [ ] Modify `BeatAIService.generateBeatContent()` to save versions
- [ ] Add version tracking to `BeatAI` interface (`currentVersionId`, `hasHistory`)
- [ ] Update beat node schema in `ProseMirrorEditorService`

**Task 1.3: Testing**
- [ ] Test version creation during beat generation
- [ ] Verify history document structure in IndexedDB
- [ ] Test version limits (max 20 versions)

### Phase 2: UI Components (Day 2)

**Task 2.1: Version History Modal**
- [ ] Create `BeatVersionHistoryModalComponent`
- [ ] Implement version list with virtual scrolling
- [ ] Add expand/collapse for version preview
- [ ] Style modal for mobile and desktop

**Task 2.2: Beat Component Integration**
- [ ] Add "History" button to `BeatAIComponent`
- [ ] Enable/disable based on `hasHistory` flag
- [ ] Wire up modal opening logic
- [ ] Add loading states

**Task 2.3: Version Switching**
- [ ] Implement `ProseMirrorEditorService.switchBeatVersion()`
- [ ] Add content replacement logic
- [ ] Update beat node attributes on switch
- [ ] Test undo/redo after version switch

### Phase 3: Settings & Maintenance (Day 3)

**Task 3.1: Database Maintenance UI**
- [ ] Add beat history stats to database maintenance page
- [ ] Implement "Delete All Histories" button
- [ ] Add confirmation dialogs with proper warnings
- [ ] Show success/error messages

**Task 3.2: Settings Configuration**
- [ ] Add `beatHistory` section to settings interface
- [ ] Create UI for max versions configuration
- [ ] Implement auto-cleanup toggle
- [ ] Save settings to local storage

**Task 3.3: Cleanup Automation**
- [ ] Implement auto-cleanup on version save
- [ ] Add background cleanup for old histories
- [ ] Test cleanup doesn't break current versions

### Phase 4: Testing & Polish (Day 4)

**Task 4.1: Integration Testing**
- [ ] Test full flow: generate → regenerate → view history → restore
- [ ] Test with multiple beats in a scene
- [ ] Test with different AI models
- [ ] Test offline behavior

**Task 4.2: Performance Testing**
- [ ] Measure modal load time with 20 versions
- [ ] Test virtual scrolling with 50+ versions
- [ ] Verify cache hit rates
- [ ] Check memory usage on mobile

**Task 4.3: Mobile Testing**
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Verify touch interactions
- [ ] Check responsive layout

**Task 4.4: Edge Cases**
- [ ] Test with empty history
- [ ] Test deleting current version
- [ ] Test restoring while generating
- [ ] Test database errors

### Phase 5: Documentation & Deployment (Day 5)

**Task 5.1: Documentation**
- [ ] Update user guide with version history feature
- [ ] Document database schema changes
- [ ] Add troubleshooting section
- [ ] Create migration guide (if needed)

**Task 5.2: Code Quality**
- [ ] Run linter and fix issues
- [ ] Add JSDoc comments to public APIs
- [ ] Ensure test coverage > 80%
- [ ] Code review and refactoring

**Task 5.3: Build & Deploy**
- [ ] Run production build
- [ ] Test production bundle size
- [ ] Create release notes
- [ ] Deploy to staging

---

## 8. Design Decisions & Tradeoffs

### Decision 1: Separate Database vs. Embedded in Story

**Options:**
- A) Store versions in separate `beat-histories` database
- B) Embed versions array in story document
- C) Store each version as separate document

**Decision: Option A (Separate Database)**

**Rationale:**
- ✅ Story documents remain lightweight (faster loading)
- ✅ Lazy loading possible (only load when needed)
- ✅ Easy to delete all histories without affecting stories
- ✅ No migration needed for existing stories
- ❌ Requires managing two databases
- ❌ No automatic sync (by design)

**Alternative Rejected:**
- Option B would bloat story documents (slower sync, more memory)
- Option C would create too many documents (harder to manage)

---

### Decision 2: Version Limit (20 versions)

**Options:**
- A) No limit (keep all versions forever)
- B) Time-based limit (keep last 7 days)
- C) Count-based limit (keep last N versions)

**Decision: Option C (20 versions)**

**Rationale:**
- ✅ Predictable storage usage
- ✅ Covers most use cases (rare to need 20+ iterations)
- ✅ Easy to implement and understand
- ✅ Configurable by user
- ❌ Old versions lost permanently

**Why 20?**
- Typical beat iteration: 3-5 attempts before satisfied
- Power users might iterate 10-15 times
- 20 provides comfortable buffer
- Storage cost: ~50KB per beat with 20 versions (acceptable)

---

### Decision 3: Local-Only Storage (No Sync by Default)

**Options:**
- A) Sync history to CouchDB automatically
- B) Local-only storage (no sync)
- C) Optional sync (user enabled)

**Decision: Option B (Local-Only)**

**Rationale:**
- ✅ Faster story loading (less data to sync)
- ✅ Reduced network traffic
- ✅ Lower server storage costs
- ✅ Privacy (history stays on device)
- ❌ Lost if device cleared
- ❌ Not available across devices

**Future Enhancement:**
- Can add Option C later if users request cross-device history

---

### Decision 4: Cache Strategy (5-Minute TTL)

**Options:**
- A) No caching (fetch from DB every time)
- B) Permanent cache (until app restart)
- C) Time-based cache (5-minute TTL)

**Decision: Option C (5-Minute TTL)**

**Rationale:**
- ✅ Reduces database queries for repeated access
- ✅ Balances memory usage and performance
- ✅ Ensures reasonably fresh data
- ❌ Adds complexity

**Why 5 minutes?**
- User typically closes and reopens modal within this window
- Long enough to benefit from caching
- Short enough to avoid stale data issues

---

### Decision 5: Virtual Scrolling for Version List

**Options:**
- A) Render all versions at once
- B) Pagination (10 per page)
- C) Virtual scrolling (Ionic component)

**Decision: Option C (Virtual Scrolling)**

**Rationale:**
- ✅ Best mobile performance
- ✅ Smooth UX (no page breaks)
- ✅ Built into Ionic (no custom code)
- ✅ Handles 100+ versions gracefully
- ❌ Requires Ionic component (dependency)

---

### Decision 6: Full Content Storage vs. Diffs

**Options:**
- A) Store full HTML content per version
- B) Store diffs/deltas between versions
- C) Store compressed content

**Decision: Option A (Full Content)**

**Rationale:**
- ✅ Instant version switching (no reconstruction)
- ✅ Simple implementation
- ✅ Robust (no dependency on previous versions)
- ❌ Higher storage usage

**Storage Analysis:**
- Average beat output: ~2KB (400 words)
- 20 versions × 2KB = 40KB per beat
- 100 beats with history = 4MB total
- **Conclusion:** Storage cost acceptable for simplicity

**Alternative Rejected:**
- Option B (diffs) would require complex reconstruction logic
- Risk of corruption if any version corrupted
- Minimal storage savings (~30-40% compression) not worth complexity

---

## 9. Storage Estimates & Performance Metrics

### Storage Analysis

**Per-Beat Estimates:**
```
Average beat content: 400 words × 5 chars/word = 2000 characters = ~2KB
Version metadata: ~500 bytes (prompt, model, timestamps, etc.)
Single version: 2KB + 500B = 2.5KB
20 versions: 2.5KB × 20 = 50KB per beat history
```

**App-Wide Estimates:**
```
Small user (10 beats with history):    10 × 50KB = 500KB
Medium user (50 beats with history):   50 × 50KB = 2.5MB
Large user (200 beats with history):   200 × 50KB = 10MB
Power user (500 beats with history):   500 × 50KB = 25MB
```

**Conclusion:** Storage usage is acceptable even for power users.

### Performance Targets

**Load Times (Mobile 4G):**
- Story load (without history): < 1 second ✅ (no change from current)
- Open version history modal: < 500ms
- Switch version: < 300ms
- Delete history: < 200ms

**Memory Usage:**
- History cache: < 5MB (for ~100 cached histories)
- Modal component: < 1MB
- Total overhead: < 6MB (acceptable)

**Database Operations:**
- Get history (first time): < 100ms
- Get history (cached): < 10ms
- Save new version: < 50ms
- Delete history: < 100ms

### Optimization Checkpoints

**If performance degrades:**
1. Reduce `MAX_VERSIONS_PER_BEAT` to 10
2. Implement content compression (gzip)
3. Use delta storage for versions
4. Paginate version list (10 per page)
5. Move to separate version database per story

---

## 10. Future Enhancements

### Post-MVP Features

**Priority 2 (Nice to Have):**
- [ ] Compare two versions side-by-side
- [ ] Favorite/star specific versions
- [ ] Add notes to versions
- [ ] Export version history as JSON
- [ ] Search within version history

**Priority 3 (Advanced):**
- [ ] Sync history to cloud (optional)
- [ ] Share version with other users
- [ ] Automatic version tagging (e.g., "best output")
- [ ] AI-powered version comparison
- [ ] Merge content from multiple versions

### Technical Debt Considerations

**Monitor for Issues:**
- Database size growth (alert if > 50MB)
- Version switch performance (alert if > 500ms)
- Cache memory usage (implement LRU if needed)
- Modal load time (optimize if > 1s)

**Potential Refactoring:**
- If history DB grows large, consider per-story databases
- If switching is slow, pre-load adjacent versions
- If cache memory high, implement more aggressive eviction

---

## 11. Security & Privacy Considerations

### Data Privacy

**Current Approach:**
- Version history stored locally (IndexedDB)
- No automatic sync to server
- No tracking or analytics on version usage

**User Control:**
- Users can delete individual beat histories
- Users can delete ALL histories via settings
- Clear documentation on what's stored

### Data Retention

**Automatic Cleanup:**
- Keep last 20 versions per beat (configurable)
- No time-based expiration (user controls deletion)

**Manual Cleanup:**
- Database maintenance page shows storage usage
- One-click delete all histories
- Confirmation dialogs prevent accidental deletion

### Offline Considerations

**Behavior:**
- Version history works fully offline
- No network required for any history operations
- Sync (if enabled in future) requires explicit user action

---

## 12. Testing Strategy

### Unit Tests

**BeatHistoryService:**
- [ ] `saveVersion()` creates version with correct ID
- [ ] `saveVersion()` marks previous version as not current
- [ ] `saveVersion()` enforces version limit
- [ ] `getHistory()` returns null for non-existent beat
- [ ] `getHistory()` uses cache when available
- [ ] `setCurrentVersion()` updates correct version
- [ ] `deleteHistory()` removes document
- [ ] `deleteAllHistories()` returns correct count

**ProseMirrorEditorService:**
- [ ] `switchBeatVersion()` deletes old content
- [ ] `switchBeatVersion()` inserts new content
- [ ] `switchBeatVersion()` updates beat node attributes
- [ ] `switchBeatVersion()` marks version as current

### Integration Tests

**Full Flow:**
- [ ] Generate beat → History created with 1 version
- [ ] Regenerate beat → History has 2 versions
- [ ] Open history modal → Versions displayed correctly
- [ ] Restore old version → Content replaced
- [ ] Delete history → History removed, beat unchanged

### E2E Tests

**User Scenarios:**
- [ ] User generates beat 5 times, sees all versions
- [ ] User restores version 3, continues editing
- [ ] User deletes history, tries to open modal (shows empty)
- [ ] User cleans up all histories in settings

### Performance Tests

**Benchmarks:**
- [ ] Open modal with 20 versions: < 500ms
- [ ] Switch version: < 300ms
- [ ] Scroll through 50 versions: smooth (60fps)
- [ ] Load story with 50 beats: < 1s (no regression)

---

## 13. Migration Plan

### Database Migration

**Existing Users:**
- No migration needed (new feature, no schema changes to existing data)
- History database created on first use
- Existing beats get `hasHistory: false` by default

**Version Check:**
```typescript
async initializeHistoryFeature() {
  const settings = await this.settingsService.getSettings();

  if (!settings.beatHistoryInitialized) {
    // First-time setup
    await this.createHistoryDatabase();
    await this.settingsService.updateSettings({
      beatHistoryInitialized: true,
      beatHistory: {
        maxVersionsPerBeat: 20,
        enableAutoCleanup: true
      }
    });
  }
}
```

### Rollback Plan

**If Issues Arise:**
1. Disable version history feature via feature flag
2. History data persists (not deleted)
3. Re-enable after fix deployed
4. No data loss

---

## 14. Success Metrics

### User Adoption

**Tracking (Optional - No Analytics Required):**
- % of users who open version history modal
- Average versions per beat
- Average version switches per session

**Goals:**
- 30% of active users use version history within first month
- Average 3-5 versions per beat with history
- 80% user satisfaction (if surveyed)

### Performance

**Goals:**
- No regression in story load time
- Modal opens in < 500ms on mobile
- Version switch in < 300ms
- App size increase < 50KB (gzipped)

### Stability

**Goals:**
- Zero data loss incidents
- < 0.1% error rate on version operations
- No performance degradation after 6 months of use

---

## 15. Documentation Checklist

**User Documentation:**
- [ ] Feature overview in user guide
- [ ] How to view version history
- [ ] How to restore previous version
- [ ] How to delete histories
- [ ] FAQ section

**Developer Documentation:**
- [ ] Database schema reference
- [ ] API documentation for BeatHistoryService
- [ ] Component usage examples
- [ ] Testing guide
- [ ] Troubleshooting guide

**Deployment Documentation:**
- [ ] Feature flag configuration
- [ ] Database initialization steps
- [ ] Rollback procedure
- [ ] Monitoring recommendations

---

## 16. Summary & Recommendations

### Core Decisions

1. **Separate Database:** Use dedicated `beat-histories` PouchDB database
2. **Version Limit:** Keep last 20 versions per beat (configurable)
3. **Local Storage:** No automatic sync (keeps feature lightweight)
4. **Lazy Loading:** Load history only when user opens modal
5. **Virtual Scrolling:** Use Ionic component for performance
6. **Full Content Storage:** Store complete HTML per version (no diffs)

### Implementation Priority

**Must Have (MVP):**
- ✅ Save version on each generation
- ✅ View version list in modal
- ✅ Restore previous version
- ✅ Delete history via settings

**Should Have (Post-MVP):**
- Compare versions side-by-side
- Version notes/annotations
- Export history

**Nice to Have (Future):**
- Cloud sync (optional)
- AI-powered comparison
- Version merging

### Risk Mitigation

**Low Risk:**
- Separate database = no impact on existing features
- Lazy loading = no performance regression
- Clear user controls = good UX

**Medium Risk:**
- Storage growth (mitigated by version limit)
- Cache memory (mitigated by TTL and limits)

**High Risk:**
- None identified

### Recommendation

**Proceed with implementation using the architecture described above.**

**Rationale:**
- ✅ Addresses user need (easy revert to previous generation)
- ✅ Minimal performance impact (lazy loading, caching)
- ✅ Scalable (version limits prevent bloat)
- ✅ Maintainable (separate database, clear separation of concerns)
- ✅ Mobile-friendly (virtual scrolling, offline-first)

**Estimated Effort:**
- Development: 4-5 days
- Testing: 1-2 days
- Total: 1-1.5 weeks

**Next Steps:**
1. Review and approve this specification
2. Create implementation tasks in project management tool
3. Begin Phase 1 (Foundation) implementation
4. Regular progress check-ins during development

---

## Appendix A: Alternative Approaches Considered

### Alternative 1: Browser History API

**Idea:** Use browser's undo/redo stack for version management.

**Rejected Because:**
- Limited to current session (lost on page reload)
- No persistence across devices
- Can't browse arbitrary versions
- Conflicts with other editor undo operations

### Alternative 2: Git-like Version Control

**Idea:** Implement full version control with branches, merges, diffs.

**Rejected Because:**
- Overkill for user needs
- Complex UI (intimidating for writers)
- Performance overhead
- Difficult to implement correctly

### Alternative 3: Server-Side Snapshots Only

**Idea:** Extend existing snapshot service to track beat versions.

**Rejected Because:**
- 15-minute granularity too coarse
- Requires server round-trip (slow)
- Doesn't work offline
- Increases server storage costs

### Alternative 4: Undo/Redo Stack

**Idea:** Implement generic undo/redo for entire editor.

**Rejected Because:**
- Complex to implement correctly
- Would affect all editor operations (not just beats)
- Lost on page reload (unless persisted)
- Doesn't provide browsable history

---

## Appendix B: Database Schema Examples

### Example History Document

```json
{
  "_id": "history-beat-k7x2m9qwe",
  "_rev": "3-abc123",
  "type": "beat-history",
  "beatId": "beat-k7x2m9qwe",
  "storyId": "story-xyz789",
  "userId": "user-123",
  "versions": [
    {
      "versionId": "v-1729611234567-a1b2c3",
      "content": "<p>In the deep forest, ancient trees whispered secrets...</p>",
      "prompt": "Describe the forest setting in a mysterious tone",
      "model": "claude-opus-4",
      "beatType": "story",
      "wordCount": 400,
      "generatedAt": "2025-10-22T14:20:34.567Z",
      "characterCount": 2134,
      "isCurrent": false,
      "selectedScenes": [
        { "sceneId": "scene-1", "chapterId": "chapter-1" }
      ],
      "includeStoryOutline": true
    },
    {
      "versionId": "v-1729611345678-d4e5f6",
      "content": "<p>The forest loomed dark and mysterious in the twilight...</p>",
      "prompt": "Describe the forest setting in a mysterious tone",
      "model": "gpt-4-turbo",
      "beatType": "story",
      "wordCount": 400,
      "generatedAt": "2025-10-22T14:22:25.678Z",
      "characterCount": 2056,
      "isCurrent": false,
      "selectedScenes": [
        { "sceneId": "scene-1", "chapterId": "chapter-1" }
      ],
      "includeStoryOutline": true
    },
    {
      "versionId": "v-1729611456789-g7h8i9",
      "content": "<p>Ancient oaks stood sentinel in the gathering darkness...</p>",
      "prompt": "Describe the forest setting in a mysterious tone",
      "model": "claude-opus-4",
      "beatType": "story",
      "wordCount": 400,
      "generatedAt": "2025-10-22T14:24:16.789Z",
      "characterCount": 2089,
      "isCurrent": true,
      "selectedScenes": [
        { "sceneId": "scene-1", "chapterId": "chapter-1" }
      ],
      "includeStoryOutline": true
    }
  ],
  "createdAt": "2025-10-22T14:20:34.567Z",
  "updatedAt": "2025-10-22T14:24:16.789Z"
}
```

---

## Appendix C: UI Mockups

### Mobile Version History Modal (Portrait)

```
┌─────────────────────────────────┐
│ Beat Version History       [X]  │
├─────────────────────────────────┤
│ Current Prompt:                 │
│ "Describe the forest setting   │
│  in a mysterious tone"          │
│                                 │
│ Version History (3 versions)    │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ✓ Version 3 - Just now      │ │
│ │   Claude Opus 4 • 400 words │ │
│ │                             │ │
│ │ Ancient oaks stood sentinel │ │
│ │ in the gathering darkness...│ │
│ │                             │ │
│ │ [View Full]  [CURRENT]      │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │   Version 2 - 2 min ago     │ │
│ │   GPT-4 Turbo • 400 words   │ │
│ │                             │ │
│ │ The forest loomed dark and  │ │
│ │ mysterious in the twilight..│ │
│ │                             │ │
│ │ [View Full]  [Restore]      │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │   Version 1 - 4 min ago     │ │
│ │   ... (collapsed)           │ │
│ └─────────────────────────────┘ │
│                                 │
├─────────────────────────────────┤
│ [Delete All] [Close]            │
└─────────────────────────────────┘
```

### Desktop Version History Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│ Beat Version History                                           [X]  │
├─────────────────────────────────────────────────────────────────────┤
│ Current Prompt: "Describe the forest setting in a mysterious tone" │
│                                                                     │
│ Version History (3 versions)                                        │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ✓ Version 3 - Just now • Claude Opus 4 • 400 words • 2089 chars│ │
│ │                                                                 │ │
│ │ Ancient oaks stood sentinel in the gathering darkness, their   │ │
│ │ gnarled branches reaching toward a sky painted in shades of    │ │
│ │ purple and grey. A mist crept between the massive trunks...    │ │
│ │                                                                 │ │
│ │                          [View Full Text]  [CURRENT VERSION]    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │   Version 2 - 2 minutes ago • GPT-4 Turbo • 400 words • 2056 ch│ │
│ │                                                                 │ │
│ │ The forest loomed dark and mysterious in the twilight, ancient │ │
│ │ trees standing like silent guardians. Shadows deepened between │ │
│ │ the towering trunks as the last light faded from the sky...    │ │
│ │                                                                 │ │
│ │                          [View Full Text]  [Restore This]       │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │   Version 1 - 4 minutes ago • Claude Opus 4 • 400 words        │ │
│ │   (Click to expand)                                             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ [Delete All History]                            [Close]             │
└─────────────────────────────────────────────────────────────────────┘
```

---

**End of Specification**
