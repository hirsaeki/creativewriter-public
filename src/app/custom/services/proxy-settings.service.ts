import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ProxySettings, ReverseProxyConfig, DEFAULT_PROXY_SETTINGS } from '../models/proxy-settings.interface';

const STORAGE_KEY = 'creative-writer-proxy-settings';

@Injectable({
  providedIn: 'root'
})
export class ProxySettingsService {
  private settings$ = new BehaviorSubject<ProxySettings>(this.loadSettings());

  getSettings(): ProxySettings {
    return this.settings$.getValue();
  }

  getSettings$(): Observable<ProxySettings> {
    return this.settings$.asObservable();
  }

  updateSettings(settings: Partial<ProxySettings>): void {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    this.saveSettings(updated);
    this.settings$.next(updated);
  }

  getClaudeProxyConfig(): ReverseProxyConfig | undefined {
    return this.getSettings().claude;
  }

  getOpenRouterProxyConfig(): ReverseProxyConfig | undefined {
    return this.getSettings().openRouter;
  }

  getGoogleGeminiProxyConfig(): ReverseProxyConfig | undefined {
    return this.getSettings().googleGemini;
  }

  getOllamaAuthToken(): string | undefined {
    return this.getSettings().ollama?.authToken;
  }

  getOpenAICompatibleAuthToken(): string | undefined {
    return this.getSettings().openAICompatible?.authToken;
  }

  private loadSettings(): ProxySettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PROXY_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load proxy settings:', e);
    }
    return DEFAULT_PROXY_SETTINGS;
  }

  private saveSettings(settings: ProxySettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save proxy settings:', e);
    }
  }

  resetSettings(): void {
    this.saveSettings(DEFAULT_PROXY_SETTINGS);
    this.settings$.next(DEFAULT_PROXY_SETTINGS);
  }
}
