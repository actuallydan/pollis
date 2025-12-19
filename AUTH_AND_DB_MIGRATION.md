# Pollis E2E Encrypted Chat App - Technical Reference

## Project Overview

Pollis is an end-to-end encrypted chat application supporting text messaging, voice, and video calling. The app prioritizes cryptographic security using Signal Protocol-compatible algorithms while maintaining a clean separation between local and remote data storage.

### Technology Stack

**Desktop Application**
- **Framework**: Wails (Go backend + React frontend bridge)
- **Frontend**: TypeScript + React + Vite (dev)
- **Local Database**: libSQL (Turso) - per-user, per-device encrypted storage
- **Platform**: Cross-platform desktop (Windows, macOS, Linux)

**Backend Services**
- **Server**: Go backend for ancillary services
- **Authentication**: Clerk (auth only, no user data)
- **File Storage**: Cloudflare R2
- **Remote Database**: Turso libSQL (cloud DBaaS)
- **WebSocket Provider**: Ably

---

## Database Schema

### Local Database (per-user, per-device - libSQL)

All cryptographic keys and session state stored locally, encrypted at rest.

#### Authentication & Device Management

```sql
CREATE TABLE auth_session (
  id TEXT PRIMARY KEY,                 -- local UUID
  clerk_user_id TEXT NOT NULL,
  clerk_session_token TEXT NOT NULL,    -- cached, refreshable
  app_auth_token TEXT NOT NULL,         -- your backend token
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);

CREATE TABLE device (
  id TEXT PRIMARY KEY,                 -- device UUID
  clerk_user_id TEXT NOT NULL,
  device_name TEXT,
  device_public_key BLOB NOT NULL,      -- device identity (optional)
  created_at INTEGER NOT NULL
);
```

#### Cryptographic Keys

```sql
CREATE TABLE identity_key (
  id INTEGER PRIMARY KEY,
  public_key BLOB NOT NULL,
  private_key_encrypted BLOB NOT NULL,  -- encrypted with local master key
  created_at INTEGER NOT NULL
);

CREATE TABLE signed_prekey (
  id INTEGER PRIMARY KEY,
  public_key BLOB NOT NULL,
  private_key_encrypted BLOB NOT NULL,
  signature BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE one_time_prekey (
  id INTEGER PRIMARY KEY,
  public_key BLOB NOT NULL,
  private_key_encrypted BLOB NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

#### Double Ratchet State

```sql
CREATE TABLE session (
  id TEXT PRIMARY KEY,                 -- peer or device ID
  peer_user_id TEXT NOT NULL,
  root_key_encrypted BLOB NOT NULL,
  sending_chain_key_encrypted BLOB,
  receiving_chain_key_encrypted BLOB,
  send_count INTEGER NOT NULL,
  recv_count INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);
```

#### Groups & Aliases

```sql
CREATE TABLE group_membership (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_sender_key (
  group_id TEXT PRIMARY KEY,
  sender_key_encrypted BLOB NOT NULL,
  distribution_state BLOB NOT NULL,    -- who has received it
  created_at INTEGER NOT NULL
);

CREATE TABLE alias (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_hash TEXT,
  created_at INTEGER NOT NULL
);
```

#### Messages & Attachments

```sql
CREATE TABLE message (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,       -- user or group
  sender_id TEXT NOT NULL,
  ciphertext BLOB NOT NULL,
  nonce BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE attachment (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  ciphertext BLOB NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL
);
```

#### Voice/Video (RTC)

```sql
CREATE TABLE rtc_session (
  id TEXT PRIMARY KEY,
  peer_id TEXT NOT NULL,
  srtp_key_encrypted BLOB NOT NULL,     -- DTLS-SRTP derived
  created_at INTEGER NOT NULL,
  ended_at INTEGER
);
```

#### Miscellaneous

```sql
CREATE TABLE key_value (
  key TEXT PRIMARY KEY,
  value BLOB NOT NULL                  -- feature flags, migrations, etc.
);
```

---

### Remote Database (central, shared - Turso libSQL)

Server-side database for coordination, key distribution, and message relay.

#### Users & Devices

```sql
CREATE TABLE user (
  id TEXT PRIMARY KEY,                 -- internal UUID
  clerk_user_id TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE device (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_key BLOB,
  created_at INTEGER NOT NULL
);
```

#### Public Key Material (Key Distribution)

```sql
CREATE TABLE identity_key (
  user_id TEXT PRIMARY KEY,
  public_key BLOB NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE signed_prekey (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  public_key BLOB NOT NULL,
  signature BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE one_time_prekey (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  public_key BLOB NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

#### Groups & Channels

```sql
CREATE TABLE group (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE group_member (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE channel (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

#### Aliases (Group Display Names)

```sql
CREATE TABLE alias (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_hash TEXT,
  created_at INTEGER NOT NULL
);
```

#### Message Relay (Optional)

```sql
CREATE TABLE message_envelope (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  recipient_id TEXT,                  -- NULL for group
  channel_id TEXT,
  ciphertext BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0
);
```

#### Voice/Video Signaling

```sql
CREATE TABLE rtc_room (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE TABLE rtc_participant (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  PRIMARY KEY (room_id, user_id)
);
```

---

## Cryptographic Implementation

### Key Derivation & Rotation

#### Identity & Prekey Lifecycle (per device)

**First Launch (after Clerk auth)**

Generate keys locally:
```
IK = X25519 keypair                    (Identity Key)
SPK = X25519 keypair                   (Signed PreKey)
SPK_sig = Ed25519_sign(IK_priv, SPK_pub)
OTPK[0..N] = X25519 keypairs           (One-Time PreKeys)
```

Upload to server:
```
IK_pub
SPK_pub + SPK_sig
OTPK_pub[]
```

Store locally (encrypted at rest):
```
IK_priv
SPK_priv
OTPK_priv[]
```

#### Key Rotation Schedule

| Key Type | Rotation Trigger |
|----------|-----------------|
| OTPK | Single-use (consumed after X3DH) |
| SPK | Time-based (e.g., 30 days) |
| Identity Key | Never (unless explicit reset) |
| Ratchet Keys | Every message / DH step |

---

### 1:1 Session Establishment (Signal-style X3DH)

**Alice → Bob flow**

1. **Fetch Bob's public keys from server:**
   ```
   IKb_pub          (Bob's Identity Key)
   SPKb_pub         (Bob's Signed PreKey)
   OTPKb_pub        (Bob's One-Time PreKey, optional)
   ```

2. **Derive shared secret:**
   ```
   DH1 = DH(IKa_priv, SPKb_pub)
   DH2 = DH(EKa_priv, IKb_pub)
   DH3 = DH(EKa_priv, SPKb_pub)
   DH4 = DH(EKa_priv, OTPKb_pub?)    -- optional, if available
   
   SK = HKDF(DH1 || DH2 || DH3 || DH4)
   ```

3. **Initialize Double Ratchet:**
   ```
   RK0 = SK                           (Root Key)
   CKs, CKr = KDF(RK0)               (Chain Keys for send/receive)
   ```

4. **Cleanup:**
   ```
   Delete: EKa_priv (ephemeral private key)
   Server marks: OTPKb_pub consumed
   ```

---

### Double Ratchet (Message Encryption)

#### Per Message Send

```
MK = HMAC(CKs, "msg")                 (Message Key)
CKs = HMAC(CKs, "chain")              (Update Chain Key)
ciphertext = AEAD(MK, plaintext)
```

**Immediately delete:** `MK` after encryption

#### DH Ratchet Step (Key Rotation)

On receiving a new DH public key from peer:

```
RK' = HKDF(DH(DHs_priv, DHr_pub), RK)
CKs, CKr = KDF(RK')
```

**Immediately delete:** Old `RK`, `DHs_priv`

#### Security Properties

- **Forward Secrecy**: Old keys deleted immediately after use
- **Post-Compromise Security**: DH ratchet step refreshes all keys
- **Out-of-Order Messages**: Handled via message key storage (limited window)

---

## Multi-Device Support (Signal-Compatible)

### Mental Model

**Each device is a separate cryptographic identity.**

- User A with 3 devices + User B with 2 devices = **6 independent sessions**
- No shared session state across devices
- Full security isolation per device

### Device Registration

**New device generates:**
```
IK_d2, SPK_d2, OTPK_d2[]
```

**Server maintains:**
```
user_id -> devices[]
```

### Session Graph

Each device pair maintains:
```
- Own X3DH handshake
- Independent Double Ratchet state
- Separate message counters
```

### Message Fan-Out (Sender Side)

For each recipient device:
```
encrypt(message, session[device_id])
send(envelope to device_id)
```

**No shortcuts.** No shared encryption across devices.

### Read Receipts / Acknowledgments

Each device sends:
```
ACK(device_id, message_id)
```

Sender marks message delivered when:
```
all known devices ACK OR timeout expires
```

### Device Removal

When device revoked:
```
1. Server marks device inactive
2. All clients rotate:
   - Group sender keys
   - Pairwise sessions with that user
```

---

## Group Encryption (Sender Keys / Signal Groups v2)

### Group Creation

Creator generates:
```
GK = random 32 bytes                  (Group Key)
```

For each member device:
```
encrypt(GK, pairwise_session[device_id])
send(SenderKeyDistributionMessage)
```

Store locally:
```
group_id -> GK
```

### Group Message Send

Per sender:
```
SK = HMAC(GK, sender_id)             (Sender Key for this sender)
MK = HMAC(SK, message_index)          (Message Key)
ciphertext = AEAD(MK, plaintext)
```

**Only sender increments their message index.**

### Member Join (Critical - Rekey Required)

1. **Rotate group key:**
   ```
   GK' = random 32 bytes
   ```

2. **Distribute to all current members:**
   ```
   encrypt(GK', pairwise_session[device_id]) for each device
   ```

3. **Delete old GK**

**New member:**
- Cannot decrypt past messages (forward secrecy)
- Receives only `GK'`

### Member Leave / Device Removal (Critical)

**Same as join - MUST rekey:**

```
1. Generate GK'
2. Distribute to remaining members only
3. Delete old GK
```

**Guarantees:**
- Forward secrecy (leaver can't read new messages)
- Post-compromise security (compromised key can't read new messages)

### Group Sender State

Each client stores:
```
(group_id, sender_id) -> sender_chain_key, message_index
```

**If state lost:**
- Request re-distribution from sender
- Rotate GK if necessary for security

---

## Voice/Video Chat (WebRTC E2EE)

### Key Establishment

WebRTC provides:
```
DTLS → SRTP keys (automatic)
```

**Add application-level trust:**

1. Sign DTLS fingerprint with identity key:
   ```
   fingerprint_sig = Ed25519_sign(IK_priv, dtls_fingerprint)
   ```

2. Verify via existing E2EE session:
   ```
   verify(fingerprint_sig, IK_pub, dtls_fingerprint)
   ```

### Optional: Additional Wrapping

```
derive SRTP master secret
wrap with:
  - Group GK (for group calls)
  - Pairwise RK (for 1:1 calls)
```

### Server Role

- **Only signaling** (ICE candidates, SDP exchange)
- **No access to media keys**
- **No access to decrypted audio/video**

---

## Desktop App Authentication (Optimized)

### Architecture Overview

```
React (renderer process)
   ↓ Wails bridge
Wails Go backend (trusted environment)
   ├─ Owns local HTTP loopback server (127.0.0.1)
   ├─ Stores Clerk tokens securely (OS keychain / encrypted storage)
   └─ Exposes auth events/status to renderer
Backend server (Go)
   └─ Verifies Clerk tokens & issues optional short-lived app tokens
```

**Security principle:** Renderer never handles raw Clerk tokens.

### Clerk Dashboard Setup

1. **Enable Hosted Sign-In Page** (recommended for desktop apps)

2. **Add loopback URLs under Redirect URLs:**
   ```
   http://127.0.0.1:PORT/clerk/callback
   http://localhost:PORT/clerk/callback
   ```
   - `PORT` can be fixed or dynamically assigned
   - Clerk supports multiple redirect URLs

3. **All login and registration flows** handled by hosted page

---

### Login / Registration Flow

#### Step 1: Initiate Auth

**Renderer → Wails Backend:**
```javascript
StartAuth()
```

**Backend generates:**
```
state = random 32 bytes    (CSRF protection)
nonce = random 32 bytes    (optional, for OpenID)
```

**Opens system browser to:**
```
https://YOUR_APP.clerk.dev/sign-in
  ?redirect_url=http://127.0.0.1:{port}/clerk/callback
  &state={state}
```

**Browser handles:**
- Login
- Registration
- MFA
- Password reset

#### Step 2: Clerk Callback

**Clerk redirects to local loopback:**
```
GET /clerk/callback?code=...&state=...
```

**Wails backend:**
1. Verifies `state` (CSRF protection)
2. Exchanges `code` for Clerk session:
   ```
   POST https://api.clerk.dev/v1/oauth/token
   Response: { user_id, session_token, expires_at }
   ```
3. Stores session encrypted locally
4. Emits event over Wails bridge to renderer

**Polite callback page HTML:**
```html
<html>
  <body>
    <h2>Login successful!</h2>
    <p>You can close this window.</p>
  </body>
  <script>setTimeout(() => window.close(), 1000)</script>
</html>
```

#### Step 3: Persistent Login

**On app restart:**
```
1. Backend checks for stored Clerk session token
2. If valid → silent auth (no browser)
3. If expired → repeat browser flow
```

**Logout:**
```
1. Delete local token
2. Optionally revoke session via Clerk API
```

---

### Backend Verification

**Wails → Go Server:**
```
Authorization: Bearer <Clerk session token>
```

**Server:**
1. Verifies with Clerk API
2. Maps `clerk_user_id` → `internal user_id`
3. Optionally issues short-lived internal app token

---

### Security Features

✅ **Tokens never exposed to renderer JavaScript**
✅ **Loopback server bound to `127.0.0.1` only**
✅ **CSRF protection via `state` parameter**
✅ **Works offline after initial login** (cached session)
✅ **Supports multi-account** (multiple encrypted sessions keyed by `clerk_user_id`)

---

### User Experience

1. System browser opens for login/register
2. Browser may briefly flash `localhost` URL (standard OAuth pattern)
3. Callback page auto-closes
4. Renderer receives success event seamlessly
5. **No copy-paste or custom URI schemes required**

---

## Known Issues & Migration Strategy

### Current Problems

1. **Inefficient Auth Patterns**
   - Tokens potentially exposed to renderer
   - No proper CSRF protection
   - Session management scattered across layers

2. **Database Schema Issues**
   - Missing indexes for common queries
   - Inefficient key rotation tracking
   - No proper migration system

### Migration Approach

#### Phase 1: Auth Refactor
- [ ] Move all token handling to Wails Go backend
- [ ] Implement loopback server with CSRF protection
- [ ] Add encrypted token storage (OS keychain)
- [ ] Update Clerk dashboard redirect URLs

#### Phase 2: Database Schema Updates
- [ ] Add proper indexes for session, message, and key lookups
- [ ] Implement key rotation tracking
- [ ] Add migration system (e.g., golang-migrate)
- [ ] Separate local vs remote schema concerns

#### Phase 3: Cryptographic Implementation
- [ ] Implement X3DH handshake
- [ ] Implement Double Ratchet
- [ ] Implement Sender Keys for groups
- [ ] Add proper key deletion after use

#### Phase 4: Multi-Device Support
- [ ] Device registration flow
- [ ] Message fan-out logic
- [ ] Device removal and rekey flow

---

## Security Guarantees

✅ **Forward Secrecy**: Old keys deleted immediately after use
✅ **Post-Compromise Security**: Key rotation prevents past compromise from affecting future messages
✅ **Multi-Device Isolation**: Each device is cryptographically independent
✅ **Group Membership Privacy**: Server only sees metadata, not content
✅ **Server Learns Nothing**: All encryption happens client-side

---

### Key Dependencies

**Go Backend:**
- Wails framework
- libsql-go (Turso)
- Clerk Go SDK
- Ably Go SDK

**Frontend:**
- React + TypeScript
- Vite (dev server)
- Wails React bindings

### Testing Strategy

- Unit tests for cryptographic primitives
- Integration tests for key exchange flows
- E2E tests for multi-device scenarios
- Load tests for message fan-out

---

## References

- [Signal Protocol Specification](https://signal.org/docs/)
- [X3DH Key Agreement](https://signal.org/docs/specifications/x3dh/)
- [Double Ratchet Algorithm](https://signal.org/docs/specifications/doubleratchet/)
- [Wails Documentation](https://wails.io/)
- [Clerk Desktop Auth Guide](https://clerk.dev/)

---

**Last Updated**: December 2025
**Document Version**: 1.0