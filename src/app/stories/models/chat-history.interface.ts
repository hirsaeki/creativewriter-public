export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isPresetPrompt?: boolean;
  extractionType?: 'characters' | 'locations' | 'objects';
}

export interface ChatHistoryContextSceneRef {
  chapterId: string;
  sceneId: string;
  chapterTitle?: string;
  sceneTitle?: string;
}

export interface ChatHistoryDoc {
  _id: string;
  _rev?: string;
  type: 'scene-chat';
  storyId: string;
  historyId: string;
  title?: string;
  messages: ChatHistoryMessage[];
  selectedScenes?: ChatHistoryContextSceneRef[];
  includeStoryOutline?: boolean;
  selectedModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

