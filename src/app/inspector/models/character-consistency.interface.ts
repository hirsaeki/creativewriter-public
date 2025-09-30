export type CharacterInconsistencyType =
  | 'name'
  | 'trait'
  | 'relationship'
  | 'timeline'
  | 'pov'
  | 'other';

export interface CharacterConsistencyIssue {
  character: string;
  type: CharacterInconsistencyType;
  snippet: string;
  start: number;
  end: number;
  why: string;
  suggestion?: string;
  confidence: number; // 0..1
}

export interface SceneCharacterConsistencyResult {
  sceneId: string;
  sceneTitle: string;
  issues: CharacterConsistencyIssue[];
  summary: {
    counts: Record<CharacterInconsistencyType, number>;
  };
  error?: string;
}

export interface GlobalCharacterConsistencyReport {
  totals: Record<CharacterInconsistencyType, number>;
  byCharacter: { name: string; count: number }[];
}

