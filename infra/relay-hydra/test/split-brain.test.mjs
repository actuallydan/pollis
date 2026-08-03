// Split-brain detection (#677) — reconciler/placement.mjs `staleBuildNodes`.
// Pure function, no AWS, no network.
//
// Run: node --test   (from infra/relay-hydra/)

import { test } from "node:test";
import assert from "node:assert/strict";
import { staleBuildNodes } from "../reconciler/placement.mjs";

const NEW = "e0322e720858d14c75211ee7ea0afeaca03d3ea8";
const OLD = "aaaa1111bbbb2222cccc3333dddd4444eeee5555";

function node(id, sha, launchedAt) {
  return { instanceId: id, ip: "203.0.113.1", sha, launchedAt };
}

test("a uniform pool is left alone", () => {
  const pool = [node("i-1", NEW, 100), node("i-2", NEW, 200)];
  assert.deepEqual(staleBuildNodes(pool), []);
});

test("the node behind the newest launch is cycled", () => {
  // i-2 launched later, so its build is the one that pulled :latest most
  // recently; i-1 is the straggler.
  const stale = staleBuildNodes([node("i-1", OLD, 100), node("i-2", NEW, 200)]);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].instanceId, "i-1");
});

test("launch order decides the target, not array order", () => {
  // Same pool, newest listed first — the verdict must not change.
  const stale = staleBuildNodes([node("i-2", NEW, 200), node("i-1", OLD, 100)]);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].instanceId, "i-1");
});

test("the newest node is never cycled", () => {
  const stale = staleBuildNodes([node("i-1", OLD, 100), node("i-2", NEW, 999)]);
  assert.ok(!stale.some((n) => n.instanceId === "i-2"));
});

test("at most one node is cycled per run", () => {
  // Three stragglers behind one new node: capacity must drain gradually, so a
  // bad :latest cannot empty the pool in a single cycle.
  const stale = staleBuildNodes([
    node("i-1", OLD, 100),
    node("i-2", OLD, 110),
    node("i-3", OLD, 120),
    node("i-4", NEW, 200),
  ]);
  assert.equal(stale.length, 1);
});

test("a single-node pool is never cycled", () => {
  // With one node there is nothing to disagree with, and cycling it would take
  // the pool to zero.
  assert.deepEqual(staleBuildNodes([node("i-1", OLD, 100)]), []);
});

test("nodes with no reportable SHA are ignored, not cycled", () => {
  // /version answered 200 but the body did not parse. That is not evidence of a
  // stale build, and must never by itself destroy a node that is serving.
  assert.deepEqual(staleBuildNodes([node("i-1", null, 100), node("i-2", null, 200)]), []);
  const mixed = staleBuildNodes([node("i-1", null, 100), node("i-2", NEW, 200)]);
  assert.deepEqual(mixed, []);
});

test("an empty pool is a no-op", () => {
  assert.deepEqual(staleBuildNodes([]), []);
});
