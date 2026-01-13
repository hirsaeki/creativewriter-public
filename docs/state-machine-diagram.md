# CreativeWriter 2.0 ステートマシーン図

## 1. アプリケーション全体の状態遷移

```mermaid
stateDiagram-v2
    [*] --> AppInit: アプリ起動

    state AppInit {
        [*] --> BootstrapAngular
        BootstrapAngular --> InitPouchDB: PouchDB初期化
        InitPouchDB --> LoadSettings: localStorage読み込み
        LoadSettings --> CheckAuth: 認証状態確認
        CheckAuth --> InitServices: サービス初期化
        InitServices --> [*]
    }

    AppInit --> StoryListView: 初期化完了

    state StoryListView {
        [*] --> INITIAL
        INITIAL --> SYNCING: 同期開始
        SYNCING --> LOADING: 同期完了
        LOADING --> READY: ストーリーあり
        LOADING --> EMPTY: ストーリーなし
        READY --> LOADING: リフレッシュ
        EMPTY --> READY: ストーリー作成
    }

    StoryListView --> StoryEditorView: ストーリー選択
    StoryListView --> SettingsView: 設定を開く

    StoryEditorView --> StoryListView: 戻る
    SettingsView --> StoryListView: 戻る
```

## 2. ストーリーエディター状態遷移

```mermaid
stateDiagram-v2
    [*] --> LoadingStory: ストーリー選択

    state LoadingStory {
        [*] --> FetchFromDB
        FetchFromDB --> ParseChapters
        ParseChapters --> LoadFirstScene
        LoadFirstScene --> [*]
    }

    LoadingStory --> Idle: ロード完了

    state EditorState {
        Idle --> Editing: ユーザー入力
        Editing --> Idle: デバウンス(3秒)経過
        Editing --> Saving: 保存トリガー
        Saving --> Idle: 保存完了
        Saving --> SaveError: 保存失敗
        SaveError --> Editing: リトライ

        Idle --> AIGenerating: AI生成開始
        Editing --> AIGenerating: AI生成開始

        state AIGenerating {
            [*] --> Preparing
            Preparing --> Streaming: API応答開始
            Streaming --> Streaming: チャンク受信
            Streaming --> Complete: 完了
            Streaming --> Error: エラー発生
            Complete --> [*]
            Error --> [*]
        }

        AIGenerating --> Editing: 生成結果挿入
    }

    EditorState --> SceneNavigation: シーン切り替え
    SceneNavigation --> LoadingStory: 別シーンロード

    EditorState --> [*]: エディター終了
```

## 3. 同期状態（DatabaseService）

```mermaid
stateDiagram-v2
    [*] --> Offline: 初期状態

    Offline --> Connecting: ネットワーク検出
    Connecting --> Online: 接続成功
    Connecting --> Offline: 接続失敗

    state Online {
        [*] --> Idle
        Idle --> Syncing: 変更検出

        state Syncing {
            [*] --> Pushing
            Pushing --> Pulling
            Pulling --> [*]
        }

        Syncing --> Idle: 同期完了
        Syncing --> SyncError: 同期エラー
        SyncError --> Idle: リトライ成功
        SyncError --> Paused: 最大リトライ超過
    }

    Online --> Paused: メモリ圧力検出
    Online --> Paused: タブ非表示
    Paused --> Online: 再開トリガー

    Online --> Offline: 接続喪失
    Paused --> Offline: 接続喪失

    note right of Syncing
        5分ごとにリスタート
        （メモリリーク対策）
    end note
```

## 4. AI生成状態（BeatAIService）

```mermaid
stateDiagram-v2
    [*] --> Ready: 初期状態

    Ready --> ProviderSelection: Generate要求

    state ProviderSelection {
        [*] --> CheckProvider
        CheckProvider --> OpenRouter: OpenRouter選択
        CheckProvider --> Claude: Claude選択
        CheckProvider --> Gemini: Gemini選択
        CheckProvider --> Ollama: Ollama選択
        OpenRouter --> [*]
        Claude --> [*]
        Gemini --> [*]
        Ollama --> [*]
    }

    ProviderSelection --> BuildingContext: プロバイダー決定

    state BuildingContext {
        [*] --> LoadCodex
        LoadCodex --> LoadSceneSummaries
        LoadSceneSummaries --> BuildPrompt
        BuildPrompt --> [*]
    }

    BuildingContext --> APICall: コンテキスト構築完了

    state APICall {
        [*] --> Requesting
        Requesting --> Streaming: ストリーム開始
        Streaming --> Streaming: チャンク受信
        Streaming --> [*]: ストリーム終了
    }

    APICall --> PostProcessing: API完了
    APICall --> ErrorHandling: APIエラー

    state ErrorHandling {
        [*] --> AnalyzeError
        AnalyzeError --> RateLimited: レート制限
        AnalyzeError --> AuthError: 認証エラー
        AnalyzeError --> NetworkError: ネットワークエラー
        RateLimited --> [*]: リトライ待機
        AuthError --> [*]: 設定確認要求
        NetworkError --> [*]: 再接続待機
    }

    PostProcessing --> SaveHistory: 履歴保存
    SaveHistory --> Ready: 完了

    ErrorHandling --> Ready: エラー処理完了
```

## 5. シーンナビゲーション状態

```mermaid
stateDiagram-v2
    [*] --> NoStory: 初期状態

    NoStory --> StoryLoaded: ストーリーロード

    state StoryLoaded {
        [*] --> FirstScene

        state SceneState {
            Viewing --> Viewing: 同一シーン
            Viewing --> Loading: 別シーン選択
            Loading --> Viewing: ロード完了
        }

        FirstScene --> SceneState
    }

    state NavigationCheck {
        [*] --> CheckPrevious
        CheckPrevious --> HasPrevious: 前シーンあり
        CheckPrevious --> NoPrevious: 最初のシーン
        HasPrevious --> CheckNext
        NoPrevious --> CheckNext
        CheckNext --> HasNext: 次シーンあり
        CheckNext --> NoNext: 最後のシーン
        HasNext --> [*]
        NoNext --> [*]
    }

    StoryLoaded --> NavigationCheck: ナビゲーション更新
    NavigationCheck --> StoryLoaded: 状態反映

    StoryLoaded --> NoStory: ストーリー閉じる
```

## 6. 設定状態（SettingsService）

```mermaid
stateDiagram-v2
    [*] --> LoadFromStorage: アプリ起動

    LoadFromStorage --> DefaultSettings: 設定なし
    LoadFromStorage --> LoadedSettings: 設定あり

    DefaultSettings --> Active: デフォルト適用
    LoadedSettings --> Active: 設定適用

    state Active {
        [*] --> Unchanged
        Unchanged --> Modified: 設定変更
        Modified --> Saving: 自動保存
        Saving --> Unchanged: 保存完了

        Unchanged --> ProviderValidation: API検証
        Modified --> ProviderValidation: API検証

        state ProviderValidation {
            [*] --> Validating
            Validating --> Valid: 検証成功
            Validating --> Invalid: 検証失敗
            Valid --> [*]
            Invalid --> [*]
        }

        ProviderValidation --> Unchanged: 検証完了
    }

    Active --> [*]: アプリ終了
```

## 7. 認証状態（AuthService）

```mermaid
stateDiagram-v2
    [*] --> CheckLocalStorage: アプリ起動

    CheckLocalStorage --> LocalOnly: ローカルモード
    CheckLocalStorage --> NotAuthenticated: 認証なし
    CheckLocalStorage --> Authenticated: 認証済み

    state LocalOnly {
        [*] --> LocalMode
        LocalMode --> LocalMode: ローカル操作
    }

    state NotAuthenticated {
        [*] --> LoginForm
        LoginForm --> Authenticating: ログイン試行
        Authenticating --> LoginForm: 認証失敗
        Authenticating --> [*]: 認証成功
    }

    NotAuthenticated --> Authenticated: ログイン成功

    state Authenticated {
        [*] --> Active
        Active --> Active: 通常操作
        Active --> Refreshing: トークンリフレッシュ
        Refreshing --> Active: リフレッシュ成功
        Refreshing --> SessionExpired: リフレッシュ失敗
        SessionExpired --> [*]: 再ログイン要求
    }

    Authenticated --> NotAuthenticated: ログアウト
    Authenticated --> NotAuthenticated: セッション期限切れ

    LocalOnly --> NotAuthenticated: クラウド切り替え
```

## 8. 統合状態遷移図（概要）

```mermaid
flowchart TB
    subgraph Application["アプリケーション層"]
        A[App起動] --> B[初期化]
        B --> C{認証状態}
        C -->|ローカル| D[ローカルモード]
        C -->|認証済み| E[同期モード]
        C -->|未認証| F[ログイン画面]
    end

    subgraph StoryList["ストーリーリスト"]
        G[INITIAL] --> H[SYNCING]
        H --> I[LOADING]
        I --> J[READY]
        I --> K[EMPTY]
    end

    subgraph Editor["エディター"]
        L[Idle] --> M[Editing]
        M --> N[Saving]
        N --> L
        L --> O[AI Generating]
        O --> M
    end

    subgraph Sync["同期サービス"]
        P[Offline] --> Q[Connecting]
        Q --> R[Online]
        R --> S[Syncing]
        S --> R
        R --> T[Paused]
        T --> R
    end

    subgraph AI["AI生成"]
        U[Ready] --> V[Building Context]
        V --> W[Streaming]
        W --> X[Complete]
        X --> U
        W --> Y[Error]
        Y --> U
    end

    D --> StoryList
    E --> StoryList
    F -->|ログイン成功| E

    J -->|ストーリー選択| Editor
    K -->|作成| J

    Editor -.->|保存| Sync
    Editor -.->|AI要求| AI
```

## 状態の説明

### アプリ初期化
| 状態 | 説明 |
|------|------|
| BootstrapAngular | Angular フレームワーク起動 |
| InitPouchDB | ローカルデータベース初期化 |
| LoadSettings | localStorage から設定読み込み |
| CheckAuth | 認証状態確認 |
| InitServices | 各種サービス初期化 |

### ストーリーリスト
| 状態 | 説明 |
|------|------|
| INITIAL | 初期状態 |
| SYNCING | リモートDBと同期中 |
| LOADING | ローカルDBからロード中 |
| READY | ストーリー表示可能 |
| EMPTY | ストーリーなし |

### エディター
| 状態 | 説明 |
|------|------|
| Idle | 待機状態（変更なし） |
| Editing | 編集中（未保存変更あり） |
| Saving | 保存処理中 |
| AIGenerating | AI生成中 |

### 同期
| 状態 | 説明 |
|------|------|
| Offline | オフライン状態 |
| Connecting | 接続試行中 |
| Online/Idle | オンライン待機 |
| Syncing | 同期処理中 |
| Paused | 一時停止（メモリ/可視性） |

### AI生成
| 状態 | 説明 |
|------|------|
| Ready | 生成待機 |
| BuildingContext | コンテキスト構築中 |
| Streaming | ストリーミング受信中 |
| Complete | 生成完了 |
| Error | エラー発生 |
