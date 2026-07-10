//! `ReplicaPool` — per-conversation local-first replicas (issue #261, phases 3–4).
//!
//! **STATUS: skeleton.** Trait + type shapes and the design are settled here; the
//! method bodies are `todo!()` markers for the phase-3 implementation. Nothing in
//! this module is wired into `AppState` or the command path yet, so it is
//! `#![allow(dead_code)]`. Bringing it live is gated on adding the libSQL
//! `replication` feature (see `LibsqlReplicaEngine`) and the DS-side per-conversation
//! provisioning + `conversation_shard` state machine (spec addendum on #261).
//!
//! ## What this is
//!
//! Once each group/DM gets its own remote Turso DB, the client opens a **local
//! replica per conversation** and reads it at microsecond latency, syncing on
//! demand. This pool is the single owner of those replicas and the single
//! chokepoint that resolves a `conversation_id` to a read connection —
//! `conv_db(conversation_id)` in the spec. No conversation-scoped table is read
//! anywhere except through [`ReplicaPool::conn`].
//!
//! ## Engine choice (spike, 2026-07-09/10)
//!
//! Default to **libSQL embedded replicas** (the `libsql` crate we already ship;
//! GA/production). The newer Turso Sync (`turso` crate, CDC) is a *second*
//! [`ReplicaEngine`] impl added later, once it reaches GA — the trait exists so the
//! engine is swappable. Reasons: `turso` is still pre-1.0 beta; and Pollis replicas
//! are **read-mostly** (client writes go through the DS), so Turso Sync's write-side
//! bandwidth wins largely don't apply. The fd-cost prototype cleared the one blocker:
//! ~4 fds/replica, fully released on close, zero leak over 300 churn cycles → ~130
//! fds at the 30-open cap.
//!
//! ## Invariants the pool enforces (not the engine)
//!
//! - **LRU cap (~30 open).** fd/memory budget (#244). Lazy-open on first access,
//!   `close()` on eviction (keeps the local file for a warm re-open).
//! - **Serialize sync-vs-read per replica.** libSQL must not read a replica
//!   mid-sync; the per-replica lock makes that unrepresentable.
//! - **Read-only.** Writes go client → DS → shard, never through a replica — so
//!   there is deliberately **no `push`** in [`ReplicaEngine`].
//! - **Token refresh.** Per-DB tokens are read-only + time-bounded, and rotation is
//!   coarse (rotating a DB invalidates *all* its tokens — the member-removal
//!   primitive). On a 401 the pool re-mints via the [`TokenProvider`] and calls
//!   `refresh_token` without tearing the replica down.
//! - **Corrupt/wedged ⇒ `purge()` + reseed.** Safe because the shard is the source
//!   of truth and decrypted plaintext lives in the local SQLCipher `message` table,
//!   which replicas never touch (spec §A).
//!
//! ## Why generic over the engine, not `dyn`
//!
//! [`ReplicaEngine::Conn`] is an associated type (each engine yields its native
//! connection), which is not `dyn`-compatible. We don't need *runtime* engine
//! swapping — one engine is chosen per build — so [`ReplicaPool`] is generic
//! (`ReplicaPool<E>`), giving compile-time swap with no boxing of the hot read conn.

#![allow(dead_code)]

use std::num::NonZeroUsize;
use std::path::PathBuf;
use std::sync::Arc;

use async_trait::async_trait;
use lru::LruCache;
use tokio::sync::Mutex;

/// Stable identifier for one conversation's remote DB + local replica. It is the
/// `conversation_id` (group id or dm_channel id); the pool maps it to a shard DB
/// name + URL via the [`ShardResolver`].
#[derive(Clone, PartialEq, Eq, Hash, Debug)]
pub struct ReplicaId(pub String);

impl std::fmt::Display for ReplicaId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// Everything needed to open/attach one replica's local file to its remote primary.
#[derive(Clone, Debug)]
pub struct ReplicaConfig {
    /// Remote Turso primary for this conversation's shard (`libsql://…`).
    pub remote_url: String,
    /// Local replica file (`<replica_dir>/<conversation_id>.db`).
    pub local_path: PathBuf,
    /// Per-DB, **read-only**, time-bounded token minted by the DS.
    pub token: String,
}

/// What a `sync()` moved — surfaced for egress metering (Turso bills embedded-sync
/// bandwidth) and for deciding sync cadence.
#[derive(Clone, Copy, Debug, Default)]
pub struct SyncStats {
    pub frames: u64,
    pub bytes: u64,
}

#[derive(thiserror::Error, Debug)]
pub enum ReplicaError {
    #[error("open replica {0}: {1}")]
    Open(ReplicaId, String),
    #[error("sync replica {0}: {1}")]
    Sync(ReplicaId, String),
    #[error("connect replica {0}: {1}")]
    Conn(ReplicaId, String),
    /// The per-DB token was rejected (expired or rotated on member removal). The
    /// pool catches this, re-mints via the [`TokenProvider`], and retries once.
    #[error("unauthorized on replica {0} — token expired or rotated")]
    Unauthorized(ReplicaId),
    /// The caller is not (or is no longer) a member — the DS refused to mint a
    /// token for this conversation. Terminal: do not retry.
    #[error("forbidden — not a member of conversation {0}")]
    Forbidden(ReplicaId),
    #[error("resolve shard for {0}: {1}")]
    Resolve(ReplicaId, String),
    #[error("replica io: {0}")]
    Io(#[from] std::io::Error),
}

/// Mints per-conversation **read-only, time-bounded** Turso tokens through the DS
/// (`POST /v1/turso/token { conversation_id }`, member-gated — same `is_member`
/// authz as the LiveKit token endpoint). Extends the existing single-token path
/// (`commands::mls::ds_client::ds_turso_token`, which posts an empty body) with the
/// `conversation_id` scope. Returns `(token, ttl_secs)`.
#[async_trait]
pub trait TokenProvider: Send + Sync {
    async fn token_for(&self, conversation_id: &str) -> Result<(String, u64), ReplicaError>;
}

/// Resolves a `conversation_id` to its shard DB URL by reading the directory DB's
/// `conversation_shard(conversation_id, db_name, status)` table (spec addendum §B).
/// Returns `None` while a conversation has no shard row yet (pre-split — the caller
/// falls back to the shared DB), or the shard URL once it is `dual`/`primary`.
#[async_trait]
pub trait ShardResolver: Send + Sync {
    async fn shard_url(&self, conversation_id: &str) -> Result<Option<String>, ReplicaError>;
}

/// One swappable sync engine. The pool owns the LRU + the sync-vs-read
/// serialization (engine-independent invariants); the engine owns the bytes on
/// disk and the transport. **No `push`** — replicas are read-only for Pollis.
#[async_trait]
pub trait ReplicaEngine: Send + Sync {
    /// Native read connection type (libSQL: `libsql::Connection`).
    type Conn: Send;

    /// Open/attach the local replica, creating + bootstrapping the file if absent.
    /// Does not sync — the caller decides when to pull.
    async fn open(&self, id: &ReplicaId, cfg: &ReplicaConfig) -> Result<(), ReplicaError>;

    /// Pull remote changes into the local file. MUST resume after an interrupted
    /// stream (durable frame_no / logical-log offset), never full-nuke unless
    /// [`purge`](Self::purge) is called. Returns moved volume for metering.
    async fn sync(&self, id: &ReplicaId) -> Result<SyncStats, ReplicaError>;

    /// Borrow a read connection to the local file. SELECT-only for Pollis.
    async fn conn(&self, id: &ReplicaId) -> Result<Self::Conn, ReplicaError>;

    /// Swap the auth token in place without tearing the replica down (libSQL:
    /// reopen the handle; Turso: the token-closure). Called after a re-mint.
    async fn refresh_token(&self, id: &ReplicaId, token: String) -> Result<(), ReplicaError>;

    /// Flush + release fds/memory on LRU eviction. Keeps the local file for a warm
    /// re-open.
    async fn close(&self, id: &ReplicaId) -> Result<(), ReplicaError>;

    /// Delete the local replica file (leave-conversation, or corruption reset —
    /// then a fresh `open` + `sync` reseeds from the primary).
    async fn purge(&self, id: &ReplicaId) -> Result<(), ReplicaError>;
}

/// The default engine: libSQL embedded replicas (`Builder::new_remote_replica`).
///
/// TODO(phase 3): bringing the bodies live requires the libSQL **`replication`**
/// feature (`pollis-core/Cargo.toml`: `libsql = { version = "0.9", features =
/// ["remote", "replication"] }`) — the current build ships `["remote"]` only, so
/// `new_remote_replica` isn't compiled in yet. The fd-cost prototype validated this
/// path end-to-end at N=30.
pub struct LibsqlReplicaEngine {
    /// Open `libsql::Database` handles keyed by replica. (Phase 3.)
    // open: Mutex<HashMap<ReplicaId, libsql::Database>>,
    _priv: (),
}

impl LibsqlReplicaEngine {
    pub fn new() -> Self {
        Self { _priv: () }
    }
}

impl Default for LibsqlReplicaEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ReplicaEngine for LibsqlReplicaEngine {
    type Conn = libsql::Connection;

    async fn open(&self, _id: &ReplicaId, _cfg: &ReplicaConfig) -> Result<(), ReplicaError> {
        // Builder::new_remote_replica(cfg.local_path, cfg.remote_url, cfg.token)
        //   .build().await → store the Database handle. WAL + busy_timeout like
        //   RemoteDb::connect_local. (needs the "replication" feature)
        todo!("phase 3: open libSQL embedded replica")
    }

    async fn sync(&self, _id: &ReplicaId) -> Result<SyncStats, ReplicaError> {
        // db.sync().await → map libsql::Replicated { frames_synced, frame_no } to
        // SyncStats. Map an auth failure to ReplicaError::Unauthorized so the pool
        // re-mints. Handle the stream-tear-down case (RemoteDb::reconnect motivation,
        // #247) — resume, don't nuke.
        todo!("phase 3: sync libSQL embedded replica")
    }

    async fn conn(&self, _id: &ReplicaId) -> Result<Self::Conn, ReplicaError> {
        // db.connect(); PRAGMA query_only=ON (read-only, mirrors RemoteDb's view).
        todo!("phase 3: connect to libSQL embedded replica")
    }

    async fn refresh_token(&self, _id: &ReplicaId, _token: String) -> Result<(), ReplicaError> {
        // libSQL has no in-place token swap → rebuild the Database handle on the
        // same local file with the new token (cheap; the file is already synced).
        todo!("phase 3: rebuild replica handle with refreshed token")
    }

    async fn close(&self, _id: &ReplicaId) -> Result<(), ReplicaError> {
        // Drop the Database handle → releases fds (prototype: ~4/replica, clean).
        todo!("phase 3: close/evict libSQL embedded replica")
    }

    async fn purge(&self, _id: &ReplicaId) -> Result<(), ReplicaError> {
        // close(), then remove the local file (+ -wal/-shm). Reuse the local.rs
        // wipe pattern.
        todo!("phase 3: purge libSQL embedded replica file")
    }
}

/// Per-resident bookkeeping. The `lock` serializes sync-vs-read for one replica so
/// a read never observes a half-applied sync (libSQL corruption guard).
struct Resident {
    lock: Arc<Mutex<()>>,
    last_sync: Option<SyncStats>,
}

/// The engine-agnostic front door. Holds the ~30-open LRU, mints/refreshes
/// per-conversation tokens, and resolves shards. Every conversation-scoped read
/// enters through [`Self::conn`].
pub struct ReplicaPool<E: ReplicaEngine> {
    engine: E,
    tokens: Arc<dyn TokenProvider>,
    shards: Arc<dyn ShardResolver>,
    /// LRU of resident replicas; over `cap`, the evicted id gets `engine.close()`.
    resident: Mutex<LruCache<ReplicaId, Resident>>,
    /// Where replica files live (`<data_dir>/replicas/`).
    replica_dir: PathBuf,
}

impl<E: ReplicaEngine> ReplicaPool<E> {
    /// `cap` is the max simultaneously-open replicas (~30 — fd budget, #244).
    pub fn new(
        engine: E,
        tokens: Arc<dyn TokenProvider>,
        shards: Arc<dyn ShardResolver>,
        replica_dir: PathBuf,
        cap: usize,
    ) -> Self {
        let cap = NonZeroUsize::new(cap.max(1)).expect("cap >= 1");
        Self {
            engine,
            tokens,
            shards,
            resident: Mutex::new(LruCache::new(cap)),
            replica_dir,
        }
    }

    /// **The chokepoint.** Resolve a conversation to a read connection on its local
    /// replica: lazy-open + first-sync if not resident, LRU-touch, serialize against
    /// an in-flight sync, and re-mint + retry once on a 401. Returns `Ok(None)` when
    /// the conversation has no shard yet (pre-split — caller reads the shared DB).
    pub async fn conn(&self, conversation_id: &str) -> Result<Option<E::Conn>, ReplicaError> {
        // 1. shards.shard_url(id)? → None ⇒ return Ok(None) (shared-DB fallback).
        // 2. ensure_resident(id, url): if absent, mint token, engine.open, engine.sync,
        //    insert into LRU (evicting + engine.close the LRU victim if over cap).
        // 3. take the resident lock, engine.conn(id). On Unauthorized: tokens.token_for,
        //    engine.refresh_token, retry once.
        let _ = (conversation_id, &self.engine, &self.tokens, &self.shards, &self.replica_dir, &self.resident);
        todo!("phase 3: lazy-open + LRU + serialize + token-retry")
    }

    /// Nudge/focus-driven sync of one resident replica (event-driven only — no
    /// periodic polling, per repo rule). No-op if the conversation isn't resident.
    pub async fn sync(&self, conversation_id: &str) -> Result<SyncStats, ReplicaError> {
        let _ = conversation_id;
        todo!("phase 3: serialized sync of a resident replica")
    }

    /// Drop the local replica (leave-conversation / corruption reset).
    pub async fn purge(&self, conversation_id: &str) -> Result<(), ReplicaError> {
        let _ = conversation_id;
        todo!("phase 3: evict + purge")
    }

    /// Close every resident replica (logout). Keeps the files.
    pub async fn evict_all(&self) -> Result<(), ReplicaError> {
        todo!("phase 3: close all resident replicas")
    }
}
