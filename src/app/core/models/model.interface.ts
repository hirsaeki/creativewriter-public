export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  pricing: ModelPricing;
  context_length: number;
  provider: 'openrouter' | 'replicate' | 'gemini' | 'ollama';
}

export interface ModelPricing {
  prompt: number; // USD per 1M tokens
  completion: number; // USD per 1M tokens
}

// OpenRouter API Response Interfaces
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string; // e.g., "0.000015"
    completion: string;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens?: number;
    is_moderated: boolean;
  };
  per_request_limits?: {
    prompt_tokens: string;
    completion_tokens: string;
  };
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

// Replicate API Response Interfaces
export interface ReplicateModel {
  url: string;
  owner: string;
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  github_url?: string;
  paper_url?: string;
  license_url?: string;
  cover_image_url?: string;
  default_example?: Record<string, unknown>;
  latest_version?: ReplicateVersion;
}

export interface ReplicateVersion {
  id: string;
  created_at: string;
  cog_version: string;
  openapi_schema: Record<string, unknown>;
}

export interface ReplicateModelsResponse {
  results: ReplicateModel[];
  next?: string;
  previous?: string;
}

// Gemini API Response Interfaces
export interface GeminiModel {
  name: string;
  version: string;
  displayName: string;
  description?: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface GeminiModelsResponse {
  models: GeminiModel[];
}

// Unified model selection interface
export interface ModelOption {
  id: string;
  label: string;
  description?: string;
  costInputEur: string; // Formatted cost per 1M tokens in EUR
  costOutputEur: string; // Formatted cost per 1M tokens in EUR
  contextLength: number;
  provider: 'openrouter' | 'replicate' | 'gemini' | 'ollama';
}