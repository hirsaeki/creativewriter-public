import { Injectable } from '@angular/core';
import PouchDB from 'pouchdb-browser';
import { BeatVersionHistory, BeatVersion, BeatHistoryStats } from '../../stories/models/beat-version-history.interface';

/**
 * Beat History Service
 *
 * Manages version history for beat AI generations. Each beat can have up to 10
 * versions stored in a separate local database, enabling users to browse and
 * restore previous generations without impacting story loading performance.
 *
 * Key Features:
 * - Lazy loading (history loaded only when requested)
 * - In-memory caching with 5-minute TTL
 * - Auto-pruning (keeps last 10 versions per beat)
 * - Local-only storage (no automatic sync)
 * - Bulk cleanup operations
 */
@Injectable({
  providedIn: 'root'
})
export class BeatHistoryService {
  private historyDb!: PouchDB.Database;
  private historyCache: Map<string, { history: BeatVersionHistory; loadedAt: Date }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_VERSIONS_PER_BEAT = 10;
  private isInitialized = false;

  constructor() {
    this.historyCache = new Map();
  }

  /**
   * Initialize the beat history database
   * Called during app startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.historyDb = new PouchDB('beat-histories');
      this.isInitialized = true;
    } catch (error) {
      console.error('[BeatHistoryService] Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Ensure database is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Generate a unique version ID
   */
  private generateVersionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `v-${timestamp}-${random}`;
  }

  /**
   * Save a new version to beat history
   *
   * @param beatId - ID of the beat
   * @param storyId - ID of the parent story
   * @param versionData - Version data (without versionId)
   * @returns The generated version ID
   */
  async saveVersion(
    beatId: string,
    storyId: string,
    versionData: Omit<BeatVersion, 'versionId'>
  ): Promise<string> {
    await this.ensureInitialized();

    const versionId = this.generateVersionId();
    const docId = `history-${beatId}`;

    try {
      // Get existing history or create new one
      let history: BeatVersionHistory;

      try {
        const existingDoc = await this.historyDb.get<BeatVersionHistory>(docId);
        history = existingDoc;

        // Only mark all existing versions as not current if new version will be current
        if (versionData.isCurrent !== false) {
          history.versions.forEach(v => v.isCurrent = false);
        }
      } catch (error) {
        // Document doesn't exist, create new history
        if ((error as {status?: number}).status === 404) {
          history = {
            _id: docId,
            type: 'beat-history',
            beatId,
            storyId,
            versions: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
        } else {
          throw error;
        }
      }

      // Add new version
      // Respect the isCurrent flag from versionData if explicitly set to false
      const newVersion: BeatVersion = {
        ...versionData,
        versionId,
        isCurrent: versionData.isCurrent !== false // Default to true unless explicitly false
      };

      history.versions.push(newVersion);
      history.updatedAt = new Date();

      // Auto-prune if exceeding version limit
      if (history.versions.length > this.MAX_VERSIONS_PER_BEAT) {
        // Sort by generation date (newest first) and keep only MAX_VERSIONS_PER_BEAT
        history.versions = history.versions
          .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
          .slice(0, this.MAX_VERSIONS_PER_BEAT);
      }

      // Save to database
      await this.historyDb.put(history);

      // Update cache
      this.historyCache.set(beatId, {
        history,
        loadedAt: new Date()
      });

      return versionId;
    } catch (error) {
      console.error(`[BeatHistoryService] Failed to save version for beat ${beatId}:`, error);
      throw error;
    }
  }

  /**
   * Get complete version history for a beat
   *
   * @param beatId - ID of the beat
   * @returns Version history or null if not found
   */
  async getHistory(beatId: string): Promise<BeatVersionHistory | null> {
    await this.ensureInitialized();

    // Check cache first
    const cached = this.historyCache.get(beatId);
    if (cached && Date.now() - cached.loadedAt.getTime() < this.CACHE_TTL) {
      return cached.history;
    }

    const docId = `history-${beatId}`;

    try {
      const rawHistory = await this.historyDb.get<BeatVersionHistory>(docId);

      // Convert date strings to Date objects
      const history: BeatVersionHistory = {
        ...rawHistory,
        createdAt: new Date(rawHistory.createdAt),
        updatedAt: new Date(rawHistory.updatedAt),
        versions: rawHistory.versions.map(v => ({
          ...v,
          generatedAt: new Date(v.generatedAt)
        }))
      };

      // Update cache
      this.historyCache.set(beatId, {
        history,
        loadedAt: new Date()
      });

      return history;
    } catch (error) {
      if ((error as {status?: number}).status === 404) {
        return null;
      }
      console.error(`[BeatHistoryService] Failed to get history for beat ${beatId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a beat has version history
   *
   * @param beatId - ID of the beat
   * @returns True if history exists
   */
  async hasHistory(beatId: string): Promise<boolean> {
    await this.ensureInitialized();

    const docId = `history-${beatId}`;

    try {
      await this.historyDb.get(docId);
      return true;
    } catch (error) {
      if ((error as {status?: number}).status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Set which version is currently active
   *
   * @param beatId - ID of the beat
   * @param versionId - ID of the version to mark as current
   */
  async setCurrentVersion(beatId: string, versionId: string): Promise<void> {
    await this.ensureInitialized();

    const docId = `history-${beatId}`;

    try {
      const history = await this.historyDb.get<BeatVersionHistory>(docId);

      // Mark all versions as not current
      history.versions.forEach(v => v.isCurrent = false);

      // Find and mark the specified version as current
      const targetVersion = history.versions.find(v => v.versionId === versionId);
      if (!targetVersion) {
        throw new Error(`Version ${versionId} not found in beat ${beatId}`);
      }

      targetVersion.isCurrent = true;
      history.updatedAt = new Date();

      // Save to database
      await this.historyDb.put(history);

      // Clear cache to force reload
      this.historyCache.delete(beatId);
    } catch (error) {
      console.error(`[BeatHistoryService] Failed to set current version for beat ${beatId}:`, error);
      throw error;
    }
  }

  /**
   * Delete version history for a specific beat
   *
   * @param beatId - ID of the beat
   */
  async deleteHistory(beatId: string): Promise<void> {
    await this.ensureInitialized();

    const docId = `history-${beatId}`;

    try {
      const doc = await this.historyDb.get(docId);
      await this.historyDb.remove(doc);

      // Clear from cache
      this.historyCache.delete(beatId);
    } catch (error) {
      if ((error as {status?: number}).status === 404) {
        // Already deleted, that's fine
        return;
      }
      console.error(`[BeatHistoryService] Failed to delete history for beat ${beatId}:`, error);
      throw error;
    }
  }

  /**
   * Delete old versions keeping only the most recent N versions
   *
   * @param beatId - ID of the beat
   * @param keepCount - Number of versions to keep (default: 5)
   */
  async deleteOldVersions(beatId: string, keepCount = 5): Promise<void> {
    await this.ensureInitialized();

    const docId = `history-${beatId}`;

    try {
      const history = await this.historyDb.get<BeatVersionHistory>(docId);

      if (history.versions.length <= keepCount) {
        return; // Nothing to delete
      }

      // Sort by generation date (newest first) and keep only keepCount versions
      history.versions = history.versions
        .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
        .slice(0, keepCount);

      history.updatedAt = new Date();

      // Save to database
      await this.historyDb.put(history);

      // Clear cache
      this.historyCache.delete(beatId);
    } catch (error) {
      if ((error as {status?: number}).status === 404) {
        return; // No history to prune
      }
      console.error(`[BeatHistoryService] Failed to prune history for beat ${beatId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all version histories for a specific story
   *
   * @param storyId - ID of the story
   * @returns Number of histories deleted
   */
  async deleteAllHistoriesForStory(storyId: string): Promise<number> {
    await this.ensureInitialized();

    try {
      // Find all history documents for this story
      const result = await this.historyDb.allDocs<BeatVersionHistory>({
        include_docs: true
      });

      const storyHistories = result.rows
        .filter(row => row.doc?.type === 'beat-history' && row.doc?.storyId === storyId)
        .map(row => row.doc!);

      // Delete each history document
      const deletePromises = storyHistories.map(doc =>
        this.historyDb.remove(doc)
      );

      await Promise.all(deletePromises);

      // Clear cache for all deleted beats
      storyHistories.forEach(history => {
        this.historyCache.delete(history.beatId);
      });

      return storyHistories.length;
    } catch (error) {
      console.error(`[BeatHistoryService] Failed to delete histories for story ${storyId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all version histories (for all beats)
   *
   * @returns Number of histories deleted
   */
  async deleteAllHistories(): Promise<number> {
    await this.ensureInitialized();

    try {
      // Get all documents
      const result = await this.historyDb.allDocs<BeatVersionHistory>({
        include_docs: true
      });

      const historyDocs = result.rows
        .filter(row => row.doc?.type === 'beat-history')
        .map(row => row.doc!);

      // Delete each document
      const deletePromises = historyDocs.map(doc =>
        this.historyDb.remove(doc)
      );

      await Promise.all(deletePromises);

      // Clear entire cache
      this.historyCache.clear();

      return historyDocs.length;
    } catch (error) {
      console.error('[BeatHistoryService] Failed to delete all histories:', error);
      throw error;
    }
  }

  /**
   * Get statistics about version history storage
   *
   * @returns Statistics including total histories, versions, and estimated size
   */
  async getHistoryStats(): Promise<BeatHistoryStats> {
    await this.ensureInitialized();

    try {
      const result = await this.historyDb.allDocs<BeatVersionHistory>({
        include_docs: true
      });

      const historyDocs = result.rows
        .filter(row => row.doc?.type === 'beat-history')
        .map(row => row.doc!);

      let totalVersions = 0;
      let totalSize = 0;

      historyDocs.forEach(doc => {
        totalVersions += doc.versions.length;
        // Estimate size (rough approximation)
        totalSize += JSON.stringify(doc).length;
      });

      return {
        totalHistories: historyDocs.length,
        totalVersions,
        totalSize
      };
    } catch (error) {
      console.error('[BeatHistoryService] Failed to get history stats:', error);
      throw error;
    }
  }

  /**
   * Clear the in-memory cache
   * Useful for testing or memory management
   */
  clearCache(): void {
    this.historyCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.historyCache.size,
      entries: Array.from(this.historyCache.keys())
    };
  }
}
