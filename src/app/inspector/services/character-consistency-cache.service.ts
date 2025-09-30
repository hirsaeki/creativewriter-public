import { Injectable } from '@angular/core';
import { SceneCharacterConsistencyResult, GlobalCharacterConsistencyReport } from '../models/character-consistency.interface';

export interface CharacterConsistencyPersist {
  storyId: string;
  modelId?: string;
  selectedScenes: {
    chapterId: string;
    sceneId: string;
    chapterTitle: string;
    sceneTitle: string;
  }[];
  results: SceneCharacterConsistencyResult[];
  overview: GlobalCharacterConsistencyReport | null;
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class CharacterConsistencyCacheService {
  private readonly KEY_PREFIX = 'cw:charConsistency:';

  load(storyId: string): CharacterConsistencyPersist | null {
    try {
      const raw = localStorage.getItem(this.KEY_PREFIX + storyId);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CharacterConsistencyPersist;
      return parsed;
    } catch (e) {
      console.warn('Failed to load character consistency cache', e);
      return null;
    }
  }

  save(data: CharacterConsistencyPersist): void {
    try {
      const toSave: CharacterConsistencyPersist = { ...data, updatedAt: Date.now() };
      localStorage.setItem(this.KEY_PREFIX + data.storyId, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save character consistency cache', e);
    }
  }

  clear(storyId: string): void {
    try {
      localStorage.removeItem(this.KEY_PREFIX + storyId);
    } catch (e) {
      console.warn('Failed to clear character consistency cache', e);
    }
  }
}

