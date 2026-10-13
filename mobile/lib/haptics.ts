import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { HAPTICS, type HapticEvent } from "./hapticEvents";

const ANDROID: Record<string, Haptics.AndroidHaptics> = {
  "context-click": Haptics.AndroidHaptics.Context_Click,
  "clock-tick": Haptics.AndroidHaptics.Clock_Tick,
  "long-press": Haptics.AndroidHaptics.Long_Press,
};

/**
 * Plays the tactile feedback for `event` (#1286; the table is in
 * lib/hapticEvents.ts). Fire-and-forget: feedback is a nicety, so a device
 * without a haptic engine, or any failure, is silent and never blocks the
 * interaction that triggered it.
 */
export function haptic(event: HapticEvent): void {
  const spec = HAPTICS[event];
  let p: Promise<void> | undefined;
  try {
    if (Platform.OS === "android") {
      p = Haptics.performAndroidHapticsAsync(ANDROID[spec.android]);
    } else if (Platform.OS === "ios") {
      p =
        spec.ios.kind === "selection"
          ? Haptics.selectionAsync()
          : Haptics.impactAsync(
              spec.ios.style === "medium"
                ? Haptics.ImpactFeedbackStyle.Medium
                : Haptics.ImpactFeedbackStyle.Light,
            );
    }
  } catch {
    return;
  }
  p?.catch(() => {});
}
