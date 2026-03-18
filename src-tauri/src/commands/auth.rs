use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::Result;
use crate::keystore;
use crate::state::AppState;
use crate::signal::identity::{IdentityKey, generate_signed_prekey, generate_one_time_prekeys};

const SESSION_KEY: &str = "session";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfile {
    pub id: String,
    pub email: String,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct IdentityInfo {
    pub user_id: String,
    pub public_key: String,
    pub is_new: bool,
}

/// Initialize Signal identity for the given user_id.
/// On first call: generates Ed25519 IK, SPK, 100 OPKs and uploads to Turso.
/// On subsequent calls: returns existing identity info.
#[tauri::command]
pub async fn initialize_identity(
    state: State<'_, Arc<AppState>>,
    user_id: String,
) -> Result<IdentityInfo> {
    match IdentityKey::load().await? {
        Some(identity) => {
            let public_key = hex::encode(identity.public_key_bytes());
            Ok(IdentityInfo { user_id, public_key, is_new: false })
        }
        None => {
            let identity = IdentityKey::generate_and_store().await?;
            let public_key_bytes = identity.public_key_bytes();
            let public_key = hex::encode(public_key_bytes);

            let (spk_pub, spk_sig) = generate_signed_prekey(1, &identity).await?;
            let opks = generate_one_time_prekeys(1, 100).await?;

            upload_initial_keys(
                &state,
                &user_id,
                &public_key_bytes,
                1,
                &spk_pub,
                &spk_sig,
                &opks,
            ).await?;

            Ok(IdentityInfo { user_id, public_key, is_new: true })
        }
    }
}

/// Check whether a Signal identity key exists locally.
#[tauri::command]
pub async fn get_identity() -> Result<Option<IdentityInfo>> {
    match IdentityKey::load().await? {
        Some(identity) => {
            let public_key = hex::encode(identity.public_key_bytes());
            Ok(Some(IdentityInfo {
                user_id: String::new(),
                public_key,
                is_new: false,
            }))
        }
        None => Ok(None),
    }
}

/// Request an OTP to be sent to the given email address.
#[tauri::command]
pub async fn request_otp(
    state: State<'_, Arc<AppState>>,
    email: String,
) -> Result<()> {
    use rand::Rng;
    use sha2::{Sha256, Digest};

    // Generate OTP in a scoped block so ThreadRng (non-Send) is dropped
    // before the first await point.
    let otp = {
        let mut rng = rand::thread_rng();
        format!("{:06}", rng.gen_range(0..1_000_000u32))
    };

    let mut hasher = Sha256::new();
    hasher.update(otp.as_bytes());
    let hash = format!("{:x}", hasher.finalize());

    let expires_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() + 600;

    {
        let mut store = state.otp_store.lock().await;
        store.insert(email.clone(), crate::state::OtpEntry { hash, expires_at });
    }

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "from": "Pollis <noreply@mail.pollis.com>",
        "to": [email],
        "subject": "Your Pollis sign-in code",
        "text": format!("Your verification code is: {}\n\nThis code expires in 10 minutes.", otp),
    });

    let resp = client
        .post("https://api.resend.com/emails")
        .header("Authorization", format!("Bearer {}", state.config.resend_api_key))
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!("Failed to send email: {}", err_text).into());
    }

    Ok(())
}

/// Verify an OTP code, create or load the user in Turso, persist session to keystore.
#[tauri::command]
pub async fn verify_otp(
    state: State<'_, Arc<AppState>>,
    email: String,
    code: String,
) -> Result<UserProfile> {
    use sha2::{Sha256, Digest};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let stored = {
        let store = state.otp_store.lock().await;
        store.get(&email).cloned()
    };

    let entry = stored.ok_or_else(|| {
        anyhow::anyhow!("No sign-in request found for this email. Please request a new code.")
    })?;

    if now > entry.expires_at {
        return Err(anyhow::anyhow!("This code has expired. Please request a new one.").into());
    }

    let mut hasher = Sha256::new();
    hasher.update(code.trim().as_bytes());
    let provided_hash = format!("{:x}", hasher.finalize());

    if provided_hash != entry.hash {
        return Err(anyhow::anyhow!("Invalid code. Please check and try again.").into());
    }

    {
        let mut store = state.otp_store.lock().await;
        store.remove(&email);
    }

    let conn = state.remote_db.conn().await?;

    let mut rows = conn.query(
        "SELECT id, username FROM users WHERE email = ?1",
        libsql::params![email.clone()],
    ).await?;

    let user_row = rows.next().await?;

    let (user_id, username) = if let Some(row) = user_row {
        let id: String = row.get(0)?;
        let uname: String = row.get(1).unwrap_or_else(|_| {
            email.split('@').next().unwrap_or("user").to_string()
        });
        (id, uname)
    } else {
        let user_id = uuid::Uuid::new_v4().to_string();
        let default_username = email.split('@').next().unwrap_or("user").to_string();
        conn.execute(
            "INSERT INTO users (id, email, username) VALUES (?1, ?2, ?3)",
            libsql::params![user_id.clone(), email.clone(), default_username.clone()],
        ).await?;
        (user_id, default_username)
    };

    let profile = UserProfile { id: user_id, email, username };

    // Persist session to OS keystore so it survives app restarts
    let session_bytes = serde_json::to_vec(&profile)
        .map_err(|e| anyhow::anyhow!("Failed to serialize session: {e}"))?;
    keystore::store(SESSION_KEY, &session_bytes).await?;

    Ok(profile)
}

/// Load the persisted session from the OS keystore.
/// Verifies the user still exists in Turso — if not, clears the stale session and returns None.
/// Returns None if the user has never signed in or has logged out.
#[tauri::command]
pub async fn get_session(state: State<'_, Arc<AppState>>) -> Result<Option<UserProfile>> {
    let bytes = match keystore::load(SESSION_KEY).await? {
        Some(b) => b,
        None => return Ok(None),
    };

    let profile: UserProfile = serde_json::from_slice(&bytes)
        .map_err(|e| anyhow::anyhow!("Failed to deserialize session: {e}"))?;

    // Verify the user still exists in Turso. After a DB wipe or account deletion
    // the keystore still has the old profile, which would cause FK errors everywhere.
    let conn = state.remote_db.conn().await?;
    let mut rows = conn.query(
        "SELECT id FROM users WHERE id = ?1",
        libsql::params![profile.id.clone()],
    ).await?;

    if rows.next().await?.is_none() {
        // Stale session — clear it so the app shows the sign-in screen
        let _ = keystore::delete(SESSION_KEY).await;
        return Ok(None);
    }

    Ok(Some(profile))
}

/// Clear the persisted session (logout). Optionally delete identity keys too.
#[tauri::command]
pub async fn logout(delete_data: bool) -> Result<()> {
    // Always clear the session
    if keystore::load(SESSION_KEY).await?.is_some() {
        keystore::delete(SESSION_KEY).await?;
    }

    if delete_data {
        // Remove identity keys from keystore
        let _ = keystore::delete("identity_key_private").await;
        let _ = keystore::delete("identity_key_public").await;
    }

    Ok(())
}

async fn upload_initial_keys(
    state: &AppState,
    user_id: &str,
    identity_key: &[u8; 32],
    spk_id: u32,
    spk_pub: &[u8],
    spk_sig: &[u8],
    opks: &[(u32, Vec<u8>)],
) -> Result<()> {
    let conn = state.remote_db.conn().await?;

    // Update the existing user row with the identity key (user created by verify_otp)
    conn.execute(
        "UPDATE users SET identity_key = ?1 WHERE id = ?2",
        libsql::params![hex::encode(identity_key), user_id],
    ).await?;

    conn.execute(
        "INSERT OR REPLACE INTO signed_prekey (user_id, key_id, public_key, signature) VALUES (?1, ?2, ?3, ?4)",
        libsql::params![user_id, spk_id as i64, hex::encode(spk_pub), hex::encode(spk_sig)],
    ).await?;

    for (id, pub_key) in opks {
        conn.execute(
            "INSERT INTO one_time_prekey (user_id, key_id, public_key) VALUES (?1, ?2, ?3)",
            libsql::params![user_id, *id as i64, hex::encode(pub_key)],
        ).await?;
    }

    Ok(())
}
