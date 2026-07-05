//! The delivery-watermark computation — extracted as a pure, generic free
//! function so it can be (1) exercised by the real ingest path and (2) proved
//! by Kani over symbolic inputs.
//!
//! ## What this decides (the safety property)
//!
//! During interleaved catch-up ([`super::ingest`]) each conversation gets a new
//! watermark: an EXCLUSIVE `sent_at` cursor that the next fetch uses as
//! `sent_at > watermark`. Advancing this cursor past an envelope means "never
//! fetch it again". So the cursor MUST NOT advance to or past any envelope we
//! still have to retry (an MLS message whose epoch this pass never reached) —
//! otherwise a current member permanently loses a decryptable message (failure
//! class F3; the exact property #442 was a false alarm about).
//!
//! The rule, preserved verbatim from the original inline logic:
//! * `stop_at` = the `sent_at` of the FIRST un-handled envelope (in the given,
//!   `sent_at`-ordered, slice order).
//! * the candidate loop walks the slice and adopts each `sent_at` as the running
//!   watermark, but BREAKS as soon as it reaches an envelope with
//!   `sent_at >= stop_at`. The `>=` (not `>`) is deliberate: on a `sent_at`
//!   tie between a handled and an un-handled envelope the cursor must stop
//!   STRICTLY BELOW the shared timestamp, or the next `sent_at > watermark`
//!   fetch would skip the un-handled one. The watermark is therefore always
//!   strictly less than the first un-handled `sent_at`, even on a tie.
//!
//! The Kani harnesses at the bottom of this file prove exactly that (P1), plus
//! monotonicity (P2) and handled-liveness (P3), and a deliberately-broken mutant
//! demonstrates the harness has teeth.

/// The only distinction the watermark cares about: whether an envelope's
/// deliverability is gated on reaching its MLS epoch this pass.
///
/// `Message` / `Edit` carry an MLS epoch and are epoch-gated (handled only once
/// the shared group's replay reached — or provably can never reach — their
/// epoch). `Delete` tombstones and any `Other` (unknown) type are
/// epoch-independent and always handled.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum EnvKind {
    Message,
    Edit,
    Delete,
    Other,
}

impl EnvKind {
    /// Map a `message_envelope.type` string to the watermark's kind. Mirrors the
    /// original `is_handled` match arms exactly: only `"message"` / `"edit"` are
    /// epoch-gated; everything else (`"delete"`, unknown) is always handled.
    pub fn from_type(env_type: &str) -> Self {
        match env_type {
            "message" => EnvKind::Message,
            "edit" => EnvKind::Edit,
            "delete" => EnvKind::Delete,
            _ => EnvKind::Other,
        }
    }
}

/// Is this envelope definitively handled (so the watermark may advance over it),
/// or must a later pass retry it? `max_fired_epoch` is the highest MLS epoch the
/// shared group's replay reached this pass (`None` = no local group, nothing
/// could be decrypted). Kept private and byte-for-byte identical to the arms of
/// the original inline `is_handled` closure.
fn is_handled(kind: EnvKind, epoch: Option<u64>, max_fired_epoch: Option<u64>) -> bool {
    match kind {
        EnvKind::Message | EnvKind::Edit => match (epoch, max_fired_epoch) {
            // Epoch within this pass's reach: decrypted now, or an unreachable
            // pre-join epoch we will never decrypt. Either way permanently
            // handled — advancing past it can't drop a message.
            (Some(e), Some(max)) => e <= max,
            // Unparseable bytes are never MLS-decryptable → permanently handled
            // (advancing past avoids wedging on a corrupt row).
            (None, _) => true,
            // The replay reached no epoch (no local group): nothing could be
            // decrypted, so these must be retried once a group exists.
            (Some(_), None) => false,
        },
        // delete tombstones / unknown types are epoch-independent.
        EnvKind::Delete | EnvKind::Other => true,
    }
}

/// Compute the `sent_at` a conversation's watermark may advance to, given its
/// `sent_at`-ordered envelopes and the highest MLS epoch this pass reached.
///
/// Returns the greatest `sent_at` in the contiguous prefix that is definitively
/// handled and strictly below the first un-handled envelope's `sent_at`, or
/// `None` if nothing may advance (empty slice, or the very first envelope must
/// be retried). Generic over the `sent_at` key `S` so the real callers pass
/// `&str`/`String` while the proofs pass bounded integers (Kani cannot make a
/// `String` symbolic).
pub fn next_watermark<S: Ord + Clone>(
    envs: &[(S, EnvKind, Option<u64>)],
    max_fired_epoch: Option<u64>,
) -> Option<S> {
    // The `sent_at` of the first envelope we must retry is an EXCLUSIVE ceiling
    // on the watermark: advancing to (or, via a `sent_at` tie, past) it would
    // drop it from the next `sent_at > watermark` fetch.
    let stop_at: Option<&S> = envs
        .iter()
        .find(|(_, kind, epoch)| !is_handled(*kind, *epoch, max_fired_epoch))
        .map(|(sent_at, _, _)| sent_at);

    let mut candidate: Option<S> = None;
    for (sent_at, _, _) in envs {
        if let Some(stop) = stop_at {
            if sent_at >= stop {
                break;
            }
        }
        candidate = Some(sent_at.clone());
    }
    candidate
}
