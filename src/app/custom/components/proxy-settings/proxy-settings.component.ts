import { Component, OnInit, OnDestroy, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonToggle, IonButton, IonIcon, IonNote, IonSpinner,
  IonSelect, IonSelectOption
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { shieldCheckmarkOutline, serverOutline, keyOutline, refreshOutline, checkmarkCircleOutline, closeCircleOutline, cloudOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { ProxySettingsService } from '../../services/proxy-settings.service';
import { ProxySettings, ReverseProxyConfig } from '../../models/proxy-settings.interface';
import { ClaudeApiProxyService } from '../../services/claude-api-proxy.service';
import { GeminiApiProxyService } from '../../services/gemini-api-proxy.service';
import { OpenRouterApiProxyService } from '../../services/openrouter-api-proxy.service';

@Component({
  selector: 'app-proxy-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonInput, IonToggle, IonButton, IonIcon, IonNote, IonSpinner,
    IonSelect, IonSelectOption
  ],
  templateUrl: './proxy-settings.component.html',
  styleUrls: ['./proxy-settings.component.scss']
})
export class ProxySettingsComponent implements OnInit, OnDestroy {
  private proxySettingsService = inject(ProxySettingsService);
  private claudeApiProxyService = inject(ClaudeApiProxyService);
  private geminiApiProxyService = inject(GeminiApiProxyService);
  private openRouterApiProxyService = inject(OpenRouterApiProxyService);
  private subscription = new Subscription();

  @Output() settingsChange = new EventEmitter<void>();

  settings: ProxySettings = {
    claude: { enabled: false, url: '', authHeaderType: 'authorization' },
    openRouter: { enabled: false, url: '', authHeaderType: 'authorization' },
    googleGemini: { enabled: false, url: '', authHeaderType: 'authorization' },
    ollama: {},
    openAICompatible: {}
  };

  testingProvider: string | null = null;
  testResults = new Map<string, 'success' | 'error' | null>();

  // Cached proxy configs to avoid function calls in template
  claudeConfig: ReverseProxyConfig = { enabled: false, url: '', authHeaderType: 'authorization' };
  openRouterConfig: ReverseProxyConfig = { enabled: false, url: '', authHeaderType: 'authorization' };
  googleGeminiConfig: ReverseProxyConfig = { enabled: false, url: '', authHeaderType: 'authorization' };

  // Cached test connection flags
  canTestClaude = false;
  canTestOpenRouter = false;
  canTestGoogleGemini = false;

  // Cached test results
  claudeTestResult: 'success' | 'error' | null = null;
  openRouterTestResult: 'success' | 'error' | null = null;
  googleGeminiTestResult: 'success' | 'error' | null = null;

  // URL validation error messages
  claudeUrlError: string | null = null;
  openRouterUrlError: string | null = null;
  googleGeminiUrlError: string | null = null;

  constructor() {
    addIcons({ shieldCheckmarkOutline, serverOutline, keyOutline, refreshOutline, checkmarkCircleOutline, closeCircleOutline, cloudOutline });
  }

  ngOnInit(): void {
    this.subscription.add(
      this.proxySettingsService.getSettings$().subscribe(settings => {
        this.settings = JSON.parse(JSON.stringify(settings));
        this.updateCachedConfigs();
      })
    );
  }

  private updateCachedConfigs(): void {
    // Ensure settings objects exist and assign references for ngModel binding
    if (!this.settings.claude) {
      this.settings.claude = { enabled: false, url: '', authHeaderType: 'authorization' };
    }
    if (!this.settings.openRouter) {
      this.settings.openRouter = { enabled: false, url: '', authHeaderType: 'authorization' };
    }
    if (!this.settings.googleGemini) {
      this.settings.googleGemini = { enabled: false, url: '', authHeaderType: 'authorization' };
    }

    // Point to settings objects directly (reference, not copy) for ngModel binding
    this.claudeConfig = this.settings.claude;
    this.openRouterConfig = this.settings.openRouter;
    this.googleGeminiConfig = this.settings.googleGemini;

    // Update cached test connection flags (only enable if URL is valid)
    this.canTestClaude = this.claudeConfig.enabled && !!this.claudeConfig.url && this.hasValidUrl('claude');
    this.canTestOpenRouter = this.openRouterConfig.enabled && !!this.openRouterConfig.url && this.hasValidUrl('openRouter');
    this.canTestGoogleGemini = this.googleGeminiConfig.enabled && !!this.googleGeminiConfig.url && this.hasValidUrl('googleGemini');

    // Update cached test results
    this.claudeTestResult = this.testResults.get('claude') ?? null;
    this.openRouterTestResult = this.testResults.get('openRouter') ?? null;
    this.googleGeminiTestResult = this.testResults.get('googleGemini') ?? null;
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onSettingsChange(): void {
    this.proxySettingsService.updateSettings(this.settings);
    this.updateCachedConfigs();
    this.settingsChange.emit();
  }

  onToggleChange(provider: 'claude' | 'openRouter' | 'googleGemini'): void {
    if (!this.settings[provider]) {
      this.settings[provider] = { enabled: false, url: '', authHeaderType: 'authorization' };
    }
    this.onSettingsChange();
  }

  resetSettings(): void {
    this.proxySettingsService.resetSettings();
  }

  getProxyConfig(provider: 'claude' | 'openRouter' | 'googleGemini'): ReverseProxyConfig {
    if (!this.settings[provider]) {
      this.settings[provider] = { enabled: false, url: '', authHeaderType: 'authorization' };
    }
    return this.settings[provider]!;
  }

  testConnection(provider: 'claude' | 'openRouter' | 'googleGemini'): void {
    if (this.testingProvider) return;

    this.testingProvider = provider;
    this.testResults.set(provider, null);
    this.updateTestResultCache(provider, null);

    let testObservable;
    switch (provider) {
      case 'claude':
        testObservable = this.claudeApiProxyService.testProxyConnection();
        break;
      case 'openRouter':
        testObservable = this.openRouterApiProxyService.testProxyConnection();
        break;
      case 'googleGemini':
        testObservable = this.geminiApiProxyService.testProxyConnection();
        break;
    }

    this.subscription.add(
      testObservable.subscribe({
        next: (success) => {
          const result = success ? 'success' : 'error';
          this.testResults.set(provider, result);
          this.updateTestResultCache(provider, result);
          this.testingProvider = null;
        },
        error: () => {
          this.testResults.set(provider, 'error');
          this.updateTestResultCache(provider, 'error');
          this.testingProvider = null;
        }
      })
    );
  }

  private updateTestResultCache(provider: 'claude' | 'openRouter' | 'googleGemini', result: 'success' | 'error' | null): void {
    switch (provider) {
      case 'claude':
        this.claudeTestResult = result;
        break;
      case 'openRouter':
        this.openRouterTestResult = result;
        break;
      case 'googleGemini':
        this.googleGeminiTestResult = result;
        break;
    }
  }

  canTestConnection(provider: 'claude' | 'openRouter' | 'googleGemini'): boolean {
    const config = this.getProxyConfig(provider);
    return config.enabled && !!config.url;
  }

  getTestResult(provider: 'claude' | 'openRouter' | 'googleGemini'): 'success' | 'error' | null {
    return this.testResults.get(provider) ?? null;
  }

  isTestingProvider(provider: string): boolean {
    return this.testingProvider === provider;
  }

  /**
   * Validates a proxy URL.
   * Allows http:// and https:// schemes only.
   * Blocks dangerous schemes like javascript:, data:, vbscript:, etc.
   * @param url The URL to validate
   * @returns null if valid, error message string if invalid
   */
  validateProxyUrl(url: string): string | null {
    if (!url || url.trim() === '') {
      return null; // Empty URL is allowed (optional field)
    }

    const trimmedUrl = url.trim().toLowerCase();

    // Block dangerous schemes
    const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'file:', 'blob:'];
    for (const scheme of dangerousSchemes) {
      if (trimmedUrl.startsWith(scheme)) {
        return `Invalid URL scheme. "${scheme}" is not allowed.`;
      }
    }

    // Only allow http:// and https://
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      return 'URL must start with http:// or https://';
    }

    // Basic URL format validation
    try {
      new URL(url.trim());
    } catch {
      return 'Invalid URL format';
    }

    return null;
  }

  /**
   * Validates URL and updates error state for a specific provider.
   * Called on URL input change.
   */
  onUrlChange(provider: 'claude' | 'openRouter' | 'googleGemini'): void {
    const config = this.settings[provider];
    const url = config?.url || '';
    const error = this.validateProxyUrl(url);

    switch (provider) {
      case 'claude':
        this.claudeUrlError = error;
        break;
      case 'openRouter':
        this.openRouterUrlError = error;
        break;
      case 'googleGemini':
        this.googleGeminiUrlError = error;
        break;
    }

    // Only save if URL is valid
    if (!error) {
      this.onSettingsChange();
    }
  }

  /**
   * Checks if a provider has a valid URL (for enabling test connection button).
   */
  hasValidUrl(provider: 'claude' | 'openRouter' | 'googleGemini'): boolean {
    const config = this.settings[provider];
    if (!config?.url) return false;
    return this.validateProxyUrl(config.url) === null;
  }
}
