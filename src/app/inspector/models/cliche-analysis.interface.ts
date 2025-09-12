export type ClicheFindingType = 'cliche' | 'idiom' | 'redundancy' | 'buzzword' | 'stereotype';

export interface ClicheFinding {
  type: ClicheFindingType;
  phrase: string;
  start: number;
  end: number;
  language: string;
  confidence: number;
  why: string;
  suggestion: string;
}

export interface SceneClicheResult {
  sceneId: string;
  sceneTitle: string;
  findings: ClicheFinding[];
  summary: {
    counts: Record<ClicheFindingType, number>;
  };
  error?: string;
}

export interface GlobalClicheReport {
  totals: Record<ClicheFindingType, number>;
  topPhrases: { phrase: string; count: number }[];
}

