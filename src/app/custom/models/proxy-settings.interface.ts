// 認証ヘッダータイプ
// - 'authorization': 透過型プロキシ向け。Authorization: Bearer {token} を送信
// - 'x-proxy-auth': 明示的プロキシ向け。X-Proxy-Auth: Bearer {token} を送信
export type AuthHeaderType = 'authorization' | 'x-proxy-auth';

export interface ReverseProxyConfig {
  enabled: boolean;
  url: string;
  authToken?: string;
  authHeaderType?: AuthHeaderType;  // デフォルトは 'authorization'（透過型プロキシ向け）
}

export interface ProxySettings {
  claude?: ReverseProxyConfig;
  openRouter?: ReverseProxyConfig;
  googleGemini?: ReverseProxyConfig;
  ollama?: { authToken?: string };
  openAICompatible?: { authToken?: string };
}

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  claude: { enabled: false, url: '', authHeaderType: 'authorization' },
  openRouter: { enabled: false, url: '', authHeaderType: 'authorization' },
  googleGemini: { enabled: false, url: '', authHeaderType: 'authorization' },
  ollama: {},
  openAICompatible: {}
};
