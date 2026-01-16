import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SettingsService } from '../../../core/services/settings.service';
import {
  IImageProvider,
  ImageProvider,
  ImageGenerationModel,
  ImageModelCapabilities,
  ImageGenerationRequest,
  ImageGenerationResult,
  GeneratedImage
} from './image-provider.interface';

// fal.ai API response types
interface FalImageOutput {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

interface FalGenerationResponse {
  images?: FalImageOutput[];
  image?: FalImageOutput;
  seed?: number;
  timings?: Record<string, number>;
  has_nsfw_concepts?: boolean[];
}

// fal.ai Platform API response types (from https://api.fal.ai/v1/models)
interface FalModelMetadata {
  display_name: string;
  category: string;
  description: string;
  status: string;
  thumbnail_url?: string;
}

interface FalModelEntry {
  endpoint_id: string;  // e.g. "fal-ai/flux/dev"
  metadata: FalModelMetadata;
}

interface FalModelsResponse {
  models: FalModelEntry[];
  next_cursor?: string | null;
  has_more?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FalImageProvider implements IImageProvider {
  private http = inject(HttpClient);
  private settingsService = inject(SettingsService);

  readonly providerId: ImageProvider = 'fal';
  readonly displayName = 'fal.ai';

  private readonly PROXY_URL = '/api/fal';
  private readonly MODELS_API_URL = '/api/fal-models';

  // Cache for loaded models
  private modelsCache: ImageGenerationModel[] = [];
  private modelsCacheTime = 0;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  // Model capability overrides for specific models (API doesn't provide all details)
  private readonly MODEL_CAPABILITY_OVERRIDES: Record<string, Partial<ImageModelCapabilities>> = {
    'fal-ai/flux/schnell': {
      maxInferenceSteps: 12,
      supportsGuidanceScale: false
    }
  };

  isConfigured(): boolean {
    const settings = this.settingsService.getSettings();
    return Boolean(settings.falAi?.enabled && settings.falAi?.apiKey);
  }

  private getApiKey(): string {
    const settings = this.settingsService.getSettings();
    return settings.falAi?.apiKey || '';
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      throw new Error('fal.ai is not configured. Please add your API key in settings.');
    }

    // Try to load models if cache is empty (for capability info)
    if (this.modelsCache.length === 0) {
      await this.getAvailableModels();
    }

    // Get model from cache, or use default capabilities if not found
    // This allows using any fal.ai model even if not in the API response
    const model = this.getModel(request.modelId);
    const capabilities = model?.capabilities ?? this.getDefaultCapabilities(request.modelId);

    // Build fal.ai input
    const input: Record<string, unknown> = {
      prompt: request.prompt
    };

    // Add aspect ratio if supported
    if (capabilities.supportsAspectRatio && request.aspectRatio) {
      // Map common aspect ratios to fal.ai format
      input['image_size'] = this.mapAspectRatio(request.aspectRatio);
    }

    // Add negative prompt if supported
    if (capabilities.supportsNegativePrompt && request.negativePrompt) {
      input['negative_prompt'] = request.negativePrompt;
    }

    // Add other parameters
    if (capabilities.supportsMultipleImages && request.numImages) {
      input['num_images'] = Math.min(request.numImages, capabilities.maxImages || 4);
    }

    if (capabilities.supportsSeed && request.seed !== undefined) {
      input['seed'] = request.seed;
    }

    if (capabilities.supportsGuidanceScale && request.guidanceScale !== undefined) {
      input['guidance_scale'] = request.guidanceScale;
    }

    if (capabilities.supportsInferenceSteps && request.inferenceSteps !== undefined) {
      const maxSteps = capabilities.maxInferenceSteps;
      input['num_inference_steps'] = maxSteps ? Math.min(request.inferenceSteps, maxSteps) : request.inferenceSteps;
    }

    // Safety settings
    if (request.enableSafetyChecker !== undefined) {
      input['enable_safety_checker'] = request.enableSafetyChecker;
    }

    if (request.safetyTolerance !== undefined) {
      input['safety_tolerance'] = request.safetyTolerance;
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Token': this.getApiKey()
    });

    try {
      // fal.ai endpoint path (remove fal-ai/ prefix for some models)
      const endpoint = request.modelId;

      // Make the request through our proxy
      const response = await firstValueFrom(
        this.http.post<FalGenerationResponse>(`${this.PROXY_URL}/${endpoint}`, input, { headers })
      );

      const images = this.extractImagesFromResponse(response);

      if (images.length === 0) {
        throw new Error('No images were generated');
      }

      return {
        images,
        modelId: request.modelId,
        prompt: request.prompt,
        seed: response.seed,
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

  private mapAspectRatio(aspectRatio: string): string {
    // Map common aspect ratio formats to fal.ai format
    const mapping: Record<string, string> = {
      '1:1': 'square',
      'square': 'square',
      '16:9': 'landscape_16_9',
      '9:16': 'portrait_16_9',
      '4:3': 'landscape_4_3',
      '3:4': 'portrait_4_3',
      'landscape': 'landscape_4_3',
      'portrait': 'portrait_4_3'
    };
    return mapping[aspectRatio] || aspectRatio;
  }

  private extractImagesFromResponse(response: FalGenerationResponse): GeneratedImage[] {
    const images: GeneratedImage[] = [];

    // Handle images array (preferred)
    if (response.images && Array.isArray(response.images) && response.images.length > 0) {
      for (let i = 0; i < response.images.length; i++) {
        const img = response.images[i];
        images.push({
          url: img.url,
          mimeType: img.content_type || 'image/png',
          width: img.width,
          height: img.height,
          index: i
        });
      }
    } else if (response.image) {
      // Fallback to single image response only if images array is empty/missing
      images.push({
        url: response.image.url,
        mimeType: response.image.content_type || 'image/png',
        width: response.image.width,
        height: response.image.height,
        index: 0
      });
    }

    return images;
  }

  async getAvailableModels(): Promise<ImageGenerationModel[]> {
    // Return cached models if still valid
    if (this.modelsCache.length > 0 && Date.now() - this.modelsCacheTime < this.CACHE_TTL_MS) {
      return this.modelsCache;
    }

    // Fetch from fal.ai Platform API
    if (!this.isConfigured()) {
      return [];
    }

    const headers = new HttpHeaders({
      'X-API-Token': this.getApiKey()
    });

    try {
      // Fetch all pages of text-to-image models using cursor pagination
      const allModels: FalModelEntry[] = [];
      let cursor: string | null = null;
      let hasMore = true;

      while (hasMore) {
        const url = cursor
          ? `${this.MODELS_API_URL}?category=text-to-image&limit=100&cursor=${encodeURIComponent(cursor)}`
          : `${this.MODELS_API_URL}?category=text-to-image&limit=100`;

        const response: FalModelsResponse = await firstValueFrom(
          this.http.get<FalModelsResponse>(url, { headers })
        );

        if (response.models && Array.isArray(response.models)) {
          allModels.push(...response.models);
        }

        hasMore = response.has_more === true && response.next_cursor != null;
        cursor = response.next_cursor ?? null;
      }

      if (allModels.length === 0) {
        return [];
      }

      // Filter to active models only
      this.modelsCache = allModels
        .filter(m => m.metadata.status === 'active')
        .map(m => this.mapFalModelToInternal(m));
      this.modelsCacheTime = Date.now();

      console.log(`Loaded ${this.modelsCache.length} text-to-image models from fal.ai`);
      return this.modelsCache;
    } catch (error) {
      console.error('Failed to fetch models from fal.ai API:', error);
      return [];
    }
  }

  private mapFalModelToInternal(falModel: FalModelEntry): ImageGenerationModel {
    // Default capabilities
    const defaultCapabilities: ImageModelCapabilities = {
      supportsAspectRatio: true,
      supportsNegativePrompt: true,
      supportsMultipleImages: true,
      supportsSeed: true,
      supportsGuidanceScale: true,
      supportsInferenceSteps: true,
      aspectRatios: ['square', 'square_hd', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9'],
      maxImages: 4
    };

    // Apply any model-specific overrides
    const overrides = this.MODEL_CAPABILITY_OVERRIDES[falModel.endpoint_id];
    const capabilities = overrides
      ? { ...defaultCapabilities, ...overrides }
      : defaultCapabilities;

    return {
      id: falModel.endpoint_id,
      name: this.deriveModelName(falModel),
      description: falModel.metadata.description || '',
      provider: 'fal',
      capabilities,
      thumbnail: falModel.metadata.thumbnail_url
    };
  }

  /**
   * Derives the proper model name from API response.
   * Falls back to extracting from endpoint_id when display_name appears to be just the creator name.
   * This is needed because fal.ai's API sometimes returns creator names (e.g., "bytedance")
   * instead of actual model names in the display_name field.
   */
  private deriveModelName(falModel: FalModelEntry): string {
    const displayName = falModel.metadata?.display_name || '';
    const endpointId = falModel.endpoint_id || '';

    // If display_name is empty or missing, extract from endpoint_id
    if (!displayName.trim()) {
      const parts = endpointId.split('/');
      if (parts.length > 1) {
        return this.formatModelName(parts.slice(1).join('-'));
      }
      return endpointId || 'Unknown Model';
    }

    // Extract parts from endpoint_id (e.g., "bytedance-seed/seedream-4.5" -> ["bytedance-seed", "seedream-4.5"])
    const parts = endpointId.split('/');
    if (parts.length <= 1) {
      // No organization prefix, use display_name as-is
      return displayName;
    }

    const creatorRaw = parts[0] || '';
    // Normalize for comparison: remove non-alphanumeric chars and lowercase
    const creatorNormalized = creatorRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
    const displayNameNormalized = displayName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check if display_name is likely just the creator/organization name
    // Be conservative: only trigger if there's a strong match, not just partial overlap
    const isCreatorName =
      displayNameNormalized.length > 0 && (
        // Exact match after normalization (e.g., "bytedance" matches "bytedance-seed")
        creatorNormalized === displayNameNormalized ||
        // Creator contains the display name exactly (e.g., creator "bytedance-seed" contains "bytedance")
        (displayNameNormalized.length >= 5 && creatorNormalized.startsWith(displayNameNormalized))
      );

    if (isCreatorName) {
      // Use the model path from endpoint_id, joined with hyphen for formatModelName to split
      const modelPath = parts.slice(1).join('-');
      return this.formatModelName(modelPath);
    }

    return displayName;
  }

  /**
   * Formats a model name from endpoint path to Title Case.
   * E.g., "seedream-4.5" -> "Seedream 4.5"
   */
  private formatModelName(name: string): string {
    return name
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  getModel(modelId: string): ImageGenerationModel | undefined {
    return this.modelsCache.find(m => m.id === modelId);
  }

  /**
   * Returns default capabilities for a model, with any known overrides applied.
   * Used when a model isn't in the API response but user wants to use it anyway.
   */
  private getDefaultCapabilities(modelId: string): ImageModelCapabilities {
    const defaults: ImageModelCapabilities = {
      supportsAspectRatio: true,
      supportsNegativePrompt: true,
      supportsMultipleImages: true,
      supportsSeed: true,
      supportsGuidanceScale: true,
      supportsInferenceSteps: true,
      aspectRatios: ['square', 'square_hd', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9'],
      maxImages: 4
    };

    // Apply any known overrides for this model
    const overrides = this.MODEL_CAPABILITY_OVERRIDES[modelId];
    return overrides ? { ...defaults, ...overrides } : defaults;
  }

  clearModelsCache(): void {
    this.modelsCache = [];
    this.modelsCacheTime = 0;
  }
}
