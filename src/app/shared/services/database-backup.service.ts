import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/services/database.service';

export interface BackupData {
  metadata: {
    appName: string;
    version: string;
    exportDate: string;
    totalDocs: number;
  };
  documents: unknown[];
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseBackupService {
  private readonly databaseService = inject(DatabaseService);

  async exportDatabase(): Promise<string> {
    const db = await this.databaseService.getDatabase();
    
    // First, get all document IDs
    const allDocsResult = await db.allDocs();
    const docIds = allDocsResult.rows
      .filter(row => !row.id.startsWith('_design/'))
      .map(row => row.id);
    
    // Then fetch each document individually with attachments
    const documents = [];
    
    for (const docId of docIds) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = await (db.get as any)(docId, { 
          attachments: true, 
          binary: false // Get as base64
        });
        documents.push(doc);
      } catch (error) {
        console.warn(`Failed to export document ${docId}:`, error);
        // Try to get without attachments as fallback
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const docWithoutAttachments = await db.get(docId) as any;
          // Remove attachment references to avoid stub issues
          if (docWithoutAttachments['_attachments']) {
            delete docWithoutAttachments['_attachments'];
          }
          documents.push(docWithoutAttachments);
        } catch (fallbackError) {
          console.error(`Failed to export document ${docId} even without attachments:`, fallbackError);
        }
      }
    }
    
    const backupData: BackupData = {
      metadata: {
        appName: 'Creative Writer 2',
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        totalDocs: documents.length
      },
      documents: documents
    };
    
    return JSON.stringify(backupData, null, 2);
  }

  async importDatabase(jsonData: string): Promise<void> {
    const db = await this.databaseService.getDatabase();
    
    let backupData: BackupData;
    try {
      backupData = JSON.parse(jsonData);
    } catch {
      throw new Error('Invalid backup file format. Please ensure the file is a valid JSON backup.');
    }
    
    // Validate backup data structure
    if (!backupData.metadata || !Array.isArray(backupData.documents)) {
      throw new Error('Invalid backup file structure. The file does not contain the expected backup format.');
    }
    
    if (backupData.documents.length === 0) {
      throw new Error('Backup file contains no documents to import.');
    }
    
    // Step 1: Clear the current database completely
    console.log('Clearing current database...');
    const existingDocs = await db.allDocs();
    const docsToDelete = existingDocs.rows
      .filter(row => !row.id.startsWith('_design/')) // Keep design documents
      .map(row => ({
        _id: row.id,
        _rev: row.value.rev,
        _deleted: true
      }));
    
    if (docsToDelete.length > 0) {
      await db.bulkDocs(docsToDelete);
    }
    
    // Step 2: Import all documents from backup
    console.log(`Importing ${backupData.documents.length} documents...`);
    
    // Import documents in batches for better performance
    const batchSize = 100;
    const batches = [];
    
    for (let i = 0; i < backupData.documents.length; i += batchSize) {
      batches.push(backupData.documents.slice(i, i + batchSize));
    }
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} documents`);
      
      try {
        // Clean documents for import (remove _rev to avoid conflicts and handle attachments)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cleanDocs = batch.map((doc: any) => {
          const cleanDoc = { ...doc };
          delete cleanDoc['_rev']; // Remove revision for fresh import
          
          // Handle attachment stubs - if attachments exist but don't have data, remove them
          if (cleanDoc['_attachments']) {
            const attachments = cleanDoc['_attachments'];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hasValidAttachments = Object.values(attachments).some((att: any) => 
              att.data || att.content_type && att.length
            );
            
            if (!hasValidAttachments) {
              console.warn(`Removing invalid attachment stubs from document ${cleanDoc['_id']}`);
              delete cleanDoc['_attachments'];
            }
          }
          
          return cleanDoc;
        });
        
        try {
          await db.bulkDocs(cleanDocs);
          console.log(`Batch ${i + 1} imported successfully`);
        } catch (error) {
          console.warn(`Batch ${i + 1} bulk import failed, trying individual documents:`, error);
          // If bulk import fails, try importing each document individually
          for (let j = 0; j < cleanDocs.length; j++) {
            const doc = cleanDocs[j];
            try {
              await db.put(doc);
            } catch (docError) {
              console.warn(`Failed to import document ${doc['_id']} (${j + 1}/${cleanDocs.length}):`, docError);
              
              // If it's an attachment error, try without attachments
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const error = docError as any;
              if (error.name === 'missing_stub' || error.message?.includes('stub') || error.message?.includes('attachment')) {
                try {
                  const docWithoutAttachments = { ...doc };
                  delete docWithoutAttachments['_attachments'];
                  await db.put(docWithoutAttachments);
                  console.warn(`Successfully imported document ${doc['_id']} without attachments`);
                } catch (finalError) {
                  console.error(`Failed to import document ${doc['_id']} even without attachments:`, finalError);
                }
              }
            }
          }
        }
      } catch (batchError) {
        console.error(`Critical error processing batch ${i + 1}:`, batchError);
        // Continue with next batch even if this one fails completely
      }
    }
    
    console.log('Database import completed successfully');
  }

  async getDatabaseInfo(): Promise<{ totalDocs: number; dbName: string; lastUpdated?: Date }> {
    const db = await this.databaseService.getDatabase();
    const info = await db.info();
    
    return {
      totalDocs: info.doc_count,
      dbName: info.db_name,
      lastUpdated: info.update_seq ? new Date() : undefined
    };
  }

  downloadFile(content: string, filename: string, mimeType = 'application/json'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  generateFilename(): string {
    const date = new Date();
    const timestamp = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    return `creative-writer-backup-${timestamp}.json`;
  }
}