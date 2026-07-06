//! Load-bearing MLS control-plane decisions, extracted as small **pure**
//! functions so they can be (1) called by the real runtime paths and (2) proved
//! exhaustively by Kani over symbolic inputs.
//!
//! This is the M2 tranche of the machine-checked-correctness program
//! (`docs/machine-checked-correctness-design.md` §4.2–§4.4):
//!
//! * [`may_rejoin`] — I5, the recovery gate (§4.4): a revoked *or* removed device
//!   never takes an external-join recovery path back into the tree.
//! * [`resolve`] — I2, own-commit canonicalization (§4.3, the #411 property): the
//!   adopt-vs-rollback decision never adopts a foreign commit and never rolls
//!   back our own landed commit.
//! * [`classify`] — I1, client-side gap detection (§4.2): replay never `Apply`s a
//!   commit across an epoch gap.
//!
//! The DS-side head arithmetic (I1's `MAX(epoch)+1`) is proved in
//! `pollis-delivery::commit` (a pure `head_epoch_of` + its own Kani harness),
//! since that code lives in the Delivery Service crate.
//!
//! ## Kani discipline (learned in M1 — see `messages/watermark.rs`)
//!
//! CBMC models heap allocation (`Vec`, `String`) at ruinous memory cost and OOMs
//! a small box. Every harness here therefore uses FIXED-SIZE stack arrays
//! `[T; N]` + a symbolic valid length, keeps symbolic domains tiny (bytes/epochs
//! in `0..=3`), bounds loops with `#[kani::unwind(N)]`, and uses
//! `#[kani::should_panic]` for the negative (mutant) harnesses.

// ─── I5: recovery gate ───────────────────────────────────────────────────────

/// Both cooperative gates on the external-join *recovery* paths, as a pure
/// predicate: this device is still `registered` (not revoked) AND its user
/// `is_member` of the group. A `false` from either means "do not rebuild/rejoin".
///
/// This is the exact `local_device_registered ∧ local_user_is_member` conjunction
/// that `group_state::may_rejoin_via_external_join` gates recovery on. Lifting it
/// to a free function lets Kani prove the whole (2-bit) truth table: the only
/// input that admits a rejoin is `(true, true)`. A revoked or removed device can
/// never climb back into the tree — the membership / forward-secrecy leak of
/// fuzzer-finding #2, proved impossible.
pub fn may_rejoin(registered: bool, is_member: bool) -> bool {
    registered && is_member
}

// ─── Kani proof harnesses ────────────────────────────────────────────────────
#[cfg(kani)]
mod proofs {
    use super::*;

    /// I5: a revoked (`!registered`) OR removed (`!is_member`) device NEVER
    /// rejoins — the exhaustive 2-bit truth table. `registered`/`is_member` are
    /// `bool`, so `kani::any()` covers all four combinations with no unwind.
    #[kani::proof]
    fn i5_gate_never_leaks() {
        let registered: bool = kani::any();
        let is_member: bool = kani::any();

        let allowed = may_rejoin(registered, is_member);

        // Rejoin is permitted ONLY when both gates pass. Equivalently: a device
        // that is either revoked or removed can never rejoin.
        if !registered || !is_member {
            assert!(!allowed);
        }
        // And the converse — the sole admitting input is (true, true) — so a
        // permitted rejoin proves both gates held.
        if allowed {
            assert!(registered && is_member);
        }
    }

    /// Negative harness: a deliberately-broken gate that uses OR instead of AND
    /// (fail-open) lets a removed-but-registered device rejoin. `should_panic`:
    /// this PASSES exactly when Kani finds the leak the real `&&` avoids — a green
    /// run certifies the harness has teeth.
    fn may_rejoin_mutant(registered: bool, is_member: bool) -> bool {
        // BUG: OR fails open — a removed member (is_member = false) but still
        // registered device would rejoin the tree.
        registered || is_member
    }

    #[kani::proof]
    #[kani::should_panic]
    fn i5_mutant_refuted() {
        let registered: bool = kani::any();
        let is_member: bool = kani::any();

        let allowed = may_rejoin_mutant(registered, is_member);

        if !registered || !is_member {
            assert!(!allowed);
        }
    }
}
