import { Injectable, signal, computed } from '@angular/core';
import { en, ja, type TranslationKeys } from './locales';

export type Language = 'en' | 'ja';

const STORAGE_KEY = 'cw.lang';

type NestedKeyOf<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKeyOf<TranslationKeys>;

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private readonly locales: Record<Language, TranslationKeys> = { en, ja };
  private readonly langSignal = signal<Language>(this.detectInitialLanguage());

  readonly lang = this.langSignal.asReadonly();
  readonly translations = computed(() => this.locales[this.langSignal()]);

  constructor() {
    this.updateDocumentLang(this.langSignal());
  }

  private detectInitialLanguage(): Language {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'ja' || stored === 'en') {
          return stored;
        }
      }
    } catch {
      // localStorage not available (SSR or security restrictions)
    }

    try {
      if (typeof navigator !== 'undefined') {
        const browserLang = navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage || '';
        if (browserLang.toLowerCase().startsWith('ja')) {
          return 'ja';
        }
      }
    } catch {
      // navigator not available (SSR)
    }

    return 'en';
  }

  setLang(lang: Language): void {
    this.langSignal.set(lang);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang);
      }
    } catch {
      // localStorage not available
    }
    this.updateDocumentLang(lang);
  }

  private updateDocumentLang(lang: Language): void {
    try {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;
      }
    } catch {
      // document not available (SSR)
    }
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: unknown = this.locales[this.langSignal()];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        value = undefined;
        break;
      }
    }

    // Fallback to English
    if (value === undefined) {
      value = this.locales['en'];
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          return key; // Return key if not found
        }
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Parameter replacement
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        return params[paramKey]?.toString() ?? `{${paramKey}}`;
      });
    }

    return value;
  }
}
