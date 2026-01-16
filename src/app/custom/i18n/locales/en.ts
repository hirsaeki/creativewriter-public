export const en = {
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    save: 'Save',
    reset: 'Reset',
    confirm: 'Confirm',
    delete: 'Delete',
    continue: 'Continue',
    dismiss: 'Dismiss',
    tips: 'Tips',
    debug: 'Debug',
    goToSettings: 'Go to Settings',
  },
  settings: {
    language: {
      title: 'Language Settings',
      description: 'Select your preferred language. Some parts of the app may remain in English.',
      ja: 'Japanese',
      en: 'English',
      current: 'Current Language',
      selectLanguage: 'Select Language',
    },
    proxy: {
      title: 'Reverse Proxy Settings',
      description: 'Configure reverse proxy endpoints for API providers. Useful for self-hosted proxies or enterprise environments.',
      languageSettings: 'Language Settings',
      claudeApiProxy: 'Claude API Proxy',
      openRouterApiProxy: 'OpenRouter API Proxy',
      geminiApiProxy: 'Google Gemini API Proxy',
      ollamaAuth: 'Ollama Authentication',
      openAIAuth: 'OpenAI-Compatible Authentication',
      enableProxy: 'Enable Proxy',
      proxyUrl: 'Proxy URL',
      authToken: 'Auth Token (optional)',
      authHeaderType: 'Auth Header Type',
      authorizationOption: 'Authorization (Transparent Proxy)',
      xProxyAuthOption: 'X-Proxy-Auth (Explicit Proxy)',
      testConnection: 'Test Connection',
      forwardNote: 'The proxy should forward requests to {url}',
      ollamaNote: 'Add authentication if your Ollama server is behind a reverse proxy with auth',
      openAINote: 'Add authentication if your OpenAI-compatible server requires Bearer token',
      resetSettings: 'Reset Proxy Settings',
    },
  },
  errors: {
    chunkUpdate: {
      title: 'Update Available',
      message: 'A new version is available. Please reload the page.',
      reload: 'Reload',
    },
  },
  memory: {
    warning: {
      header: 'Memory Usage High',
      message: 'Memory usage is at {usage}%. Consider closing some stories or clearing old data.',
    },
    critical: {
      header: 'Critical Memory Usage!',
      message: 'Memory usage is at {usage}%! The app may become unstable. Please close stories or refresh the page.',
    },
    tips: {
      header: 'Memory Optimization Tips',
      message: '• Close stories you\'re not working on\n• Export and archive old stories\n• Clear browser cache and reload\n• Reduce the number of open scenes\n• Check mobile-debug for details',
    },
  },
};

export type TranslationKeys = typeof en;
