## 2024-05-23 - API Session Reuse Optimization
**Learning:** The initial implementation of `ApiBackend` created a new remote session for *every* user message. This is a significant performance bottleneck (latency of session initialization) and functional limitation (loss of conversation context).
**Action:** Refactored `sendMessage` to check for an existing `remoteId` on the session object. If present, it uses the `:sendMessage` endpoint to append to the existing session. This reduces latency for subsequent messages and enables true conversational state.

## 2024-05-24 - Git Remote Memoization
**Learning:** `git remote get-url origin` was being called on every session creation, spawning a new child process. Since the remote URL rarely changes during an editor session, this is unnecessary overhead.
**Action:** Implemented caching for `_getGitHubRepoSlug` to store the resolved repo slug. This eliminates redundant process spawns for subsequent session creations.
