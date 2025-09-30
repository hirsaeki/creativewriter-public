export interface StoryResearchSceneFinding {
  chapterId: string;
  sceneId: string;
  chapterTitle?: string;
  sceneTitle?: string;
  prompt: string;
  response: string;
}

export type StoryResearchStatus = 'completed' | 'failed';

export interface StoryResearchDoc {
  _id: string;
  _rev?: string;
  type: 'story-research';
  storyId: string;
  researchId: string;
  task: string;
  model: string;
  sceneFindings: StoryResearchSceneFinding[];
  summary?: string;
  status: StoryResearchStatus;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
