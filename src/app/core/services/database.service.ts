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
    operation: 'push' | 'pull';
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

    // Increase EventEmitter limit to prevent memory leak warnings
    // PouchDB sync operations create many internal event listeners
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (this.db && (this.db as any).setMaxListeners) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.db as any).setMaxListeners(20);
    }

    // Create comprehensive indexes for better query performance (in parallel)
    const indexes = [
      { fields: ['type'] },
      { fields: ['type', 'createdAt'] },
      { fields: ['type', 'updatedAt'] },
      { fields: ['chapters'] },
      { fields: ['storyId'] },
      { fields: ['createdAt'] },
      { fields: ['updatedAt'] },
      { fields: ['id'] }
    ];

    // Store reference to current db to prevent race conditions
    const currentDb = this.db;

    // Create all indexes in parallel for faster initialization
    await Promise.all(
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
    );

    // Setup sync for the new database
    await this.setupSync();
  }

  private handleUserChange(user: User | null): void {
    // Use setTimeout to avoid immediate database switching during constructor
    setTimeout(async () => {
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
    }, 100);
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
      timeout: 30000
    }) as unknown as PouchSync;

    this.syncHandler = (handler as unknown as PouchDB.Replication.Sync<Record<string, unknown>>)
    .on('change', () => {
      this.updateSyncStatus({ 
        isSync: false, 
        lastSync: new Date(),
        error: undefined 
      });
    })
    .on('active', () => {
      this.updateSyncStatus({ isSync: true, error: undefined });
    })
    .on('paused', (info: unknown) => {
      this.updateSyncStatus({ 
        isSync: false, 
        error: info ? `Sync paused: ${info}` : undefined 
      });
    })
    .on('error', (info: unknown) => {
      console.error('Sync error:', info);
      this.updateSyncStatus({ 
        isSync: false, 
        error: `Sync error: ${info}` 
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

        // Track progress during replication
        (replication as PouchDB.Replication.Replication<Record<string, unknown>>)
          .on('change', (info) => {
            if (info && typeof info === 'object' && 'docs' in info) {
              const docs = info.docs as unknown[];
              this.updateSyncStatus({
                syncProgress: {
                  docsProcessed: docs?.length || 0,
                  operation: direction
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
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
