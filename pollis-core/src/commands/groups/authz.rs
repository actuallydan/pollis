//! One group-membership preflight, used by every group-scoped command.
//!
//! Before #875 this check was copied fourteen times across `groups/*.rs` and
//! `messages/edit_delete.rs`. The copies had drifted into four different
//! answers for the *same* condition — "you are not a member of this group",
//! "requester is not a group member", "user is not a member of this group", and
//! two sites that returned `Ok(Vec::new())`, so a caller could not tell "you may
//! not see this" from "there is nothing here". That last one is the reason this
//! module exists: an authorization outcome that is indistinguishable from an
//! empty result is not a message, it is a silence.
//!
//! ## What this layer is and is not
//!
//! It is a **client-side preflight**: it turns a doomed round-trip into a clear
//! local error and lets the UI render the right state. It is **not** the
//! enforcement point. Every write these commands guard also goes through the
//! Delivery Service, which re-derives the same role from `group_member` and
//! answers 403 (`pollis_delivery::groups::{group_role, is_admin}`) — the DS is
//! untrusted-by-the-client but authoritative-for-the-server, and it never
//! trusts a client-supplied role. Reads go direct to Turso, where this *is* the
//! only check; that is exactly why it must be honest rather than silently empty.
//!
//! Every entry point takes the caller's existing `&Connection` rather than
//! `&AppState`: for a REMOTE database `Database::connect()` builds a whole new
//! `hyper::Client` with a cold pool, so a helper that opened its own would turn
//! one preflight into an extra TCP + TLS handshake on every guarded command.
//!
//! ## Roles
//!
//! `group_member.role` carries `'admin'` or `'member'` and nothing else.
//! `'owner'` was renamed to `'admin'` by migration 000008 (see
//! `db::remote::migration_008_owner_role_becomes_admin`) and `groups.owner_id`
//! is a display field, never an authorization input — so an unknown role string
//! is treated as a plain member, matching the DS's `== Some("admin")`.

use libsql::Connection;

use crate::error::{Error, Result};

/// The caller's standing in a group. Absence is represented by `Option`, never
/// by a third variant — "not a member" is not a role.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GroupRole {
    Admin,
    Member,
}

impl GroupRole {
    pub fn is_admin(self) -> bool {
        matches!(self, GroupRole::Admin)
    }

    fn from_column(raw: &str) -> Self {
        if raw == "admin" {
            GroupRole::Admin
        } else {
            GroupRole::Member
        }
    }
}

/// The one wording for "the caller is not in this group". Every site that used
/// to invent its own now returns exactly this.
pub const NOT_A_MEMBER: &str = "you are not a member of this group";

fn not_a_member() -> Error {
    Error::Other(anyhow::anyhow!(NOT_A_MEMBER))
}

/// `only group admins can {action}` — `action` is a verb phrase, e.g.
/// `"update group settings"`.
fn not_an_admin(action: &str) -> Error {
    Error::Other(anyhow::anyhow!("only group admins can {action}"))
}

/// The caller's role in `group_id`, or `None` when they are not a member.
/// Prefer [`require_member`] / [`require_admin`] — reach for this only where
/// "not a member" is a legitimate non-error outcome.
pub async fn group_role(
    conn: &Connection,
    group_id: &str,
    user_id: &str,
) -> Result<Option<GroupRole>> {
    let mut rows = conn
        .query(
            "SELECT role FROM group_member WHERE group_id = ?1 AND user_id = ?2",
            libsql::params![group_id.to_string(), user_id.to_string()],
        )
        .await?;
    Ok(match rows.next().await? {
        Some(row) => Some(GroupRole::from_column(&row.get::<String>(0)?)),
        None => None,
    })
}

/// The caller's role in the group that owns `channel_id`, or `None` when the
/// conversation is not a group channel (a DM has no `channels` row) or the
/// caller is not a member. One round trip, mirroring the DS's
/// `messages::channel_group_role`.
pub async fn channel_group_role(
    conn: &Connection,
    channel_id: &str,
    user_id: &str,
) -> Result<Option<GroupRole>> {
    let mut rows = conn
        .query(
            "SELECT gm.role FROM channels c \
             JOIN group_member gm ON gm.group_id = c.group_id \
             WHERE c.id = ?1 AND gm.user_id = ?2",
            libsql::params![channel_id.to_string(), user_id.to_string()],
        )
        .await?;
    Ok(match rows.next().await? {
        Some(row) => Some(GroupRole::from_column(&row.get::<String>(0)?)),
        None => None,
    })
}

/// Require membership. Returns the caller's role so an admin-only *branch* can
/// be taken without a second query (e.g. "members may remove themselves, admins
/// may remove anyone").
pub async fn require_member(
    conn: &Connection,
    group_id: &str,
    user_id: &str,
) -> Result<GroupRole> {
    group_role(conn, group_id, user_id)
        .await?
        .ok_or_else(not_a_member)
}

/// Require admin. `action` completes "only group admins can …".
pub async fn require_admin(
    conn: &Connection,
    group_id: &str,
    user_id: &str,
    action: &str,
) -> Result<()> {
    if require_member(conn, group_id, user_id).await?.is_admin() {
        return Ok(());
    }
    Err(not_an_admin(action))
}

/// Require that `user_id` is a member of `group_id` — used to validate the
/// *target* of an action, not the caller.
pub async fn require_target_member(
    conn: &Connection,
    group_id: &str,
    user_id: &str,
) -> Result<GroupRole> {
    group_role(conn, group_id, user_id)
        .await?
        .ok_or_else(|| Error::Other(anyhow::anyhow!("user is not a member of this group")))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A real libsql connection with the real schema — the same definitions the
    /// DS's own authz tests run against (`pollis_schema`), so a divergence
    /// between the two `group_member` readers would show up here.
    async fn db() -> Connection {
        let db = libsql::Builder::new_local(":memory:")
            .build()
            .await
            .expect("in-memory libsql");
        let conn = db.connect().expect("connect");
        for sql in pollis_schema::main_scripts() {
            conn.execute_batch(sql).await.expect("schema");
        }
        conn.execute_batch(
            "INSERT INTO users (id, email, username) VALUES \
               ('alice', 'a@x.com', 'alice'), ('bob', 'b@x.com', 'bob'), \
               ('carol', 'c@x.com', 'carol'), ('dave', 'd@x.com', 'dave');\
             INSERT INTO groups (id, name, owner_id) VALUES ('g1', 'G', 'alice');\
             INSERT INTO group_member (group_id, user_id, role) VALUES \
               ('g1', 'alice', 'admin'), ('g1', 'bob', 'member'), ('g1', 'dave', 'wizard');\
             INSERT INTO channels (id, group_id, name) VALUES ('ch1', 'g1', 'general');\
             INSERT INTO dm_channel (id, created_by) VALUES ('dm1', 'alice');",
        )
        .await
        .expect("seed");
        conn
    }

    fn msg(e: Error) -> String {
        e.to_string()
    }

    #[tokio::test]
    async fn role_is_read_from_group_member() {
        let conn = db().await;
        assert_eq!(
            group_role(&conn, "g1", "alice").await.unwrap(),
            Some(GroupRole::Admin)
        );
        assert_eq!(
            group_role(&conn, "g1", "bob").await.unwrap(),
            Some(GroupRole::Member)
        );
        assert_eq!(group_role(&conn, "g1", "carol").await.unwrap(), None);
    }

    /// `group_member.role` has no CHECK constraint, so an unrecognised string is
    /// storable. It must read as a plain member — never as an admin — matching
    /// the DS's `== Some("admin")`. A `role != "admin"` comparison and a
    /// `role == "admin"` comparison agree on this case only if both are written
    /// carefully; one helper removes the chance of getting it wrong twice.
    #[tokio::test]
    async fn unknown_role_string_is_not_admin() {
        let conn = db().await;
        assert_eq!(
            group_role(&conn, "g1", "dave").await.unwrap(),
            Some(GroupRole::Member)
        );
        assert!(require_admin(&conn, "g1", "dave", "do the thing")
            .await
            .is_err());
    }

    /// The single wording. Before #875 this same condition produced three
    /// different sentences depending on which command you called.
    #[tokio::test]
    async fn non_member_gets_one_wording() {
        let conn = db().await;
        assert_eq!(
            msg(require_member(&conn, "g1", "carol").await.unwrap_err()),
            NOT_A_MEMBER
        );
        assert_eq!(
            msg(require_admin(&conn, "g1", "carol", "update group settings")
                .await
                .unwrap_err()),
            NOT_A_MEMBER,
            "a non-member must be told they are not a member, not that they are not an admin"
        );
    }

    #[tokio::test]
    async fn member_who_is_not_admin_is_told_which_action() {
        let conn = db().await;
        assert_eq!(
            msg(require_admin(&conn, "g1", "bob", "delete the group")
                .await
                .unwrap_err()),
            "only group admins can delete the group"
        );
        assert!(require_admin(&conn, "g1", "alice", "delete the group")
            .await
            .is_ok());
    }

    #[tokio::test]
    async fn target_membership_has_its_own_wording() {
        let conn = db().await;
        assert_eq!(
            msg(require_target_member(&conn, "g1", "carol")
                .await
                .unwrap_err()),
            "user is not a member of this group",
            "the TARGET of an action is a different subject from the caller"
        );
        assert!(require_target_member(&conn, "g1", "bob").await.is_ok());
    }

    /// A DM has no `channels` row and no admin concept, so it must be `None`
    /// rather than an error — the caller decides what that means.
    #[tokio::test]
    async fn channel_role_resolves_through_the_owning_group() {
        let conn = db().await;
        assert_eq!(
            channel_group_role(&conn, "ch1", "alice").await.unwrap(),
            Some(GroupRole::Admin)
        );
        assert_eq!(
            channel_group_role(&conn, "ch1", "carol").await.unwrap(),
            None
        );
        assert_eq!(
            channel_group_role(&conn, "dm1", "alice").await.unwrap(),
            None
        );
    }
}
