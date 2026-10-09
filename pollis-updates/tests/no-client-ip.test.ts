/*
 * No plain client IPs readable anywhere (the hard privacy rule, the same one
 * pollis-delivery/tests/no_client_ip_exposure.rs enforces for the DS).
 *
 * Pinned: the wrangler config turns Workers Logs and Logpush off explicitly;
 * the Worker source logs nothing and reads no client-identifying data.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function jsonc(path: string): Record<string, unknown> {
  const raw = readFileSync(path, "utf8");
  // Strip // comments that are not inside strings, then parse.
  const stripped = raw.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*/g, (_m, str: string | undefined) => str ?? "");
  return JSON.parse(stripped);
}

test("Workers Logs and Logpush are explicitly off", () => {
  const config = jsonc(join(root, "wrangler.jsonc"));
  assert.deepEqual(config.observability, { enabled: false });
  assert.equal(config.logpush, false);
  // One origin only: no *.workers.dev alias, no preview URLs.
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  // No tail consumers either — they receive every request.
  assert.equal(config.tail_consumers, undefined);
});

test("the Worker never logs and never reads client-identifying data", () => {
  const dir = join(root, "worker");
  for (const name of readdirSync(dir)) {
    const code = readFileSync(join(dir, name), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    for (const banned of [/console\./, /\.cf\b/, /cf-connecting-ip/i, /x-forwarded-for/i, /x-real-ip/i, /true-client-ip/i, /user-agent/i, /eas-client-id/i]) {
      assert.ok(!banned.test(code), `${name} matches ${banned}`);
    }
  }
});
