// Account-deletion hook for the Delete Account screen. Backed by
// `delete_account` (server-side wipe via the DS + local cleanup) and
// `wipe_local_data` (belt-and-suspenders local wipe).
//
// Failure semantics mirror `pollis-core/src/commands/auth.rs`:
//   - `delete_account` errors out BEFORE any local cleanup if the remote
//     (DS) delete fails — the user stays signed in and we surface the error.
//   - Once the remote delete succeeds, core's local cleanup is best-effort;
//     the follow-up `wipe_local_data` here is too. A local-wipe failure must
//     NOT strand the user signed-in to a deleted account, so it is logged
//     and swallowed — the caller always proceeds to sign-out.

import { useMutation, useQuery } from "@tanstack/react-query";
import { useObserver } from "mobx-react-lite";
import { invoke } from "../../lib/native";
import { appStore } from "../../stores/appStore";

// Mirrors `SelfAuditReport` in pollis-core/src/commands/transparency.rs
// (desktop: frontend/src/types SelfAuditReport). `report` is left out: the
// Security screen shows only the verdict.
export type AuditStatus = "ok" | "pending" | "alarm" | "unavailable";

export interface SelfAuditReport {
  status: AuditStatus;
  detail: string;
  my_identity_version: number;
  my_account_id_pub: string;
}

/**
 * The Security screen's account-key check (#330, desktop's
 * useSelfAuditAccountKey): the key the DS holds for this account, compared
 * with what the public transparency log says it is. Advisory only — it never
 * blocks anything.
 */
export function useSelfAuditAccountKey() {
  const currentUser = useObserver(() => appStore.currentUser);
  return useQuery({
    queryKey: ["transparency", "self-audit", currentUser?.id ?? null],
    queryFn: async (): Promise<SelfAuditReport | null> => {
      if (!currentUser) {
        return null;
      }
      return await invoke<SelfAuditReport>("self_audit_account_key", {
        myUserId: currentUser.id,
      });
    },
    enabled: !!currentUser,
    staleTime: 1000 * 60 * 5,
  });
}

export function useDeleteAccount() {
  return useMutation({
    // Tactile feedback (#1286): lib/queryClient.ts plays it.
    meta: { haptic: { success: "destructive" } },
    mutationFn: async (userId: string) => {
      // Remote + primary local wipe. Throws (and aborts) on server failure.
      await invoke("delete_account", { userId });
      try {
        // Sweep any remaining local state (other-account remnants, data dir).
        await invoke("wipe_local_data");
      } catch (e) {
        console.warn("[account] wipe_local_data after delete failed (ignored):", e);
      }
    },
  });
}
