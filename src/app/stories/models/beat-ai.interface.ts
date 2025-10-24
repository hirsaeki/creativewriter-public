export interface BeatAI {
  id: string;
  prompt: string;
  generatedContent: string;
  isGenerating: boolean;
  isCollapsed: boolean;
  createdAt: Date;
  updatedAt: Date;
  wordCount?: number;
  beatType?: 'story' | 'scene'; // Default is 'story' for backwards compatibility
  model?: string; // AI model used for generation
  selectedScenes?: { sceneId: string; chapterId: string; }[]; // Persisted selected scene contexts
  includeStoryOutline?: boolean; // Persisted story outline setting
  currentVersionId?: string; // ID of the currently active version in history
  hasHistory?: boolean; // Quick flag to check if version history exists
}

export interface BeatAIGenerationEvent {
  beatId: string;
  chunk: string;
  isComplete: boolean;
}

export interface BeatAIPromptEvent {
  beatId: string;
  prompt?: string;
  action: 'generate' | 'deleteAfter' | 'regenerate' | 'rewrite';
  wordCount?: number;
  model?: string;
  storyId?: string;
  chapterId?: string;
  sceneId?: string;
  beatType?: 'story' | 'scene';
  customContext?: {
    selectedScenes: string[];
    includeStoryOutline: boolean;
    selectedSceneContexts: { sceneId: string; chapterId: string; content: string; }[];
  };
  existingText?: string; // Text to be rewritten (for rewrite action)
}

export interface BeatContentInsertEvent {
  beatId: string;
  content: string;
  isComplete: boolean;
}
