# リバースプロキシ設定機能 - 実装引継資料

## ステータス
**実装中 - 方針変更後、未着手**

## 目的
各AIプロバイダー（Claude, OpenRouter, Gemini, Ollama, OpenAI互換）にリバースプロキシを設定できるオプションを追加する。Bearer認証をサポート。

---

## 完了済み作業

### 1. 仕様ドキュメント作成
- `docs/reverse-proxy-settings.md` - 設計仕様書

### 2. フォーク運用ルール策定
- `CLAUDE.local.md` - フォークメンテナンスルール
- `.gitattributes` - マージ保護設定

---

## 方針変更の経緯

### 当初のアプローチ（却下）
upstreamファイルを直接修正：
- `src/app/core/models/settings.interface.ts`
- `src/app/core/services/settings.service.ts`
- `src/app/core/services/claude-api.service.ts`
- 他のAPIサービス

**問題点**: CLAUDE.local.mdのフォークルールに違反。upstream同期時にコンフリクト発生。

### 正しいアプローチ（採用）
`src/app/custom/` 配下にカスタム実装を作成し、DIで差し替え。

---

## 次にやるべきこと

### Phase 1: ディレクトリ構造作成
```
src/app/custom/
├── models/
│   └── proxy-settings.interface.ts
├── services/
│   ├── proxy-settings.service.ts
│   ├── claude-api-proxy.service.ts
│   ├── openrouter-api-proxy.service.ts
│   ├── gemini-api-proxy.service.ts
│   ├── ollama-api-proxy.service.ts
│   └── openai-api-proxy.service.ts
├── components/
│   └── proxy-settings/
│       ├── proxy-settings.component.ts
│       ├── proxy-settings.component.html
│       └── proxy-settings.component.scss
└── custom.module.ts
```

### Phase 2: 型定義
`proxy-settings.interface.ts`:
```typescript
export interface ReverseProxyConfig {
  enabled: boolean;
  url: string;
  authToken?: string;
}

export interface ProxySettings {
  claude?: ReverseProxyConfig;
  openRouter?: ReverseProxyConfig;
  googleGemini?: ReverseProxyConfig;
  ollama?: { authToken?: string };  // baseUrlは既存設定を使用
  openAICompatible?: { authToken?: string };
}
```

### Phase 3: プロキシ設定サービス
`proxy-settings.service.ts`:
- 独自のlocalStorageキー（`creative-writer-proxy-settings`）を使用
- upstreamの設定とは分離

### Phase 4: APIサービスの拡張
各APIサービスを継承し、プロキシ対応をオーバーライド：

```typescript
// 例: claude-api-proxy.service.ts
@Injectable()
export class ClaudeApiProxyService extends ClaudeApiService {
  constructor(
    http: HttpClient,
    settingsService: SettingsService,
    private proxySettingsService: ProxySettingsService
  ) {
    super(http, settingsService);
  }

  // getApiUrl等をオーバーライド
}
```

### Phase 5: DI設定
`custom.module.ts`:
```typescript
@NgModule({
  providers: [
    { provide: ClaudeApiService, useClass: ClaudeApiProxyService },
    { provide: OpenRouterApiService, useClass: OpenRouterApiProxyService },
    // ...
  ]
})
export class CustomModule {}
```

### Phase 6: UI追加
設定画面にプロキシ設定コンポーネントを追加。
既存の`api-settings.component`を拡張するか、別タブとして追加。

### Phase 7: 検証
```bash
npm run build
npm test -- --no-watch
npm run lint
```

---

## 設計ポイント

### プロキシ認証
- Claude/Gemini: `Authorization: Bearer {token}` を追加
- OpenRouter: 元々Bearerを使用 → `X-Proxy-Auth: Bearer {token}` で分離
- Ollama/OpenAI互換: 既存baseURLに認証ヘッダー追加

### 設定の分離
- プロキシ設定は独自のlocalStorageキーに保存
- upstreamの設定構造には手を加えない

### 継承パターン
- 元のAPIサービスを`extends`で継承
- 必要なメソッドのみオーバーライド
- 既存の動作を維持

---

## 関連ファイル

| ファイル | 説明 |
|---------|------|
| `docs/reverse-proxy-settings.md` | 仕様ドキュメント |
| `CLAUDE.local.md` | フォークルール |
| `.gitattributes` | マージ保護 |
| `src/app/core/services/claude-api.service.ts` | 継承元（参照用） |
| `src/app/core/services/openrouter-api.service.ts` | 継承元（参照用） |
| `src/app/core/services/google-gemini-api.service.ts` | 継承元（参照用） |
| `src/app/core/services/ollama-api.service.ts` | 継承元（参照用） |
| `src/app/core/services/openai-compatible-api.service.ts` | 継承元（参照用） |

---

## 注意事項

1. **upstreamファイルは変更しない** - CLAUDE.local.mdのルールを厳守
2. **カスタムコードは`src/app/custom/`に配置** - `.gitattributes`で保護済み
3. **DI差し替えはCustomModuleで行う** - app.config.tsへの変更は最小限に
