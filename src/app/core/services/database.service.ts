import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService, User } from './auth.service';
import { SyncLoggerService } from './sync-logger.service';
import { PouchDB } from '../../app';

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
    const indexStart = performance.now();
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
      console.log(`[DatabaseService] Index creation completed: ${(performance.now() - indexStart).toFixed(0)}ms`);
    }).catch(err => {
      console.warn('[DatabaseService] Index creation failed:', err);
    });

    // PERFORMANCE FIX: Don't await sync setup - let it happen in background
    // This prevents network delays from blocking database availability
    this.setupSync().catch(err => {
      console.warn('[DatabaseService] Background sync setup failed:', err);
    });

    console.log(`[DatabaseService] Database '${dbName}' ready for use`);
  }

  private async handleUserChange(user: User | null): Promise<void> {
    // Immediately switch database when user changes (no setTimeout to avoid race conditions)
    if (user) {
      const userDbName = this.authService.getUserDatabaseName();
      if (userDbName && userDbName !== (this.db?.name)) {
        console.log(`[DatabaseService] User logged in, switching to database: ${userDbName}`);
        this.initializationPromise = this.initializeDatabase(userDbName);
        await this.initializationPromise;
      }
    } else {
      // User logged out - switch to anonymous database
      const anonymousDb = 'creative-writer-stories-anonymous';
      if (this.db?.name !== anonymousDb) {
        console.log(`[DatabaseService] User logged out, switching to anonymous database`);
        this.initializationPromise = this.initializeDatabase(anonymousDb);
        await this.initializationPromise;
      }
    }
  }

  async getDatabase(): Promise<PouchDB.Database> {
    // Wait for initialization to complete
    if (this.initializationPromise) {
      const waitStart = performance.now();
      await this.initializationPromise;
      const waitTime = performance.now() - waitStart;
      if (waitTime > 10) {
        console.log(`[DatabaseService] Waited ${waitTime.toFixed(0)}ms for database initialization`);
      }
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    console.log(`[DatabaseService] getDatabase() returning database: ${this.db.name}`);
    return this.db;
  }

  // Synchronous getter for backwards compatibility (use with caution)
  getDatabaseSync(): PouchDB.Database | null {
    return this.db;
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
      // CRITICAL: Filter out snapshot documents from sync
      // Snapshots stay server-side only, accessed via HTTP on-demand
      filter: (doc: PouchDB.Core.Document<Record<string, unknown>>) => {
        // Sync all documents EXCEPT snapshots
        const docType = (doc as { type?: string }).type;
        return docType !== 'story-snapshot';
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

      this.updateSyncStatus({
        isSync: false,
        lastSync: new Date(),
        error: undefined,
        syncProgress: docsProcessed > 0 ? {
          docsProcessed,
          operation,
          currentDoc
        } : undefined
      });

      // Clear progress after a short delay
      setTimeout(() => {
        const current = this.syncStatusSubject.value;
        if (!current.isSync) {
          this.updateSyncStatus({ syncProgress: undefined });
        }
      }, 2000);
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
      // This is normal for live sync - not an error
      this.updateSyncStatus({
        isSync: false,
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
        // Remove all event listeners to prevent memory leaks
        this.syncHandler.off('change');
        this.syncHandler.off('active');
        this.syncHandler.off('paused');
        this.syncHandler.off('error');

        // Cancel the sync
        this.syncHandler.cancel();
      } catch (error) {
        console.warn('Error canceling sync:', error);
      }
      this.syncHandler = null;
    }
    this.updateSyncStatus({ isSync: false });
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
      console.log(`[DatabaseService] Found ${databases.length} IndexedDB databases`);

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
            console.log(`[DatabaseService] Cleaning up old mrview database: ${dbName}`);
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
          if (isMrviewDatabase) {
            console.log(`[DatabaseService] Keeping active mrview database: ${dbName}`);
          } else {
            console.log(`[DatabaseService] Keeping user data database: ${dbName}`);
          }
        }
      }

      console.log(`[DatabaseService] Cleanup complete: ${cleaned} mrview databases removed, ${kept} kept (all user data preserved)`);
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
        console.log('[DatabaseService] No remote database connection, skipping missing stories check');
        return null;
      }

      // Get local database
      const localDb = await this.getDatabase();

      // Quick count using allDocs (same efficient method used by StoryService)
      const countStories = async (db: PouchDB.Database): Promise<number> => {
        const result = await db.allDocs();
        // Filter out non-story documents (same logic as StoryService.getTotalStoriesCount)
        return result.rows.filter((row) => {
          const id = row.id;
          // Filter out design docs
          if (id.startsWith('_design')) {
            return false;
          }
          // Filter out typed documents by ID pattern
          if (id.match(/^(video|codex|image-video-association|beat-suggestion|beat-history)-/)) {
            return false;
          }
          return true;
        }).length;
      };

      // Count stories in both databases
      const [localCount, remoteCount] = await Promise.all([
        countStories(localDb),
        countStories(this.remoteDb)
      ]);

      console.log(`[DatabaseService] Story count check - Local: ${localCount}, Remote: ${remoteCount}`);

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
