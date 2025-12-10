import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService, User } from './auth.service';
import { SyncLoggerService } from './sync-logger.service';
import { PouchDB } from '../../app';
import { countStories } from '../../shared/utils/document-filters';

// Minimal static type for the PouchDB constructor when loaded via ESM
interface PouchDBStatic {
  new (nameOrUrl: string, options?: PouchDB.Configuration.DatabaseConfiguration): PouchDB.Database;
  plugin(plugin: unknown): void;
}

// Minimal replication sync interface used by this service
interface PouchSync {
  on(event: string, handler: (info: unknown) => void): PouchSync;
  off(event: string, handler?: (info: unknown) => void): PouchSync;
  cancel(): void;
}

export interface SyncStatus {
  isOnline: boolean;
  isSync: boolean;
  isConnecting?: boolean;
  lastSync?: Date;
  error?: string;
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

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private readonly authService = inject(AuthService);
  private readonly syncLogger = inject(SyncLoggerService);
  
  private db: PouchDB.Database | null = null;
  private remoteDb: PouchDB.Database | null = null;
  private syncHandler: PouchSync | null = null;
  private initializationPromise: Promise<void> | null = null;
  private syncStatusSubject = new BehaviorSubject<SyncStatus>({
    isOnline: navigator.onLine,
    isSync: false
  });

  // Runtime reference to the PouchDB constructor loaded via ESM
  // Types for PouchDB usage remain via the ambient PouchDB namespace
  private pouchdbCtor: PouchDBStatic | null = null;

  // Track the active story for selective sync
  private activeStoryId: string | null = null;

  // Track if sync is temporarily paused (e.g., during AI streaming)
  private syncPaused = false;
  private activePauseCount = 0;

  // Bootstrap mode: When true, sync ALL documents including stories
  // Used when local database is empty and metadata index is missing
  private bootstrapSyncMode = false;

  public syncStatus$: Observable<SyncStatus> = this.syncStatusSubject.asObservable();

  constructor() {
    // Use preloaded PouchDB from app.ts
    this.pouchdbCtor = PouchDB as unknown as PouchDBStatic;

    // Initialize with default database (will be updated when user logs in)
    this.initializationPromise = this.initializeDatabase('creative-writer-stories');

    // Subscribe to user changes to switch databases
    this.authService.currentUser$.subscribe(user => {
      this.handleUserChange(user);
    });

    // Setup online/offline detection
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
  }

  private async initializeDatabase(dbName: string): Promise<void> {
    // PouchDB is now preloaded in app.ts, no need for dynamic imports
    if (!this.pouchdbCtor) {
      throw new Error('PouchDB not preloaded - check app.ts initialization');
    }

    // Stop sync first
    await this.stopSync();
    
    // Close existing database safely
    if (this.db) {
      try {
        await this.db.close();
      } catch (error) {
        console.warn('Error closing database:', error);
      }
    }

    this.db = new this.pouchdbCtor(dbName);

    // Clean up old mrview databases in background (don't block initialization)
    // This frees up IndexedDB storage without affecting user data
    this.cleanupOldDatabases().catch(err => {
      console.warn('[DatabaseService] Background cleanup failed:', err);
    });

    // Increase EventEmitter limit to prevent memory leak warnings
    // PouchDB sync operations create many internal event listeners
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (this.db && (this.db as any).setMaxListeners) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.db as any).setMaxListeners(20);
    }

    // Create minimal indexes for non-story documents only
    // Stories use allDocs() which is faster for small datasets
    const indexes = [
      // Indexes for non-story documents (codex, video, etc.)
      { fields: ['type'] },
      { fields: ['storyId'] }
    ];

    // Store reference to current db to prevent race conditions
    const currentDb = this.db;

    // Create indexes in background - don't block database availability
    // This prevents slow index creation from delaying app startup
    Promise.all(
      indexes.map(async (indexDef) => {
        try {
          // Only create index if this database instance is still active
          if (currentDb === this.db) {
            await currentDb.createIndex({ index: indexDef });
          }
        } catch (err) {
          // Ignore errors if database was closed during initialization
          if (err && typeof err === 'object' && 'message' in err &&
              !(err.message as string).includes('database is closed')) {
            console.warn(`Could not create index for ${JSON.stringify(indexDef.fields)}:`, err);
          }
        }
      })
    ).then(() => {
      // Index creation completed
    }).catch(err => {
      console.warn('[DatabaseService] Index creation failed:', err);
    });

    // PERFORMANCE FIX: Don't await sync setup - let it happen in background
    // This prevents network delays from blocking database availability
    this.setupSync().catch(err => {
      console.warn('[DatabaseService] Background sync setup failed:', err);
    });
  }

  private async handleUserChange(user: User | null): Promise<void> {
    // Immediately switch database when user changes (no setTimeout to avoid race conditions)
    if (user) {
      const userDbName = this.authService.getUserDatabaseName();
      if (userDbName && userDbName !== (this.db?.name)) {
        this.initializationPromise = this.initializeDatabase(userDbName);
        await this.initializationPromise;
      }
    } else {
      // User logged out - switch to anonymous database
      const anonymousDb = 'creative-writer-stories-anonymous';
      if (this.db?.name !== anonymousDb) {
        this.initializationPromise = this.initializeDatabase(anonymousDb);
        await this.initializationPromise;
      }
    }
  }

  async getDatabase(): Promise<PouchDB.Database> {
    // Wait for initialization to complete
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // Synchronous getter for backwards compatibility (use with caution)
  getDatabaseSync(): PouchDB.Database | null {
    return this.db;
  }

  /**
   * Set the active story ID for selective sync.
   * Only the active story and its related documents will be synced.
   * Set to null to sync all documents.
   */
  setActiveStoryId(storyId: string | null): void {
    const changed = this.activeStoryId !== storyId;
    const previousId = this.activeStoryId;
    this.activeStoryId = storyId;

    console.info(`[DatabaseService] setActiveStoryId: ${previousId} → ${storyId} (changed: ${changed})`);

    // If the active story changed and sync is running, restart sync to apply new filter
    if (changed && this.syncHandler) {
      console.info('[DatabaseService] Restarting sync to apply new activeStoryId filter...');
      this.stopSync().then(() => {
        console.info('[DatabaseService] Sync stopped, starting with new filter...');
        this.startSync();
        console.info('[DatabaseService] Sync restarted with activeStoryId:', this.activeStoryId);
      }).catch(err => {
        console.error('Error restarting sync after story change:', err);
      });
    } else if (changed && !this.syncHandler) {
      console.warn('[DatabaseService] activeStoryId changed but sync is not running');
    }
  }

  /**
   * Get the currently active story ID for selective sync
   */
  getActiveStoryId(): string | null {
    return this.activeStoryId;
  }

  /**
   * Force replication of a specific document from remote
   * This is useful when opening a story to ensure it's immediately pulled from remote
   *
   * @param docId The document ID to replicate
   * @returns Promise that resolves when replication completes
   */
  async forceReplicateDocument(docId: string): Promise<void> {
    if (!this.remoteDb || !this.db) {
      console.warn('[DatabaseService] Cannot force replicate: database not initialized');
      return;
    }

    console.info(`[DatabaseService] Force replicating document: ${docId}`);

    try {
      // Do a one-time pull replication for this specific document
      await this.db.replicate.from(this.remoteDb, {
        doc_ids: [docId],
        timeout: 10000
      });
      console.info(`[DatabaseService] ✓ Successfully replicated document: ${docId}`);
    } catch (error) {
      console.error(`[DatabaseService] Failed to replicate document ${docId}:`, error);
      throw error;
    }
  }

  async setupSync(remoteUrl?: string): Promise<void> {
    try {
      // Use provided URL or try to detect from environment/location
      const couchUrl = remoteUrl || this.getCouchDBUrl();

      if (!couchUrl) {
        return;
      }

      // Indicate that we're connecting
      this.updateSyncStatus({
        isConnecting: true,
        error: undefined
      });

      const Pouch = this.pouchdbCtor;
      if (!Pouch) {
        throw new Error('PouchDB not initialized');
      }
      this.remoteDb = new Pouch(couchUrl, {
        auth: {
          username: 'admin',
          password: 'password' // TODO: Make this configurable
        }
      });

      // Test connection
      try {
        await this.remoteDb.info();
      } catch (testError) {
        // If info() fails, likely the CouchDB server is not available or returns HTML error page
        // Clean up the remoteDb reference and throw a more user-friendly error
        this.remoteDb = null;
        throw new Error(`CouchDB connection failed: ${testError instanceof Error ? testError.message : String(testError)}`);
      }

      // Connection successful, clear connecting state
      this.updateSyncStatus({ isConnecting: false });

      // Start bidirectional sync
      this.startSync();

    } catch (error) {
      console.warn('Could not setup sync:', error);
      this.remoteDb = null;

      const errorMessage = this.getFriendlySyncError(error, 'Sync setup failed');
      this.updateSyncStatus({
        error: errorMessage,
        isConnecting: false
      });
    }
  }

  private getCouchDBUrl(): string | null {
    // Try to determine CouchDB URL based on current location
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;
    
    // Get the current database name (user-specific)
    const dbName = this.db ? this.db.name : 'creative-writer-stories-anonymous';
    
    // Check if we're running with nginx reverse proxy (through /_db/ path)
    const baseUrl = port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
    
    // For development with direct CouchDB access
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && !this.isReverseProxySetup()) {
      return `${protocol}//${hostname}:5984/${dbName}`;
    }
    
    // For production or reverse proxy setup - use /_db/ prefix
    return `${baseUrl}/_db/${dbName}`;
  }

  private isReverseProxySetup(): boolean {
    // Check if we can detect reverse proxy setup by testing for nginx-specific headers
    // or by checking if the current port is not 5984 (standard CouchDB port)
    const port = window.location.port;
    // If running on port 3080 (nginx proxy port) or any non-5984 port, assume reverse proxy
    return port === '3080' || (port !== '5984' && port !== '');
  }

  private startSync(): void {
    if (!this.remoteDb || !this.db) return;

    const handler = this.db.sync(this.remoteDb, {
      live: true,
      retry: true,
      timeout: 30000,
      // SELECTIVE SYNC: Filter to only sync active story and related documents
      // This significantly reduces memory usage and sync operations on mobile
      filter: (doc: PouchDB.Core.Document<Record<string, unknown>>) => {
        const docType = (doc as { type?: string }).type;
        const docId = doc._id;

        // Always exclude snapshots
        if (docType === 'story-snapshot') {
          return false;
        }

        // ALWAYS sync the story metadata index (lightweight document for story list)
        if (docId === 'story-metadata-index' || docType === 'story-metadata-index') {
          return true;
        }

        // Sync user-wide documents (not story-specific)
        // These include: custom backgrounds, videos, etc.
        const userWideTypes = ['custom-background', 'video', 'image-video-association'];
        if (docType && userWideTypes.includes(docType)) {
          return true;
        }

        // BOOTSTRAP MODE: When enabled, sync ALL documents to populate empty database
        // This is used when local database is empty and metadata index is missing
        if (this.bootstrapSyncMode) {
          // In bootstrap mode, sync everything except snapshots (already excluded above)
          console.info(`[SyncFilter] ✓ Bootstrap mode: syncing ${docId}`);
          return true;
        }

        // If no active story is set (viewing story list), ONLY sync index + user-wide docs
        // DO NOT sync individual story documents - they're not needed for the list view
        if (!this.activeStoryId) {
          // Story documents have no type field - exclude them
          if (!docType) {
            console.debug(`[SyncFilter] Excluding story document ${docId} (no activeStoryId)`);
            return false;
          }
          // Codex documents are story-specific - exclude them
          if (docType === 'codex') {
            return false;
          }
          // Allow other document types (already handled user-wide types above)
          return true;
        }

        // SELECTIVE SYNC ENABLED: Only sync active story and related documents

        // 1. Sync the active story document (stories have no type field)
        if (!docType && docId === this.activeStoryId) {
          console.info(`[SyncFilter] ✓ Syncing active story: ${docId}`);
          return true;
        }

        // 2. Sync codex for the active story
        const storyId = (doc as { storyId?: string }).storyId;
        if (docType === 'codex' && storyId === this.activeStoryId) {
          console.info(`[SyncFilter] ✓ Syncing codex for active story: ${docId}`);
          return true;
        }

        // 3. Exclude all other documents (other stories, their codex entries, etc.)
        if (!docType) {
          console.debug(`[SyncFilter] Excluding story document ${docId} (not active story ${this.activeStoryId})`);
        }
        return false;
      }
    }) as unknown as PouchSync;

    this.syncHandler = (handler as unknown as PouchDB.Replication.Sync<Record<string, unknown>>)
    .on('change', (info: unknown) => {
      // Extract document details from change event
      let docsProcessed = 0;
      let currentDoc = undefined;
      let operation: 'push' | 'pull' = 'pull';

      if (info && typeof info === 'object') {
        // Check if this is a push or pull operation
        if ('direction' in info && info.direction === 'push') {
          operation = 'push';
        }

        // Extract documents information
        if ('change' in info && info.change && typeof info.change === 'object') {
          const change = info.change as { docs?: unknown[] };
          if (change.docs && Array.isArray(change.docs)) {
            docsProcessed = change.docs.length;

            // Get the last document details
            if (change.docs.length > 0) {
              const lastDoc = change.docs[change.docs.length - 1];
              if (lastDoc && typeof lastDoc === 'object' && '_id' in lastDoc) {
                currentDoc = {
                  id: (lastDoc as { _id: string })._id,
                  type: 'type' in lastDoc ? String((lastDoc as { type: unknown }).type) : undefined,
                  title: 'title' in lastDoc ? String((lastDoc as { title: unknown }).title) : undefined
                };
              }
            }
          }
        }
      }

      // Update progress only - DO NOT set isSync: false or lastSync here!
      // Those should only be set in the 'paused' handler when sync is truly complete.
      // Setting them here caused the green "synced" badge to appear prematurely.
      this.updateSyncStatus({
        error: undefined,
        syncProgress: docsProcessed > 0 ? {
          docsProcessed,
          operation,
          currentDoc
        } : undefined
      });
    })
    .on('active', (info: unknown) => {
      // Extract pending count if available
      let pendingDocs = undefined;

      if (info && typeof info === 'object' && 'pending' in info) {
        pendingDocs = typeof info.pending === 'number' ? info.pending : undefined;
      }

      this.updateSyncStatus({
        isSync: true,
        error: undefined,
        syncProgress: pendingDocs !== undefined ? {
          docsProcessed: 0,
          operation: 'pull',
          pendingDocs
        } : undefined
      });
    })
    .on('paused', () => {
      // Paused event means sync caught up and is waiting for new changes
      // This is the ONLY place where lastSync should be set - indicates true sync completion
      this.updateSyncStatus({
        isSync: false,
        lastSync: new Date(),
        syncProgress: undefined
      });
    })
    .on('error', (info: unknown) => {
      console.error('Sync error:', info);
      this.updateSyncStatus({
        isSync: false,
        error: `Sync error: ${info}`,
        syncProgress: undefined
      });
    });
  }

  private updateOnlineStatus(isOnline: boolean): void {
    this.updateSyncStatus({ isOnline });
  }

  private updateSyncStatus(updates: Partial<SyncStatus>): void {
    const current = this.syncStatusSubject.value;
    this.syncStatusSubject.next({ ...current, ...updates });
  }

  async stopSync(): Promise<void> {
    if (this.syncHandler) {
      try {
        // Cancel the sync - this also cleans up event listeners internally
        // Note: We don't call .off() because PouchDB's cancel() handles cleanup
        // and .off() requires the original function references which we don't store
        this.syncHandler.cancel();
      } catch (error) {
        console.warn('Error canceling sync:', error);
      }
      this.syncHandler = null;
    }
    this.updateSyncStatus({ isSync: false });
  }

  /**
   * Temporarily pause database sync during performance-critical operations
   * like AI text streaming. Uses a counter to support nested pause/resume calls.
   * Safe to call multiple times - sync only resumes when all pausers have resumed.
   */
  pauseSync(): void {
    this.activePauseCount++;

    if (this.syncHandler && !this.syncPaused) {
      console.info('[DatabaseService] Pausing sync for performance-critical operation');
      try {
        this.syncHandler.cancel();
      } catch (error) {
        console.warn('Error pausing sync:', error);
      }
      this.syncHandler = null;
      this.syncPaused = true;
    }
  }

  /**
   * Resume database sync after a performance-critical operation completes.
   * Only actually resumes when all nested pause calls have been matched with resume calls.
   */
  resumeSync(): void {
    if (this.activePauseCount > 0) {
      this.activePauseCount--;
    }

    // Only resume if all pausers have resumed and sync was actually paused
    if (this.activePauseCount === 0 && this.syncPaused && this.remoteDb) {
      console.info('[DatabaseService] Resuming sync after performance-critical operation');
      this.syncPaused = false;
      this.startSync();
    }
  }

  /**
   * Enable bootstrap sync mode and trigger a full sync.
   * Use this when local database is empty and metadata index is missing.
   * This temporarily allows syncing ALL documents (including stories)
   * to populate the empty database.
   *
   * @returns Promise that resolves when initial sync completes
   */
  async enableBootstrapSync(): Promise<{ docsProcessed: number }> {
    if (!this.remoteDb) {
      console.warn('[DatabaseService] Cannot enable bootstrap sync: remote database not connected');
      return { docsProcessed: 0 };
    }

    console.info('[DatabaseService] Enabling bootstrap sync mode - will sync ALL documents');
    this.bootstrapSyncMode = true;

    // Restart sync with bootstrap mode enabled
    await this.stopSync();
    this.startSync();

    // Wait for sync to complete with improved completion detection
    return new Promise((resolve) => {
      let totalDocsProcessed = 0;
      let syncCompleted = false;
      let lastActivityTime = Date.now();
      const timeoutMs = 90000;      // 90s hard timeout
      const idleThresholdMs = 3000; // 3s of no activity = likely complete

      const complete = (docs: number) => {
        if (syncCompleted) return;
        syncCompleted = true;
        clearInterval(idleChecker);
        subscription.unsubscribe();

        // Small delay to ensure IndexedDB writes complete before resolving
        setTimeout(() => {
          console.info(`[DatabaseService] Bootstrap sync completed: ${docs} docs processed`);
          this.disableBootstrapSync();
          resolve({ docsProcessed: docs });
        }, 500);
      };

      const subscription = this.syncStatus$.subscribe(status => {
        // Track activity and documents processed
        if (status.syncProgress?.docsProcessed) {
          totalDocsProcessed = Math.max(totalDocsProcessed, status.syncProgress.docsProcessed);
          lastActivityTime = Date.now();
        }

        // Complete when sync is paused AND we have lastSync set
        // (now reliable since we only set lastSync on 'paused' event)
        if (!status.isSync && status.lastSync && totalDocsProcessed > 0) {
          console.info(`[DatabaseService] Bootstrap sync paused with ${totalDocsProcessed} docs`);
          complete(totalDocsProcessed);
        }
      });

      // Idle detection: if no activity for 3s after receiving docs, assume complete
      const idleChecker = setInterval(() => {
        if (totalDocsProcessed > 0 && Date.now() - lastActivityTime > idleThresholdMs && !syncCompleted) {
          console.info('[DatabaseService] Bootstrap sync idle timeout');
          complete(totalDocsProcessed);
        }
      }, 1000);

      // Hard timeout fallback
      setTimeout(() => {
        if (!syncCompleted) {
          console.warn('[DatabaseService] Bootstrap sync hard timeout');
          complete(totalDocsProcessed);
        }
      }, timeoutMs);
    });
  }

  /**
   * Disable bootstrap sync mode and restart with selective sync
   */
  private disableBootstrapSync(): void {
    console.info('[DatabaseService] Disabling bootstrap sync mode');
    this.bootstrapSyncMode = false;

    // Restart sync with normal selective filtering
    this.stopSync().then(() => {
      this.startSync();
    }).catch(err => {
      console.warn('[DatabaseService] Error restarting sync after bootstrap:', err);
    });
  }

  /**
   * Check if bootstrap sync mode is currently enabled
   */
  isBootstrapSyncEnabled(): boolean {
    return this.bootstrapSyncMode;
  }

  async forcePush(): Promise<{ docsProcessed: number }> {
    return await this.runManualReplication('push');
  }

  async forcePull(): Promise<{ docsProcessed: number }> {
    return await this.runManualReplication('pull');
  }

  async compact(): Promise<void> {
    if (!this.db) return;
    await this.db.compact();
  }

  async destroy(): Promise<void> {
    await this.stopSync();
    if (!this.db) return;
    await this.db.destroy();
  }

  private async runManualReplication(direction: 'push' | 'pull'): Promise<{ docsProcessed: number }> {
    const user = this.authService.getCurrentUser();
    const userId = user?.username ?? 'anonymous';

    if (!this.remoteDb || !this.db) {
      const message = 'Remote database not connected';
      this.updateSyncStatus({ error: message });
      this.syncLogger.logError(
        direction === 'push' ? 'Manual push failed: remote database not connected' : 'Manual pull failed: remote database not connected',
        userId
      );
      throw new Error(message);
    }

    const logId = this.syncLogger.logInfo(
      direction === 'push' ? 'Manual push started' : 'Manual pull started',
      undefined,
      userId
    );

    this.updateSyncStatus({
      isSync: true,
      error: undefined,
      syncProgress: { docsProcessed: 0, operation: direction }
    });
    const startTime = Date.now();

    // Set up timeout (60 seconds)
    const timeoutMs = 60000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let timedOut = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        reject(new Error('Sync operation timed out after 60 seconds'));
      }, timeoutMs);
    });

    try {
      // Create replication with progress tracking
      const replicationPromise = (async () => {
        const replication = direction === 'push'
          ? this.db!.replicate.to(this.remoteDb!)
          : this.db!.replicate.from(this.remoteDb!);

        // Track progress during replication with document details
        let totalProcessed = 0;
        (replication as PouchDB.Replication.Replication<Record<string, unknown>>)
          .on('change', (info) => {
            if (info && typeof info === 'object' && 'docs' in info) {
              const docs = info.docs as unknown[];
              const docsCount = docs?.length || 0;
              totalProcessed += docsCount;

              // Get current document details
              let currentDoc = undefined;
              if (docs && docs.length > 0) {
                const lastDoc = docs[docs.length - 1];
                if (lastDoc && typeof lastDoc === 'object' && '_id' in lastDoc) {
                  currentDoc = {
                    id: (lastDoc as { _id: string })._id,
                    type: 'type' in lastDoc ? String((lastDoc as { type: unknown }).type) : undefined,
                    title: 'title' in lastDoc ? String((lastDoc as { title: unknown }).title) : undefined
                  };
                }
              }

              // Get total docs if available
              let totalDocs: number | undefined = undefined;
              if ('docs_read' in info) {
                totalDocs = (info as { docs_read: number }).docs_read;
              } else if ('docs_written' in info) {
                totalDocs = (info as { docs_written: number }).docs_written;
              }

              this.updateSyncStatus({
                syncProgress: {
                  docsProcessed: totalProcessed,
                  totalDocs,
                  operation: direction,
                  currentDoc
                }
              });
            }
          });

        return await replication;
      })();

      // Race between replication and timeout
      const result = await Promise.race([replicationPromise, timeoutPromise]);

      if (timeoutId) clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      const itemCount = direction === 'push' ? result.docs_written : result.docs_read;

      this.updateSyncStatus({
        lastSync: new Date(),
        error: undefined,
        syncProgress: undefined
      });

      this.syncLogger.updateLog(logId, {
        type: direction === 'push' ? 'upload' : 'download',
        status: 'success',
        action: direction === 'push'
          ? `Manual push completed (${itemCount} ${itemCount === 1 ? 'doc' : 'docs'})`
          : `Manual pull completed (${itemCount} ${itemCount === 1 ? 'doc' : 'docs'})`,
        itemCount,
        duration,
        timestamp: new Date()
      });

      return { docsProcessed: itemCount };
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);

      console.error(direction === 'push' ? 'Force push failed:' : 'Force pull failed:', error);
      const friendlyMessage = this.getFriendlySyncError(
        error,
        timedOut ? 'Sync timed out' : (direction === 'push' ? 'Manual push failed' : 'Manual pull failed')
      );

      this.updateSyncStatus({ error: friendlyMessage, syncProgress: undefined });
      this.syncLogger.updateLog(logId, {
        type: 'error',
        status: 'error',
        action: direction === 'push' ? 'Manual push failed' : 'Manual pull failed',
        details: friendlyMessage,
        timestamp: new Date()
      });

      throw error;
    } finally {
      this.updateSyncStatus({ isSync: false, syncProgress: undefined });
    }
  }

  private getFriendlySyncError(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      const message = error.message;
      const normalized = message.toLowerCase();

      if (normalized.includes('couchdb connection failed') || normalized.includes('failed to fetch') || normalized.includes('network')) {
        return 'Database server unreachable';
      }
      if (normalized.includes('unauthorized') || normalized.includes('auth')) {
        return 'Database authentication failed';
      }
      if (normalized.includes('timeout')) {
        return 'Database connection timeout';
      }
      if (normalized.includes('syntaxerror') && normalized.includes('json')) {
        return 'Database server returned invalid response';
      }

      return `${fallback}: ${message}`;
    }

    if (typeof error === 'string') {
      return error;
    }

    return fallback;
  }

  /**
   * Get current database storage usage
   */
  async getDatabaseSize(): Promise<{ used: number; quota: number; percentage: number }> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percentage = quota > 0 ? (used / quota) * 100 : 0;

        return { used, quota, percentage };
      }
    } catch (error) {
      console.warn('Could not estimate storage:', error);
    }

    return { used: 0, quota: 0, percentage: 0 };
  }

  /**
   * Check storage health and emit warnings if needed
   */
  async checkStorageHealth(): Promise<{ healthy: boolean; message?: string }> {
    const { percentage, used, quota } = await this.getDatabaseSize();

    if (percentage > 90) {
      return {
        healthy: false,
        message: `Storage almost full (${percentage.toFixed(1)}%)! Used ${this.formatBytes(used)} of ${this.formatBytes(quota)}. Consider cleaning up old data.`
      };
    } else if (percentage > 75) {
      return {
        healthy: false,
        message: `Storage usage high (${percentage.toFixed(1)}%). Used ${this.formatBytes(used)} of ${this.formatBytes(quota)}.`
      };
    }

    return { healthy: true };
  }

  /**
   * Clean up old PouchDB mrview databases from IndexedDB
   * SAFE: Only removes materialized view databases (indexes), NEVER user data
   * mrview databases can be recreated automatically by PouchDB when needed
   */
  async cleanupOldDatabases(): Promise<{ cleaned: number; kept: number; errors: string[] }> {
    const currentDbName = this.db?.name;
    const errors: string[] = [];
    let cleaned = 0;
    let kept = 0;

    try {
      // Get all databases from IndexedDB
      if (!indexedDB.databases) {
        console.warn('[DatabaseService] IndexedDB.databases() not supported, skipping cleanup');
        return { cleaned: 0, kept: 0, errors: ['IndexedDB.databases() not supported'] };
      }

      const databases = await indexedDB.databases();

      for (const dbInfo of databases) {
        const dbName = dbInfo.name;
        if (!dbName || !dbName.startsWith('_pouch_')) {
          kept++;
          continue; // Not a PouchDB database
        }

        // ONLY delete mrview databases (materialized views / indexes)
        // NEVER delete user story databases - they contain actual data!
        const isMrviewDatabase = dbName.includes('-mrview-');
        const isCurrentMrview = currentDbName && dbName.includes(`${currentDbName}-mrview-`);
        const isBeatHistoriesMrview = dbName.includes('beat-histories-mrview-');

        if (isMrviewDatabase && !isCurrentMrview && !isBeatHistoriesMrview) {
          // Safe to delete: old mrview database for inactive user database
          try {
            if (!this.pouchdbCtor) {
              throw new Error('PouchDB not initialized');
            }
            const tempDb = new this.pouchdbCtor(dbName);
            await tempDb.destroy();
            cleaned++;
          } catch (error) {
            const errorMsg = `Failed to delete ${dbName}: ${error}`;
            console.warn(`[DatabaseService] ${errorMsg}`);
            errors.push(errorMsg);
          }
        } else {
          kept++;
        }
      }
    } catch (error) {
      const errorMsg = `Database cleanup failed: ${error}`;
      console.error(`[DatabaseService] ${errorMsg}`);
      errors.push(errorMsg);
    }

    return { cleaned, kept, errors };
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Check if there are stories in the remote database that are missing locally
   * This is a quick check that compares story counts between local and remote databases
   * @returns Object with hasMissing flag and counts, or null if remote DB is unavailable
   */
  async checkForMissingStories(): Promise<{
    hasMissing: boolean;
    localCount: number;
    remoteCount: number;
  } | null> {
    try {
      // Check if we have a remote database connection
      if (!this.remoteDb) {
        return null;
      }

      // Get local database
      const localDb = await this.getDatabase();

      // Quick count using allDocs (same efficient method used by StoryService)
      const countStoriesInDb = async (db: PouchDB.Database): Promise<number> => {
        const result = await db.allDocs({
          include_docs: true  // REQUIRED: filterStoryRows needs full documents to check type/chapters fields
        });
        // Use shared utility function for consistent story document filtering
        return countStories(result.rows);
      };

      // Count local stories first
      const localCount = await countStoriesInDb(localDb);

      // Count remote stories with separate error handling
      // Remote DB may be unavailable or return malformed responses
      let remoteCount: number;
      try {
        remoteCount = await countStoriesInDb(this.remoteDb);
      } catch {
        // Remote database unavailable or returned invalid response
        // This is expected when offline or server is unreachable
        console.warn('[DatabaseService] Remote database unavailable for story count check');
        return null;
      }

      return {
        hasMissing: remoteCount > localCount,
        localCount,
        remoteCount
      };
    } catch (error) {
      console.error('[DatabaseService] Error checking for missing stories:', error);
      return null;
    }
  }
}
