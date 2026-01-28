## 2024-05-23 - API Session Reuse Optimization
**Learning:** The initial implementation of `ApiBackend` created a new remote session for *every* user message. This is a significant performance bottleneck (latency of session initialization) and functional limitation (loss of conversation context).
**Action:** Refactored `sendMessage` to check for an existing `remoteId` on the session object. If present, it uses the `:sendMessage` endpoint to append to the existing session. This reduces latency for subsequent messages and enables true conversational state.

## 2024-05-24 - Git Remote Memoization
**Learning:** `git remote get-url origin` was being called on every session creation, spawning a new child process. Since the remote URL rarely changes during editor session, this is unnecessary overhead.
**Action:** Implemented caching for `_getGitHubRepoSlug` to store the resolved repo slug. This eliminates redundant process spawns for subsequent session creations.

## 2025-01-28 - ApiBackend Cache & Polling Fixes
**Learning:** The previous implementation of `ApiBackend` had missing property definitions for caches (`_repoSlugCache`, `_sourceNameCache`) and polling state (`_processedActivitySets`), causing runtime errors or preventing optimizations from working. Also, `_pollActivities` used an O(N) array check instead of O(1) Set lookup.
**Action:** Fixed the class definitions, repaired the caching logic for git remote resolution, and implemented a proper Set-based deduplication for activity polling.

## 2025-01-29 - ApiBackend Duplicate Definitions & Webview Optimization
**Learning:** Found critical duplicate private property definitions in `ApiBackend` (likely merge artifacts) that prevented compilation. Also identified that `CLI_COMMANDS` was being JSON-serialized on every webview render.
**Action:** Removed duplicate properties in `ApiBackend.ts` to fix the build. Implemented static caching for `CLI_COMMANDS` JSON string to eliminate redundant serialization overhead during view refreshes.
