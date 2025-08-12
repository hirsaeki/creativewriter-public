import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/services/database.service';

export interface StoredImage {
  _id: string;
  id: string;
  name: string;
  base64Data: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  type: 'image';
}

export interface ImageUploadResult {
  url: string;
  imageId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private readonly MAX_IMAGE_SIZE = 2 * 1024 * 1024; // Reduced to 2MB
  private readonly MAX_IMAGES = 20; // Max number of images to keep
  private databaseService = inject(DatabaseService);

  /**
   * Upload an image file and store it locally, returning both URL and ID
   */
  async uploadImageWithId(file: File): Promise<ImageUploadResult> {
    // Validate file size
    if (file.size > this.MAX_IMAGE_SIZE) {
      throw new Error(`File is too large. Maximum size: ${this.formatFileSize(this.MAX_IMAGE_SIZE)}`);
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    try {
      // Clean up old images first to make space
      await this.cleanupImages();

      // Convert file to base64
      const base64Data = await this.fileToBase64(file);
      
      // Create image record
      const imageId = this.generateImageId();
      const storedImage: StoredImage = {
        _id: `image_${imageId}`,
        id: imageId,
        name: file.name,
        base64Data,
        mimeType: file.type,
        size: file.size,
        createdAt: new Date(),
        type: 'image'
      };

      // Store in PouchDB
      await this.storeImage(storedImage);

      // Return both URL and ID
      return {
        url: this.getImageDataUrl(storedImage),
        imageId: imageId
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error uploading image');
    }
  }

  /**
   * Upload an image file and store it locally (legacy method)
   */
  async uploadImage(file: File): Promise<string> {
    // Validate file size
    if (file.size > this.MAX_IMAGE_SIZE) {
      throw new Error(`File is too large. Maximum size: ${this.formatFileSize(this.MAX_IMAGE_SIZE)}`);
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    try {
      // Clean up old images first to make space
      await this.cleanupImages();

      // Convert file to base64
      const base64Data = await this.fileToBase64(file);
      
      // Create image record
      const imageId = this.generateImageId();
      const storedImage: StoredImage = {
        _id: `image_${imageId}`,
        id: imageId,
        name: file.name,
        base64Data,
        mimeType: file.type,
        size: file.size,
        createdAt: new Date(),
        type: 'image'
      };

      // Store in PouchDB
      await this.storeImage(storedImage);

      // Return data URL for immediate use
      return this.getImageDataUrl(storedImage);
    } catch (error) {
      console.error('Error uploading image:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error uploading image');
    }
  }

  /**
   * Get all stored images
   */
  async getAllImages(): Promise<StoredImage[]> {
    try {
      const db = await this.databaseService.getDatabase();
      const result = await db.find({
        selector: { type: 'image' }
        // Remove sort to avoid index issues - we'll sort in memory instead
      });
      
      const images = result.docs.map((doc: unknown) => {
        const typedDoc = doc as StoredImage & { _id: string; _rev: string };
        return {
          ...typedDoc,
          createdAt: new Date(typedDoc.createdAt)
        };
      }) as StoredImage[];
      
      // Sort in memory by createdAt descending
      return images.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Error loading images:', error);
      return [];
    }
  }

  /**
   * Get a specific image by ID
   */
  async getImage(id: string): Promise<StoredImage | null> {
    try {
      const db = await this.databaseService.getDatabase();
      const doc = await db.get(`image_${id}`) as StoredImage & { _id: string; _rev: string };
      return {
        ...doc,
        createdAt: new Date(doc['createdAt'])
      } as StoredImage;
    } catch (error) {
      if ((error as PouchDB.Core.Error).status === 404) {
        return null;
      }
      console.error('Error loading image:', error);
      return null;
    }
  }

  /**
   * Delete an image
   */
  async deleteImage(id: string): Promise<boolean> {
    try {
      const db = await this.databaseService.getDatabase();
      const doc = await db.get(`image_${id}`);
      await db.remove(doc);
      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  }

  /**
   * Get data URL for an image
   */
  getImageDataUrl(image: StoredImage): string {
    return `data:${image.mimeType};base64,${image.base64Data}`;
  }

  /**
   * Clean up old images to manage storage space
   */
  async cleanupImages(): Promise<void> {
    try {
      const images = await this.getAllImages();
      
      // If we have more than MAX_IMAGES, remove the oldest ones
      if (images.length >= this.MAX_IMAGES) {
        const imagesToDelete = images.slice(this.MAX_IMAGES - 1);
        
        for (const image of imagesToDelete) {
          await this.deleteImage(image.id);
        }
      }
    } catch (error) {
      console.error('Fehler beim Bereinigen der Bilder:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{ count: number; totalSize: number; formattedSize: string }> {
    const images = await this.getAllImages();
    const totalSize = images.reduce((sum, img) => sum + img.size, 0);
    
    return {
      count: images.length,
      totalSize,
      formattedSize: this.formatFileSize(totalSize)
    };
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64 data
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading the file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  private async storeImage(image: StoredImage): Promise<void> {
    try {
      const db = await this.databaseService.getDatabase();
      await db.put(image);
    } catch (error) {
      if (error instanceof Error && (error.name === 'QuotaExceededError' || error.message.includes('storage quota'))) {
        // Try to clean up space and retry
        await this.cleanupImages();
        try {
          const db = await this.databaseService.getDatabase();
          await db.put(image);
        } catch {
          throw new Error('Not enough storage space available. Try deleting old images.');
        }
      } else {
        throw error;
      }
    }
  }

  private generateImageId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}