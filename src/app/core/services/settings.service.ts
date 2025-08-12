import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Settings, DEFAULT_SETTINGS } from '../models/settings.interface';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly STORAGE_KEY = 'creative-writer-settings';
  private settingsSubject = new BehaviorSubject<Settings>(this.loadSettings());
  
  public settings$ = this.settingsSubject.asObservable();

  constructor() {
    // Initialize with saved settings or defaults
    this.settingsSubject.next(this.loadSettings());
  }

  private loadSettings(): Settings {
    try {
      const savedSettings = localStorage.getItem(this.STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Merge with defaults to ensure all properties exist
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          openRouter: {
            ...DEFAULT_SETTINGS.openRouter,
            ...parsed.openRouter
          },
          replicate: {
            ...DEFAULT_SETTINGS.replicate,
            ...parsed.replicate
          },
          googleGemini: {
            ...DEFAULT_SETTINGS.googleGemini,
            ...parsed.googleGemini,
            contentFilter: {
              ...DEFAULT_SETTINGS.googleGemini.contentFilter,
              ...parsed.googleGemini?.contentFilter
            }
          },
          ollama: {
            ...DEFAULT_SETTINGS.ollama,
            ...parsed.ollama
          },
          sceneTitleGeneration: {
            ...DEFAULT_SETTINGS.sceneTitleGeneration,
            ...parsed.sceneTitleGeneration
          },
          appearance: {
            ...DEFAULT_SETTINGS.appearance,
            ...parsed.appearance
          },
          favoriteModels: parsed.favoriteModels || DEFAULT_SETTINGS.favoriteModels,
          updatedAt: new Date(parsed.updatedAt || new Date())
        };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(settings: Settings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  getSettings(): Settings {
    return this.settingsSubject.value;
  }

  updateSettings(settings: Partial<Settings>): void {
    const updatedSettings = {
      ...this.settingsSubject.value,
      ...settings,
      updatedAt: new Date()
    };
    
    this.saveSettings(updatedSettings);
    this.settingsSubject.next(updatedSettings);
  }

  updateOpenRouterSettings(settings: Partial<Settings['openRouter']>): void {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings = {
      ...currentSettings,
      openRouter: {
        ...currentSettings.openRouter,
        ...settings
      },
      // If OpenRouter is being enabled, disable Gemini
      googleGemini: settings.enabled ? {
        ...currentSettings.googleGemini,
        enabled: false
      } : currentSettings.googleGemini,
      updatedAt: new Date()
    };
    
    this.saveSettings(updatedSettings);
    this.settingsSubject.next(updatedSettings);
  }

  updateReplicateSettings(settings: Partial<Settings['replicate']>): void {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings = {
      ...currentSettings,
      replicate: {
        ...currentSettings.replicate,
        ...settings
      },
      updatedAt: new Date()
    };
    
    this.saveSettings(updatedSettings);
    this.settingsSubject.next(updatedSettings);
  }

  updateSceneTitleGenerationSettings(settings: Partial<Settings['sceneTitleGeneration']>): void {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings = {
      ...currentSettings,
      sceneTitleGeneration: {
        ...currentSettings.sceneTitleGeneration,
        ...settings
      },
      updatedAt: new Date()
    };
    
    this.saveSettings(updatedSettings);
    this.settingsSubject.next(updatedSettings);
  }

  clearSettings(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.settingsSubject.next({ ...DEFAULT_SETTINGS });
  }

  // Utility methods for checking API availability
  isOpenRouterConfigured(): boolean {
    const settings = this.getSettings();
    return settings.openRouter.enabled && !!settings.openRouter.apiKey;
  }

  isReplicateConfigured(): boolean {
    const settings = this.getSettings();
    return settings.replicate.enabled && !!settings.replicate.apiKey;
  }

  updateGoogleGeminiSettings(settings: Partial<Settings['googleGemini']>): void {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings = {
      ...currentSettings,
      googleGemini: {
        ...currentSettings.googleGemini,
        ...settings
      },
      // If Gemini is being enabled, disable OpenRouter
      openRouter: settings.enabled ? {
        ...currentSettings.openRouter,
        enabled: false
      } : currentSettings.openRouter,
      updatedAt: new Date()
    };
    
    this.saveSettings(updatedSettings);
    this.settingsSubject.next(updatedSettings);
  }

  isGoogleGeminiConfigured(): boolean {
    const settings = this.getSettings();
    return settings.googleGemini.enabled && !!settings.googleGemini.apiKey;
  }

  updateAppearanceSettings(settings: Partial<Settings['appearance']>): void {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings = {
      ...currentSettings,
      appearance: {
        ...currentSettings.appearance,
        ...settings
      },
      updatedAt: new Date()
    };
    
    
    this.saveSettings(updatedSettings);
    this.settingsSubject.next(updatedSettings);
    
  }
}