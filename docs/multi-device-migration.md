# Multi-Device Migration Spec

## Overview

This document specifies the changes required to support multiple registered devices per Pollis user. The current architecture assumes a single device per user throughout its crypto, schema, and key-management layers. Every assumption identified here must be resolved before a second device can participate in any conversation.

---

## 1. Current Assumptions That Break With Multi-Device

### 1.1 Identity key is per-user, not per-device

`src-tauri/src/signal/identity.rs` — `IdentityKey::generate_and_store()` stores the Ed25519 signing key under the fixed keystore keys `"identity_key_private"` and `"identity_key_public"`. A second device has a different OS keystore and therefore generates a completely different identity key.

`src-tauri/src/commands/auth.rs` — `initialize_identity()` then writes that device's X25519 public key into `users.identity_key` (a single column on the `users` row). The second device to authenticate will silently overwrite the first device's published key, breaking all in-flight X3DH sessions the first device was a party to.

There is no `device_id` concept anywhere in `users`, `signed_prekey`, `one_time_prekey`, `sender_key_dist`, or `x3dh_init` in `remote_schema.sql`.

### 1.2 Prekey bundles are scoped to users, not devices

`remote_schema.sql` — `signed_prekey(user_id, key_id)` and `one_time_prekey(user_id, key_id)` have a two-part primary key of `(user_id, key_id)`. A second device that generates OPK IDs starting from 1 (see `replenish_one_time_prekeys` — it queries `MAX(id)` from the **local** DB, not the remote) will INSERT OPKs that silently collide with the first device's IDs via `INSERT OR IGNORE`.

`get_prekey_bundle()` (`commands/signal.rs`) returns a single bundle — one SPK, one OPK — keyed on `user_id` alone. There is no way to route a bundle to a specific device, so a sender establishing an X3DH session does not know which device will hold the private keys that can complete the handshake.

### 1.3 Sender key distribution targets users, not devices

`distribute_sender_key_to_group_members()` and `distribute_sender_key_to_dm_members()` in `commands/messages.rs` both query group members / DM members by `user_id` and look up keys from `users.identity_key` (a single column) and the most recent `signed_prekey` row for that `user_id`. The encrypted `SenderKeyState` is then written to `sender_key_dist` with `UNIQUE(channel_id, sender_id, recipient_id)` — one row per `(sender, recipient_user)` pair. A second device belonging to the same recipient user never receives its own distribution row; it cannot decrypt incoming group messages.

### 1.4 SPK key rotation reads local DB for the max ID

`rotate_signed_prekey()` (`commands/signal.rs`) queries `MAX(id)` from the **local** `signed_prekey` table, not from Turso. Two devices independently calling this command will each arrive at `new_id = 1` and overwrite each other in the remote DB (`INSERT OR REPLACE`).

### 1.5 OPK replenishment reads local DB for the max ID

`replenish_one_time_prekeys()` queries `MAX(id)` from the **local** `one_time_prekey` table. The remote OPK namespace is shared across devices; device B's replenishment will silently collide with device A's OPK IDs via `INSERT OR IGNORE`.

### 1.6 Signal session table hard-codes device_id = 1

`local_schema.sql` — `signal_session(user_id, device_id)` has a `device_id INTEGER NOT NULL DEFAULT 1` column and a composite primary key on `(user_id, device_id)`. The schema acknowledges devices but nothing in the current code ever sets `device_id` to a value other than 1. The local DB query in `session.rs` ignores the column entirely.

### 1.7 Session token identifies only the user

`verify_otp()` stores a `UserProfile { id, email, username }` in the OS keystore under `"session"`. There is no stable device identifier. A second device logs in as the same user and is indistinguishable from the first.

### 1.8 message_envelope delivery is per-user, not per-device

`poll_pending_messages()` marks envelopes as `delivered = 0` / `delivered` but the query joins only on `group_member.user_id`. Once any device fetches and processes a message, there is no mechanism to deliver it to a second device that was offline.

### 1.9 logout() deletes the single shared identity key

`logout(delete_data: true)` deletes `"identity_key_private"` and `"identity_key_public"`. If two devices share a user account, logging out and deleting data on device A inadvertently destroys the remote `signed_prekey` and `one_time_prekey` rows (via the `initialize_identity` re-upload path), invalidating device B's existing sessions.

---

## 2. Turso Schema Changes

All changes below are additive except where noted. The remote schema lives in `src-tauri/src/db/migrations/remote_schema.sql`.

### 2.1 Device registry table (new)

```sql
CREATE TABLE device (
    id          TEXT PRIMARY KEY,          -- stable device ULID, generated at first login on that device
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL DEFAULT '',  -- user-visible label ("MacBook Pro", "iPhone 16")
    identity_key TEXT NOT NULL,            -- hex X25519 public key for THIS device
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at  TEXT                       -- NULL = active; non-NULL = revoked
);

CREATE INDEX idx_device_user ON device(user_id, revoked_at);
```

The `users.identity_key` column becomes a denormalised "primary device" hint only. All cryptographic operations must use `device.identity_key`. The column should be left in place for backwards compatibility and updated to reflect the most-recently-active device as a convenience.

### 2.2 Add device_id foreign key to prekey tables

```sql
-- New columns on existing tables (applied as ALTER TABLE in a migration run):
ALTER TABLE signed_prekey ADD COLUMN device_id TEXT REFERENCES device(id) ON DELETE CASCADE;
ALTER TABLE one_time_prekey ADD COLUMN device_id TEXT REFERENCES device(id) ON DELETE CASCADE;
```

The primary keys must be widened:

```sql
-- signed_prekey: old PK was (user_id, key_id)
-- New logical unique constraint: (device_id, key_id)
-- Because libSQL / SQLite cannot drop a PK, re-create the table in migration:

CREATE TABLE signed_prekey_v2 (
    device_id   TEXT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id      INTEGER NOT NULL,
    public_key  TEXT NOT NULL,
    signature   TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (device_id, key_id)
);

CREATE TABLE one_time_prekey_v2 (
    device_id   TEXT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id      INTEGER NOT NULL,
    public_key  TEXT NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (device_id, key_id)
);
```

Populate from existing rows during migration (see section 5).

### 2.3 Widen sender_key_dist to target devices

The current `UNIQUE(channel_id, sender_id, recipient_id)` must become `UNIQUE(channel_id, sender_id, recipient_device_id)`:

```sql
CREATE TABLE sender_key_dist_v2 (
    id                  TEXT PRIMARY KEY,
    channel_id          TEXT NOT NULL,
    sender_id           TEXT NOT NULL,
    sender_device_id    TEXT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
    recipient_id        TEXT NOT NULL,
    recipient_device_id TEXT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
    encrypted_state     TEXT NOT NULL,
    ephemeral_key       TEXT NOT NULL,
    spk_id              INTEGER NOT NULL,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(channel_id, sender_id, sender_device_id, recipient_device_id)
);

CREATE INDEX idx_skd_v2_channel     ON sender_key_dist_v2(channel_id, sender_id, sender_device_id);
CREATE INDEX idx_skd_v2_recip_dev   ON sender_key_dist_v2(recipient_device_id, channel_id);
```

`sender_device_id` is needed so that when a sender rotates keys on one device, existing rows from other devices are not invalidated.

### 2.4 Per-device message delivery tracking

The current `message_envelope.delivered` flag is a single boolean; it cannot track delivery to multiple devices independently. Replace it with a fan-out receipt table:

```sql
CREATE TABLE message_delivery (
    envelope_id TEXT NOT NULL REFERENCES message_envelope(id) ON DELETE CASCADE,
    device_id   TEXT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
    delivered   INTEGER NOT NULL DEFAULT 0,
    delivered_at TEXT,
    PRIMARY KEY (envelope_id, device_id)
);

CREATE INDEX idx_delivery_device ON message_delivery(device_id, delivered);
```

When a message is written to `message_envelope`, the sender also INSERTs one `message_delivery` row for each active (non-revoked) device of every recipient, plus each of the sender's own other devices. `poll_pending_messages` then queries `message_delivery WHERE device_id = ?device_id AND delivered = 0`.

### 2.5 x3dh_init must target a specific device

```sql
ALTER TABLE x3dh_init ADD COLUMN recipient_device_id TEXT REFERENCES device(id);
```

Senders must specify which device they are initiating a session with. Existing rows can have `recipient_device_id = NULL` treated as legacy single-device sessions.

---

## 3. Signal Protocol Changes

### 3.1 Identity keys are per-device

Each device generates its own independent Ed25519 + X25519 identity key pair (already the case in `IdentityKey::generate_and_store()`). The key change is that these must be published to `device.identity_key` rather than `users.identity_key`. Senders fetching a prekey bundle address a `device_id`, not a `user_id`.

The Ed25519 verifying key (`identity_key_public`) can be published as the device's signing key for signed-prekey verification. It does not need to be the same across devices for group messaging; each device is an independent Signal endpoint.

### 3.2 Prekey bundles are per-device

`get_prekey_bundle()` must accept a `device_id: String` parameter and query `signed_prekey_v2` and `one_time_prekey_v2` filtered on `device_id`. The returned `PreKeyBundle` struct must include `device_id`.

To establish an X3DH session, the initiating device must:
1. List all active devices for the target user (`SELECT id FROM device WHERE user_id = ?1 AND revoked_at IS NULL`).
2. Fetch one prekey bundle per device.
3. Run `x3dh_send()` once per target device and write one `x3dh_init` row per device.

This means a DM between Alice and Bob with two devices each requires four X3DH sessions: Alice-device-1 → Bob-device-1, Alice-device-1 → Bob-device-2, Alice-device-2 → Bob-device-1, Alice-device-2 → Bob-device-2. In practice, sender key distribution (section 3.3) reduces this to one SenderKeyState distribution per remote device.

### 3.3 Sender key distribution must fan out to all devices

`distribute_sender_key_to_group_members()` and `distribute_sender_key_to_dm_members()` currently iterate over `user_id`s. They must be rewritten to iterate over `(user_id, device_id)` pairs:

```sql
-- Replace the inner query in both distribute functions:
SELECT d.id AS device_id, d.identity_key,
       (SELECT spk.public_key FROM signed_prekey_v2 spk
        WHERE spk.device_id = d.id ORDER BY spk.key_id DESC LIMIT 1) AS spk_pub,
       (SELECT spk.key_id FROM signed_prekey_v2 spk
        WHERE spk.device_id = d.id ORDER BY spk.key_id DESC LIMIT 1) AS spk_id
FROM group_member gm
JOIN device d ON d.user_id = gm.user_id
WHERE gm.group_id = ?1
  AND d.user_id != ?2          -- exclude sender's user
  AND d.revoked_at IS NULL
  AND d.identity_key IS NOT NULL
```

For the sender's own other devices, add a second pass:

```sql
SELECT d.id AS device_id, d.identity_key, ...
FROM device d
WHERE d.user_id = ?sender_user_id
  AND d.id != ?sender_device_id
  AND d.revoked_at IS NULL
```

`encrypt_sender_key_for_recipient()` in `signal/crypto.rs` does not change — it already takes raw byte slices for `recipient_identity_key` and `recipient_spk`. The call site change is only to the loop that feeds device-level keys instead of user-level keys.

The unique constraint in `sender_key_dist_v2` on `(channel_id, sender_id, sender_device_id, recipient_device_id)` ensures one distribution row per sender-device / recipient-device pair.

### 3.4 Own-device distribution (sender to self)

When Alice sends a message from device A, device B (her other device) must also receive the sender key so it can display the sent message in its own history. The distribution pass for own-other-devices should use the same `encrypt_sender_key_for_recipient()` path. `poll_pending_messages` on device B fetches the ciphertext envelope; device B then looks up the distribution row addressed to its `device_id` and decrypts the SenderKeyState before decrypting the message.

### 3.5 Signed prekey key IDs must be device-scoped

`rotate_signed_prekey()` currently queries `MAX(id)` from the local `signed_prekey` table to pick a new `key_id`. After the migration, `key_id` is scoped to `(device_id, key_id)` in `signed_prekey_v2`, so local max-ID is still correct — each device maintains its own monotonically increasing counter. No change needed to the ID generation logic, only to the remote INSERT target table and the inclusion of `device_id` in the query.

### 3.6 OPK IDs must be device-scoped

Same as SPKs: the remote table is now `one_time_prekey_v2` with `(device_id, key_id)` PK. The local DB already stores OPK private keys by ID without cross-device collision risk because the local DB is never shared. The INSERT path in `replenish_one_time_prekeys()` must include the device's `device_id`.

### 3.7 SenderKeyState is still per-sender-device in local DB

The local `group_sender_key` table stores `(group_id, sender_id)`. For own sender key, `sender_id` equals `user_id`, which is fine because a device's sender key is device-specific (different chain_id per device). Peer sender keys use the `"peer:{sender_id}"` convention in `session.rs`. For multi-device peers, the local DB must store one peer entry per sender device:

```sql
-- Old:  peer:alice
-- New:  peer:alice:{device_id}
```

The `load_peer_sender_key()` and `save_peer_sender_key()` functions in `signal/session.rs` must accept an optional `device_id` suffix. Alternatively, change the key format to `peer:{user_id}:{device_id}` unconditionally. The local `group_sender_key.sender_id` column is `TEXT NOT NULL` and does not reference any table, so this is a simple string format change with a local schema migration to rename existing rows.

---

## 4. Rust Backend Changes

### 4.1 New command: register_device

```rust
// src-tauri/src/commands/auth.rs
#[tauri::command]
pub async fn register_device(
    state: State<'_, Arc<AppState>>,
    user_id: String,
    device_name: String,
) -> Result<String>  // returns device_id
```

Generates a stable ULID for this device, writes it to `device` table with the device's X25519 identity key, stores `device_id` in the OS keystore under `"device_id"`. Called once during `initialize_identity()` if no `device_id` is found in the keystore.

### 4.2 Changes to initialize_identity

`initialize_identity()` in `commands/auth.rs` must:
1. Load or generate Ed25519 + X25519 keypairs (unchanged).
2. Load `device_id` from keystore, or call `register_device()` to create one.
3. Write to `device.identity_key` instead of `users.identity_key`.
4. Upload SPK and OPKs to `signed_prekey_v2` and `one_time_prekey_v2` with the device's `device_id`.
5. Clear stale `sender_key_dist_v2` rows by `recipient_device_id` instead of `recipient_id`.

### 4.3 Changes to get_prekey_bundle

```rust
// src-tauri/src/commands/signal.rs
#[tauri::command]
pub async fn get_prekey_bundle(
    user_id: String,
    device_id: Option<String>,  // None = return bundles for all active devices
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<PreKeyBundle>>
```

`PreKeyBundle` must add:

```rust
pub struct PreKeyBundle {
    pub user_id: String,
    pub device_id: String,    // new field
    pub identity_key: String,
    pub signed_prekey_id: u32,
    pub signed_prekey: String,
    pub signed_prekey_sig: String,
    pub one_time_prekey_id: Option<u32>,
    pub one_time_prekey: Option<String>,
}
```

The frontend must update its `PreKeyBundle` TypeScript type in `frontend/src/types/` to match.

### 4.4 Changes to rotate_signed_prekey

`rotate_signed_prekey()` must:
1. Load `device_id` from keystore.
2. INSERT into `signed_prekey_v2(device_id, user_id, key_id, public_key, signature)`.
3. Query `MAX(key_id)` from `signed_prekey_v2 WHERE device_id = ?` on the remote DB rather than from local DB, to be authoritative.

### 4.5 Changes to replenish_one_time_prekeys

`replenish_one_time_prekeys()` must:
1. Load `device_id` from keystore.
2. Query `MAX(key_id) FROM one_time_prekey_v2 WHERE device_id = ?` on the remote DB.
3. INSERT into `one_time_prekey_v2` with the `device_id`.

### 4.6 Changes to send_message

`send_message()` in `commands/messages.rs` must:
1. Pass `sender_device_id` (loaded from keystore) to both `distribute_sender_key_to_group_members()` and `distribute_sender_key_to_dm_members()`.
2. After writing to `message_envelope`, INSERT one `message_delivery` row for each active device of each recipient user (including sender's own other devices).
3. The distribution functions must use the new device-scoped query (section 3.3).

New signature:

```rust
async fn distribute_sender_key_to_group_members(
    conn: &libsql::Connection,
    channel_id: &str,
    sender_id: &str,
    sender_device_id: &str,   // new
    state_to_distribute: &SenderKeyState,
) -> Result<()>
```

### 4.7 Changes to poll_pending_messages

`poll_pending_messages()` must:
1. Load `device_id` from keystore.
2. Query `message_delivery` for rows where `device_id = ?this_device AND delivered = 0` joined to `message_envelope`.
3. Mark those delivery rows as `delivered = 1` after fetching.

New query:

```sql
SELECT me.id, me.conversation_id, me.sender_id, me.ciphertext, me.sent_at
FROM message_envelope me
JOIN message_delivery md ON md.envelope_id = me.id
WHERE md.device_id = ?1 AND md.delivered = 0
```

### 4.8 New command: list_user_devices

```rust
#[tauri::command]
pub async fn list_user_devices(
    state: State<'_, Arc<AppState>>,
    user_id: String,
) -> Result<Vec<DeviceInfo>>

pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub last_seen_at: String,
    pub is_current: bool,
}
```

### 4.9 New command: revoke_device

```rust
#[tauri::command]
pub async fn revoke_device(
    state: State<'_, Arc<AppState>>,
    user_id: String,
    device_id: String,
) -> Result<()>
```

Sets `device.revoked_at = datetime('now')` for the given device. Deletes all `signed_prekey_v2` and `one_time_prekey_v2` rows for the device. Does not delete `sender_key_dist_v2` rows immediately — they expire naturally when the revoked device's sender keys are no longer distributed.

After revocation, all group senders must redistribute their sender keys to the remaining active devices. This can be deferred to the next message send (the `NOT EXISTS` filter in distribute functions will pick up the missing rows).

Revoking the current device should be equivalent to `logout(delete_data: true)`.

### 4.10 AppState changes

`AppState` in `state.rs` should cache the current `device_id` so every command does not need to hit the keystore:

```rust
pub struct AppState {
    pub config: Config,
    pub local_db: Arc<Mutex<LocalDb>>,
    pub remote_db: Arc<RemoteDb>,
    pub otp_store: Arc<Mutex<HashMap<String, OtpEntry>>>,
    pub device_id: Arc<tokio::sync::RwLock<Option<String>>>,  // new
}
```

Populated in `initialize_identity()` or on startup via `get_session()`.

---

## 5. Key Migration for Existing Single-Device Users

The migration must be non-destructive: users who have only one device must retain all their message history and not be forced to re-authenticate.

### 5.1 Remote schema migration steps

Run as a single migration script via `pnpm db:push`:

1. Create `device` table.
2. For each user in `users` who has an `identity_key`:
   ```sql
   INSERT INTO device (id, user_id, name, identity_key, created_at, last_seen_at)
   SELECT lower(hex(randomblob(10))), id, 'Primary Device', identity_key, created_at, created_at
   FROM users
   WHERE identity_key IS NOT NULL;
   ```
   Note: Turso does not have `gen_random_uuid()`. Use a migration-time script (Rust or Node) to generate proper ULIDs for device IDs.

3. Create `signed_prekey_v2` and `one_time_prekey_v2`. Populate from existing tables by joining on `user_id` to find the newly created `device.id`:
   ```sql
   INSERT INTO signed_prekey_v2 (device_id, user_id, key_id, public_key, signature, created_at)
   SELECT d.id, spk.user_id, spk.key_id, spk.public_key, spk.signature, spk.created_at
   FROM signed_prekey spk
   JOIN device d ON d.user_id = spk.user_id;

   INSERT INTO one_time_prekey_v2 (device_id, user_id, key_id, public_key, used, created_at)
   SELECT d.id, opk.user_id, opk.key_id, opk.public_key, opk.used, opk.created_at
   FROM one_time_prekey opk
   JOIN device d ON d.user_id = opk.user_id;
   ```

4. Create `sender_key_dist_v2`. Populate from `sender_key_dist` by matching `sender_id` and `recipient_id` to their single legacy device:
   ```sql
   INSERT INTO sender_key_dist_v2 (id, channel_id, sender_id, sender_device_id, recipient_id, recipient_device_id, encrypted_state, ephemeral_key, spk_id, created_at)
   SELECT skd.id, skd.channel_id, skd.sender_id, ds.id, skd.recipient_id, dr.id,
          skd.encrypted_state, skd.ephemeral_key, skd.spk_id, skd.created_at
   FROM sender_key_dist skd
   JOIN device ds ON ds.user_id = skd.sender_id
   JOIN device dr ON dr.user_id = skd.recipient_id;
   ```

5. Create `message_delivery`. Populate from `message_envelope` — mark all existing envelopes as delivered so existing users are not re-shown old messages:
   ```sql
   INSERT INTO message_delivery (envelope_id, device_id, delivered, delivered_at)
   SELECT me.id, d.id, 1, datetime('now')
   FROM message_envelope me
   JOIN group_member gm ON gm.group_id = (
       SELECT group_id FROM channels WHERE id = me.conversation_id
   )
   JOIN device d ON d.user_id = gm.user_id;
   ```
   (DM envelopes need a similar join through `dm_channel_member`.)

6. Keep old tables in place during the transition period. Drop them in a follow-up migration once all clients have updated.

### 5.2 Client-side migration (on first launch of new version)

When the app starts and finds no `"device_id"` in the OS keystore:

1. Load `"session"` from keystore to get `user_id`.
2. Query Turso: `SELECT id FROM device WHERE user_id = ?1 LIMIT 1`.
3. If a row exists (migrated from remote schema step 2), store that `device_id` in the keystore. This device is the existing single device.
4. If no row exists, call `register_device()` to create one (new user post-migration).

This ensures existing users automatically associate with their migrated device row without losing history or triggering a new identity-key generation.

### 5.3 Local schema migration

Add a `device_id` column to the local `group_sender_key` table to correctly scope peer sender keys:

```sql
-- local_schema.sql migration (add after existing schema):
ALTER TABLE group_sender_key ADD COLUMN device_id TEXT;
-- Existing rows have device_id = NULL, treated as legacy single-device entries.
```

Existing `"peer:{user_id}"` entries in `group_sender_key` remain valid for users not yet on a second device. New rows will use `"peer:{user_id}:{device_id}"`. The lookup functions in `signal/session.rs` must handle both formats during the transition.

---

## 6. Unit-Testable Scenarios

Each scenario below is expressible as a Rust `#[test]` or `#[tokio::test]` in the relevant module. They use in-memory SQLite (already established in `session.rs` tests via `Connection::open_in_memory()`) and mock remote DB state.

### 6.1 Device B can decrypt messages sent while device B was offline

Setup:
- Alice has device A (online) and device B (offline at send time).
- Alice sends a message from device A to channel C.
- `distribute_sender_key_to_group_members()` writes a `sender_key_dist_v2` row for `(sender_device=A, recipient_device=A_device_B)` — Alice's own other device.
- A `message_delivery` row is written for device B with `delivered = 0`.

Assertion:
- Device B calls `poll_pending_messages()` with its `device_id`.
- Device B receives the envelope.
- Device B looks up its distribution row for Alice's device A on channel C.
- Device B calls `decrypt_sender_key_distribution()` using its own X25519 identity key and SPK private key.
- Device B successfully decrypts the SenderKeyState.
- Device B calls `SenderKeyState::decrypt()` with the SenderKeyMessage.
- Decrypted plaintext matches original content.

File: `src-tauri/src/signal/crypto.rs` (extend existing `encrypt_then_decrypt_roundtrip` test with a device B scenario).

### 6.2 Revoking device C does not break device A or device B

Setup:
- Bob has three devices: A, B, C.
- Alice has sent sender key distributions to all three.

Action:
- `revoke_device(user_id=Bob, device_id=C)` is called.
- Device C row has `revoked_at` set; its `signed_prekey_v2` and `one_time_prekey_v2` rows are deleted.

Assertions:
- `list_user_devices()` for Bob returns only A and B.
- `get_prekey_bundle(user_id=Bob)` returns bundles for A and B only.
- `distribute_sender_key_to_group_members()` for a new message from Alice targets only A and B (no row written for C).
- Existing `sender_key_dist_v2` rows for C are ignored (device JOIN filters on `revoked_at IS NULL`).
- Device A and B can still decrypt new messages from Alice without interruption.

File: new test file `src-tauri/src/commands/tests/multi_device.rs`.

### 6.3 Adding device D causes full sender key redistribution

Setup:
- Bob has devices A and B. Alice has device X.
- Alice has an existing `sender_key_dist_v2` row for Bob-A and Bob-B on channel C.

Action:
- Bob registers device D via `register_device()`.
- Alice sends a new message on channel C.

Assertion:
- `distribute_sender_key_to_group_members()` detects that no `sender_key_dist_v2` row exists for `(sender_device=Alice-X, recipient_device=Bob-D)`.
- A new distribution row is written for Bob-D using its freshly published identity key and SPK.
- The existing rows for Bob-A and Bob-B are left in place (`INSERT OR REPLACE` keyed on the new unique constraint does not touch them).
- Bob-D, after calling `poll_pending_messages()`, receives the envelope and can decrypt it.

### 6.4 OPK ID namespace is per-device and never collides

Setup:
- User Alice has devices A and B.
- Device A has OPKs with IDs 1–100 in `one_time_prekey_v2`.
- Device B calls `replenish_one_time_prekeys()` with `device_id=B`.

Assertion:
- Remote query is `MAX(key_id) FROM one_time_prekey_v2 WHERE device_id = ?B` — returns 0 (no existing rows for device B).
- Device B INSERTs OPKs with IDs 1–50 for `device_id=B`.
- Device A's IDs 1–100 are unaffected (different `device_id`).
- No `UNIQUE` violation occurs.

### 6.5 Stale distribution rows are cleared only for the current device on key reset

Setup:
- Alice has devices A and B.
- Alice generates a new X25519 identity key on device A (simulating a keystore wipe).

Action:
- `initialize_identity()` detects `x25519_key_is_new = true`.
- Calls `DELETE FROM sender_key_dist_v2 WHERE recipient_device_id = ?A_device_id`.

Assertion:
- Distribution rows addressed to device B (`recipient_device_id = B`) are not deleted.
- Distribution rows addressed to device A are deleted.
- Senders will re-distribute to device A on their next message; device B continues to operate without interruption.

### 6.6 Sender key distribution includes sender's own other devices

Setup:
- Alice has devices A and B.
- Alice sends a message from device A on channel C.

Assertion:
- `distribute_sender_key_to_group_members()` (or its DM equivalent) writes a `sender_key_dist_v2` row where `recipient_device_id = Alice-B`.
- A `message_delivery` row is written for `device_id = Alice-B`.
- When Alice opens the app on device B, `poll_pending_messages()` fetches the envelope.
- Device B decrypts the distribution row using its own keys.
- Device B displays the sent message in channel C history.

### 6.7 SPK rotation on device A does not invalidate device B's SPK

Setup:
- Bob has devices A and B; both have SPKs in `signed_prekey_v2`.

Action:
- `rotate_signed_prekey(user_id=Bob)` is called on device A with `device_id=A`.

Assertion:
- INSERT targets `signed_prekey_v2(device_id=A, ...)`.
- `signed_prekey_v2` rows for device B are untouched.
- `get_prekey_bundle(user_id=Bob, device_id=B)` still returns device B's previous SPK.

### 6.8 Decrypting a sender key distribution fails if the wrong device's keys are used

This exercises the existing `wrong_key_fails_to_decrypt` test in `signal/crypto.rs` in a multi-device context.

Setup:
- Alice encrypts a SenderKeyState addressed to Bob-device-A's identity key and SPK.
- An attempt is made to decrypt it using Bob-device-B's identity key and SPK.

Assertion:
- `decrypt_sender_key_distribution()` returns `Err(Error::Crypto("AES-GCM decrypt failed ..."))`.
- No plaintext is accessible to the wrong device.

### 6.9 Revoking the current device triggers logout and key cleanup

Setup:
- Bob is logged in on device A.

Action:
- Bob revokes device A from the settings UI.

Assertions:
- `device.revoked_at` is set for device A.
- `signed_prekey_v2` rows for device A are deleted from remote.
- `one_time_prekey_v2` rows for device A are deleted from remote.
- `"device_id"`, `"session"`, `"identity_key_private"`, and `"identity_key_public"` are cleared from local keystore.
- Subsequent `get_session()` call returns `None`.

### 6.10 Legacy single-device user operates correctly after migration

Setup:
- Alice is a pre-migration user. The migration script ran and created a `device` row for her existing keys.

Action:
- Alice launches the updated app for the first time.
- Client-side migration (section 5.2) finds `device.id` for her `user_id`.
- Stores it in keystore as `"device_id"`.

Assertions:
- `initialize_identity()` does not generate a new identity key (one already exists in keystore).
- No new `device` row is created (the existing one is found and reused).
- `poll_pending_messages()` uses Alice's existing `device_id` and fetches only pending delivery rows.
- All pre-migration message history in local DB is still decryptable (SenderKeyState chain was not reset).
