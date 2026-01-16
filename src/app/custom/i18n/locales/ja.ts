import type { TranslationKeys } from './en';

export const ja: TranslationKeys = {
  common: {
    ok: 'OK',
    cancel: 'キャンセル',
    save: '保存',
    reset: 'リセット',
    confirm: '確認',
    delete: '削除',
    continue: '続ける',
    dismiss: '閉じる',
    tips: 'ヒント',
    debug: 'デバッグ',
    goToSettings: '設定へ',
  },
  settings: {
    language: {
      title: '言語設定',
      description: 'お好みの言語を選択してください。アプリの一部は英語のままの場合があります。',
      ja: '日本語',
      en: '英語',
      current: '現在の言語',
      selectLanguage: '言語を選択',
    },
    proxy: {
      title: 'リバースプロキシ設定',
      description: 'APIプロバイダー向けのリバースプロキシエンドポイントを設定します。セルフホストのプロキシやエンタープライズ環境で便利です。',
      languageSettings: '言語設定',
      claudeApiProxy: 'Claude APIプロキシ',
      openRouterApiProxy: 'OpenRouter APIプロキシ',
      geminiApiProxy: 'Google Gemini APIプロキシ',
      ollamaAuth: 'Ollama認証',
      openAIAuth: 'OpenAI互換認証',
      enableProxy: 'プロキシを有効化',
      proxyUrl: 'プロキシURL',
      authToken: '認証トークン（任意）',
      authHeaderType: '認証ヘッダータイプ',
      authorizationOption: 'Authorization（透過プロキシ）',
      xProxyAuthOption: 'X-Proxy-Auth（明示的プロキシ）',
      testConnection: '接続テスト',
      forwardNote: 'プロキシは{url}へリクエストを転送します',
      ollamaNote: 'Ollamaサーバーが認証付きリバースプロキシの背後にある場合、認証を追加してください',
      openAINote: 'OpenAI互換サーバーがBearerトークンを必要とする場合、認証を追加してください',
      resetSettings: 'プロキシ設定をリセット',
    },
  },
  errors: {
    chunkUpdate: {
      title: 'アップデートがあります',
      message: '新しいバージョンが利用可能です。ページをリロードしてください。',
      reload: 'リロード',
    },
  },
  memory: {
    warning: {
      header: 'メモリ使用量が高い',
      message: 'メモリ使用量が{usage}%です。ストーリーを閉じるか、古いデータをクリアしてください。',
    },
    critical: {
      header: 'メモリ使用量が危険です！',
      message: 'メモリ使用量が{usage}%です！アプリが不安定になる可能性があります。ストーリーを閉じるかページをリロードしてください。',
    },
    tips: {
      header: 'メモリ最適化のヒント',
      message: '• 作業していないストーリーを閉じる\n• 古いストーリーをエクスポートしてアーカイブ\n• ブラウザキャッシュをクリアしてリロード\n• 開いているシーンの数を減らす\n• 詳細はmobile-debugで確認',
    },
  },
};
