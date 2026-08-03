//! Server-side attachment reference counting (#690, resolving the second
//! `TODO(#419)`).
//!
//! Attachments are convergently encrypted and deduped by `content_hash`: one
//! `attachment_object` row and one R2 blob back EVERY message that carries the
//! same file, across conversations and users. The old delete was unconditional —
//! deleting one referencing message removed the shared row (and R2 object) out
//! from under every other, 404'ing their attachment. These tests pin the fix:
//!
//!   * `stranding_cannot_happen` — two conversations reference one hash; deleting
//!     the first message keeps the object alive for the second, and only the
//!     second's delete collects it. **This FAILS against the pre-change code**
//!     (`apply_delete_attachment` used to `DELETE FROM attachment_object WHERE
//!     content_hash = ?` unconditionally, so the row vanished on the first
//!     delete) — see the assertion after the first delete.
//!   * `r2_presign_delete_is_refused_while_referenced` — the R2 chokepoint: the
//!     real `/v1/r2/presign` handler refuses to mint a `delete` for an object
//!     that still has a reference, and mints one once the last reference is gone.
//!   * plus the legacy/backfill and idempotency edges.
//!
//! Driven against a local libsql DB exactly as the DS runs, mirroring
//! `envelope_retention.rs` (apply-fn level) and `auth.rs` (real router via
//! `tower::oneshot`).

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt as _;
use pollis_delivery::db::Db;
use pollis_delivery::messages::{
    apply_delete_attachment, apply_register_attachment, object_is_referenced,
    AttachmentDeleteBody, AttachmentRegisterBody,
};
use pollis_delivery::writes::WriteOutcome;
use pollis_delivery::{build_router_with_state, AppState};
use std::sync::Arc;
use tower::ServiceExt as _;

const SCHEMA: &str = "\
CREATE TABLE attachment_object (\
  content_hash TEXT PRIMARY KEY, r2_key TEXT NOT NULL, \
  created_at TEXT NOT NULL DEFAULT (datetime('now')));\
CREATE TABLE attachment_ref (\
  content_hash TEXT NOT NULL, message_id TEXT NOT NULL, \
  created_at TEXT NOT NULL DEFAULT (datetime('now')), \
  PRIMARY KEY (content_hash, message_id));";

async fn fresh() -> Arc<Db> {
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("db.db");
    std::mem::forget(dir);
    let db = Db::connect_local(path.to_str().unwrap()).await.expect("local db");
    db.conn().unwrap().execute_batch(SCHEMA).await.expect("schema");
    Arc::new(db)
}

/// Register attachment `hash` (at R2 key `key`) as referenced by message `msg`.
async fn register_ref(db: &Db, hash: &str, key: &str, msg: &str) {
    let body = AttachmentRegisterBody {
        content_hash: hash.into(),
        r2_key: key.into(),
        message_id: Some(msg.into()),
    };
    let out = apply_register_attachment(&db.conn().unwrap(), Some("u1"), &body)
        .await
        .unwrap();
    assert!(matches!(out, WriteOutcome::Ok));
}

/// Release message `msg`'s reference to attachment `hash` (the message-delete
/// path), then let the DS conditionally collect the shared object.
async fn release_ref(db: &Db, hash: &str, msg: &str) {
    let body = AttachmentDeleteBody {
        content_hash: hash.into(),
        message_id: Some(msg.into()),
    };
    let out = apply_delete_attachment(&db.conn().unwrap(), Some("u1"), &body)
        .await
        .unwrap();
    assert!(matches!(out, WriteOutcome::Ok));
}

async fn object_exists(db: &Db, hash: &str) -> bool {
    let conn = db.conn().unwrap();
    let mut rows = conn
        .query(
            "SELECT 1 FROM attachment_object WHERE content_hash = ?1",
            libsql::params![hash.to_string()],
        )
        .await
        .unwrap();
    rows.next().await.unwrap().is_some()
}

async fn ref_count(db: &Db, hash: &str) -> i64 {
    let conn = db.conn().unwrap();
    let mut rows = conn
        .query(
            "SELECT COUNT(*) FROM attachment_ref WHERE content_hash = ?1",
            libsql::params![hash.to_string()],
        )
        .await
        .unwrap();
    rows.next().await.unwrap().unwrap().get::<i64>(0).unwrap()
}

// ── The stranding invariant ───────────────────────────────────────────────────

/// Two conversations reference the same convergent file. Deleting the first's
/// message must NOT collect the shared object; only deleting the last reference
/// does. This is the Definition-of-Done scenario.
///
/// **Fails against the pre-change code.** The old `apply_delete_attachment` ran
/// `DELETE FROM attachment_object WHERE content_hash = ?` with no predicate, so
/// the assertion "the object survives the first delete" (`object_exists` == true
/// below) was false — the row was gone and conversation Q's attachment 404'd.
#[tokio::test]
async fn stranding_cannot_happen() {
    let db = fresh().await;
    let hash = "hhhh";
    let key = "media/hhhh/pic.enc";

    // Conversation P's message m_p and conversation Q's message m_q both carry
    // the same file. The object row exists once; the reference count is two.
    register_ref(&db, hash, key, "m_p").await;
    register_ref(&db, hash, key, "m_q").await;
    assert!(object_exists(&db, hash).await, "object must exist after registration");
    assert_eq!(ref_count(&db, hash).await, 2, "both messages reference the hash");

    // Conversation P deletes its message. The reference is released, but the
    // shared object must SURVIVE — conversation Q still references it.
    release_ref(&db, hash, "m_p").await;
    assert_eq!(ref_count(&db, hash).await, 1, "only m_q's reference remains");
    assert!(
        object_exists(&db, hash).await,
        "the shared attachment_object must survive while conversation Q still \
         references it — the old UNCONDITIONAL delete removed it here, stranding Q \
         (this is the assertion that fails against the pre-change code, #690)"
    );
    assert!(
        object_is_referenced(&db.conn().unwrap(), hash).await.unwrap(),
        "the object is still referenced, so the R2 delete-presign gate must refuse"
    );

    // Conversation Q now deletes its message — the last reference. The object is
    // collected, and the R2 gate opens.
    release_ref(&db, hash, "m_q").await;
    assert_eq!(ref_count(&db, hash).await, 0, "no references remain");
    assert!(
        !object_exists(&db, hash).await,
        "with the last reference gone the object must be collected"
    );
    assert!(
        !object_is_referenced(&db.conn().unwrap(), hash).await.unwrap(),
        "no references remain, so the R2 delete-presign gate must now permit the delete"
    );
}

/// Registration is idempotent: a retried send (same `content_hash`, same
/// `message_id`) must not double-count, or a single delete could never bring the
/// count to zero.
#[tokio::test]
async fn registration_is_idempotent() {
    let db = fresh().await;
    register_ref(&db, "h", "media/h/f.enc", "m1").await;
    register_ref(&db, "h", "media/h/f.enc", "m1").await;
    assert_eq!(ref_count(&db, "h").await, 1, "a retried send must not double-count");

    release_ref(&db, "h", "m1").await;
    assert!(!object_exists(&db, "h").await, "one release must clear the idempotent ref");
}

/// A pre-#690 client sends no `message_id` on delete. It releases nothing, but
/// the collect is STILL conditional — so it can no longer strand a hash a newer
/// client referenced. A legacy zero-reference object it deletes is collected
/// exactly as before (no worse than today).
#[tokio::test]
async fn old_client_delete_cannot_strand_a_referenced_object() {
    let db = fresh().await;
    // A newer client referenced this hash for its message.
    register_ref(&db, "h", "media/h/f.enc", "m_new").await;

    // An old client (no message_id) tries to delete the object unconditionally.
    let out = apply_delete_attachment(
        &db.conn().unwrap(),
        Some("u2"),
        &AttachmentDeleteBody { content_hash: "h".into(), message_id: None },
    )
    .await
    .unwrap();
    assert!(matches!(out, WriteOutcome::Ok));
    assert!(
        object_exists(&db, "h").await,
        "an old client's message_id-less delete must NOT collect an object a newer \
         client still references — the conditional predicate protects it (#690)"
    );

    // A legacy object with no references at all is collectable, as before.
    db.conn()
        .unwrap()
        .execute(
            "INSERT INTO attachment_object (content_hash, r2_key) VALUES ('legacy', 'media/legacy/f.enc')",
            (),
        )
        .await
        .unwrap();
    apply_delete_attachment(
        &db.conn().unwrap(),
        Some("u2"),
        &AttachmentDeleteBody { content_hash: "legacy".into(), message_id: None },
    )
    .await
    .unwrap();
    assert!(
        !object_exists(&db, "legacy").await,
        "a zero-reference legacy row stays collectable — no worse than today"
    );
}

// ── The R2 presign delete gate (through the real router) ──────────────────────

/// An R2 config whose secrets are present so `broker.r2_ready()` is `Some` and
/// the presign handler proceeds to the reference gate. The signature these mint
/// is never used — the test only asserts the gate's allow/refuse decision.
fn r2_broker() -> pollis_delivery::broker::BrokerConfig {
    pollis_delivery::broker::BrokerConfig {
        r2_endpoint: Some("https://acct.r2.cloudflarestorage.com".into()),
        r2_region: "auto".into(),
        r2_bucket: Some("pollis-media".into()),
        r2_access_key_id: Some("AKIAEXAMPLE".into()),
        r2_secret_access_key: Some("secret-do-not-log".into()),
        ..Default::default()
    }
}

async fn presign_delete(router: &axum::Router, key: &str) -> StatusCode {
    let body = serde_json::json!({ "operation": "delete", "key": key, "user_id": "u1" });
    let req = Request::builder()
        .method("POST")
        .uri("/v1/r2/presign")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();
    router.clone().oneshot(req).await.unwrap().status()
}

/// The R2 chokepoint: the DS must refuse to mint a `delete` presign for an object
/// that still has a reference, and mint one once the last reference is released.
/// A refcount that protects the Turso row but lets the client blow away the R2
/// object is not a fix (#690).
#[tokio::test]
async fn r2_presign_delete_is_refused_while_referenced() {
    let db = fresh().await;
    let key = "media/hhhh/pic.enc";
    register_ref(&db, "hhhh", key, "m_p").await;
    register_ref(&db, "hhhh", key, "m_q").await;

    // Auth OFF (no signing needed); broker configured so the handler reaches the
    // gate rather than 503'ing.
    let state = AppState::new(Arc::clone(&db), false).with_broker_config(r2_broker());
    let router = build_router_with_state(state);

    assert_eq!(
        presign_delete(&router, key).await,
        StatusCode::FORBIDDEN,
        "a delete presign must be REFUSED while a reference remains"
    );

    // Release one of the two references — one still remains, still refused.
    release_ref(&db, "hhhh", "m_p").await;
    assert_eq!(
        presign_delete(&router, key).await,
        StatusCode::FORBIDDEN,
        "still refused while conversation Q's reference remains"
    );

    // Release the last reference — the object is now collectable, gate opens.
    release_ref(&db, "hhhh", "m_q").await;
    assert_eq!(
        presign_delete(&router, key).await,
        StatusCode::OK,
        "with no reference left the delete presign must be minted"
    );
}

/// A non-media key (no `media/<hash>/…` shape) carries no reference-counted
/// object, so the delete gate passes it through — avatar/icon cleanup must keep
/// working.
#[tokio::test]
async fn r2_presign_delete_passes_non_media_keys() {
    let db = fresh().await;
    let state = AppState::new(Arc::clone(&db), false).with_broker_config(r2_broker());
    let router = build_router_with_state(state);
    assert_eq!(
        presign_delete(&router, "avatars/u1/pic.png").await,
        StatusCode::OK,
        "a non-media key has no reference to consult and must pass the gate"
    );
}

/// `get`/`put` are never reference-gated — only the shared-object integrity of
/// `delete` is. A referenced object must still be freely fetchable/uploadable.
#[tokio::test]
async fn r2_presign_get_and_put_are_not_gated() {
    let db = fresh().await;
    let key = "media/hhhh/pic.enc";
    register_ref(&db, "hhhh", key, "m_p").await;
    let state = AppState::new(Arc::clone(&db), false).with_broker_config(r2_broker());
    let router = build_router_with_state(state);

    for op in ["get", "put"] {
        let body = serde_json::json!({ "operation": op, "key": key, "user_id": "u1" });
        let req = Request::builder()
            .method("POST")
            .uri("/v1/r2/presign")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&body).unwrap()))
            .unwrap();
        let resp = router.clone().oneshot(req).await.unwrap();
        assert_eq!(
            resp.status(),
            StatusCode::OK,
            "{op} must not be reference-gated even while the object is referenced"
        );
        // Sanity: the body carries a presigned URL.
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert!(json.get("url").and_then(|u| u.as_str()).is_some(), "presign returns a url");
    }
}
