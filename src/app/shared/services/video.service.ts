import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/services/database.service';
import { StoredVideo, ImageVideoAssociation } from '../models/video.interface';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private readonly MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB max for videos
  private readonly MAX_VIDEOS = 10; // Max number of videos to keep
  private databaseService = inject(DatabaseService);

  /**
   * Upload a video file and store it locally
   */
  async uploadVideo(file: File): Promise<string> {
    // Validate file size
    if (file.size > this.MAX_VIDEO_SIZE) {
      throw new Error(`Video is too large. Maximum size: ${this.formatFileSize(this.MAX_VIDEO_SIZE)}`);
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      throw new Error('Only video files are allowed');
    }

    try {
      // Clean up old videos first to make space
      await this.cleanupVideos();

      // Convert file to base64
      const base64Data = await this.fileToBase64(file);
      
      // Create video record
      const videoId = this.generateVideoId();
      const storedVideo: StoredVideo = {
        _id: `video_${videoId}`,
        id: videoId,
        name: file.name,
        base64Data,
        mimeType: file.type,
        size: file.size,
        createdAt: new Date(),
        type: 'video'
      };

      // Store in PouchDB
      await this.storeVideo(storedVideo);

      // Return video ID for association
      return videoId;
    } catch (error) {
      console.error('Error uploading video:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error uploading video');
    }
  }

  /**
   * Get all stored videos
   */
  async getAllVideos(): Promise<StoredVideo[]> {
    try {
      const db = await this.databaseService.getDatabase();
      const result = await db.find({
        selector: { type: 'video' }
        // Remove sort to avoid index issues - we'll sort in memory instead
      });
      
      const videos = result.docs.map((doc: unknown) => {
        const typedDoc = doc as StoredVideo & { _id: string; _rev: string };
        return {
          ...typedDoc,
          createdAt: new Date(typedDoc.createdAt)
        };
      }) as StoredVideo[];
      
      // Sort in memory by createdAt descending
      return videos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Error loading videos:', error);
      return [];
    }
  }

  /**
   * Get a specific video by ID
   */
  async getVideo(id: string): Promise<StoredVideo | null> {
    try {
      const db = await this.databaseService.getDatabase();
      const doc = await db.get(`video_${id}`) as StoredVideo & { _id: string; _rev: string };
      return {
        ...doc,
        createdAt: new Date(doc['createdAt'])
      } as StoredVideo;
    } catch (error) {
      if ((error as PouchDB.Core.Error).status === 404) {
        return null;
      }
      console.error('Error loading video:', error);
      return null;
    }
  }

  /**
   * Delete a video
   */
  async deleteVideo(id: string): Promise<boolean> {
    try {
      const db = await this.databaseService.getDatabase();
      const doc = await db.get(`video_${id}`);
      await db.remove(doc);
      return true;
    } catch (error) {
      console.error('Error deleting video:', error);
      return false;
    }
  }

  /**
   * Get data URL for a video
   */
  getVideoDataUrl(video: StoredVideo): string {
    return `data:${video.mimeType};base64,${video.base64Data}`;
  }

  /**
   * Associate an image with a video
   */
  async associateImageWithVideo(imageId: string, videoId: string): Promise<boolean> {
    try {
      const associationId = this.generateAssociationId();
      const association: ImageVideoAssociation = {
        _id: `association_${associationId}`,
        id: associationId,
        imageId,
        videoId,
        createdAt: new Date(),
        type: 'image-video-association'
      };

      const db = await this.databaseService.getDatabase();
      await db.put(association);
      return true;
    } catch (error) {
      console.error('Error linking image and video:', error);
      return false;
    }
  }

  /**
   * Get video associated with an image
   */
  async getVideoForImage(imageId: string): Promise<StoredVideo | null> {
    try {
      const db = await this.databaseService.getDatabase();
      console.log('Searching for video association for imageId:', imageId);
      
      const result = await db.find({
        selector: { 
          type: 'image-video-association',
          imageId: imageId
        }
      });

      console.log('Found associations:', result.docs.length);
      
      if (result.docs.length === 0) {
        return null;
      }

      const association = result.docs[0] as ImageVideoAssociation;
      console.log('Found association:', association);
      
      const video = await this.getVideo(association.videoId);
      console.log('Found video:', !!video);
      
      return video;
    } catch (error) {
      console.error('Error loading linked video:', error);
      return null;
    }
  }

  /**
   * Remove association between image and video
   */
  async removeImageVideoAssociation(imageId: string): Promise<boolean> {
    try {
      const db = await this.databaseService.getDatabase();
      const result = await db.find({
        selector: { 
          type: 'image-video-association',
          imageId: imageId
        }
      });

      for (const doc of result.docs) {
        await db.remove(doc);
      }
      
      return true;
    } catch (error) {
      console.error('Error removing association:', error);
      return false;
    }
  }

  /**
   * Clean up old videos to manage storage space
   */
  async cleanupVideos(): Promise<void> {
    try {
      const videos = await this.getAllVideos();
      
      // If we have more than MAX_VIDEOS, remove the oldest ones
      if (videos.length >= this.MAX_VIDEOS) {
        const videosToDelete = videos.slice(this.MAX_VIDEOS - 1);
        
        for (const video of videosToDelete) {
          await this.deleteVideo(video.id);
        }
      }
    } catch (error) {
      console.error('Error cleaning up videos:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{ count: number; totalSize: number; formattedSize: string }> {
    const videos = await this.getAllVideos();
    const totalSize = videos.reduce((sum, vid) => sum + vid.size, 0);
    
    return {
      count: videos.length,
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
        reject(new Error('Error reading file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  private async storeVideo(video: StoredVideo): Promise<void> {
    try {
      const db = await this.databaseService.getDatabase();
      await db.put(video);
    } catch (error) {
      if (error instanceof Error && (error.name === 'QuotaExceededError' || error.message.includes('storage quota'))) {
        // Try to clean up space and retry
        await this.cleanupVideos();
        try {
          const db = await this.databaseService.getDatabase();
          await db.put(video);
        } catch {
          throw new Error('Not enough storage space available. Try deleting old videos.');
        }
      } else {
        throw error;
      }
    }
  }

  private generateVideoId(): string {
    return `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAssociationId(): string {
    return `assoc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}