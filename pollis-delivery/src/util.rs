//! Tiny crate-wide primitives that have no better home.
//!
//! Until #875 the DS carried six copies of the wall-clock helper below —
//! `auth`, `bootstrap`, `broker`, `email_change`, `otp` and `ratelimit` each had
//! their own — in two different return types. Identical copies are cheap right
//! up until one of them is edited.

/// Current wall-clock time, whole seconds since the Unix epoch.
///
/// A clock behind the epoch reads as `0` rather than panicking: every caller
/// uses this for TTLs, lockouts and rate-limit stamps, where "a very old
/// timestamp" degrades gracefully and a panic takes the DS down.
///
/// Returns `u64` because a Unix second is not negative. [`crate::auth`] casts at
/// its boundary — request-signature skew is compared against a *client*-supplied
/// timestamp, so that arithmetic has to be signed or a client ahead of the
/// server wraps into "valid".
pub fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
