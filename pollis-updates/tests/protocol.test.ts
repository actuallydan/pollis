/*
 * worker/protocol.ts — the Expo Updates protocol v1 responses the Worker gives.
 *
 * Pinned: a published pointer comes back as multipart/mixed with the protocol
 * headers and the stored signature passed through byte-for-byte on the signed
 * part; nothing published is a 204 (v1's "no update"); directives are served
 * as directive parts; malformed requests are 400s that never touch R2; a
 * malformed pointer is a 500, never a half-formed update; assets are served by
 * content address only; every other path/method is refused.
 *
 *   node --test pollis-updates/tests/*.test.ts      (or `pnpm test` in pollis-updates/)
 */

import test from "node:test";
import assert from "node:assert/strict";

import { handle, multipartBody, parsePointer, pointerKey, type BucketLike, type StoredObject } from "../worker/protocol.ts";

const RV = "376466c81d9428da79f80525da44567b98aa4e4a";
const SIG = 'sig="c2lnbmF0dXJl", keyid="main", alg="rsa-v1_5-sha256"';
const SHA = "09f8db0f31a3a02acbf80a31f7e1ff83002b6a54b87aece45c50296673bd5072";

const MANIFEST = JSON.stringify({
  id: "dd7c08cc-ce5e-4ea2-b437-b106ad5ec958",
  createdAt: "2026-10-09T12:00:00.000Z",
  runtimeVersion: RV,
  launchAsset: { hash: "x", key: "k", contentType: "application/javascript", fileExtension: ".bundle", url: `https://updates.pollis.com/assets/${SHA}` },
  assets: [],
  metadata: {},
  extra: {},
});

function object(body: string | Uint8Array, contentType?: string): StoredObject {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  return {
    async text() {
      return new TextDecoder().decode(bytes);
    },
    body: new Response(bytes).body,
    size: bytes.length,
    httpEtag: '"etag-1"',
    httpMetadata: contentType ? { contentType } : {},
  };
}

class FakeBucket implements BucketLike {
  reads: string[] = [];
  objects: Record<string, () => StoredObject>;
  constructor(objects: Record<string, () => StoredObject>) {
    this.objects = objects;
  }
  async get(key: string): Promise<StoredObject | null> {
    this.reads.push(key);
    const make = this.objects[key];
    return make ? make() : null;
  }
}

function env(objects: Record<string, () => StoredObject> = {}) {
  return { UPDATES: new FakeBucket(objects), CHANNEL: "production" };
}

function manifestRequest(headers: Record<string, string> = {}, query = ""): Request {
  return new Request(`https://updates.pollis.com/api/manifest${query}`, {
    headers: {
      "expo-protocol-version": "1",
      "expo-platform": "ios",
      "expo-runtime-version": RV,
      "expo-channel-name": "production",
      ...headers,
    },
  });
}

function pointer(kind: "manifest" | "directive", body: string, signature = SIG): () => StoredObject {
  return () => object(JSON.stringify({ kind, body, signature }));
}

function boundaryOf(res: Response): string {
  const m = /^multipart\/mixed; boundary=(\S+)$/.exec(res.headers.get("content-type") ?? "");
  assert.ok(m, `content-type ${res.headers.get("content-type")}`);
  return m[1];
}

test("a published manifest is served multipart with its signature passed through", async () => {
  const e = env({ [pointerKey("production", "ios", RV)]: pointer("manifest", MANIFEST) });
  const res = await handle(manifestRequest(), e);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("expo-protocol-version"), "1");
  assert.equal(res.headers.get("expo-sfv-version"), "0");
  assert.equal(res.headers.get("cache-control"), "private, max-age=0");
  const b = boundaryOf(res);
  const text = await res.text();
  assert.equal(
    text,
    `--${b}\r\ncontent-disposition: form-data; name="manifest"\r\ncontent-type: application/json; charset=utf-8\r\n` +
      `expo-signature: ${SIG}\r\n\r\n${MANIFEST}\r\n` +
      `--${b}\r\ncontent-disposition: form-data; name="extensions"\r\ncontent-type: application/json\r\n\r\n{"assetRequestHeaders":{}}\r\n` +
      `--${b}--\r\n`,
  );
  assert.deepEqual(e.UPDATES.reads, [`current/production/ios/${RV}.json`]);
});

test("each response gets a fresh boundary", async () => {
  const e = env({ [pointerKey("production", "ios", RV)]: pointer("manifest", MANIFEST) });
  const a = boundaryOf(await handle(manifestRequest(), e));
  const b = boundaryOf(await handle(manifestRequest(), e));
  assert.notEqual(a, b);
});

test("platform and runtime version route to separate pointers", async () => {
  const androidRv = "650428a8330d3d6e164e93a21f4fa73aa7088395";
  const e = env();
  await handle(manifestRequest({ "expo-platform": "android", "expo-runtime-version": androidRv }), e);
  assert.deepEqual(e.UPDATES.reads, [`current/production/android/${androidRv}.json`]);
});

test("platform and runtime version may come from the query when headers are absent", async () => {
  const e = env();
  const res = await handle(
    manifestRequest({ "expo-platform": "", "expo-runtime-version": "" }, `?platform=android&runtime-version=${RV}`),
    e,
  );
  assert.equal(res.status, 204);
  assert.deepEqual(e.UPDATES.reads, [`current/production/android/${RV}.json`]);
});

test("nothing published is a protocol-v1 204", async () => {
  const res = await handle(manifestRequest(), env());
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("expo-protocol-version"), "1");
  assert.equal(res.headers.get("expo-sfv-version"), "0");
  assert.equal(await res.text(), "");
});

test("a rollBackToEmbedded directive is served as a signed directive part, without extensions", async () => {
  const directive = JSON.stringify({ type: "rollBackToEmbedded", parameters: { commitTime: "2026-10-09T13:00:00.000Z" } });
  const e = env({ [pointerKey("production", "ios", RV)]: pointer("directive", directive) });
  const res = await handle(manifestRequest(), e);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes(`content-disposition: form-data; name="directive"\r\n`));
  assert.ok(text.includes(`expo-signature: ${SIG}\r\n\r\n${directive}\r\n`));
  assert.ok(!text.includes('name="manifest"'));
  assert.ok(!text.includes('name="extensions"'));
});

test("a noUpdateAvailable directive is served too", async () => {
  const e = env({ [pointerKey("production", "ios", RV)]: pointer("directive", '{"type":"noUpdateAvailable"}') });
  const res = await handle(manifestRequest(), e);
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes('{"type":"noUpdateAvailable"}'));
});

test("malformed requests are 400s that never reach R2", async () => {
  const cases: Record<string, string>[] = [
    { "expo-protocol-version": "0" },
    { "expo-protocol-version": "" },
    { "expo-platform": "web" },
    { "expo-runtime-version": "../../assets/x" },
    { "expo-runtime-version": "a/b" },
    { "expo-channel-name": "staging" },
    { "expo-channel-name": "" },
  ];
  for (const headers of cases) {
    const e = env();
    const res = await handle(manifestRequest(headers), e);
    assert.equal(res.status, 400, JSON.stringify(headers));
    assert.deepEqual(e.UPDATES.reads, [], JSON.stringify(headers));
  }
});

test("a pointer the pipeline did not write correctly is a 500, never a partial update", async () => {
  const bad: (() => StoredObject)[] = [
    () => object("not json"),
    pointer("manifest", MANIFEST, "sig=unquoted"),
    pointer("manifest", MANIFEST, 'sig="abc", keyid="main", alg="rsa-v1_5-sha512"'),
    pointer("manifest", MANIFEST.replace(RV, "a-different-runtime")),
    pointer("directive", '{"type":"launchSomethingElse"}'),
    () => object(JSON.stringify({ kind: "other", body: MANIFEST, signature: SIG })),
  ];
  for (const make of bad) {
    const res = await handle(manifestRequest(), env({ [pointerKey("production", "ios", RV)]: make }));
    assert.equal(res.status, 500);
  }
});

test("parsePointer accepts exactly what the pipeline writes", () => {
  const p = parsePointer(JSON.stringify({ kind: "manifest", body: MANIFEST, signature: SIG }), RV);
  assert.deepEqual(p, { kind: "manifest", body: MANIFEST, signature: SIG });
});

test("multipartBody refuses a boundary that occurs inside the body", () => {
  assert.throws(() => multipartBody({ kind: "manifest", body: '{"x":"pollis-abc"}', signature: SIG }, "pollis-abc"), /collision/);
});

test("assets are served by content address with immutable caching", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const e = env({ [`assets/${SHA}`]: () => object(bytes, "image/png") });
  const res = await handle(new Request(`https://updates.pollis.com/assets/${SHA}`), e);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/png");
  assert.equal(res.headers.get("content-length"), "4");
  assert.equal(res.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), bytes);

  const head = await handle(new Request(`https://updates.pollis.com/assets/${SHA}`, { method: "HEAD" }), e);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("a missing asset is a 404 and a non-sha256 asset path never reaches R2", async () => {
  const e = env();
  assert.equal((await handle(new Request(`https://updates.pollis.com/assets/${SHA}`), e)).status, 404);
  const before = e.UPDATES.reads.length;
  for (const path of ["/assets/abc", `/assets/${SHA.toUpperCase()}`, `/assets/${SHA}/x`, "/assets/../current/production/ios/x.json"]) {
    assert.equal((await handle(new Request(`https://updates.pollis.com${path}`), e)).status, 404, path);
  }
  assert.equal(e.UPDATES.reads.length, before);
});

test("only GET/HEAD, and only the two routes", async () => {
  const e = env();
  assert.equal((await handle(new Request("https://updates.pollis.com/api/manifest", { method: "POST" }), e)).status, 405);
  assert.equal((await handle(new Request("https://updates.pollis.com/api/manifest", { method: "HEAD" }), e)).status, 405);
  assert.equal((await handle(new Request("https://updates.pollis.com/"), e)).status, 404);
  assert.equal((await handle(new Request("https://updates.pollis.com/updates/x.json"), e)).status, 404);
  assert.equal((await handle(new Request("https://updates.pollis.com/current/production/ios/x.json"), e)).status, 404);
  assert.deepEqual(e.UPDATES.reads, []);
});
