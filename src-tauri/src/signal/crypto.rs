use crate::signal::group::SenderKeyState;
use crate::error::{Error, Result};
use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit, aead::Aead};
use hkdf::Hkdf;
use sha2::Sha256;
use x25519_dalek::{StaticSecret, PublicKey as X25519PublicKey};
use rand::rngs::OsRng;

const SENDER_KEY_DIST_INFO: &[u8] = b"Pollis SenderKeyDist v1";

/// Encrypt a SenderKeyState for delivery to a recipient.
/// Uses a fresh ephemeral X25519 key + HKDF to derive an AES-256-GCM key,
/// then encrypts the JSON-serialized SenderKeyState.
/// Returns (encrypted_state_hex, ephemeral_public_key_hex).
pub fn encrypt_sender_key_for_recipient(
    sender_key_state: &SenderKeyState,
    recipient_identity_key: &[u8; 32],
    recipient_spk: &[u8; 32],
) -> Result<(String, String)> {
    let ephemeral = StaticSecret::random_from_rng(OsRng);
    let ephemeral_pub = X25519PublicKey::from(&ephemeral);

    let recipient_ik = X25519PublicKey::from(*recipient_identity_key);
    let recipient_spk_pub = X25519PublicKey::from(*recipient_spk);

    let dh1 = ephemeral.diffie_hellman(&recipient_ik);
    let dh2 = ephemeral.diffie_hellman(&recipient_spk_pub);

    let mut ikm = Vec::with_capacity(64);
    ikm.extend_from_slice(dh1.as_bytes());
    ikm.extend_from_slice(dh2.as_bytes());

    let hkdf = Hkdf::<Sha256>::new(None, &ikm);
    let mut key_bytes = [0u8; 32];
    hkdf.expand(SENDER_KEY_DIST_INFO, &mut key_bytes)
        .map_err(|_| Error::Crypto("HKDF expand failed for sender key dist".into()))?;

    let plaintext = serde_json::to_vec(sender_key_state)?;

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key_bytes));
    let nonce_bytes: [u8; 12] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ct = cipher.encrypt(nonce, plaintext.as_slice())
        .map_err(|_| Error::Crypto("AES-GCM encrypt failed for sender key dist".into()))?;

    // Prepend nonce to ciphertext then hex-encode
    let mut combined = nonce_bytes.to_vec();
    combined.extend(ct);

    Ok((hex::encode(combined), hex::encode(ephemeral_pub.as_bytes())))
}

/// Decrypt a SenderKeyState that was encrypted for us.
/// our_spk_secret: our signed prekey private key bytes.
pub fn decrypt_sender_key_distribution(
    encrypted_state_hex: &str,
    ephemeral_key_hex: &str,
    our_identity_secret: &StaticSecret,
    our_spk_secret: &StaticSecret,
) -> Result<SenderKeyState> {
    let combined = hex::decode(encrypted_state_hex)
        .map_err(|e| Error::Crypto(format!("invalid hex in encrypted state: {e}")))?;
    let ephemeral_bytes = hex::decode(ephemeral_key_hex)
        .map_err(|e| Error::Crypto(format!("invalid hex in ephemeral key: {e}")))?;

    if ephemeral_bytes.len() != 32 {
        return Err(Error::Crypto("ephemeral key must be 32 bytes".into()));
    }
    let ephemeral_arr: [u8; 32] = ephemeral_bytes.try_into()
        .map_err(|_| Error::Crypto("ephemeral key conversion failed".into()))?;
    let ephemeral_pub = X25519PublicKey::from(ephemeral_arr);

    // DH1 = DH(our_identity_secret, ephemeral_pk)
    let dh1 = our_identity_secret.diffie_hellman(&ephemeral_pub);
    // DH2 = DH(our_spk_secret, ephemeral_pk)
    let dh2 = our_spk_secret.diffie_hellman(&ephemeral_pub);

    let mut ikm = Vec::with_capacity(64);
    ikm.extend_from_slice(dh1.as_bytes());
    ikm.extend_from_slice(dh2.as_bytes());

    let hkdf = Hkdf::<Sha256>::new(None, &ikm);
    let mut key_bytes = [0u8; 32];
    hkdf.expand(SENDER_KEY_DIST_INFO, &mut key_bytes)
        .map_err(|_| Error::Crypto("HKDF expand failed for sender key dist decrypt".into()))?;

    if combined.len() < 12 {
        return Err(Error::Crypto("encrypted state too short".into()));
    }

    let nonce = Nonce::from_slice(&combined[..12]);
    let ct = &combined[12..];

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key_bytes));
    let plaintext = cipher.decrypt(nonce, ct)
        .map_err(|_| Error::Crypto("AES-GCM decrypt failed for sender key dist".into()))?;

    let state: SenderKeyState = serde_json::from_slice(&plaintext)?;
    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use x25519_dalek::StaticSecret;
    use rand::rngs::OsRng;

    fn make_keypair() -> (StaticSecret, X25519PublicKey) {
        let secret = StaticSecret::random_from_rng(OsRng);
        let public = X25519PublicKey::from(&secret);
        (secret, public)
    }

    #[test]
    fn encrypt_then_decrypt_roundtrip() {
        let (ik_secret, ik_pub) = make_keypair();
        let (spk_secret, spk_pub) = make_keypair();

        let state = SenderKeyState::new();
        let ik_bytes: [u8; 32] = *ik_pub.as_bytes();
        let spk_bytes: [u8; 32] = *spk_pub.as_bytes();

        let (encrypted_hex, ephemeral_hex) =
            encrypt_sender_key_for_recipient(&state, &ik_bytes, &spk_bytes)
                .expect("encrypt should succeed");

        let decrypted = decrypt_sender_key_distribution(
            &encrypted_hex,
            &ephemeral_hex,
            &ik_secret,
            &spk_secret,
        ).expect("decrypt should succeed");

        assert_eq!(state.chain_id, decrypted.chain_id);
        assert_eq!(state.iteration, decrypted.iteration);
        assert_eq!(state.chain_key, decrypted.chain_key);
    }

    #[test]
    fn wrong_key_fails_to_decrypt() {
        let (_ik_secret, ik_pub) = make_keypair();
        let (_spk_secret, spk_pub) = make_keypair();
        let (wrong_ik, _) = make_keypair();
        let (wrong_spk, _) = make_keypair();

        let state = SenderKeyState::new();
        let ik_bytes: [u8; 32] = *ik_pub.as_bytes();
        let spk_bytes: [u8; 32] = *spk_pub.as_bytes();

        let (encrypted_hex, ephemeral_hex) =
            encrypt_sender_key_for_recipient(&state, &ik_bytes, &spk_bytes)
                .expect("encrypt should succeed");

        let result = decrypt_sender_key_distribution(
            &encrypted_hex,
            &ephemeral_hex,
            &wrong_ik,
            &wrong_spk,
        );

        assert!(result.is_err(), "decryption with wrong keys should fail");
    }
}
