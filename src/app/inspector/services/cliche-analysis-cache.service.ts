import { Injectable } from '@angular/core';
import { SceneClicheResult, GlobalClicheReport } from '../models/cliche-analysis.interface';

export interface ClicheAnalysisPersist {
  storyId: string;
  modelId: string;
  selectedScenes: {
    chapterId: string;
    sceneId: string;
    chapterTitle: string;
    sceneTitle: string;
  }[];
  results: SceneClicheResult[];
  overview: GlobalClicheReport | null;
  updatedAt: number; // epoch ms
}

@Injectable({ providedIn: 'root' })
export class ClicheAnalysisCacheService {
  private readonly KEY_PREFIX = 'cw:clicheAnalysis:';

  load(storyId: string): ClicheAnalysisPersist | null {
    try {
      const raw = localStorage.getItem(this.key(storyId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ClicheAnalysisPersist;
      if (!parsed || parsed.storyId !== storyId) return null;
      return parsed;
    } catch (e) {
      console.warn('Failed to load cliche analysis cache', e);
      return null;
    }
  }

  save(data: ClicheAnalysisPersist): void {
    try {
      const toSave: ClicheAnalysisPersist = { ...data, updatedAt: Date.now() };
      localStorage.setItem(this.key(data.storyId), JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save cliche analysis cache', e);
    }
  }

  clear(storyId: string): void {
    try {
      localStorage.removeItem(this.key(storyId));
    } catch (e) {
      console.warn('Failed to clear cliche analysis cache', e);
    }
  }

  private key(storyId: string): string {
    return `${this.KEY_PREFIX}${storyId}`;
    }
}
