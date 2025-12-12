import { environment } from '../../../environments/environment';

export interface FavoriteModelLists {
  beatInput: string[];
  sceneSummary: string[];
  rewrite: string[];
  characterChat: string[];
}

export interface Settings {
  openRouter: OpenRouterSettings;
  replicate: ReplicateSettings;
  googleGemini: GoogleGeminiSettings;
  ollama: OllamaSettings;
  claude: ClaudeSettings;
  openAICompatible: OpenAICompatibleSettings;
  sceneTitleGeneration: SceneTitleGenerationSettings;
  sceneSummaryGeneration: SceneSummaryGenerationSettings;
  sceneGenerationFromOutline: SceneGenerationFromOutlineSettings;
  selectedModel: string; // Global selected model (format: "provider:model_id")
  favoriteModels: string[]; // Legacy list of favorite model IDs for quick access (mirrors favoriteModelLists.beatInput)
  favoriteModelLists: FavoriteModelLists; // Structured favorite model lists by feature
  appearance: AppearanceSettings;
  premium: PremiumSettings; // Premium subscription settings
  updatedAt: Date;
}

export interface PremiumSettings {
  email: string;                    // Email used for subscription verification
  apiUrl: string;                   // Subscription API URL (Cloudflare Worker)
  authToken?: string;               // Auth token from portal verification
  authTokenCreatedAt?: number;      // When auth token was created (for refresh)
  // Cached status (updated when verified)
  cachedStatus: {
    active: boolean;
    plan?: 'monthly' | 'yearly';
    expiresAt?: number;             // Unix timestamp in milliseconds
    lastVerified?: number;          // When we last checked
  };
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

export interface ClaudeSettings {
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  enabled: boolean;
}

export interface OpenAICompatibleSettings {
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

export interface SceneGenerationFromOutlineSettings {
  wordCount: number; // default target length
  temperature: number;
  includeStoryOutline: boolean; // include story context by default
  useFullStoryContext: boolean; // when true, full text; false => summaries
  includeCodex: boolean; // include codex items
  customInstruction: string; // appended to prompt
  useCustomPrompt: boolean; // use custom template
  customPrompt: string; // template with placeholders
  selectedModel: string; // optional specific model override (provider:id)
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
  claude: {
    apiKey: '',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    topP: 1.0,
    topK: 0,
    enabled: false
  },
  openAICompatible: {
    baseUrl: 'http://localhost:1234',
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
    customPrompt: 'Create a summary of the following scene:\n\nTitle: {sceneTitle}\n\nContent:\n{sceneContent}\n\nWrite a focused, comprehensive summary that captures the most important plot points and character developments.\n\n{languageInstruction}',
    useCustomPrompt: false,
    selectedModel: ''
  },
  sceneGenerationFromOutline: {
    wordCount: 600,
    temperature: 0.7,
    includeStoryOutline: true,
    useFullStoryContext: false,
    includeCodex: true,
    customInstruction: '',
    useCustomPrompt: false,
    customPrompt: '<messages>\n<message role="system">{systemMessage}</message>\n<message role="user">You are writing a complete scene for a story.\n\n<story_title>{storyTitle}</story_title>\n\n<glossary>\n{codexEntries}\n</glossary>\n\n<story_context>\n{storySoFar}\n</story_context>\n\n<scene_outline>\n{sceneOutline}\n</scene_outline>\n\n<instructions>\nWrite a complete, coherent scene based strictly on the outline. Aim for about {wordCount} words.\n{languageInstruction}{customInstruction}\nDo not include meta comments or headings. Output only the scene prose.\n</instructions>\n</message>\n</messages>',
    selectedModel: ''
  },
  appearance: {
    textColor: '#e0e0e0', // Default light gray color for dark theme
    backgroundImage: 'none' // No background image by default
  },
  premium: {
    email: '',
    apiUrl: environment.premiumApiUrl,
    cachedStatus: {
      active: false
    }
  },
  selectedModel: '',
  favoriteModels: [],
  favoriteModelLists: {
    beatInput: [],
    sceneSummary: [],
    rewrite: [],
    characterChat: []
  },
  updatedAt: new Date()
};
