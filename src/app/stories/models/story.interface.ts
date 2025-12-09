import { FavoriteModelLists } from '../../core/models/settings.interface';

export type NarrativePerspective = 'first-person' | 'third-person-limited' | 'third-person-omniscient' | 'second-person';

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
  narrativePerspective?: NarrativePerspective; // POV for AI-generated content
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
  schemaVersion?: number; // Schema version for migration tracking
  createdAt: Date;
  updatedAt: Date;
  lastModifiedBy?: {
    deviceId: string;
    deviceName: string;
    timestamp: Date;
  };
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

<beat_generation_task>
  <objective>
    Generate the next story beat that advances the narrative from the current scene's ending point.
  </objective>

  <narrative_parameters>
    {pointOfView}
    <word_count>{wordCount} words (±50 words acceptable)</word_count>
    <tense>Match the established tense (typically past tense)</tense>
  </narrative_parameters>

  <beat_requirements>
    {prompt}
  </beat_requirements>

  <style_guidance>
    - Match the exact tone and narrative voice of the current scene
    - Maintain the established balance of dialogue, action, and introspection
    - {writingStyle}
    - End on a moment of significance, decision point, or natural transition
  </style_guidance>

  <constraints>
    - Do NOT resolve major plot threads or conflicts
    - Do NOT have characters act inconsistently with their established personalities
    - Do NOT introduce unrelated subplots or major new story elements
    - Do NOT write beyond what is specifically requested in the beat requirements
  </constraints>

  <output_format>
    Pure narrative prose. No meta-commentary, scene markers, chapter headings, or author notes.
  </output_format>
</beat_generation_task>

Generate the beat now:</message>
</messages>`,
  useFullStoryContext: false,
  beatInstruction: 'continue',
  narrativePerspective: 'third-person-limited',
  favoriteModels: [],
  favoriteModelLists: {
    beatInput: [],
    sceneSummary: [],
    rewrite: []
  }
};
