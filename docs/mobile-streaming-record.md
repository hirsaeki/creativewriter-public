# Mobile Beat Streaming Background Handling

## Problem
- Users reported that beat generation streaming stops on mobile when the app/tab goes into the background.
- Mobile browsers (especially iOS Safari) suspend JavaScript execution and abort long-lived network requests when the page loses foreground focus.
- Our streaming approach depended on the client connection staying alive, so the AI request terminated and no final content was delivered.

## Solution Variants Considered
1. **Wake Lock**
   - Request `navigator.wakeLock.request('screen')` while streaming to keep the display active.
   - Pros: Keeps the current streaming pathway intact.
   - Cons: Limited platform support; intrusive UX; still fails if the user switches apps.

2. **Server-Side Continuation**
   - Send the generation request to a backend worker that continues processing even if the client disconnects; client fetches completion later.
   - Pros: Most resilient across devices; session survives disconnects.
   - Cons: Requires new infrastructure; added latency; job tracking complexity.

3. **Visibility-Aware Client Fallback** (Chosen)
   - Detect `document.hidden` and transition the request to a non-streaming completion call when the tab is backgrounded.
   - Pros: Minimal infrastructure changes; keeps existing provider integrations; small UX trade-offs.
   - Cons: User loses mid-stream UI updates during background periods; relies on client reactivation.

## Decision
- Implement variant 3 for a low-risk, client-only fix that ensures the user still receives the full generated content after returning to the app.
- Keep server-side continuation as a potential future improvement if uninterrupted background progress is required.

## Implementation Summary
- Added provider-aware `GenerationContext` records to track stream state and manage fallbacks (`docs/mobile-streaming-analysis.md` already describes the high-level approach).
- Hooked into `visibilitychange` events to detect when the app hides or returns and either cancel or resume work accordingly.
- On hide: abort active streaming requests and prepare a fallback path for each in-flight beat.
- On return: reissue the request using the provider’s non-streaming endpoint, deliver the accumulated content, and clean up context.
- Guarded the stream completion handlers so they do not fire while a fallback is pending.
- Propagated the final result back through the existing `generation$` and ReplaySubject pipeline so downstream consumers do not change.
- Preserved existing error handling and provider-specific behaviors.

## Further Options
- Introduce a backend relay/worker to process streaming requests so backgrounding the client has no impact.
- Add user-configurable settings to prefer non-streaming completion when on mobile or low bandwidth.
- Experiment with progressive sync: cache partial content locally and reconcile with the fallback completion to reduce UX gaps.
- Explore wake-lock support as an opt-in for users who want continuous on-screen streaming despite the trade-offs.
