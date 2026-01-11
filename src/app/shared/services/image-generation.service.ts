import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
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

  // Active generation tracking
  private generatingSubject = new BehaviorSubject<boolean>(false);
  public generating$ = this.generatingSubject.asObservable();

  constructor() {
    // Initialize models on service creation
    this.modelService.loadAllModels();
  }

  /**
   * Generate image(s) using the appropriate provider
   */
  generateImage(request: ImageGenerationRequest): Observable<ImageGenerationJob> {
    // Get the model to determine provider
    const model = this.modelService.getModel(request.modelId);
    if (!model) {
      return of({
        id: '',
        modelId: request.modelId,
        modelName: 'Unknown',
        provider: 'openrouter' as ImageProvider,
        prompt: request.prompt,
        status: 'failed' as const,
        createdAt: new Date(),
        error: `Model ${request.modelId} not found`,
        request
      });
    }

    // Get the appropriate provider
    const provider = this.getProviderForModel(model.provider);
    if (!provider) {
      return of({
        id: '',
        modelId: request.modelId,
        modelName: model.name,
        provider: model.provider,
        prompt: request.prompt,
        status: 'failed' as const,
        createdAt: new Date(),
        error: `Provider ${model.provider} is not configured`,
        request
      });
    }

    // Create job in history
    const job = this.historyService.createJob(request, model.name, model.provider);

    this.generatingSubject.next(true);

    // Execute generation
    return from(provider.generate(request)).pipe(
      tap(result => {
        // Update job with results
        this.historyService.completeJob(job.id, result.images);
      }),
      map(result => ({
        ...job,
        status: 'completed' as const,
        completedAt: new Date(),
        images: result.images
      })),
      catchError(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.historyService.failJob(job.id, errorMessage);
        return of({
          ...job,
          status: 'failed' as const,
          completedAt: new Date(),
          error: errorMessage
        });
      }),
      tap(() => {
        this.generatingSubject.next(false);
      })
    );
  }

  /**
   * Regenerate using an existing job's request and append results to that job.
   * Removes seed from request to generate new variations instead of identical copies.
   */
  regenerateAndAppend(jobId: string): Observable<ImageGenerationJob> {
    const job = this.historyService.getJob(jobId);
    if (!job) {
      return of({
        id: '',
        modelId: '',
        modelName: 'Unknown',
        provider: 'openrouter' as ImageProvider,
        prompt: '',
        status: 'failed' as const,
        createdAt: new Date(),
        error: 'Job not found',
        request: { modelId: '', prompt: '' }
      });
    }

    // Get the provider
    const provider = this.getProviderForModel(job.provider);
    if (!provider) {
      return of({
        ...job,
        status: 'failed' as const,
        error: `Provider ${job.provider} is not configured`
      });
    }

    // Clone request and remove seed to get new variations
    const request: ImageGenerationRequest = { ...job.request };
    delete request.seed;

    this.generatingSubject.next(true);

    return from(provider.generate(request)).pipe(
      tap(result => {
        // Append new images to existing job
        this.historyService.appendImagesToJob(jobId, result.images);
      }),
      map(() => this.historyService.getJob(jobId)!),
      catchError(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Don't modify the job on failure, just return error info
        return of({
          ...job,
          error: errorMessage
        });
      }),
      tap(() => {
        this.generatingSubject.next(false);
      })
    );
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
