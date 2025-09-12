import { Injectable, signal, computed, inject } from '@angular/core';
import { DatabaseService } from '../../core/services/database.service';
import { AuthService } from '../../core/services/auth.service';

export interface CustomBackground {
  _id: string;
  _rev?: string;
  type: 'custom-background';
  name: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: Date;
  createdBy: string; // username
  _attachments?: Record<string, {
      content_type: string;
      digest?: string;
      length?: number;
      stub?: boolean;
      data?: string; // Base64 encoded when creating
    }>;
}

export interface CustomBackgroundOption {
  id: string;
  name: string;
  filename: string;
  blobUrl: string;
  size: number;
  createdAt: Date;
  createdBy: string;
}

@Injectable({
  providedIn: 'root'
})
export class SyncedCustomBackgroundService {
  private databaseService = inject(DatabaseService);
  private authService = inject(AuthService);
  
  private customBackgrounds = signal<CustomBackgroundOption[]>([]);
  private blobUrlCache = new Map<string, string>();
  
  // Computed signal for reactive access
  backgrounds = computed(() => this.customBackgrounds());

  constructor() {
    this.loadCustomBackgrounds();
    
    // React to user changes - but don't clear cache immediately
    this.authService.currentUser$.subscribe((user) => {
      // Only reload if user actually changed (not initial load)
      if (user !== null || this.customBackgrounds().length > 0) {
        this.loadCustomBackgrounds();
      }
    });
  }

  /**
   * Upload and store a custom background image with PouchDB attachments
   */
  async uploadBackground(file: File, customName?: string): Promise<CustomBackground> {
    // Validate file
    if (!this.isValidImageFile(file)) {
      throw new Error('Invalid file type. Only PNG, JPG, JPEG and WebP are allowed.');
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      throw new Error('File is too large. Maximum 5MB allowed.');
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to upload custom backgrounds.');
    }

    // Convert file to base64
    const base64Data = await this.fileToBase64(file);
    const docId = `custom-bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const attachmentName = `image_${Date.now()}.${this.getFileExtension(file.name)}`;
    const name = customName || file.name.replace(/\.[^/.]+$/, ""); // Remove extension

    const backgroundDoc: CustomBackground = {
      _id: docId,
      type: 'custom-background',
      name,
      filename: attachmentName,
      contentType: file.type,
      size: file.size,
      createdAt: new Date(),
      createdBy: currentUser.username,
      _attachments: {
        [attachmentName]: {
          content_type: file.type,
          data: base64Data.split(',')[1] // Remove data:image/... prefix
        }
      }
    };

    // Save to PouchDB
    const db = await this.databaseService.getDatabase();
    const result = await db.put(backgroundDoc);
    backgroundDoc._rev = result.rev;

    // Small delay to ensure document is persisted and indexed
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Reload backgrounds to update signals
    await this.loadCustomBackgrounds();

    return backgroundDoc;
  }

  /**
   * Delete a custom background
   */
  async deleteBackground(id: string): Promise<void> {
    try {
      const db = await this.databaseService.getDatabase();
      const doc = await db.get(id);
      
      // Check if user can delete this background
      const currentUser = this.authService.getCurrentUser();
      const typedDoc = doc as CustomBackground;
      if (!currentUser || typedDoc.createdBy !== currentUser.username) {
        throw new Error('You can only delete your own backgrounds.');
      }
      
      await db.remove(doc);
      
      // Clean up blob URL
      const cachedUrl = this.blobUrlCache.get(id);
      if (cachedUrl) {
        URL.revokeObjectURL(cachedUrl);
        this.blobUrlCache.delete(id);
      }
      
      // Reload backgrounds to update signals
      await this.loadCustomBackgrounds();
    } catch (error) {
      console.error('Error deleting background:', error);
      throw new Error('Error deleting background');
    }
  }

  /**
   * Get a specific custom background
   */
  async getBackground(id: string): Promise<CustomBackground | null> {
    try {
      const db = await this.databaseService.getDatabase();
      const doc = await db.get(id) as CustomBackground;
      return doc;
    } catch (error) {
      console.error('Error getting background:', error);
      return null;
    }
  }

  /**
   * Get background image as blob URL
   */
  async getBackgroundBlobUrl(id: string, attachmentName: string): Promise<string | null> {
    // Check cache first
    const cacheKey = `${id}_${attachmentName}`;
    if (this.blobUrlCache.has(cacheKey)) {
      return this.blobUrlCache.get(cacheKey)!;
    }

    try {
      const db = await this.databaseService.getDatabase();
      const attachment = await db.getAttachment(id, attachmentName);
      
      if (attachment) {
        const blobUrl = URL.createObjectURL(attachment as Blob);
        this.blobUrlCache.set(cacheKey, blobUrl);
        return blobUrl;
      }
      return null;
    } catch (error) {
      console.error('Error getting background blob:', error);
      return null;
    }
  }

  /**
   * Load all custom backgrounds from PouchDB
   */
  private async loadCustomBackgrounds(): Promise<void> {
    try {
      const db = await this.databaseService.getDatabase();
      
      // Use allDocs with startkey/endkey for more reliable results
      const result = await db.allDocs({
        include_docs: true,
        startkey: 'custom-bg_',
        endkey: 'custom-bg_\ufff0'
      });

      const backgrounds: CustomBackgroundOption[] = [];

      for (const row of result.rows) {
        const doc = row.doc as CustomBackground;
        
        // Verify document structure
        if (doc && doc.type === 'custom-background' && doc._attachments) {
          // Get the first attachment (should be the image)
          const attachmentKey = Object.keys(doc._attachments)[0];
          if (attachmentKey) {
            try {
              const blobUrl = await this.getBackgroundBlobUrl(doc._id, attachmentKey);
              if (blobUrl) {
                backgrounds.push({
                  id: doc._id,
                  name: doc.name,
                  filename: doc.filename,
                  blobUrl,
                  size: doc.size,
                  createdAt: new Date(doc.createdAt),
                  createdBy: doc.createdBy
                });
              }
            } catch {
              // Skip this background if attachment loading fails
              continue;
            }
          }
        }
      }

      // Sort by creation date (newest first)
      backgrounds.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      this.customBackgrounds.set(backgrounds);
    } catch (error) {
      console.error('Error loading custom backgrounds:', error);
      this.customBackgrounds.set([]);
    }
  }

  /**
   * Convert File to base64 string
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || 'png';
  }

  /**
   * Validate if file is a supported image format
   */
  private isValidImageFile(file: File): boolean {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    return validTypes.includes(file.type);
  }

  /**
   * Get total storage usage
   */
  getTotalStorageSize(): number {
    return this.customBackgrounds().reduce((total, bg) => total + bg.size, 0);
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Clear all custom backgrounds for current user
   */
  async clearAllBackgrounds(): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('You must be logged in.');
      }

      const db = await this.databaseService.getDatabase();
      const result = await db.find({
        selector: {
          type: 'custom-background',
          createdBy: currentUser.username
        }
      });

      const docsToDelete = result.docs.map((doc: unknown) => {
        const existingDoc = doc as PouchDB.Core.ExistingDocument<CustomBackground>;
        return {
          _id: existingDoc._id,
          _rev: existingDoc._rev,
          _deleted: true
        };
      });

      if (docsToDelete.length > 0) {
        await db.bulkDocs(docsToDelete);
        this.clearBlobCache();
        await this.loadCustomBackgrounds();
      }
    } catch (error) {
      console.error('Error clearing backgrounds:', error);
      throw new Error('Error deleting all backgrounds');
    }
  }

  /**
   * Clear blob URL cache
   */
  private clearBlobCache(): void {
    // Cleanup all blob URLs for memory management
    this.blobUrlCache.forEach(url => URL.revokeObjectURL(url));
    this.blobUrlCache.clear();
  }

  /**
   * Get storage usage information
   */
  getStorageInfo(): { used: number; count: number; userBackgrounds: number } {
    const backgrounds = this.customBackgrounds();
    const currentUser = this.authService.getCurrentUser();
    const userBackgrounds = currentUser ? 
      backgrounds.filter(bg => bg.createdBy === currentUser.username).length : 0;
    
    return {
      used: this.getTotalStorageSize(),
      count: backgrounds.length,
      userBackgrounds
    };
  }

  /**
   * Check if user is logged in
   */
  isUserLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  /**
   * Get current user info
   */
  getCurrentUser() {
    return this.authService.getCurrentUser();
  }

  /**
   * Force sync with remote database
   */
  async syncNow(): Promise<void> {
    try {
      // Force a pull to get latest data
      await this.databaseService.forcePull();
      // Then reload backgrounds
      await this.loadCustomBackgrounds();
    } catch (error) {
      console.error('Error syncing backgrounds:', error);
      throw new Error('Synchronisation fehlgeschlagen');
    }
  }

  /**
   * Get sync status
   */
  get syncStatus$() {
    return this.databaseService.syncStatus$;
  }
}
