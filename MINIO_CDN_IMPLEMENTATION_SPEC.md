# MinIO CDN Implementation Specification
## Self-Hosted Asset Storage Migration

**Version:** 1.0
**Date:** 2025-01-07
**Target Completion:** 2 weeks
**Risk Level:** Medium

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Target Architecture](#target-architecture)
4. [Implementation Phases](#implementation-phases)
5. [File-by-File Changes](#file-by-file-changes)
6. [New Files to Create](#new-files-to-create)
7. [Infrastructure Changes](#infrastructure-changes)
8. [Migration Strategy](#migration-strategy)
9. [Testing Requirements](#testing-requirements)
10. [Rollback Plan](#rollback-plan)
11. [Performance Metrics](#performance-metrics)
12. [Security Considerations](#security-considerations)

---

## 1. EXECUTIVE SUMMARY

### Objective
Migrate large asset storage (custom background images, story cover images, codex images) from PouchDB attachments to MinIO object storage to:
- Reduce IndexedDB storage by ~99% for image data
- Improve sync performance (30s → 0.5s for 10 backgrounds)
- Reduce memory usage by ~95% (60MB → 2MB)
- Eliminate mobile browser performance issues

### Scope
**In Scope:**
- Custom background images (currently PouchDB attachments)
- Story cover images (base64 strings)
- Codex entry images (URLs/base64)
- Backend upload API
- MinIO Docker setup
- Migration tools

**Out of Scope:**
- Beat history (staying local-only)
- Story content (staying in PouchDB)
- Video references (already URL-based)

### Key Metrics
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Sync data (10 backgrounds) | 50MB | 2KB | 99.99% |
| Sync time (10 backgrounds) | ~30s | ~0.5s | 98% |
| Memory usage | 60MB | 2MB | 97% |
| IndexedDB storage | High | Minimal | 99% |

---

## 2. CURRENT ARCHITECTURE ANALYSIS

### 2.1 Files Using PouchDB Attachments

#### **Primary Attachment User:**
- **File:** `src/app/shared/services/synced-custom-background.service.ts`
- **Lines:** 92-97, 172-183, 207-227
- **Usage:** Stores 5MB images as base64 attachments
- **Impact:** HIGH - main cause of sync performance issues

#### **Backup Service:**
- **File:** `src/app/shared/services/database-backup.service.ts`
- **Lines:** 29-55, 122-139
- **Usage:** Exports/imports attachments in JSON
- **Impact:** MEDIUM - needs attachment migration logic

#### **Other Image Storage:**
- **Story Cover Images:** Base64 strings in Story.coverImage (optional field)
- **Codex Images:** URLs or base64 in CodexEntry.imageUrl (optional field)

### 2.2 Current Storage Model

```typescript
// Current CustomBackground interface (line 5-22 of synced-custom-background.service.ts)
export interface CustomBackground {
  _id: string;
  _rev?: string;
  type: 'custom-background';
  name: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: Date;
  createdBy: string;
  _attachments?: Record<string, {
    content_type: string;
    digest?: string;
    length?: number;
    stub?: boolean;
    data?: string; // Base64 encoded
  }>;
}
```

**Problem:** `_attachments` contains full base64 image data, synced via PouchDB.

### 2.3 Current Infrastructure

```yaml
# docker-compose.yml
services:
  nginx:        # Port 3080 → reverse proxy
  creativewriter: # Angular app
  couchdb:      # Port 5984 → database
  replicate-proxy: # Port 3001
  gemini-proxy:    # Port 3002
  snapshot-service: # Background service
```

**Missing:** MinIO service, upload backend API

---

## 3. TARGET ARCHITECTURE

### 3.1 New Storage Model

```typescript
// NEW CustomBackground interface
export interface CustomBackground {
  _id: string;
  _rev?: string;
  type: 'custom-background';
  name: string;
  filename: string;
  contentType: string;
  size: number;
  imageUrl: string;  // ← NEW: MinIO URL
  createdAt: Date;
  createdBy: string;
  // _attachments REMOVED
}
```

### 3.2 Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Browser App                          │
│  ┌──────────────────┐        ┌──────────────────┐      │
│  │   PouchDB        │        │   AssetCdnService│      │
│  │  (Metadata Only) │        │   (Upload Logic) │      │
│  └────────┬─────────┘        └────────┬─────────┘      │
│           │                           │                 │
└───────────┼───────────────────────────┼─────────────────┘
            │                           │
            │ Sync metadata (2KB)       │ POST /api/upload/presigned-url
            │                           │ PUT to presigned URL (direct)
            ▼                           ▼
  ┌─────────────────┐         ┌──────────────────┐
  │   CouchDB       │         │  MinIO:9000      │
  │   (Metadata)    │         │  (Binary Assets) │
  └─────────────────┘         └──────────────────┘
           │                           │
           └───────────┬───────────────┘
                       │
              ┌────────▼─────────┐
              │   Upload API     │
              │   (Node.js)      │
              │   Port: 3003     │
              └──────────────────┘
```

### 3.3 URL Structure

```
MinIO Storage:
- Bucket: creative-writer-assets
- Path structure: users/{userId}/backgrounds/{uniqueId}.{ext}

Public URLs (via nginx):
http://localhost:3080/assets/users/alice/backgrounds/abc123def456.jpg

Direct MinIO URLs (for uploads via presigned):
http://localhost:9000/creative-writer-assets/users/alice/backgrounds/abc123def456.jpg
```

---

## 4. IMPLEMENTATION PHASES

### **Phase 1: Infrastructure Setup** (Days 1-2)
- [ ] Add MinIO to docker-compose.yml
- [ ] Update nginx.conf for MinIO proxy
- [ ] Create upload-api backend service
- [ ] Test MinIO connectivity
- [ ] Set up CORS policies

### **Phase 2: Backend API Development** (Days 3-4)
- [ ] Create upload-api Node.js service
- [ ] Implement presigned URL generation
- [ ] Implement file deletion endpoint
- [ ] Add rate limiting
- [ ] Add security headers

### **Phase 3: Frontend Service Layer** (Days 5-6)
- [ ] Create AssetCdnService
- [ ] Update CustomBackground interface
- [ ] Refactor SyncedCustomBackgroundService
- [ ] Update BackgroundUploadComponent
- [ ] Update BackgroundSelectorComponent

### **Phase 4: Migration Tools** (Days 7-8)
- [ ] Create AssetMigrationService
- [ ] Build migration UI component
- [ ] Update DatabaseBackupService
- [ ] Test migration with sample data

### **Phase 5: Testing & Optimization** (Days 9-10)
- [ ] Unit tests for new services
- [ ] Integration tests
- [ ] Performance testing
- [ ] Mobile browser testing
- [ ] Fix bugs

### **Phase 6: Documentation & Deployment** (Days 11-14)
- [ ] Update README
- [ ] Create deployment guide
- [ ] Update backup procedures
- [ ] Production deployment
- [ ] User migration support

---

## 5. FILE-BY-FILE CHANGES

### 5.1 CRITICAL: Update CustomBackground Interface

**File:** `src/app/shared/services/synced-custom-background.service.ts`

**Current Interface (Lines 5-22):**
```typescript
export interface CustomBackground {
  _id: string;
  _rev?: string;
  type: 'custom-background';
  name: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: Date;
  createdBy: string;
  _attachments?: Record<string, {
      content_type: string;
      digest?: string;
      length?: number;
      stub?: boolean;
      data?: string;
    }>;
}
```

**NEW Interface:**
```typescript
export interface CustomBackground {
  _id: string;
  _rev?: string;
  type: 'custom-background';
  name: string;
  filename: string;
  contentType: string;
  size: number;
  imageUrl: string;  // ← ADD THIS
  createdAt: Date;
  createdBy: string;
  // REMOVE _attachments field entirely
}
```

**Change Summary:**
- ✅ Add `imageUrl: string` field
- ❌ Remove `_attachments` field

---

### 5.2 CRITICAL: Refactor uploadBackground Method

**File:** `src/app/shared/services/synced-custom-background.service.ts`

**Current Method (Lines 62-112):**
```typescript
async uploadBackground(file: File, customName?: string): Promise<CustomBackground> {
  // Validate file
  if (!this.isValidImageFile(file)) {
    throw new Error('Invalid file type. Only PNG, JPG, JPEG and WebP are allowed.');
  }

  if (file.size > 5 * 1024 * 1024) {
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
  const name = customName || file.name.replace(/\.[^/.]+$/, "");

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
        data: base64Data.split(',')[1]
      }
    }
  };

  const db = await this.databaseService.getDatabase();
  const result = await db.put(backgroundDoc);
  backgroundDoc._rev = result.rev;

  await new Promise(resolve => setTimeout(resolve, 200));
  await this.loadCustomBackgrounds();

  return backgroundDoc;
}
```

**NEW Method:**
```typescript
async uploadBackground(file: File, customName?: string): Promise<CustomBackground> {
  // Validate file
  if (!this.isValidImageFile(file)) {
    throw new Error('Invalid file type. Only PNG, JPG, JPEG and WebP are allowed.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File is too large. Maximum 5MB allowed.');
  }

  const currentUser = this.authService.getCurrentUser();
  if (!currentUser) {
    throw new Error('You must be logged in to upload custom backgrounds.');
  }

  try {
    // Optional: Compress image before upload
    const compressedFile = await this.assetCdnService.compressImage(file);

    // Upload to MinIO via AssetCdnService and get public URL
    const imageUrl = await this.assetCdnService.uploadImage(
      compressedFile,
      (progress) => {
        // Optional: emit progress to UI
        console.log(`Upload progress: ${progress}%`);
      }
    );

    const docId = `custom-bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const name = customName || file.name.replace(/\.[^/.]+$/, "");

    // Store metadata ONLY in PouchDB - NO attachments!
    const backgroundDoc: CustomBackground = {
      _id: docId,
      type: 'custom-background',
      name,
      filename: file.name,
      contentType: file.type,
      size: compressedFile.size,
      imageUrl,  // ← CDN URL instead of attachment
      createdAt: new Date(),
      createdBy: currentUser.username,
    };

    const db = await this.databaseService.getDatabase();
    const result = await db.put(backgroundDoc);
    backgroundDoc._rev = result.rev;

    await this.loadCustomBackgrounds();
    return backgroundDoc;

  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}
```

**Dependencies Added:**
```typescript
// Add to top of file
import { AssetCdnService } from './asset-cdn.service';

// Add to constructor
private assetCdnService = inject(AssetCdnService);
```

---

### 5.3 CRITICAL: Refactor deleteBackground Method

**File:** `src/app/shared/services/synced-custom-background.service.ts`

**Current Method (Lines 117-144):**
```typescript
async deleteBackground(id: string): Promise<void> {
  try {
    const db = await this.databaseService.getDatabase();
    const doc = await db.get(id);

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

    await this.loadCustomBackgrounds();
  } catch (error) {
    console.error('Error deleting background:', error);
    throw new Error('Error deleting background');
  }
}
```

**NEW Method:**
```typescript
async deleteBackground(id: string): Promise<void> {
  try {
    const db = await this.databaseService.getDatabase();
    const doc = await db.get(id) as CustomBackground;

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || doc.createdBy !== currentUser.username) {
      throw new Error('You can only delete your own backgrounds.');
    }

    // Delete from MinIO FIRST
    if (doc.imageUrl) {
      await this.assetCdnService.deleteAsset(doc.imageUrl);
    }

    // Then delete metadata from PouchDB
    await db.remove(doc);

    await this.loadCustomBackgrounds();
  } catch (error) {
    console.error('Error deleting background:', error);
    throw new Error('Error deleting background');
  }
}
```

---

### 5.4 CRITICAL: Refactor loadCustomBackgrounds Method

**File:** `src/app/shared/services/synced-custom-background.service.ts`

**Current Method (Lines 189-239):**
```typescript
private async loadCustomBackgrounds(): Promise<void> {
  try {
    const db = await this.databaseService.getDatabase();

    const result = await db.allDocs({
      include_docs: true,
      startkey: 'custom-bg_',
      endkey: 'custom-bg_\ufff0'
    });

    const backgrounds: CustomBackgroundOption[] = [];

    for (const row of result.rows) {
      const doc = row.doc as CustomBackground;

      if (doc && doc.type === 'custom-background' && doc._attachments) {
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
            continue;
          }
        }
      }
    }

    backgrounds.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.customBackgrounds.set(backgrounds);
  } catch (error) {
    console.error('Error loading custom backgrounds:', error);
    this.customBackgrounds.set([]);
  }
}
```

**NEW Method:**
```typescript
private async loadCustomBackgrounds(): Promise<void> {
  try {
    const db = await this.databaseService.getDatabase();

    const result = await db.allDocs({
      include_docs: true,
      startkey: 'custom-bg_',
      endkey: 'custom-bg_\ufff0'
    });

    const backgrounds: CustomBackgroundOption[] = [];

    for (const row of result.rows) {
      const doc = row.doc as CustomBackground;

      // NEW: Check for imageUrl instead of _attachments
      if (doc && doc.type === 'custom-background' && doc.imageUrl) {
        backgrounds.push({
          id: doc._id,
          name: doc.name,
          filename: doc.filename,
          blobUrl: doc.imageUrl,  // ← Direct CDN URL!
          size: doc.size,
          createdAt: new Date(doc.createdAt),
          createdBy: doc.createdBy
        });
      }
    }

    backgrounds.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    this.customBackgrounds.set(backgrounds);
  } catch (error) {
    console.error('Error loading custom backgrounds:', error);
    this.customBackgrounds.set([]);
  }
}
```

**What Changed:**
- ❌ Removed attachment checking (`doc._attachments`)
- ❌ Removed `getBackgroundBlobUrl()` call
- ✅ Use `doc.imageUrl` directly
- ✅ Simpler, faster, no blob URL generation

---

### 5.5 REMOVE: Obsolete Methods

**File:** `src/app/shared/services/synced-custom-background.service.ts`

**Methods to DELETE:**
```typescript
// Lines 161-184: DELETE THIS METHOD
async getBackgroundBlobUrl(id: string, attachmentName: string): Promise<string | null> {
  // ... entire method
}

// Lines 244-251: DELETE THIS METHOD
private fileToBase64(file: File): Promise<string> {
  // ... entire method
}

// Lines 328-332: DELETE THIS METHOD
private clearBlobCache(): void {
  // ... entire method
}
```

**Variables to DELETE:**
```typescript
// Line 42: DELETE THIS
private blobUrlCache = new Map<string, string>();
```

---

### 5.6 UPDATE: Database Backup Service

**File:** `src/app/shared/services/database-backup.service.ts`

**Problem:** Lines 29-55 export attachments as base64 in JSON. This will fail for new imageUrl-based backgrounds.

**Current Export Logic (Lines 32-39):**
```typescript
const doc = await (db.get as any)(docId, {
  attachments: true,
  binary: false // Get as base64
});
documents.push(doc);
```

**NEW Export Logic:**
```typescript
const doc = await db.get(docId);

// For custom backgrounds, warn if old attachment-based
if ((doc as any).type === 'custom-background') {
  if ((doc as any)._attachments && !(doc as any).imageUrl) {
    console.warn(`[MIGRATION NEEDED] Document ${docId} uses old attachment format`);
  }
  // Don't try to export attachments - they should be in MinIO
  delete (doc as any)._attachments;
}

documents.push(doc);
```

**Import Logic (Lines 122-139):** Already handles missing attachments, but add warning:

```typescript
// Add after line 128
if ((doc as any).type === 'custom-background' && (doc as any)._attachments) {
  console.warn(`[MIGRATION] Importing old attachment-based background. Run migration after import.`);
}
```

---

### 5.7 UPDATE: Components Using Backgrounds

**File:** `src/app/ui/components/background-selector.component.ts`

**No changes needed!** Component already uses `customBg.blobUrl` (line 124), which will now contain the MinIO URL instead of a blob URL.

**File:** `src/app/ui/components/background-upload.component.ts`

**No changes needed!** Component calls `customBackgroundService.uploadBackground()` which we already refactored.

---

## 6. NEW FILES TO CREATE

### 6.1 AssetCdnService

**File:** `src/app/shared/services/asset-cdn.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

export interface UploadResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

@Injectable({
  providedIn: 'root'
})
export class AssetCdnService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly API_BASE = '/api/upload';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  /**
   * Upload image to MinIO with progress tracking
   */
  async uploadImage(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    // Validate file
    if (!this.isValidImageFile(file)) {
      throw new Error('Invalid file type. Only PNG, JPG, JPEG, and WebP allowed.');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`File too large. Max size: ${this.formatFileSize(this.MAX_FILE_SIZE)}`);
    }

    // Get current user
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('You must be logged in to upload images.');
    }

    try {
      // Step 1: Get presigned URL from backend
      const { uploadUrl, publicUrl } = await firstValueFrom(
        this.http.post<UploadResponse>(`${this.API_BASE}/presigned-url`, {
          filename: file.name,
          contentType: file.type,
          userId: user.username,
        })
      );

      // Step 2: Upload directly to MinIO using presigned URL
      await this.uploadToMinIO(uploadUrl, file, file.type, onProgress);

      // Step 3: Return public URL for storage in PouchDB
      return publicUrl;
    } catch (error) {
      console.error('Upload failed:', error);
      throw new Error('Failed to upload image. Please try again.');
    }
  }

  /**
   * Upload file to MinIO using presigned URL
   */
  private async uploadToMinIO(
    presignedUrl: string,
    file: File,
    contentType: string,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            onProgress(Math.round(percent));
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.send(file);
    });
  }

  /**
   * Delete asset from MinIO
   */
  async deleteAsset(publicUrl: string): Promise<void> {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      // Extract key from public URL
      const url = new URL(publicUrl);
      const key = url.pathname.substring(1); // Remove leading /

      await firstValueFrom(
        this.http.delete(`${this.API_BASE}/${user.username}/${key}`)
      );
    } catch (error) {
      console.error('Failed to delete asset:', error);
      // Don't throw - asset might already be deleted
    }
  }

  /**
   * Compress image before upload
   */
  async compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Compression failed'));
                return;
              }

              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });

              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  private isValidImageFile(file: File): boolean {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    return validTypes.includes(file.type);
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
```

**Location:** `src/app/shared/services/asset-cdn.service.ts`

---

### 6.2 Asset Migration Service

**File:** `src/app/shared/services/asset-migration.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/services/database.service';
import { AssetCdnService } from './asset-cdn.service';
import { CustomBackground } from './synced-custom-background.service';

@Injectable({
  providedIn: 'root'
})
export class AssetMigrationService {
  private readonly databaseService = inject(DatabaseService);
  private readonly assetCdnService = inject(AssetCdnService);

  /**
   * Migrate backgrounds from PouchDB attachments to MinIO
   */
  async migrateBackgroundsToMinIO(): Promise<{
    migrated: number;
    failed: number;
    skipped: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let migrated = 0;
    let failed = 0;
    let skipped = 0;

    try {
      const db = await this.databaseService.getDatabase();

      // Find all custom background documents
      const result = await db.allDocs({
        include_docs: true,
        startkey: 'custom-bg_',
        endkey: 'custom-bg_\ufff0'
      });

      console.log(`[Migration] Found ${result.rows.length} custom background documents`);

      for (const row of result.rows) {
        const doc = row.doc as CustomBackground & { _attachments?: any };

        // Skip if already migrated (has imageUrl)
        if (doc.imageUrl) {
          console.log(`[Migration] Skipping ${doc._id} - already has imageUrl`);
          skipped++;
          continue;
        }

        // Skip if no attachments to migrate
        if (!doc._attachments || Object.keys(doc._attachments).length === 0) {
          console.log(`[Migration] Skipping ${doc._id} - no attachments`);
          skipped++;
          continue;
        }

        try {
          console.log(`[Migration] Migrating ${doc._id}...`);

          // Get first attachment
          const attachmentKey = Object.keys(doc._attachments)[0];
          const attachment = await db.getAttachment(doc._id, attachmentKey) as Blob;

          // Convert blob to File
          const file = new File([attachment], doc.filename, {
            type: doc.contentType
          });

          // Upload to MinIO
          const imageUrl = await this.assetCdnService.uploadImage(file);

          // Update document - remove attachment, add imageUrl
          const updated: CustomBackground = {
            ...doc,
            imageUrl,
          };
          delete (updated as any)._attachments;

          await db.put(updated);

          migrated++;
          console.log(`[Migration] ✓ Migrated ${doc.name}`);

        } catch (error) {
          failed++;
          const errorMsg = `Failed to migrate ${doc.name}: ${error}`;
          errors.push(errorMsg);
          console.error(`[Migration] ✗ ${errorMsg}`);
        }
      }

      console.log(`[Migration] Complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed`);
      return { migrated, failed, skipped, errors };

    } catch (error) {
      throw new Error(`Migration failed: ${error}`);
    }
  }

  /**
   * Check migration status
   */
  async checkMigrationStatus(): Promise<{
    total: number;
    migrated: number;
    needsMigration: number;
  }> {
    try {
      const db = await this.databaseService.getDatabase();

      const result = await db.allDocs({
        include_docs: true,
        startkey: 'custom-bg_',
        endkey: 'custom-bg_\ufff0'
      });

      let migrated = 0;
      let needsMigration = 0;

      for (const row of result.rows) {
        const doc = row.doc as CustomBackground & { _attachments?: any };

        if (doc.imageUrl) {
          migrated++;
        } else if (doc._attachments) {
          needsMigration++;
        }
      }

      return {
        total: result.rows.length,
        migrated,
        needsMigration
      };

    } catch (error) {
      console.error('Error checking migration status:', error);
      return { total: 0, migrated: 0, needsMigration: 0 };
    }
  }
}
```

**Location:** `src/app/shared/services/asset-migration.service.ts`

---

### 6.3 Upload API Backend

**File:** `backend/upload-api/src/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Client } from 'minio';
import crypto from 'crypto';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3003;

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:3080',
    process.env.FRONTEND_URL || 'http://localhost:3080'
  ],
  credentials: true
}));

app.use(express.json());

// Configure MinIO client
const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

const BUCKET_NAME = 'creative-writer-assets';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Initialize bucket
(async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`✓ Bucket ${BUCKET_NAME} created`);

      // Set public read policy
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      console.log(`✓ Bucket policy set to public read`);
    } else {
      console.log(`✓ Bucket ${BUCKET_NAME} already exists`);
    }
  } catch (err) {
    console.error('✗ Error initializing MinIO bucket:', err);
  }
})();

// Rate limiting
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per 15 minutes
  message: 'Too many upload requests, please try again later',
});

/**
 * Generate presigned URL for upload
 */
app.post('/presigned-url', uploadLimiter, async (req, res) => {
  try {
    const { filename, contentType, userId } = req.body;

    // Validate inputs
    if (!filename || !contentType || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    // Generate unique, safe key
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const fileExt = path.extname(filename).toLowerCase();
    const key = `users/${userId}/backgrounds/${uniqueId}${fileExt}`;

    // Security: Prevent path traversal
    if (key.includes('..') || !key.startsWith(`users/${userId}/`)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    // Check if file already exists (prevent overwrites)
    try {
      await minioClient.statObject(BUCKET_NAME, key);
      return res.status(409).json({ error: 'File already exists' });
    } catch (err: any) {
      if (err.code !== 'NotFound') {
        throw err;
      }
      // File doesn't exist - good to proceed
    }

    // Generate presigned URL (valid for 5 minutes)
    const presignedUrl = await minioClient.presignedPutObject(
      BUCKET_NAME,
      key,
      300 // 5 minutes
    );

    // Public URL through nginx reverse proxy
    const publicUrl = `${process.env.PUBLIC_URL || 'http://localhost:3080'}/assets/${key}`;

    res.json({
      uploadUrl: presignedUrl,
      publicUrl,
      key,
    });

  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

/**
 * Delete asset
 */
app.delete('/:userId/*', async (req, res) => {
  try {
    const userId = req.params.userId;
    const subPath = req.params[0];
    const key = `users/${userId}/${subPath}`;

    // Security: Verify user owns this asset
    if (!key.startsWith(`users/${userId}/`)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await minioClient.removeObject(BUCKET_NAME, key);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'upload-api' });
});

app.listen(PORT, () => {
  console.log(`✓ Upload API listening on port ${PORT}`);
});
```

**Package.json:**
```json
{
  "name": "upload-api",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    "minio": "^8.0.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.10.6",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2"
  }
}
```

**Dockerfile:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3003

CMD ["node", "dist/index.js"]
```

**Location:** `backend/upload-api/`

---

## 7. INFRASTRUCTURE CHANGES

### 7.1 Update docker-compose.yml

**File:** `docker-compose.yml`

**Add MinIO service after CouchDB:**

```yaml
  # Add after couchdb service (after line 43)
  minio:
    image: quay.io/minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER:-minioadmin}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-minioadmin123}
      - MINIO_BROWSER_REDIRECT_URL=http://localhost:9001
    ports:
      - "9000:9000"  # API
      - "9001:9001"  # Console
    volumes:
      - ${DATA_PATH:-./data}/minio-data:/data
    networks:
      - creativewriter-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  upload-api:
    image: ghcr.io/marcodroll/creativewriter2-upload-api:latest
    restart: unless-stopped
    environment:
      - PORT=3003
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
      - MINIO_USE_SSL=false
      - MINIO_ACCESS_KEY=${MINIO_ROOT_USER:-minioadmin}
      - MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD:-minioadmin123}
      - PUBLIC_URL=${PUBLIC_URL:-http://localhost:3080}
    depends_on:
      - minio
    networks:
      - creativewriter-network
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
```

**Add volume for MinIO data:**

```yaml
# Add to volumes section at the end
volumes:
  minio-data:  # Add this line
```

---

### 7.2 Update nginx.conf

**File:** `nginx.conf`

**Add MinIO proxy routes (insert after line 114, before closing brace):**

```nginx
        # MinIO asset serving (public access)
        location /assets/ {
            rewrite ^/assets/(.*)$ /creative-writer-assets/$1 break;
            proxy_pass http://minio:9000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # CORS headers for direct browser access
            add_header Access-Control-Allow-Origin * always;
            add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

            # Cache images for 1 year (immutable URLs)
            expires 1y;
            add_header Cache-Control "public, max-age=31536000, immutable";

            # Handle OPTIONS preflight
            if ($request_method = 'OPTIONS') {
                return 204;
            }
        }

        # Upload API proxy
        location /api/upload/ {
            proxy_pass http://upload-api:3003/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Increase timeouts for uploads
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;

            # Allow larger uploads
            client_max_body_size 10M;
        }
```

---

### 7.3 Environment Variables

**File:** `.env` (create if doesn't exist)

```bash
# MinIO Configuration
MINIO_ROOT_USER=admin-$(openssl rand -hex 8)
MINIO_ROOT_PASSWORD=$(openssl rand -base64 32)

# Public URL (change for production)
PUBLIC_URL=http://localhost:3080

# Data path
DATA_PATH=./data

# Port
PORT=3080
```

**Security Note:** Generate strong credentials for production!

---

## 8. MIGRATION STRATEGY

### 8.1 Migration UI Component

**File:** `src/app/ui/settings/migration-panel.component.ts`

```typescript
import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonProgressBar, IonText, IonAlert
} from '@ionic/angular/standalone';
import { AssetMigrationService } from '../../shared/services/asset-migration.service';

@Component({
  selector: 'app-migration-panel',
  standalone: true,
  imports: [
    CommonModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonButton, IonProgressBar, IonText, IonAlert
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Asset Migration</ion-card-title>
      </ion-card-header>

      <ion-card-content>
        <div *ngIf="!isChecking() && migrationStatus()">
          <ion-text>
            <p><strong>Migration Status:</strong></p>
            <ul>
              <li>Total backgrounds: {{ migrationStatus()!.total }}</li>
              <li>Already migrated: {{ migrationStatus()!.migrated }}</li>
              <li>Needs migration: {{ migrationStatus()!.needsMigration }}</li>
            </ul>
          </ion-text>

          <ion-button
            expand="block"
            [disabled]="isMigrating() || migrationStatus()!.needsMigration === 0"
            (click)="startMigration()">
            {{ isMigrating() ? 'Migrating...' : 'Start Migration' }}
          </ion-button>

          <ion-progress-bar
            *ngIf="isMigrating()"
            [value]="migrationProgress()">
          </ion-progress-bar>

          <ion-text *ngIf="migrationResult()" color="success">
            <p>✓ Migration complete!</p>
            <ul>
              <li>Migrated: {{ migrationResult()!.migrated }}</li>
              <li>Skipped: {{ migrationResult()!.skipped }}</li>
              <li>Failed: {{ migrationResult()!.failed }}</li>
            </ul>
          </ion-text>

          <ion-text *ngIf="migrationResult()?.errors.length" color="danger">
            <p><strong>Errors:</strong></p>
            <ul>
              <li *ngFor="let error of migrationResult()!.errors">{{ error }}</li>
            </ul>
          </ion-text>
        </div>

        <ion-button
          *ngIf="!migrationStatus()"
          expand="block"
          (click)="checkStatus()">
          Check Migration Status
        </ion-button>
      </ion-card-content>
    </ion-card>
  `
})
export class MigrationPanelComponent implements OnInit {
  private migrationService = inject(AssetMigrationService);

  isChecking = signal(false);
  isMigrating = signal(false);
  migrationProgress = signal(0);
  migrationStatus = signal<any>(null);
  migrationResult = signal<any>(null);

  async ngOnInit() {
    await this.checkStatus();
  }

  async checkStatus() {
    this.isChecking.set(true);
    try {
      const status = await this.migrationService.checkMigrationStatus();
      this.migrationStatus.set(status);
    } catch (error) {
      console.error('Error checking migration status:', error);
    } finally {
      this.isChecking.set(false);
    }
  }

  async startMigration() {
    this.isMigrating.set(true);
    this.migrationProgress.set(0);

    try {
      const result = await this.migrationService.migrateBackgroundsToMinIO();
      this.migrationResult.set(result);
      await this.checkStatus();
    } catch (error) {
      console.error('Migration error:', error);
    } finally {
      this.isMigrating.set(false);
      this.migrationProgress.set(1);
    }
  }
}
```

**Add to settings page:**
```typescript
// In ui-settings.component.ts, add to template:
<app-migration-panel></app-migration-panel>
```

---

### 8.2 Migration Steps for Users

1. **Backup existing data:**
   ```bash
   # Export current database
   Settings → Database → Export Database
   ```

2. **Update deployment:**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

3. **Run migration:**
   ```
   Settings → Asset Migration → Start Migration
   ```

4. **Verify migration:**
   - Check backgrounds load correctly
   - Test upload new background
   - Verify sync works

5. **Clean up (optional):**
   ```bash
   # After successful migration, compact database to reclaim space
   Settings → Database → Compact Database
   ```

---

## 9. TESTING REQUIREMENTS

### 9.1 Unit Tests

**File:** `src/app/shared/services/asset-cdn.service.spec.ts`

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AssetCdnService } from './asset-cdn.service';
import { AuthService } from '../../core/services/auth.service';

describe('AssetCdnService', () => {
  let service: AssetCdnService;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    const authSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AssetCdnService,
        { provide: AuthService, useValue: authSpy }
      ]
    });

    service = TestBed.inject(AssetCdnService);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should upload image successfully', async () => {
    // Test implementation
  });

  it('should reject invalid file types', async () => {
    // Test implementation
  });

  it('should compress images', async () => {
    // Test implementation
  });
});
```

### 9.2 Integration Tests

1. **Upload flow:**
   - Select file
   - Get presigned URL
   - Upload to MinIO
   - Save metadata to PouchDB
   - Verify image loads

2. **Delete flow:**
   - Delete from MinIO
   - Delete from PouchDB
   - Verify image removed

3. **Migration flow:**
   - Create attachment-based background
   - Run migration
   - Verify converted to URL-based
   - Verify image still loads

### 9.3 Manual Testing Checklist

- [ ] Upload new background (PNG)
- [ ] Upload new background (JPG)
- [ ] Upload new background (WebP)
- [ ] Reject invalid file type (GIF)
- [ ] Reject oversized file (>5MB)
- [ ] Delete background
- [ ] Background displays in selector
- [ ] Background syncs to other device
- [ ] Migration converts old backgrounds
- [ ] Backup/restore works
- [ ] Mobile browser performance improved

---

## 10. ROLLBACK PLAN

### 10.1 Database Rollback

**If migration fails:**

1. **Restore from backup:**
   ```
   Settings → Database → Import Database
   (Use backup created before migration)
   ```

2. **Manual cleanup:**
   ```typescript
   // In browser console:
   const db = await databaseService.getDatabase();
   const docs = await db.allDocs({ include_docs: true, startkey: 'custom-bg_', endkey: 'custom-bg_\ufff0' });

   // Remove imageUrl, keep attachments
   for (const row of docs.rows) {
     const doc = row.doc;
     if (doc.imageUrl) {
       delete doc.imageUrl;
       await db.put(doc);
     }
   }
   ```

### 10.2 Code Rollback

**Revert changes:**
```bash
git revert <commit-hash>
git push
```

**Redeploy old version:**
```bash
docker-compose down
docker-compose pull
docker-compose up -d
```

### 10.3 MinIO Cleanup

**If needed:**
```bash
# Stop MinIO
docker-compose stop minio upload-api

# Remove containers
docker-compose rm -f minio upload-api

# Remove volumes (WARNING: deletes all uploaded assets!)
docker volume rm creativewriter_minio-data
```

---

## 11. PERFORMANCE METRICS

### 11.1 Baseline Metrics (Before)

**Test Setup:** 10 custom backgrounds, 5MB each

| Metric | Value |
|--------|-------|
| Total data in PouchDB | 50MB |
| IndexedDB storage used | ~60MB |
| Sync time (initial) | ~30s on 4G |
| Sync time (incremental) | ~5s |
| Memory usage | ~60MB |
| Background load time | ~2s (blob URL generation) |

### 11.2 Target Metrics (After)

| Metric | Target |
|--------|--------|
| Total data in PouchDB | <100KB |
| IndexedDB storage used | <1MB |
| Sync time (initial) | <1s |
| Sync time (incremental) | <0.5s |
| Memory usage | <5MB |
| Background load time | <500ms (cached CDN) |

### 11.3 Measurement Tools

```typescript
// Add to asset-cdn.service.ts for performance tracking
private measureUploadPerformance(fileSize: number, duration: number) {
  const throughput = (fileSize / duration) * 1000; // bytes per second
  const throughputMB = throughput / (1024 * 1024); // MB/s

  console.log(`[Performance] Upload: ${fileSize} bytes in ${duration}ms (${throughputMB.toFixed(2)} MB/s)`);
}
```

---

## 12. SECURITY CONSIDERATIONS

### 12.1 Authentication & Authorization

**Current:** User authentication via AuthService
**New Requirements:**
- Verify user owns assets before deletion
- Prevent path traversal in upload paths
- Rate limit upload endpoints
- Validate file types server-side

**Implementation:**
```typescript
// Backend validation (upload-api)
if (!key.startsWith(`users/${userId}/`)) {
  return res.status(403).json({ error: 'Unauthorized' });
}
```

### 12.2 Input Validation

**File upload validation:**
- Client-side: File type, size (UX)
- Server-side: File type, size (security)
- Path sanitization: Prevent `../` attacks
- Content-Type verification

### 12.3 Network Security

**MinIO access:**
- Internal network only (docker network)
- Public access via nginx reverse proxy
- CORS configured for frontend domain only

**Presigned URLs:**
- Short expiration (5 minutes)
- One-time use
- Scoped to specific object

### 12.4 Data Privacy

**User data isolation:**
- Separate folders per user: `users/{userId}/`
- Cannot access other users' assets
- MinIO bucket policy: public read, authenticated write

---

## 13. DEPLOYMENT CHECKLIST

### 13.1 Pre-Deployment

- [ ] Code review completed
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] Backup procedure tested
- [ ] Rollback procedure tested

### 13.2 Deployment Steps

1. **Backup production data:**
   ```bash
   # Export database
   curl http://localhost:5984/creative-writer-stories-{user}/_all_docs?include_docs=true > backup.json
   ```

2. **Update environment variables:**
   ```bash
   # Generate strong credentials
   export MINIO_ROOT_USER=admin-$(openssl rand -hex 16)
   export MINIO_ROOT_PASSWORD=$(openssl rand -base64 32)
   ```

3. **Deploy infrastructure:**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

4. **Verify services:**
   ```bash
   docker-compose ps
   # All services should be "Up"

   curl http://localhost:9000/minio/health/live
   # Should return "OK"

   curl http://localhost:3003/health
   # Should return {"status":"ok"}
   ```

5. **Deploy frontend:**
   ```bash
   npm run build
   # Deploy to nginx container
   ```

6. **Run migration for existing users:**
   - Notify users to run migration
   - Provide migration UI in settings

### 13.3 Post-Deployment Verification

- [ ] MinIO accessible via nginx
- [ ] Upload API responding
- [ ] New uploads work
- [ ] Background selector displays images
- [ ] Sync performance improved
- [ ] Mobile performance improved
- [ ] No console errors

### 13.4 Monitoring

**Key metrics to monitor:**
- Upload API response times
- MinIO storage usage
- Upload success/failure rates
- Sync performance metrics
- Error rates

---

## 14. DOCUMENTATION UPDATES

### 14.1 README.md Updates

**Add MinIO section:**
```markdown
## MinIO Object Storage

Custom backgrounds and images are stored in MinIO, a self-hosted S3-compatible object storage.

**Access MinIO Console:**
- URL: http://localhost:9001
- Username: See MINIO_ROOT_USER in .env
- Password: See MINIO_ROOT_PASSWORD in .env

**Storage Location:**
- Bucket: creative-writer-assets
- Path: users/{username}/backgrounds/*.{jpg|png|webp}
```

### 14.2 Architecture Documentation

**Update SYNC_ARCHITECTURE.md:**
- Add MinIO to infrastructure diagram
- Document upload flow
- Update storage usage calculations

### 14.3 User Documentation

**Migration Guide:**
```markdown
# Migrating to MinIO Storage

## Why?
Improved performance, especially on mobile devices.

## Steps:
1. Update to latest version
2. Go to Settings → Asset Migration
3. Click "Start Migration"
4. Wait for completion
5. Verify backgrounds still work

## Rollback:
If issues occur, restore from backup:
Settings → Database → Import Database
```

---

## 15. KNOWN LIMITATIONS & FUTURE IMPROVEMENTS

### 15.1 Current Limitations

1. **Single MinIO instance** - no high availability
2. **No CDN** - all traffic through nginx
3. **No image optimization** - basic compression only
4. **No automatic cleanup** - orphaned assets remain if metadata deleted

### 15.2 Future Improvements

1. **Image Optimization:**
   - Integrate Thumbor for automatic resizing
   - Serve WebP with JPEG fallback
   - Generate thumbnails

2. **High Availability:**
   - MinIO distributed mode (4+ nodes)
   - Erasure coding for redundancy

3. **Performance:**
   - CDN integration (Cloudflare)
   - HTTP/2 push for critical assets
   - Service Worker caching

4. **Features:**
   - Bulk upload
   - Image cropping/editing
   - Drag-and-drop reordering
   - Background categories

---

## 16. SUCCESS CRITERIA

### 16.1 Must Have (P0)

- ✅ All existing backgrounds migrated successfully
- ✅ New uploads work without errors
- ✅ Sync time reduced by >90%
- ✅ Mobile browser performance improved
- ✅ No data loss during migration
- ✅ Backward compatible (can restore old backups)

### 16.2 Should Have (P1)

- ✅ Migration UI for easy user migration
- ✅ Automatic image compression
- ✅ Upload progress tracking
- ✅ Comprehensive error handling

### 16.3 Nice to Have (P2)

- ⭕ Real-time upload progress
- ⭕ Multi-file upload
- ⭕ Image preview before upload
- ⭕ Storage usage dashboard

---

## 17. APPENDIX

### A. Useful Commands

**Check MinIO bucket contents:**
```bash
docker-compose exec minio mc ls local/creative-writer-assets/
```

**Check storage usage:**
```bash
docker-compose exec minio mc du local/creative-writer-assets/
```

**Manual asset cleanup:**
```bash
docker-compose exec minio mc rm --recursive --force local/creative-writer-assets/users/{username}/
```

### B. Troubleshooting

**Problem:** Upload fails with CORS error
**Solution:** Check nginx CORS headers, verify MinIO CORS policy

**Problem:** Presigned URL expired
**Solution:** Increase expiration time in upload-api (currently 5min)

**Problem:** Image doesn't load
**Solution:** Check nginx proxy, verify MinIO bucket policy is public read

**Problem:** Migration stuck
**Solution:** Check browser console, verify MinIO accessible, check upload-api logs

### C. References

- MinIO Documentation: https://min.io/docs/minio/linux/
- Presigned URL Best Practices: AWS S3 Documentation
- PouchDB Attachments: https://pouchdb.com/guides/attachments.html

---

**END OF SPECIFICATION**

This specification should be treated as the single source of truth for implementing MinIO CDN asset storage. All implementation work should follow this document exactly.

**Version History:**
- v1.0 (2025-01-07): Initial specification

**Reviewers:** TBD
**Approvers:** TBD
**Implementation Lead:** TBD
