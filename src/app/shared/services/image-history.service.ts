import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ImageGenerationJob,
  ImageGenerationRequest,
  GeneratedImage,
  ImageProvider
} from './image-providers/image-provider.interface';

/** Stored settings for last prompt - uses the same interface as generation request */
type PersistedSettings = Partial<ImageGenerationRequest>;

@Injectable({
  providedIn: 'root'
})
export class ImageHistoryService {
  private readonly STORAGE_KEY = 'creative-writer-image-history';
  private readonly LAST_PROMPT_KEY = 'creative-writer-last-image-prompt';
  private readonly MAX_HISTORY_SIZE = 100;

  private jobsSubject = new BehaviorSubject<ImageGenerationJob[]>([]);
  public jobs$ = this.jobsSubject.asObservable();

  // Observable for completed jobs only
  public completedJobs$ = this.jobs$.pipe(
    map(jobs => jobs.filter(j => j.status === 'completed'))
  );

  // Observable for active (pending/processing) jobs
  public activeJobs$ = this.jobs$.pipe(
    map(jobs => jobs.filter(j => j.status === 'pending' || j.status === 'processing'))
  );

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Create a new job for tracking
   */
  createJob(request: ImageGenerationRequest, modelName: string, provider: ImageProvider): ImageGenerationJob {
    const job: ImageGenerationJob = {
      id: this.generateJobId(),
      modelId: request.modelId,
      modelName,
      provider,
      prompt: request.prompt,
      status: 'pending',
      createdAt: new Date(),
      request
    };

    this.addJob(job);
    return job;
  }

  /**
   * Update job status to processing
   */
  markProcessing(jobId: string): void {
    this.updateJob(jobId, { status: 'processing' });
  }

  /**
   * Mark job as completed with generated images
   */
  completeJob(jobId: string, images: GeneratedImage[]): void {
    this.updateJob(jobId, {
      status: 'completed',
      completedAt: new Date(),
      images
    });
  }

  /**
   * Append additional images to an existing completed job
   */
  appendImagesToJob(jobId: string, newImages: GeneratedImage[]): void {
    const job = this.getJob(jobId);
    if (!job || job.status !== 'completed') return;

    const existingImages = job.images || [];
    // Re-index new images starting after existing
    const reindexedImages = newImages.map((img, i) => ({
      ...img,
      index: existingImages.length + i
    }));

    this.updateJob(jobId, {
      images: [...existingImages, ...reindexedImages]
    });
  }

  /**
   * Mark job as failed with error message
   */
  failJob(jobId: string, error: string): void {
    this.updateJob(jobId, {
      status: 'failed',
      completedAt: new Date(),
      error
    });
  }

  /**
   * Get a specific job by ID
   */
  getJob(jobId: string): ImageGenerationJob | undefined {
    return this.jobsSubject.value.find(j => j.id === jobId);
  }

  /**
   * Get observable for a specific job
   */
  getJob$(jobId: string): Observable<ImageGenerationJob | undefined> {
    return this.jobs$.pipe(
      map(jobs => jobs.find(j => j.id === jobId))
    );
  }

  /**
   * Get all jobs
   */
  getJobs(): ImageGenerationJob[] {
    return this.jobsSubject.value;
  }

  /**
   * Get jobs filtered by provider
   */
  getJobsByProvider(provider: ImageProvider): ImageGenerationJob[] {
    return this.jobsSubject.value.filter(j => j.provider === provider);
  }

  /**
   * Get jobs filtered by model
   */
  getJobsByModel(modelId: string): ImageGenerationJob[] {
    return this.jobsSubject.value.filter(j => j.modelId === modelId);
  }

  /**
   * Delete a specific job
   */
  deleteJob(jobId: string): void {
    const jobs = this.jobsSubject.value.filter(j => j.id !== jobId);
    this.jobsSubject.next(jobs);
    this.saveToStorage();
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.jobsSubject.next([]);
    this.saveToStorage();
  }

  /**
   * Clear jobs older than specified days
   */
  clearOldJobs(daysOld: number): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const jobs = this.jobsSubject.value.filter(j => j.createdAt > cutoff);
    this.jobsSubject.next(jobs);
    this.saveToStorage();
  }

  /**
   * Save last used prompt and settings.
   * Uses the same ImageGenerationRequest interface for type safety.
   */
  saveLastPrompt(modelId: string, settings: PersistedSettings): void {
    try {
      localStorage.setItem(this.LAST_PROMPT_KEY, JSON.stringify({ modelId, settings }));
    } catch (error) {
      console.warn('Failed to save last prompt to localStorage:', error);
    }
  }

  /**
   * Get last used prompt and settings.
   * Returns settings using the same ImageGenerationRequest interface.
   */
  getLastPrompt(): { modelId: string; settings: PersistedSettings } | null {
    try {
      const saved = localStorage.getItem(this.LAST_PROMPT_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load last prompt from localStorage:', error);
    }
    return null;
  }

  // Private methods

  private addJob(job: ImageGenerationJob): void {
    let jobs = [job, ...this.jobsSubject.value];

    // Trim to max size, keeping most recent
    if (jobs.length > this.MAX_HISTORY_SIZE) {
      jobs = jobs.slice(0, this.MAX_HISTORY_SIZE);
    }

    this.jobsSubject.next(jobs);
    this.saveToStorage();
  }

  private updateJob(jobId: string, updates: Partial<ImageGenerationJob>): void {
    const jobs = this.jobsSubject.value.map(job =>
      job.id === jobId ? { ...job, ...updates } : job
    );
    this.jobsSubject.next(jobs);
    this.saveToStorage();
  }

  private generateJobId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const jobs: ImageGenerationJob[] = JSON.parse(saved);
        // Convert date strings back to Date objects
        jobs.forEach(job => {
          job.createdAt = new Date(job.createdAt);
          if (job.completedAt) {
            job.completedAt = new Date(job.completedAt);
          }
        });
        this.jobsSubject.next(jobs);
      }
    } catch (error) {
      console.warn('Failed to load jobs from localStorage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const jobs = this.jobsSubject.value;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(jobs));
    } catch (error) {
      console.warn('Failed to save jobs to localStorage:', error);
    }
  }
}
