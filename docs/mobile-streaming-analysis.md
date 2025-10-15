# Mobile Streaming Analysis

## Observed Behavior
- Beat generation streams rely on foreground `fetch` + `ReadableStream` processing.
- Mobile browsers (especially iOS Safari) suspend JavaScript execution and terminate network streams when the tab or app is backgrounded, causing the generation to stop.

## Root Causes
- OS-level power management prevents background tabs from holding active streams.
- Current implementation keeps all streaming state on the client; there is no server-side continuation when the connection drops.

## Viable Mitigations (2025 Best Practices)
1. **Screen Wake Lock**: Request `navigator.wakeLock.request('screen')` while streaming to keep the page foregrounded. Works on Android Chrome and Safari 17.4+ (including standalone PWA mode). Must handle `visibilitychange` to re-acquire the lock.
2. **Visibility-Aware Fallback**: Detect `document.hidden` and, before suspension, persist the request ID, cancel the client stream, and allow a backend worker to finish the generation. On return, resume via an API that serves accumulated output or reconnects through SSE/WebSocket.
3. **Client-Side Non-Streaming Fallback**: If background execution is unavoidable, switch to the existing non-streaming API path so users still receive the final text after returning.
4. **UX Guidance**: Inform users that keeping the app visible ensures uninterrupted streaming; offer a toggle to enable wake-lock support.

## Recommended Next Steps
- Decide whether to invest in wake-lock plus visibility handling or implement server-side continuation for background-safe streaming.
- If bandwidth permits, prototype a backend relay that keeps long-lived AI sessions active regardless of client focus.
