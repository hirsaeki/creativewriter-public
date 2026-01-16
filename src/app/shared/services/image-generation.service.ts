import { Injectable, inject } from '@angular/core';
import { Observable, Subscription, from, of, throwError, EMPTY } from 'rxjs';
import { catchError, tap, finalize } from 'rxjs/operators';
import {
  ImageProvider,
  ImageGenerationModel,
  ImageGenerationRequest,
  ImageGenerationJob,
  IImageProvider
} from './image-providers/image-provider.interface';
import { OpenRouterImageProvider } from './image-providers/openrouter-image.provider';
import { FalImageProvider } from './image-providers/fal-image.provider';
import { ReplicateImageProvider } from './image-providers/replicate-image.provider';
import { ImageHistoryService } from './image-history.service';
import { ImageModelService } from './image-model.service';

@Injectable({
  providedIn: 'root'
})
export class ImageGenerationService {
  // Inject providers
  private openRouterProvider = inject(OpenRouterImageProvider);
  private falProvider = inject(FalImageProvider);
  private replicateProvider = inject(ReplicateImageProvider);

  // Inject services
  private historyService = inject(ImageHistoryService);
  private modelService = inject(ImageModelService);

  // Observable streams from sub-services
  public jobs$ = this.historyService.jobs$;
  public models$ = this.modelService.models$;
  public modelsLoading$ = this.modelService.loading$;
  public modelsByProvider$ = this.modelService.modelsByProvider$;

  // Concurrent generation tracking
  private readonly MAX_CONCURRENT_GENERATIONS = 3;
  private activeGenerations = new Map<string, Subscription>();

  // Observable for count of currently processing jobs
  public processingCount$ = this.historyService.processingCount$;

  constructor() {
    // Initialize models on service creation
    this.modelService.loadAllModels();
  }

  /**
   * Generate image(s) using the appropriate provider.
   * Runs in the background - returns immediately with the job reference.
   * Supports up to MAX_CONCURRENT_GENERATIONS concurrent jobs.
   */
  generateImage(request: ImageGenerationRequest): Observable<ImageGenerationJob> {
    // Check concurrency limit
    if (this.activeGenerations.size >= this.MAX_CONCURRENT_GENERATIONS) {
      return throwError(() => new Error(
        `Maximum ${this.MAX_CONCURRENT_GENERATIONS} concurrent generations allowed. Please wait for one to complete.`
      ));
    }

    // Get the model to determine provider
    const model = this.modelService.getModel(request.modelId);
    if (!model) {
      return throwError(() => new Error(`Model ${request.modelId} not found`));
    }

    // Get the appropriate provider
    const provider = this.getProviderForModel(model.provider);
    if (!provider) {
      return throwError(() => new Error(`Provider ${model.provider} is not configured`));
    }

    // Create job in history immediately (status: pending)
    const job = this.historyService.createJob(request, model.name, model.provider);

    // Start background generation (fire-and-forget)
    this.startBackgroundGeneration(job.id, request, provider);

    // Return job reference immediately
    return of(job);
  }

  /**
   * Start background generation for a job.
   * The subscription is tracked so it can be cancelled if needed.
   */
  private startBackgroundGeneration(
    jobId: string,
    request: ImageGenerationRequest,
    provider: IImageProvider
  ): void {
    // Update status to processing
    this.historyService.markProcessing(jobId);

    // Start async generation
    const subscription = from(provider.generate(request)).pipe(
      tap(result => {
        this.historyService.completeJob(jobId, result.images);
      }),
      catchError(error => {
        const rawMessage = error instanceof Error ? error.message : String(error);
        const errorMessage = this.sanitizeErrorMessage(rawMessage);
        this.historyService.failJob(jobId, errorMessage);
        return EMPTY;
      }),
      finalize(() => {
        this.activeGenerations.delete(jobId);
      })
    ).subscribe();

    // Track active generation
    this.activeGenerations.set(jobId, subscription);
  }

  /**
   * Cancel a running generation
   */
  cancelGeneration(jobId: string): void {
    const subscription = this.activeGenerations.get(jobId);
    if (subscription) {
      subscription.unsubscribe();
      this.activeGenerations.delete(jobId);
      this.historyService.failJob(jobId, 'Cancelled by user');
    }
  }

  /**
   * Regenerate using an existing job's request and append results to that job.
   * Removes seed from request to generate new variations instead of identical copies.
   * Runs in the background - returns immediately with the job reference.
   */
  regenerateAndAppend(jobId: string): Observable<ImageGenerationJob> {
    // Check concurrency limit
    if (this.activeGenerations.size >= this.MAX_CONCURRENT_GENERATIONS) {
      return throwError(() => new Error(
        `Maximum ${this.MAX_CONCURRENT_GENERATIONS} concurrent generations allowed. Please wait for one to complete.`
      ));
    }

    const job = this.historyService.getJob(jobId);
    if (!job) {
      return throwError(() => new Error('Job not found'));
    }

    // Get the provider
    const provider = this.getProviderForModel(job.provider);
    if (!provider) {
      return throwError(() => new Error(`Provider ${job.provider} is not configured`));
    }

    // Clone request and remove seed to get new variations
    const request: ImageGenerationRequest = { ...job.request, seed: undefined };

    // Start background regeneration
    this.startBackgroundRegeneration(jobId, request, provider);

    // Return current job reference immediately
    return of(job);
  }

  /**
   * Start background regeneration that appends to an existing job.
   */
  private startBackgroundRegeneration(
    jobId: string,
    request: ImageGenerationRequest,
    provider: IImageProvider
  ): void {
    // Use a unique key for tracking this regeneration
    const regenerationKey = `${jobId}_regen_${Date.now()}`;

    const subscription = from(provider.generate(request)).pipe(
      tap(result => {
        // Append new images to existing job
        this.historyService.appendImagesToJob(jobId, result.images);
      }),
      catchError(error => {
        console.error('Regeneration failed:', error);
        return EMPTY;
      }),
      finalize(() => {
        this.activeGenerations.delete(regenerationKey);
      })
    ).subscribe();

    // Track active regeneration
    this.activeGenerations.set(regenerationKey, subscription);
  }

  private readonly MAX_ERROR_MESSAGE_LENGTH = 200;

  /**
   * Sanitize error messages to prevent HTML content from cluttering the UI.
   * Extracts meaningful error info from HTML error pages (like Cloudflare 504).
   */
  private sanitizeErrorMessage(message: string): string {
    // Check if message looks like HTML
    if (message.includes('<!DOCTYPE') || message.includes('<html')) {
      // Try to extract error code and message from common error page patterns
      const titleMatch = message.match(/<title>([^<]+)<\/title>/i);
      const h1Match = message.match(/<h1[^>]*>([^<]+)<\/h1>/i);

      // Extract HTTP status code if present (e.g., "Error code 504")
      const codeMatch = message.match(/error\s*code\s*(\d{3})/i) ||
                        message.match(/(\d{3}):\s*\w+/);

      if (titleMatch || h1Match || codeMatch) {
        const parts: string[] = [];
        if (codeMatch) parts.push(`HTTP ${codeMatch[1]}`);
        if (h1Match) parts.push(h1Match[1].trim());
        else if (titleMatch) parts.push(titleMatch[1].trim());
        // Filter empty strings and join
        const result = parts.filter(p => p).join(' - ');
        if (result) {
          // Apply truncation to extracted content too
          return result.length > this.MAX_ERROR_MESSAGE_LENGTH
            ? result.substring(0, this.MAX_ERROR_MESSAGE_LENGTH) + '...'
            : result;
        }
      }

      return 'Server error (HTML response)';
    }

    // Truncate very long messages
    if (message.length > this.MAX_ERROR_MESSAGE_LENGTH) {
      return message.substring(0, this.MAX_ERROR_MESSAGE_LENGTH) + '...';
    }

    return message;
  }

  /**
   * Get the appropriate provider instance for a provider type
   */
  private getProviderForModel(provider: ImageProvider): IImageProvider | null {
    switch (provider) {
      case 'openrouter':
        return this.openRouterProvider.isConfigured() ? this.openRouterProvider : null;
      case 'fal':
        return this.falProvider.isConfigured() ? this.falProvider : null;
      case 'replicate':
        return this.replicateProvider.isConfigured() ? this.replicateProvider : null;
      default:
        return null;
    }
  }

  /**
   * Get all available models
   */
  getAvailableModels(): ImageGenerationModel[] {
    return this.modelService.getModels();
  }

  /**
   * Get models for a specific provider
   */
  getModelsByProvider(provider: ImageProvider): ImageGenerationModel[] {
    return this.modelService.getModelsByProvider(provider);
  }

  /**
   * Get a specific model by ID
   */
  getModel(modelId: string): ImageGenerationModel | undefined {
    return this.modelService.getModel(modelId);
  }

  /**
   * Refresh all models from providers
   */
  async refreshModels(): Promise<void> {
    await this.modelService.refreshAllModels();
  }

  /**
   * Load models from a specific provider
   */
  async loadProviderModels(provider: ImageProvider): Promise<ImageGenerationModel[]> {
    return this.modelService.loadProviderModels(provider);
  }

  /**
   * Check which providers are configured
   */
  getConfiguredProviders(): ImageProvider[] {
    return this.modelService.getConfiguredProviders();
  }

  /**
   * Check if a specific provider is configured
   */
  isProviderConfigured(provider: ImageProvider): boolean {
    return this.modelService.isProviderConfigured(provider);
  }

  /**
   * Get provider display name
   */
  getProviderDisplayName(provider: ImageProvider): string {
    return this.modelService.getProviderDisplayName(provider);
  }

  /**
   * Get all jobs
   */
  getJobs(): ImageGenerationJob[] {
    return this.historyService.getJobs();
  }

  /**
   * Clear all job history
   */
  clearJobs(): void {
    this.historyService.clearHistory();
  }

  /**
   * Delete a specific job
   */
  deleteJob(jobId: string): void {
    this.historyService.deleteJob(jobId);
  }

  /**
   * Save last used prompt and settings.
   * Uses Partial<ImageGenerationRequest> for type safety.
   */
  saveLastPrompt(modelId: string, settings: Partial<ImageGenerationRequest>): void {
    this.historyService.saveLastPrompt(modelId, settings);
  }

  /**
   * Get last used prompt and settings.
   * Returns settings using the same ImageGenerationRequest interface.
   */
  getLastPrompt(): { modelId: string; settings: Partial<ImageGenerationRequest> } | null {
    return this.historyService.getLastPrompt();
  }

  // Legacy support: expose availableModels$ for backward compatibility
  public availableModels$ = this.models$;
}
