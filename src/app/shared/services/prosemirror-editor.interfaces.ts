import { BeatAIPromptEvent } from '../../stories/models/beat-ai.interface';
import { BeatAI } from '../../stories/models/beat-ai.interface';

export interface EditorConfig {
  placeholder?: string;
  onUpdate?: (content: string) => void;
  onSlashCommand?: (position: number) => void;
  onBeatPromptSubmit?: (event: BeatAIPromptEvent) => void;
  onBeatContentUpdate?: (beatData: BeatAI) => void;
  onBeatFocus?: () => void;
  onImageInsertRequest?: (position: number) => void;
  storyContext?: {
    storyId?: string;
    chapterId?: string;
    sceneId?: string;
  };
  debugMode?: boolean;
}

export interface SimpleEditorConfig {
  placeholder?: string;
  onUpdate?: (content: string) => void;
  storyContext?: {
    storyId?: string;
    chapterId?: string;
    sceneId?: string;
  };
}

export interface StoryContext {
  storyId?: string;
  chapterId?: string;
  sceneId?: string;
}

export interface BeatInfo {
  beatId: string;
  prompt: string;
  position: number;
  isGenerating: boolean;
  hasContent: boolean;
}
