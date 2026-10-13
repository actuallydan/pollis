import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HAPTICS, armHaptic, type HapticEvent } from "../lib/hapticEvents.ts";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the swipe ticks only when the armed state flips", () => {
  assert.equal(armHaptic(false, false), null);
  assert.equal(armHaptic(true, true), null);
  assert.equal(armHaptic(false, true), "swipeArmed");
  assert.equal(armHaptic(true, false), "swipeDisarmed");
});

test("every event has an iOS and an Android haptic", () => {
  const events: HapticEvent[] = [
    "swipeArmed",
    "swipeDisarmed",
    "doubleTapReply",
    "longPress",
    "reactionAdd",
    "reactionRemove",
  ];
  assert.deepEqual(Object.keys(HAPTICS).sort(), [...events].sort());
  for (const e of events) {
    assert.ok(HAPTICS[e].ios.kind, e);
    assert.ok(HAPTICS[e].android, e);
  }
});

test("Android plays system haptics, never the raw vibrator", () => {
  const s = src("lib/haptics.ts");
  assert.match(s, /performAndroidHapticsAsync/);
  assert.doesNotMatch(s, /Vibration|vibrate\(/);
  // Every Android constant the table names is mapped.
  for (const { android } of Object.values(HAPTICS)) {
    assert.ok(s.includes(`"${android}"`), android);
  }
});

test("feedback can never throw into the interaction", () => {
  const s = src("lib/haptics.ts");
  assert.match(s, /catch \{\s*return;\s*\}/);
  assert.match(s, /\.catch\(\(\) => \{\}\)/);
});

test("the gesture plays haptics from its worklets via scheduleOnRN", () => {
  const s = src("components/chat/SwipeToReply.tsx");
  assert.match(s, /armHaptic\(armed\.value, next\)/);
  assert.match(s, /scheduleOnRN\(buzz, event\)/);
  assert.match(s, /scheduleOnRN\(buzz, "doubleTapReply"\)/);
});

test("a touch long press and every reaction toggle play their haptic", () => {
  const row = src("components/chat/MessageRow.tsx");
  assert.match(row, /haptic\("longPress"\)/);
  assert.doesNotMatch(row, /onLongPress=\{onLongPress\}/);
  const reactions = src("hooks/queries/useReactions.ts");
  assert.match(reactions, /haptic\(vars\.mode === "add" \? "reactionAdd" : "reactionRemove"\)/);
});

test("expo-haptics is a pinned dependency", () => {
  const pkg = JSON.parse(src("package.json"));
  assert.match(pkg.dependencies["expo-haptics"], /^~57\./);
});
