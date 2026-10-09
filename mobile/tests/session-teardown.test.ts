/*
 * Ending a session clears the decrypted media cache (#1256).
 *
 * `clearMediaCache()` existed but nothing called it, so every attachment a
 * session had decrypted to `pollis-media/` stayed on disk after sign-out or
 * account deletion. Every path that ends a session now goes through
 * `endSession()` (lib/session), whose pure half is `tearDownSession`.
 *
 * Two things are pinned: the teardown really clears the cache (and survives
 * the clear failing), and no sign-out path goes around it — a new one that
 * calls `appStore.logout()` directly would quietly bring the gap back.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { tearDownSession } from "../lib/session/teardown.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) {
      out.push(...sourceFiles(rel));
    } else if (/\.tsx?$/.test(name)) {
      out.push(rel);
    }
  }
  return out;
}

test("the teardown resets the store and then clears the media cache", async () => {
  const calls: string[] = [];
  await tearDownSession({
    resetStore: () => {
      calls.push("resetStore");
    },
    clearMediaCache: async () => {
      calls.push("clearMediaCache");
    },
  });
  assert.deepEqual(calls, ["resetStore", "clearMediaCache"]);
});

test("a failed cache wipe still ends the session", async () => {
  let reset = false;
  const warn = console.warn;
  console.warn = () => {};
  try {
    await tearDownSession({
      resetStore: () => {
        reset = true;
      },
      clearMediaCache: async () => {
        throw new Error("disk full");
      },
    });
  } finally {
    console.warn = warn;
  }
  assert.equal(reset, true, "a failed wipe must not leave the user signed in");
});

test("endSession wires the real media cache clear", () => {
  const src = read("lib/session/index.ts");
  assert.match(src, /import \{ clearMediaCache \} from "\.\.\/media\/cache"/);
  assert.match(src, /clearMediaCache,/);
  assert.match(src, /resetStore: appStore\.logout/);
});

test("every sign-out path goes through endSession", () => {
  for (const rel of [
    "hooks/queries/useAuth.ts",
    "app/self/delete-account.tsx",
    "hooks/useInboxRealtime.ts",
  ]) {
    assert.match(read(rel), /endSession\(\)/, `${rel} no longer calls endSession()`);
  }
});

test("nothing but endSession resets the store on sign-out", () => {
  const offenders = ["app", "components", "hooks", "lib"]
    .flatMap(sourceFiles)
    .filter((rel) => relative("lib/session", rel).startsWith(".."))
    .filter((rel) => /appStore\.logout\b/.test(read(rel)));
  assert.deepEqual(
    offenders,
    [],
    "a sign-out path that calls appStore.logout() directly skips the media cache wipe",
  );
});
