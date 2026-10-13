// Which tactile feedback each physical interaction gets (#1286). Pure, so
// tests/haptics.test.ts can pin it without a device; lib/haptics.ts plays it.
//
// iOS uses the UIKit feedback generators (impact / selection). Android uses
// View.performHapticFeedback constants, not the vibrator: they follow the
// phone's own "touch feedback" setting and feel like the rest of the system.
// Only constants from API 23 or older are used (minSdk is 24), so every
// supported phone has them.

export type HapticEvent =
  // Swipe to reply crossed the threshold: letting go now replies.
  | "swipeArmed"
  // Dragged back under the threshold: letting go now cancels.
  | "swipeDisarmed"
  // A double tap started a reply.
  | "doubleTapReply"
  // A long press opened the message sheet.
  | "longPress"
  // A reaction was added or removed.
  | "reactionAdd"
  | "reactionRemove";

export type IosHaptic =
  | { kind: "impact"; style: "light" | "medium" }
  | { kind: "selection" };

export type AndroidHaptic = "context-click" | "clock-tick" | "long-press";

export const HAPTICS: Record<
  HapticEvent,
  { ios: IosHaptic; android: AndroidHaptic }
> = {
  swipeArmed: { ios: { kind: "impact", style: "light" }, android: "context-click" },
  swipeDisarmed: { ios: { kind: "selection" }, android: "clock-tick" },
  doubleTapReply: { ios: { kind: "impact", style: "light" }, android: "context-click" },
  longPress: { ios: { kind: "impact", style: "medium" }, android: "long-press" },
  reactionAdd: { ios: { kind: "selection" }, android: "context-click" },
  reactionRemove: { ios: { kind: "selection" }, android: "clock-tick" },
};

/**
 * The haptic for a change in the swipe's armed state, or none when it did
 * not change. Called from the gesture worklet on every update, so the
 * common case (no change) costs a comparison and no bridge hop.
 */
export function armHaptic(wasArmed: boolean, isArmed: boolean): HapticEvent | null {
  "worklet";
  if (wasArmed === isArmed) {
    return null;
  }
  return isArmed ? "swipeArmed" : "swipeDisarmed";
}
