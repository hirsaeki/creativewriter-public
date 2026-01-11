import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, interval, takeWhile, switchMap, take } from 'rxjs';
import { SettingsService } from '../../../core/services/settings.service';
import {
  IImageProvider,
  ImageProvider,
  ImageGenerationModel,
  ImageGenerationRequest,
  ImageGenerationResult,
  GeneratedImage,
  ImageModelCapabilities
} from './image-provider.interface';

// Replicate API response types
interface ReplicatePredictionResponse {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
  logs?: string;
}

interface ReplicateCollectionResponse {
  models: {
    url: string;
    name: string;
    description?: string;
    latest_version?: { id: string };
    owner: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class ReplicateImageProvider implements IImageProvider {
  private http = inject(HttpClient);
  private settingsService = inject(SettingsService);

  readonly providerId: ImageProvider = 'replicate';
  readonly displayName = 'Replicate';

  private readonly PROXY_URL = '/api/replicate';

  // Polling configuration - max 3 minutes (90 polls at 2s interval)
  private readonly POLL_INTERVAL_MS = 2000;
  private readonly MAX_POLL_ATTEMPTS = 90;

  // Cache for loaded models
  private modelsCache: ImageGenerationModel[] = [];
  private modelsCacheTime = 0;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  // Default capabilities for Replicate models
  private readonly DEFAULT_CAPABILITIES: ImageModelCapabilities = {
    supportsAspectRatio: false,
    supportsNegativePrompt: true,
    supportsMultipleImages: true,
    supportsSeed: true,
    supportsGuidanceScale: true,
    supportsInferenceSteps: true,
    maxImages: 4
  };

  // Predefined models with known configurations
  private readonly MODELS: ImageGenerationModel[] = [
    {
      id: 'asiryan/unlimited-xl',
      name: 'Unlimited XL',
      description: 'High-quality image generation model',
      provider: 'replicate',
      capabilities: { ...this.DEFAULT_CAPABILITIES }
    },
    {
      id: 'lucataco/realistic-vision-v5',
      name: 'Realistic Vision V5',
      description: 'Photorealistic image generation',
      provider: 'replicate',
      capabilities: { ...this.DEFAULT_CAPABILITIES }
    },
    {
      id: 'stability-ai/sdxl',
      name: 'Stable Diffusion XL',
      description: 'Latest SDXL model with high quality output',
      provider: 'replicate',
      capabilities: { ...this.DEFAULT_CAPABILITIES }
    }
  ];

  // Model version mapping (required by Replicate API)
  private readonly MODEL_VERSIONS: Record<string, string> = {
    'asiryan/unlimited-xl': '1a98916be7897ab4d9fbc30d2b20d070c237674148b00d344cf03ff103eb7082',
    'lucataco/realistic-vision-v5': '23e520565b2ce5b779df730ddd71e7b96be852bfe1bbba6284a083e3610e3e3e',
    'stability-ai/sdxl': '7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc'
  };

  isConfigured(): boolean {
    const settings = this.settingsService.getSettings();
    return Boolean(settings.replicate?.enabled && settings.replicate?.apiKey);
  }

  private getApiKey(): string {
    const settings = this.settingsService.getSettings();
    return settings.replicate?.apiKey || '';
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      throw new Error('Replicate is not configured. Please add your API key in settings.');
    }

    const model = this.getModel(request.modelId);
    if (!model) {
      throw new Error(`Model ${request.modelId} not found`);
    }

    // Get model version
    const version = this.MODEL_VERSIONS[request.modelId] || '';
    if (!version) {
      throw new Error(`Model version not found for ${request.modelId}`);
    }

    // Build Replicate input
    const input: Record<string, unknown> = {
      prompt: request.prompt,
      disable_safety_checker: true
    };

    // Add optional parameters
    if (request.negativePrompt) {
      input['negative_prompt'] = request.negativePrompt;
    }

    if (request.numImages) {
      input['num_outputs'] = Math.min(request.numImages, 4);
    }

    if (request.seed !== undefined) {
      input['seed'] = request.seed;
    }

    if (request.guidanceScale !== undefined) {
      input['guidance_scale'] = request.guidanceScale;
    }

    if (request.inferenceSteps !== undefined) {
      input['num_inference_steps'] = request.inferenceSteps;
    }

    // Default dimensions if not specified
    input['width'] = 1024;
    input['height'] = 1024;

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Token': this.getApiKey()
    });

    try {
      // Start prediction
      const predictionResponse = await firstValueFrom(
        this.http.post<ReplicatePredictionResponse>(`${this.PROXY_URL}/predictions`, {
          version: `${request.modelId}:${version}`,
          input
        }, { headers })
      );

      // Poll for completion
      const finalResponse = await this.pollPrediction(predictionResponse.id, headers);

      if (finalResponse.status === 'failed') {
        throw new Error(finalResponse.error || 'Generation failed');
      }

      const images = this.extractImagesFromResponse(finalResponse);

      if (images.length === 0) {
        throw new Error('No images were generated');
      }

      return {
        images,
        modelId: request.modelId,
        prompt: request.prompt,
        generatedAt: new Date()
      };
    } catch (error: unknown) {
      // Re-throw if already a proper Error
      if (error instanceof Error && !(error as { status?: number }).status) {
        throw error;
      }

      // Handle HttpErrorResponse
      const httpError = error as { status?: number; error?: { message?: string; error?: string; detail?: string }; message?: string };
      if (httpError.status && httpError.error) {
        const errorMessage = httpError.error.message || httpError.error.error || httpError.error.detail || JSON.stringify(httpError.error);
        throw new Error(`Failed to generate image: ${errorMessage}`);
      }

      // Fallback for other error types
      if (httpError.message) {
        throw new Error(`Failed to generate image: ${httpError.message}`);
      }

      throw new Error('Failed to generate image: Unknown error');
    }
  }

  private async pollPrediction(predictionId: string, headers: HttpHeaders): Promise<ReplicatePredictionResponse> {
    return new Promise((resolve, reject) => {
      let lastResponse: ReplicatePredictionResponse | null = null;

      const subscription = interval(this.POLL_INTERVAL_MS).pipe(
        take(this.MAX_POLL_ATTEMPTS), // Prevent infinite polling - max 3 minutes
        switchMap(() => this.http.get<ReplicatePredictionResponse>(
          `${this.PROXY_URL}/predictions/${predictionId}`,
          { headers }
        )),
        takeWhile(response => {
          lastResponse = response;
          return response.status === 'starting' || response.status === 'processing';
        }, true)
      ).subscribe({
        next: response => {
          if (response.status !== 'starting' && response.status !== 'processing') {
            subscription.unsubscribe();
            resolve(response);
          }
        },
        error: err => {
          subscription.unsubscribe();
          reject(err);
        },
        complete: () => {
          // If we hit max attempts without resolution, reject with timeout error
          if (lastResponse && (lastResponse.status === 'starting' || lastResponse.status === 'processing')) {
            reject(new Error('Image generation timed out after 3 minutes'));
          }
        }
      });
    });
  }

  private extractImagesFromResponse(response: ReplicatePredictionResponse): GeneratedImage[] {
    const images: GeneratedImage[] = [];

    if (!response.output) {
      return images;
    }

    const outputs = Array.isArray(response.output)
      ? response.output.filter((url): url is string => !!url)
      : [response.output].filter((url): url is string => !!url);

    for (let i = 0; i < outputs.length; i++) {
      images.push({
        url: outputs[i],
        mimeType: 'image/png',
        index: i
      });
    }

    return images;
  }

  async getAvailableModels(): Promise<ImageGenerationModel[]> {
    // Return cached models if still valid
    if (this.modelsCache.length > 0 && Date.now() - this.modelsCacheTime < this.CACHE_TTL_MS) {
      return this.modelsCache;
    }

    if (!this.isConfigured()) {
      return this.MODELS;
    }

    try {
      const headers = new HttpHeaders({
        'X-API-Token': this.getApiKey(),
        'Content-Type': 'application/json'
      });

      const response = await firstValueFrom(
        this.http.get<ReplicateCollectionResponse>(`${this.PROXY_URL}/collections/text-to-image`, { headers })
      );

      const apiModels: ImageGenerationModel[] = (response.models || []).map(model => ({
        id: model.url.replace('https://replicate.com/', ''),
        name: model.name,
        description: model.description || '',
        provider: 'replicate' as const,
        capabilities: { ...this.DEFAULT_CAPABILITIES }
      }));

      // Combine predefined models first, then API models
      const allModels = [...this.MODELS];
      for (const model of apiModels) {
        if (!allModels.find(m => m.id === model.id)) {
          allModels.push(model);
        }
      }

      this.modelsCache = allModels;
      this.modelsCacheTime = Date.now();

      return allModels;
    } catch (error) {
      console.error('Failed to fetch Replicate models:', error);
      return this.MODELS;
    }
  }

  getModel(modelId: string): ImageGenerationModel | undefined {
    // Check cache first
    const cached = this.modelsCache.find(m => m.id === modelId);
    if (cached) return cached;

    // Check predefined models
    return this.MODELS.find(m => m.id === modelId);
  }

  clearModelsCache(): void {
    this.modelsCache = [];
    this.modelsCacheTime = 0;
  }

  // Add a custom model version mapping
  addModelVersion(modelId: string, version: string): void {
    this.MODEL_VERSIONS[modelId] = version;
  }
}
