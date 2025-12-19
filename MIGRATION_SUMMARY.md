# Pollis Auth & Database Migration - Implementation Summary

## Overview

This document summarizes the comprehensive migration implemented to address auth pattern inefficiencies and database schema issues identified in [AUTH_AND_DB_MIGRATION.md](AUTH_AND_DB_MIGRATION.md).

## Completed Changes

### 1. Database Schema Updates

#### Local Database (Desktop App)

**New Migration:** [internal/database/migrations/005_comprehensive_schema.sql](internal/database/migrations/005_comprehensive_schema.sql)

**New Tables:**
- `auth_session` - Stores Clerk session tokens securely
  - Tracks session expiration and last usage
  - Enables multi-session support per user

- `device` - Multi-device support per Signal Protocol spec
  - Each device has unique identity keys
  - Tracks device registration time and name

- `identity_key` - Long-term identity keypair (encrypted)
  - Separated from users table for better security architecture
  - Private keys encrypted with local master key

- `signed_prekey` - X3DH signed prekeys (encrypted)
  - Rotation support via expires_at timestamp
  - Used for Signal Protocol key agreement

- `one_time_prekey` - X3DH one-time prekeys (encrypted)
  - Single-use keys for forward secrecy
  - Consumed flag for tracking usage

- `session` - Double Ratchet session state (encrypted)
  - Per-peer/device session tracking
  - Send/receive message counters
  - Encrypted root and chain keys

- `group_sender_key` - Group encryption keys
  - Distribution state tracking
  - Enables efficient group messaging

- `alias` - Per-group display names
  - Privacy-preserving group identities

- `attachment` - Message file attachments
  - Encrypted file storage
  - MIME type and size tracking

- `rtc_session` - WebRTC encrypted sessions
  - SRTP key storage for voice/video

- `key_value` - Generic key-value store
  - Feature flags and migration tracking

**Updated Tables:**
- `message` - Restructured to match AUTH_AND_DB_MIGRATION.md spec
  - Added `conversation_id`, `nonce`, `delivered` fields
  - Renamed `content_encrypted` → `ciphertext`
  - Renamed `author_id` → `sender_id`
  - Maintained backward compatibility fields

**Indexes Added:**
- Performance indexes on all foreign keys
- Indexes on frequently queried fields (expires_at, consumed, delivered, etc.)

#### Remote Database (Server)

**New Migration:** [server/internal/database/migrations/008_comprehensive_schema.sql](server/internal/database/migrations/008_comprehensive_schema.sql)

**Schema Changes:**
- `user` table simplified (removed username/email/phone/avatar_url)
  - Added `disabled` flag for account management
  - Minimal metadata-only storage

- `device` table added (multi-device support)
  - Links devices to users
  - Stores device public keys

- `identity_key` table - Public identity keys for key distribution

- `signed_prekey` & `one_time_prekey` tables - Prekey bundles for X3DH

- `group_table` renamed from `groups` (SQLite reserved word avoidance)

- `group_member` - Updated to use user_id instead of user_identifier

- `channel` renamed from `channels`

- `alias` - Per-group display names

- `message_envelope` - Optional message relay

- `rtc_room` & `rtc_participant` - Voice/video signaling support

**Cleanup:**
- Dropped redundant `prekey_bundles` table

### 2. Data Models

**File:** [internal/models/models.go](internal/models/models.go)

**New Models:**
- `AuthSession` - Local auth session tracking
- `Device` - Device registration
- `IdentityKey` - Long-term identity keypair
- `SignedPreKey` - X3DH signed prekeys
- `OneTimePreKey` - X3DH one-time prekeys
- `Session` - Double Ratchet session state
- `GroupMembership` - Group member roles
- `GroupSenderKey` - Group encryption keys
- `Alias` - Per-group display names
- `Attachment` - File attachments
- `RTCSession` - WebRTC sessions
- `KeyValue` - Generic key-value store

**Updated Models:**
- `User` - Removed identity key fields (now in separate table)
- `Message` - Updated to match new schema (ciphertext, nonce, conversation_id)

**Maintained for Backward Compatibility:**
- `SignalSession`, `GroupKey`, `GroupMember`, `MessageAttachment`, etc.

### 3. New Services

#### [AuthSessionService](internal/services/auth_session_service.go)

Manages authentication session lifecycle:
- `CreateSession()` - Store new Clerk session
- `GetSessionByClerkUserID()` - Retrieve active session
- `UpdateLastUsed()` - Track session usage
- `UpdateTokens()` - Refresh expired tokens
- `DeleteSession()` - Logout
- `IsExpired()` - Session validation
- `CleanupExpiredSessions()` - Maintenance

#### [DeviceService](internal/services/device_service.go)

Handles multi-device support:
- `RegisterDevice()` - Register new device with identity key
- `GetDeviceByID()` - Retrieve device info
- `GetDevicesByClerkUserID()` - List all user devices
- `GetCurrentDevice()` - Get most recent device
- `UpdateDeviceName()` - Rename device
- `DeleteDevice()` - Revoke device

#### [IdentityKeyService](internal/services/identity_key_service.go)

Manages long-term identity keys:
- `CreateIdentityKey()` - Store new identity keypair (encrypted)
- `GetIdentityKey()` - Retrieve current identity key
- `GetIdentityKeyByID()` - Get specific key version
- `HasIdentityKey()` - Check if key exists
- `DeleteIdentityKey()` - Revoke identity (breaks existing sessions)

#### [PrekeyService](internal/services/prekey_service.go)

Handles X3DH prekey lifecycle:

**Signed PreKeys:**
- `CreateSignedPreKey()` - Store new signed prekey
- `GetCurrentSignedPreKey()` - Get active non-expired key
- `DeleteExpiredSignedPreKeys()` - Cleanup

**One-Time PreKeys:**
- `CreateOneTimePreKey()` - Store single prekey
- `CreateOneTimePreKeyBatch()` - Bulk upload
- `GetUnconsumedOneTimePreKey()` - Fetch for X3DH
- `MarkOneTimePreKeyConsumed()` - Mark as used
- `CountUnconsumedOneTimePreKeys()` - Monitor prekey supply
- `DeleteConsumedOneTimePreKeys()` - Cleanup

### 4. Refactored Services

#### [ClerkService](internal/services/clerk_service.go)

**Before:** 344 lines with extensive fallback logic
**After:** 119 lines, clean and straightforward

**Removed:**
- Complex JWT decoding fallback logic
- Frontend API workarounds
- Development token (`dvb_`) handling
- User listing as fallback
- Session ID guessing
- Base64 decoding attempts

**Simplified to:**
- `VerifySessionToken()` - JWT verification only
- `VerifySession()` - Session ID verification
- `GetUser()` - User lookup by ID
- `GetUserByEmail()` - Email search
- `GetUserByPhoneNumber()` - Phone search
- `RevokeSession()` - Session revocation

**Result:** Cleaner, more maintainable, follows Clerk best practices

#### [UserService](internal/services/user_service.go)

**Updated for new schema:**
- Removed identity key management (now in IdentityKeyService)
- Removed username/email/phone fields (stored remotely)
- Simplified `CreateUser()` to only store ID and Clerk ID
- Simplified `UpdateUser()` to only update timestamp
- Added `DeleteUser()` and `DeleteUserByClerkID()` methods
- Maintained backward compatibility for migration period

## Security Improvements

1. **Token Handling:**
   - Tokens never exposed to frontend React code
   - Stored securely in OS keychain via KeychainService
   - Session tokens verified using proper JWT validation

2. **Key Storage:**
   - All private keys encrypted at rest with local master key
   - Separation of identity keys from user data
   - Proper key lifecycle management (rotation, expiration)

3. **Multi-Device Support:**
   - Each device has independent cryptographic identity
   - Device revocation supported
   - Per-device session tracking

4. **CSRF Protection:**
   - State parameter in OAuth flow (to be implemented in app.go)
   - Loopback server bound to 127.0.0.1 only

## Performance Improvements

1. **Database Indexes:**
   - Indexes on all foreign keys
   - Indexes on frequently queried fields (expires_at, consumed, etc.)
   - Composite indexes for common query patterns

2. **Efficient Queries:**
   - Simplified user queries (no unnecessary JOINs)
   - Proper use of LIMIT for single-record queries
   - Batch operations for prekey upload

3. **Schema Normalization:**
   - Separated concerns (auth, devices, keys, messages)
   - Reduced data duplication
   - Cleaner foreign key relationships

## Backward Compatibility

Migration maintains compatibility:
- Old models kept with deprecation comments
- UserService attempts old schema queries if new schema fails
- Message table migration preserves existing data
- Group/channel table renames handled gracefully

## Remaining Tasks

The following tasks are still pending (tracked in TODO list):

1. **Update app.go auth flow** - Refactor to use browser OAuth exclusively
2. **Replace ClerkAuth.tsx** - Remove embedded Clerk UI, use auth initiation only
3. **Update server handlers** - Support new device registration flow
4. **Remove old migrations** - Clean up superseded migration files
5. **Update DB initialization** - Handle new migration files
6. **End-to-end testing** - Verify complete auth flow

## Migration Impact

### Breaking Changes

- **Identity keys moved:** Code accessing `user.IdentityKeyPublic`/`Private` must use `IdentityKeyService`
- **User table schema:** `username`/`email`/`phone` removed from local storage
- **Message schema:** Field names changed (content_encrypted → ciphertext, etc.)

### Non-Breaking Changes

- New tables can coexist with existing data
- Services added (no existing services removed)
- Models extended (backward-compatible wrappers maintained)

## Testing Recommendations

1. **Database Migration:**
   - Test migration on database with existing users
   - Verify data preservation in messages table
   - Confirm indexes created successfully

2. **Auth Flow:**
   - Test new session creation and retrieval
   - Verify token refresh logic
   - Test session expiration and cleanup

3. **Device Management:**
   - Register multiple devices per user
   - Test device listing and revocation
   - Verify device-specific crypto keys

4. **Key Management:**
   - Generate identity and prekeys
   - Test key rotation (signed prekeys)
   - Verify one-time prekey consumption

5. **Backward Compatibility:**
   - Test with existing user data
   - Verify old schema fallback in UserService
   - Confirm message decryption still works

## Architecture Benefits

1. **Cleaner Separation of Concerns:**
   - Auth (AuthSessionService, ClerkService)
   - Devices (DeviceService)
   - Cryptography (IdentityKeyService, PrekeyService)
   - Users (UserService)

2. **Signal Protocol Compliance:**
   - Proper X3DH key management
   - Double Ratchet session state
   - Multi-device support as per spec

3. **Scalability:**
   - Efficient prekey replenishment
   - Device-specific sessions
   - Proper session cleanup

4. **Maintainability:**
   - Reduced code complexity (ClerkService: 344 → 119 lines)
   - Clear service responsibilities
   - Well-documented schema

## Next Steps

To complete the migration:

1. Refactor `app.go` authentication flow
2. Update frontend `ClerkAuth.tsx` component
3. Update server gRPC handlers for device registration
4. Remove deprecated migration files
5. Run comprehensive end-to-end tests
6. Update deployment documentation

## References

- [AUTH_AND_DB_MIGRATION.md](AUTH_AND_DB_MIGRATION.md) - Full migration specification
- [SPEC.md](SPEC.md) - Original application specification
- [Signal Protocol Docs](https://signal.org/docs/) - Cryptographic implementation reference

---

**Migration Date:** December 2025
**Status:** ~60% Complete (Core infrastructure done, app.go and frontend pending)
