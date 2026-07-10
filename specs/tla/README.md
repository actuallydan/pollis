# TLA+ specs — machine-checked correctness

Abstract TLA+ models of the Pollis control-plane / delivery invariants, checked
exhaustively by TLC over small configurations. These are the design-level
complement to the Kani proofs on the real Rust pure functions
(`pollis-core/src/commands/messages/watermark.rs`,
`pollis-core/src/commands/mls/invariants.rs`). See
[`docs/machine-checked-correctness-design.md`](../../docs/machine-checked-correctness-design.md)
§3 for the coverage rationale.

## Specs

| File | Spec | Invariants | Status |
|---|---|---|---|
| `Delivery.tla` + `Delivery.cfg` | **Spec B — Delivery / retention** | I3 (`NoLossForCurrentMember`, `CursorMonotone`) + I4 (retention floor) + `AcceptedLossesOnly` | authored + TLC-checked |

Spec A (`CommitLog`, I1/I2 — M4) is not authored yet; this slice is Spec B only.

## Running TLC

Fast, headless, JVM-only. From the repo root:

```bash
scripts/tlc-check.sh            # sound spec — all invariants must PASS
scripts/tlc-check.sh --broken   # teeth — must produce a counterexample
```

The script downloads a pinned `tla2tools.jar` if absent and needs only a JRE
(`java` on `PATH` or `JAVA_HOME`). A third party can re-check the `.tla`/`.cfg`
files with the public [TLA+ tools](https://github.com/tlaplus/tlaplus) — nothing
here is Pollis-specific tooling.

## Delivery (Spec B) at a glance

State: per-key ordered `msgs` (`[epoch, sentAt]`), per-`(key, device)` `cursor`
(the delivery watermark), the current `member` set with per-device `joinEpoch`
and replayed `replay` epoch, `delivered` (decrypted sentAts), and the retention
`gcFloor`. Actions: `Commit` (advance epoch), `Send`, `Join`/`Leave`,
`ReplayCommit`, `Advance` (the watermark step, abstracting `next_watermark`), and
`GC` (raise the retention floor).

Invariants:

- **`NoLossForCurrentMember`** (I3 + I4, anti-F3): retention never removes a
  message a current member-device still needs.
- **`CursorMonotone`**: cursors never regress.
- **`AcceptedLossesOnly`**: a device has decrypted `m` only if continuously
  present since `m`'s epoch — exactly the two accepted losses (pre-join
  messages; a fresh device starts empty), nothing weaker.

**Teeth.** `DeliveryBroken.cfg` flips `SoundGC` to `FALSE`, guarding the
retention floor by the *fastest* member instead of the slowest. TLC then reports
a concrete `NoLossForCurrentMember` counterexample, proving the invariant is not
vacuously true.

**Forward-compat (PQ hybrid MLS).** Everything is keyed by an abstract
`k \in Keys`. The PQ program's `(conversation, generation, epoch)` lineage is
modelled by enlarging `Keys` — a config change, not a spec rewrite
(design doc §3 note).
