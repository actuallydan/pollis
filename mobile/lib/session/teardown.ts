// The pure half of ending a session on this device (#1256). Kept free of
// Expo / MobX imports so `node --test` can drive it with fakes; the wired
// version every sign-out path calls is `endSession()` in ./index.ts.

export interface SessionTeardownDeps {
  // Drop the signed-in UI state (current user, selections, cached lists).
  resetStore: () => void;
  // Unlink every decrypted media file the session materialised to disk.
  clearMediaCache: () => Promise<void>;
}

// Runs after the Rust side has torn the session down (`logout` /
// `delete_account`), so nothing can resolve fresh media while the cache is
// being emptied. A failed wipe is logged, never thrown: a disk hiccup must
// not strand the user signed in to a session that has already ended.
export async function tearDownSession(deps: SessionTeardownDeps): Promise<void> {
  deps.resetStore();
  try {
    await deps.clearMediaCache();
  } catch (e) {
    console.warn("[session] clearing the media cache failed (ignored):", e);
  }
}
