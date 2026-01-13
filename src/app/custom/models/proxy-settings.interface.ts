export interface ReverseProxyConfig {
  enabled: boolean;
  url: string;
  authToken?: string;
}

export interface ProxySettings {
  claude?: ReverseProxyConfig;
  openRouter?: ReverseProxyConfig;
  googleGemini?: ReverseProxyConfig;
  ollama?: { authToken?: string };
  openAICompatible?: { authToken?: string };
}

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  claude: { enabled: false, url: '' },
  openRouter: { enabled: false, url: '' },
  googleGemini: { enabled: false, url: '' },
  ollama: {},
  openAICompatible: {}
};
