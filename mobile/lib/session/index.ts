// The one place a mobile session ends (#1256). Sign-out, account deletion
// and the forced sign-out of a revoked device all route through
// `endSession()`, so whatever a session leaves behind on the device is
// cleaned up in one spot rather than at each call site.

import { appStore } from "../../stores/appStore";
import { clearMediaCache } from "../media/cache";
import { tearDownSession } from "./teardown";

export function endSession(): Promise<void> {
  return tearDownSession({
    resetStore: appStore.logout,
    clearMediaCache,
  });
}
