import { FavoriteModelLists } from '../../core/models/settings.interface';

export interface Scene {
  id: string;
  title: string;
  content: string;
  summary?: string;
  summaryGeneratedAt?: Date;
  order: number;
  sceneNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  chapterNumber: number;
  scenes: Scene[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StorySettings {
  systemMessage: string;
  beatGenerationTemplate: string; // Advanced template for beat generation
  useFullStoryContext: boolean; // true = full story, false = summaries only
  beatInstruction: 'continue' | 'stay'; // continue = "Continue the story", stay = "Stay in the moment"
  language?: 'en' | 'de' | 'fr' | 'es' | 'custom'; // Story language setting
  favoriteModels: string[]; // Legacy quick access
  favoriteModelLists: FavoriteModelLists; // Structured favorites per story feature
}

export interface Story {
  _id?: string;
  _rev?: string;
  id: string;
  title: string;
  chapters: Chapter[];
  settings?: StorySettings;
  codexId?: string;
  coverImage?: string; // Base64 encoded image data or URL
  order?: number; // For custom sorting
  createdAt: Date;
  updatedAt: Date;
  // Legacy support for old stories
  content?: string;
}

export const DEFAULT_STORY_SETTINGS: StorySettings = {
  systemMessage: 'You are a creative writing assistant that helps with writing stories. Maintain the style and tone of the existing story.',
  beatGenerationTemplate: `<messages>
<message role="system">{systemMessage}</message>
<message role="user">You are continuing a story. Here is the context:

<story_title>{storyTitle}</story_title>

<glossary>
{codexEntries}
</glossary>

<story_context>
{storySoFar}
</story_context>

<current_scene>
{sceneFullText}
</current_scene>

<instructions>
{pointOfView}
Write approximately {wordCount} words that continue this story.
{writingStyle}

Task: {prompt}
</instructions>

Continue the story now with {wordCount} words:</message>
</messages>`,
  useFullStoryContext: false,
  beatInstruction: 'continue',
  favoriteModels: [],
  favoriteModelLists: {
    beatInput: [],
    sceneSummary: [],
    rewrite: []
  }
};
