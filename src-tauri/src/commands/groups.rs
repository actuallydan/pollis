use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{Error, Result};
use crate::state::AppState;

/// Map a libsql error to a user-facing message based on known constraint patterns.
fn db_err(e: crate::error::Error, context: &str) -> crate::error::Error {
    let msg = e.to_string();
    if msg.contains("FOREIGN KEY") {
        Error::Other(anyhow::anyhow!(
            "{context}: your session may be out of sync — please sign out and sign back in."
        ))
    } else if msg.contains("UNIQUE") || msg.contains("SQLITE_CONSTRAINT_UNIQUE") {
        Error::Other(anyhow::anyhow!("{context} already exists."))
    } else {
        e
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Group {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Channel {
    pub id: String,
    pub group_id: String,
    pub name: String,
    pub description: Option<String>,
}

#[tauri::command]
pub async fn list_user_groups(
    user_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<Group>> {
    let conn = state.remote_db.conn().await?;

    let mut rows = conn.query(
        "SELECT g.id, g.name, g.description, g.owner_id, g.created_at
         FROM groups g
         JOIN group_member gm ON gm.group_id = g.id
         WHERE gm.user_id = ?1",
        libsql::params![user_id],
    ).await?;

    let mut groups = Vec::new();
    while let Some(row) = rows.next().await? {
        groups.push(Group {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            owner_id: row.get(3)?,
            created_at: row.get(4)?,
        });
    }

    Ok(groups)
}

#[tauri::command]
pub async fn list_group_channels(
    group_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<Channel>> {
    let conn = state.remote_db.conn().await?;

    let mut rows = conn.query(
        "SELECT id, group_id, name, description FROM channels WHERE group_id = ?1",
        libsql::params![group_id],
    ).await?;

    let mut channels = Vec::new();
    while let Some(row) = rows.next().await? {
        channels.push(Channel {
            id: row.get(0)?,
            group_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
        });
    }

    Ok(channels)
}

#[tauri::command]
pub async fn create_group(
    name: String,
    description: Option<String>,
    owner_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Group> {
    let conn = state.remote_db.conn().await?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO groups (id, name, description, owner_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        libsql::params![id.clone(), name.clone(), description.clone(), owner_id.clone(), now.clone()],
    ).await.map_err(|e| db_err(e.into(), "Group"))?;

    conn.execute(
        "INSERT INTO group_member (group_id, user_id, role) VALUES (?1, ?2, 'owner')",
        libsql::params![id.clone(), owner_id.clone()],
    ).await.map_err(|e| db_err(e.into(), "Group member"))?;

    Ok(Group { id, name, description, owner_id, created_at: now })
}

#[tauri::command]
pub async fn create_channel(
    group_id: String,
    name: String,
    description: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<Channel> {
    let conn = state.remote_db.conn().await?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO channels (id, group_id, name, description) VALUES (?1, ?2, ?3, ?4)",
        libsql::params![id.clone(), group_id.clone(), name.clone(), description.clone()],
    ).await.map_err(|e| db_err(e.into(), "Channel"))?;

    Ok(Channel { id, group_id, name, description })
}

#[tauri::command]
pub async fn invite_to_group(
    group_id: String,
    user_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    let conn = state.remote_db.conn().await?;

    conn.execute(
        "INSERT OR IGNORE INTO group_member (group_id, user_id, role) VALUES (?1, ?2, 'member')",
        libsql::params![group_id, user_id],
    ).await?;

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupMember {
    pub user_id: String,
    pub username: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
    pub joined_at: String,
}

#[tauri::command]
pub async fn update_group(
    group_id: String,
    requester_id: String,
    name: Option<String>,
    description: Option<String>,
    icon_url: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<Group> {
    let conn = state.remote_db.conn().await?;

    // Only owner can update
    let mut rows = conn.query(
        "SELECT owner_id FROM groups WHERE id = ?1",
        libsql::params![group_id.clone()],
    ).await?;

    let owner_id: String = if let Some(row) = rows.next().await? {
        row.get(0)?
    } else {
        return Err(Error::Other(anyhow::anyhow!("group not found")));
    };

    if owner_id != requester_id {
        return Err(Error::Other(anyhow::anyhow!("only the group owner can update group settings")));
    }

    if let Some(ref n) = name {
        conn.execute(
            "UPDATE groups SET name = ?1 WHERE id = ?2",
            libsql::params![n.clone(), group_id.clone()],
        ).await?;
    }
    if let Some(ref d) = description {
        conn.execute(
            "UPDATE groups SET description = ?1 WHERE id = ?2",
            libsql::params![d.clone(), group_id.clone()],
        ).await?;
    }
    if let Some(ref u) = icon_url {
        conn.execute(
            "UPDATE groups SET icon_url = ?1 WHERE id = ?2",
            libsql::params![u.clone(), group_id.clone()],
        ).await?;
    }

    let mut rows = conn.query(
        "SELECT id, name, description, owner_id, created_at FROM groups WHERE id = ?1",
        libsql::params![group_id],
    ).await?;

    if let Some(row) = rows.next().await? {
        Ok(Group {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            owner_id: row.get(3)?,
            created_at: row.get(4)?,
        })
    } else {
        Err(Error::Other(anyhow::anyhow!("group not found after update")))
    }
}

#[tauri::command]
pub async fn delete_group(
    group_id: String,
    requester_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    let conn = state.remote_db.conn().await?;

    let mut rows = conn.query(
        "SELECT owner_id FROM groups WHERE id = ?1",
        libsql::params![group_id.clone()],
    ).await?;

    let owner_id: String = if let Some(row) = rows.next().await? {
        row.get(0)?
    } else {
        return Err(Error::Other(anyhow::anyhow!("group not found")));
    };

    if owner_id != requester_id {
        return Err(Error::Other(anyhow::anyhow!("only the group owner can delete the group")));
    }

    // CASCADE deletes group_member and channels entries
    conn.execute(
        "DELETE FROM groups WHERE id = ?1",
        libsql::params![group_id],
    ).await?;

    Ok(())
}

#[tauri::command]
pub async fn get_group_members(
    group_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<GroupMember>> {
    let conn = state.remote_db.conn().await?;

    let mut rows = conn.query(
        "SELECT gm.user_id, u.username, u.display_name, u.avatar_url, gm.role, gm.joined_at
         FROM group_member gm
         LEFT JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ?1",
        libsql::params![group_id],
    ).await?;

    let mut members = Vec::new();
    while let Some(row) = rows.next().await? {
        members.push(GroupMember {
            user_id: row.get(0)?,
            username: row.get(1)?,
            display_name: row.get(2)?,
            avatar_url: row.get(3)?,
            role: row.get(4)?,
            joined_at: row.get(5)?,
        });
    }

    Ok(members)
}

#[tauri::command]
pub async fn remove_member_from_group(
    group_id: String,
    user_id: String,
    requester_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    let conn = state.remote_db.conn().await?;

    // Check requester's role
    let mut rows = conn.query(
        "SELECT role FROM group_member WHERE group_id = ?1 AND user_id = ?2",
        libsql::params![group_id.clone(), requester_id.clone()],
    ).await?;

    let requester_role: String = if let Some(row) = rows.next().await? {
        row.get(0)?
    } else {
        return Err(Error::Other(anyhow::anyhow!("requester is not a group member")));
    };

    // Owner or admin can remove others; anyone can remove themselves
    if requester_id != user_id && requester_role != "owner" && requester_role != "admin" {
        return Err(Error::Other(anyhow::anyhow!(
            "only an owner or admin can remove other members"
        )));
    }

    // Owner cannot be removed (must transfer first)
    if requester_id != user_id {
        let mut target_rows = conn.query(
            "SELECT role FROM group_member WHERE group_id = ?1 AND user_id = ?2",
            libsql::params![group_id.clone(), user_id.clone()],
        ).await?;

        if let Some(row) = target_rows.next().await? {
            let target_role: String = row.get(0)?;
            if target_role == "owner" {
                return Err(Error::Other(anyhow::anyhow!(
                    "cannot remove the group owner; transfer ownership first"
                )));
            }
        }
    }

    conn.execute(
        "DELETE FROM group_member WHERE group_id = ?1 AND user_id = ?2",
        libsql::params![group_id, user_id],
    ).await?;

    Ok(())
}

#[tauri::command]
pub async fn leave_group(
    group_id: String,
    user_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    let conn = state.remote_db.conn().await?;

    // Check if user is the owner
    let mut rows = conn.query(
        "SELECT role FROM group_member WHERE group_id = ?1 AND user_id = ?2",
        libsql::params![group_id.clone(), user_id.clone()],
    ).await?;

    let role: String = if let Some(row) = rows.next().await? {
        row.get(0)?
    } else {
        return Err(Error::Other(anyhow::anyhow!("user is not a member of this group")));
    };

    if role == "owner" {
        return Err(Error::Other(anyhow::anyhow!(
            "owner must transfer ownership before leaving the group"
        )));
    }

    conn.execute(
        "DELETE FROM group_member WHERE group_id = ?1 AND user_id = ?2",
        libsql::params![group_id, user_id],
    ).await?;

    Ok(())
}

#[tauri::command]
pub async fn update_channel(
    channel_id: String,
    requester_id: String,
    name: Option<String>,
    description: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<Channel> {
    let conn = state.remote_db.conn().await?;

    // Get channel's group_id then check requester role
    let mut rows = conn.query(
        "SELECT group_id FROM channels WHERE id = ?1",
        libsql::params![channel_id.clone()],
    ).await?;

    let group_id: String = if let Some(row) = rows.next().await? {
        row.get(0)?
    } else {
        return Err(Error::Other(anyhow::anyhow!("channel not found")));
    };

    let mut role_rows = conn.query(
        "SELECT role FROM group_member WHERE group_id = ?1 AND user_id = ?2",
        libsql::params![group_id.clone(), requester_id.clone()],
    ).await?;

    let role: String = if let Some(row) = role_rows.next().await? {
        row.get(0)?
    } else {
        return Err(Error::Other(anyhow::anyhow!("requester is not a group member")));
    };

    if role != "owner" && role != "admin" {
        return Err(Error::Other(anyhow::anyhow!("only group owner or admin can update channels")));
    }

    if let Some(ref n) = name {
        conn.execute(
            "UPDATE channels SET name = ?1 WHERE id = ?2",
            libsql::params![n.clone(), channel_id.clone()],
        ).await?;
    }
    if let Some(ref d) = description {
        conn.execute(
            "UPDATE channels SET description = ?1 WHERE id = ?2",
            libsql::params![d.clone(), channel_id.clone()],
        ).await?;
    }

    let mut rows = conn.query(
        "SELECT id, group_id, name, description FROM channels WHERE id = ?1",
        libsql::params![channel_id],
    ).await?;

    if let Some(row) = rows.next().await? {
        Ok(Channel {
            id: row.get(0)?,
            group_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
        })
    } else {
        Err(Error::Other(anyhow::anyhow!("channel not found after update")))
    }
}

#[tauri::command]
pub async fn delete_channel(
    channel_id: String,
    requester_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    let conn = state.remote_db.conn().await?;

    let mut rows = conn.query(
        "SELECT group_id FROM channels WHERE id = ?1",
        libsql::params![channel_id.clone()],
    ).await?;

    let group_id: String = if let Some(row) = rows.next().await? {
        row.get(0)?
    } else {
        return Err(Error::Other(anyhow::anyhow!("channel not found")));
    };

    let mut role_rows = conn.query(
        "SELECT role FROM group_member WHERE group_id = ?1 AND user_id = ?2",
        libsql::params![group_id, requester_id],
    ).await?;

    let role: String = if let Some(row) = role_rows.next().await? {
        row.get(0)?
    } else {
        return Err(Error::Other(anyhow::anyhow!("requester is not a group member")));
    };

    if role != "owner" && role != "admin" {
        return Err(Error::Other(anyhow::anyhow!("only group owner or admin can delete channels")));
    }

    conn.execute(
        "DELETE FROM channels WHERE id = ?1",
        libsql::params![channel_id],
    ).await?;

    Ok(())
}

#[tauri::command]
pub async fn transfer_ownership(
    group_id: String,
    new_owner_id: String,
    requester_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    let conn = state.remote_db.conn().await?;

    // Verify requester is current owner
    let mut rows = conn.query(
        "SELECT owner_id FROM groups WHERE id = ?1",
        libsql::params![group_id.clone()],
    ).await?;

    let current_owner: String = if let Some(row) = rows.next().await? {
        row.get(0)?
    } else {
        return Err(Error::Other(anyhow::anyhow!("group not found")));
    };

    if current_owner != requester_id {
        return Err(Error::Other(anyhow::anyhow!("only the current owner can transfer ownership")));
    }

    // Verify new owner is a member
    let mut member_rows = conn.query(
        "SELECT 1 FROM group_member WHERE group_id = ?1 AND user_id = ?2",
        libsql::params![group_id.clone(), new_owner_id.clone()],
    ).await?;

    if member_rows.next().await?.is_none() {
        return Err(Error::Other(anyhow::anyhow!("new owner must be a current member of the group")));
    }

    // Update the owner_id in groups table
    conn.execute(
        "UPDATE groups SET owner_id = ?1 WHERE id = ?2",
        libsql::params![new_owner_id.clone(), group_id.clone()],
    ).await?;

    // Update roles in group_member
    conn.execute(
        "UPDATE group_member SET role = 'member' WHERE group_id = ?1 AND user_id = ?2",
        libsql::params![group_id.clone(), requester_id],
    ).await?;

    conn.execute(
        "UPDATE group_member SET role = 'owner' WHERE group_id = ?1 AND user_id = ?2",
        libsql::params![group_id, new_owner_id],
    ).await?;

    Ok(())
}
