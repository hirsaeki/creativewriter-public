export interface Settings {
  openRouter: OpenRouterSettings;
  replicate: ReplicateSettings;
  googleGemini: GoogleGeminiSettings;
  ollama: OllamaSettings;
  sceneTitleGeneration: SceneTitleGenerationSettings;
  sceneSummaryGeneration: SceneSummaryGenerationSettings;
  selectedModel: string; // Global selected model (format: "provider:model_id")
  favoriteModels: string[]; // List of favorite model IDs for quick access
  appearance: AppearanceSettings;
  updatedAt: Date;
}

export interface AppearanceSettings {
  textColor: string; // Hex color code for text in editor and beat AI
  backgroundImage: string; // Background image filename or 'none' for no background
}

export interface OpenRouterSettings {
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  enabled: boolean;
}

export interface ReplicateSettings {
  apiKey: string;
  model: string;
  version: string;
  enabled: boolean;
}

export interface GoogleGeminiSettings {
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  enabled: boolean;
  contentFilter: {
    harassment: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
    hateSpeech: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
    sexuallyExplicit: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
    dangerousContent: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
    civicIntegrity: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
  };
}

export interface OllamaSettings {
  baseUrl: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  enabled: boolean;
}

export interface SceneTitleGenerationSettings {
  maxWords: number;
  style: 'descriptive' | 'concise' | 'action' | 'emotional';
  language: 'german' | 'english';
  includeGenre: boolean;
  temperature: number;
  customInstruction: string;
  customPrompt: string;
  useCustomPrompt: boolean;
  selectedModel: string;
}

export interface SceneSummaryGenerationSettings {
  temperature: number;
  customInstruction: string;
  customPrompt: string;
  useCustomPrompt: boolean;
  selectedModel: string;
}

export const DEFAULT_SETTINGS: Settings = {
  openRouter: {
    apiKey: '',
    model: '',
    temperature: 0.7,
    topP: 1.0,
    enabled: false
  },
  replicate: {
    apiKey: '',
    model: '',
    version: '',
    enabled: false
  },
  googleGemini: {
    apiKey: '',
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    topP: 1.0,
    enabled: false,
    contentFilter: {
      harassment: 'BLOCK_NONE',
      hateSpeech: 'BLOCK_NONE',
      sexuallyExplicit: 'BLOCK_NONE',
      dangerousContent: 'BLOCK_NONE',
      civicIntegrity: 'BLOCK_NONE'
    }
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: '',
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 2000,
    enabled: false
  },
  sceneTitleGeneration: {
    maxWords: 5,
    style: 'concise',
    language: 'german',
    includeGenre: false,
    temperature: 0.3,
    customInstruction: '',
    customPrompt: 'Create a title for the following scene. The title should be up to {maxWords} words long and capture the essence of the scene.\n\n{styleInstruction}\n{genreInstruction}\n{languageInstruction}{customInstruction}\n\nScene content (only this one scene):\n{sceneContent}\n\nRespond only with the title, without further explanations or quotation marks.',
    useCustomPrompt: false,
    selectedModel: ''
  },
  sceneSummaryGeneration: {
    temperature: 0.7,
    customInstruction: '',
    customPrompt: 'Create a summary of the following scene:\n\nTitle: {sceneTitle}\n\nContent:\n{sceneContent}\n\nThe summary should capture the most important plot points and character developments. Write a complete and comprehensive summary with at least 3-5 sentences.',
    useCustomPrompt: false,
    selectedModel: ''
  },
  appearance: {
    textColor: '#e0e0e0', // Default light gray color for dark theme
    backgroundImage: 'none' // No background image by default
  },
  selectedModel: '',
  favoriteModels: [],
  updatedAt: new Date()
};