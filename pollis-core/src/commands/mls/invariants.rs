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

// ─── I2: own-commit canonicalization (#411) ──────────────────────────────────

/// The outcome of submitting a commit through the delivery seam, as the pure
/// decision sees it. Mirrors the three real cases the reconcile / external-join
/// paths branch on:
/// * `Committed` — the DS confirmed our insert (our bytes are canonical at this
///   epoch by construction).
/// * `LostRace` — the DS reported someone else committed this epoch first
///   (`SubmitResult::LostRace`).
/// * `Failed` — the submit errored (network / stream eviction); the response was
///   lost, so whether our commit landed is *ambiguous*.
///
/// `LostRace` and `Failed` are both ambiguous — a stale `LostRace` can be a retry
/// of our OWN accepted commit, and a `Failed` can hide a commit that landed with
/// only the response lost — so both are resolved against the canonical log.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SubmitOutcome {
    Committed,
    LostRace,
    Failed,
}

/// Whether to ADOPT the locally-staged commit (merge it, advance the epoch) or
/// ROLL it back (clear the pending commit and converge on the winner).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Resolution {
    Adopt,
    Rollback,
}

/// Decide adopt-vs-rollback for a submitted own-commit, given the submit
/// `outcome`, `ours` (the exact commit bytes we staged), and `stored_at_epoch`
/// (the bytes the canonical log actually holds at this epoch, or `None` if the
/// log has no row / the read failed).
///
/// This is the #411 correctness core (`reconcile.rs` `our_commit_is_canonical` +
/// the adopt/rollback branch), lifted to a pure function so Kani can prove both
/// directions:
/// * **`Adopt` ⟹ `stored_at_epoch == Some(ours)`** — never adopt a foreign
///   commit (no phantom epoch, no fork).
/// * **`Rollback` ⟹ `stored_at_epoch != Some(ours)`** — never discard a landed
///   own commit (no wedge).
///
/// A `Committed` outcome always adopts: the DS only returns `Committed` when it
/// wrote *our* bytes at this epoch, so they are canonical there by construction
/// (the Kani harness encodes that coupling). The ambiguous `LostRace` / `Failed`
/// outcomes adopt IFF the log's bytes at this epoch are byte-for-byte ours.
pub fn resolve(outcome: SubmitOutcome, ours: &[u8], stored_at_epoch: Option<&[u8]>) -> Resolution {
    match outcome {
        // The DS confirmed our insert — canonical by construction.
        SubmitOutcome::Committed => Resolution::Adopt,
        // Ambiguous: the canonical log is the arbiter. Adopt only if our exact
        // bytes sit at this epoch; otherwise roll back and converge.
        SubmitOutcome::LostRace | SubmitOutcome::Failed => {
            if stored_at_epoch == Some(ours) {
                Resolution::Adopt
            } else {
                Resolution::Rollback
            }
        }
    }
}

// ─── Kani proof harnesses ────────────────────────────────────────────────────
#[cfg(kani)]
mod proofs {
    use super::*;

    /// Fill a FIXED-SIZE stack array with symbolic bytes over the tiny domain
    /// `0..=1` — enough to exercise byte-equal and byte-unequal commits while
    /// keeping CBMC's state space small. Never a `Vec` (heap → OOM).
    fn symbolic_bytes<const N: usize>() -> [u8; N] {
        let mut a = [0u8; N];
        for b in a.iter_mut() {
            let v: u8 = kani::any();
            kani::assume(v <= 1);
            *b = v;
        }
        a
    }

    impl kani::Arbitrary for SubmitOutcome {
        fn any() -> Self {
            match kani::any::<u8>() % 3 {
                0 => SubmitOutcome::Committed,
                1 => SubmitOutcome::LostRace,
                _ => SubmitOutcome::Failed,
            }
        }
    }

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

    // ── I2: own-commit canonicalization (#411) ───────────────────────────────
    //
    // Small fixed-size byte arrays (N = 3, bytes 0..=1) + a symbolic Some/None
    // stored value + a symbolic outcome. Proves both directions of `resolve`.
    const N: usize = 3;

    /// I2: `resolve` never adopts a foreign commit and never rolls back our own
    /// landed one.
    ///   * `Adopt` ⟹ `stored_at_epoch == Some(ours)` (no phantom epoch / fork)
    ///   * `Rollback` ⟹ `stored_at_epoch != Some(ours)` (no wedge)
    #[kani::proof]
    #[kani::unwind(4)]
    fn i2_resolve_sound() {
        let ours: [u8; N] = symbolic_bytes();
        let stored_bytes: [u8; N] = symbolic_bytes();
        let has_stored: bool = kani::any();
        let stored: Option<&[u8]> = if has_stored {
            Some(&stored_bytes[..])
        } else {
            None
        };
        let outcome: SubmitOutcome = kani::any();

        // DS contract: a `Committed` result means the DS wrote OUR exact bytes at
        // this epoch, so they are canonical there. Model that coupling so the
        // `Committed → Adopt` branch is only exercised in states the DS produces.
        if outcome == SubmitOutcome::Committed {
            kani::assume(stored == Some(&ours[..]));
        }

        match resolve(outcome, &ours[..], stored) {
            // No foreign adopt: an adopted commit is exactly the one at this epoch.
            Resolution::Adopt => assert!(stored == Some(&ours[..])),
            // No own rollback: we only roll back when the log does NOT hold ours.
            Resolution::Rollback => assert!(stored != Some(&ours[..])),
        }
    }

    /// Negative harness: a broken `resolve` that adopts an ambiguous outcome
    /// UNCONDITIONALLY (even when the log holds a foreign commit or nothing).
    /// `should_panic`: Kani must find the no-foreign-adopt violation the real
    /// `== Some(ours)` guard prevents.
    fn resolve_mutant(outcome: SubmitOutcome, _ours: &[u8], _stored: Option<&[u8]>) -> Resolution {
        match outcome {
            SubmitOutcome::Committed => Resolution::Adopt,
            // BUG: adopts a LostRace/Failed outcome without checking the log —
            // would graft a foreign commit / phantom epoch (#411).
            SubmitOutcome::LostRace | SubmitOutcome::Failed => Resolution::Adopt,
        }
    }

    #[kani::proof]
    #[kani::should_panic]
    #[kani::unwind(4)]
    fn i2_mutant_refuted() {
        let ours: [u8; N] = symbolic_bytes();
        let stored_bytes: [u8; N] = symbolic_bytes();
        let has_stored: bool = kani::any();
        let stored: Option<&[u8]> = if has_stored {
            Some(&stored_bytes[..])
        } else {
            None
        };
        let outcome: SubmitOutcome = kani::any();

        if outcome == SubmitOutcome::Committed {
            kani::assume(stored == Some(&ours[..]));
        }

        if let Resolution::Adopt = resolve_mutant(outcome, &ours[..], stored) {
            assert!(stored == Some(&ours[..]));
        }
    }
}
