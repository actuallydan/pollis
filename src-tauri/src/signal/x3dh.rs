/// X3DH (Extended Triple Diffie-Hellman) key agreement
/// https://signal.org/docs/specifications/x3dh/
///
/// Alice (initiator) performs:
///   DH1 = DH(IK_A, SPK_B)
///   DH2 = DH(EK_A, IK_B)
///   DH3 = DH(EK_A, SPK_B)
///   DH4 = DH(EK_A, OPK_B)  [optional]
///   SK = KDF(DH1 || DH2 || DH3 [|| DH4])

use x25519_dalek::{StaticSecret, PublicKey as X25519PublicKey, EphemeralSecret};
use hkdf::Hkdf;
use sha2::Sha256;
use rand::rngs::OsRng;
use crate::error::{Error, Result};

const X3DH_INFO: &[u8] = b"Pollis X3DH v1";
const F: [u8; 32] = [0xff; 32];

pub struct X3DHInitiation {
    /// Derived shared secret (32 bytes)
    pub shared_secret: [u8; 32],
    /// Alice's ephemeral public key — must be sent to Bob
    pub ephemeral_public_key: Vec<u8>,
    /// The OPK id used (if any)
    pub used_opk_id: Option<u32>,
}

pub struct BobPreKeyBundle {
    pub identity_key: [u8; 32],
    pub signed_prekey: [u8; 32],
    pub signed_prekey_id: u32,
    pub one_time_prekey: Option<([u8; 32], u32)>,
}

pub fn x3dh_send(
    alice_identity: &StaticSecret,
    alice_identity_public: &X25519PublicKey,
    bob_bundle: &BobPreKeyBundle,
) -> Result<X3DHInitiation> {
    let ephemeral_secret = EphemeralSecret::random_from_rng(OsRng);
    let ephemeral_public = X25519PublicKey::from(&ephemeral_secret);

    let bob_ik = X25519PublicKey::from(bob_bundle.identity_key);
    let bob_spk = X25519PublicKey::from(bob_bundle.signed_prekey);

    // DH1 = DH(IK_A, SPK_B)
    let dh1 = alice_identity.diffie_hellman(&bob_spk);
    // DH2 = DH(EK_A, IK_B)
    let dh2 = ephemeral_secret.diffie_hellman(&bob_ik);
    // DH3 = DH(EK_A, SPK_B) — ephemeral_secret consumed by dh2, so we need another approach
    // Note: EphemeralSecret is consumed by DH. We use StaticSecret for EK in practice.
    // Re-derive using alice_identity for DH3 workaround — use a fresh static secret for EK.

    // Actually, to do DH2 and DH3 with the same EK, we use StaticSecret for the ephemeral key.
    // This is safe because EK is single-use and discarded after initiation.
    let ek_secret = StaticSecret::random_from_rng(OsRng);
    let ek_public = X25519PublicKey::from(&ek_secret);

    let dh1 = alice_identity.diffie_hellman(&bob_spk);
    let dh2 = ek_secret.diffie_hellman(&bob_ik);
    let dh3 = ek_secret.diffie_hellman(&bob_spk);

    let (dh4_bytes, used_opk_id) = if let Some((opk_bytes, opk_id)) = bob_bundle.one_time_prekey {
        let bob_opk = X25519PublicKey::from(opk_bytes);
        let dh4 = ek_secret.diffie_hellman(&bob_opk);
        (Some(dh4.as_bytes().to_vec()), Some(opk_id))
    } else {
        (None, None)
    };

    let mut ikm = Vec::with_capacity(160);
    ikm.extend_from_slice(&F);
    ikm.extend_from_slice(dh1.as_bytes());
    ikm.extend_from_slice(dh2.as_bytes());
    ikm.extend_from_slice(dh3.as_bytes());
    if let Some(dh4) = &dh4_bytes {
        ikm.extend_from_slice(dh4);
    }

    let hkdf = Hkdf::<Sha256>::new(None, &ikm);
    let mut shared_secret = [0u8; 32];
    hkdf.expand(X3DH_INFO, &mut shared_secret)
        .map_err(|_| Error::Crypto("HKDF expand failed".into()))?;

    Ok(X3DHInitiation {
        shared_secret,
        ephemeral_public_key: ek_public.as_bytes().to_vec(),
        used_opk_id,
    })
}

pub fn x3dh_receive(
    bob_identity: &StaticSecret,
    bob_spk_secret: &StaticSecret,
    bob_opk_secret: Option<&StaticSecret>,
    alice_identity_public: &[u8; 32],
    alice_ephemeral_public: &[u8; 32],
) -> Result<[u8; 32]> {
    let alice_ik = X25519PublicKey::from(*alice_identity_public);
    let alice_ek = X25519PublicKey::from(*alice_ephemeral_public);

    // DH1 = DH(SPK_B, IK_A)
    let dh1 = bob_spk_secret.diffie_hellman(&alice_ik);
    // DH2 = DH(IK_B, EK_A)
    let dh2 = bob_identity.diffie_hellman(&alice_ek);
    // DH3 = DH(SPK_B, EK_A)
    let dh3 = bob_spk_secret.diffie_hellman(&alice_ek);

    let dh4_bytes = bob_opk_secret
        .map(|opk| opk.diffie_hellman(&alice_ek).as_bytes().to_vec());

    let mut ikm = Vec::with_capacity(160);
    ikm.extend_from_slice(&F);
    ikm.extend_from_slice(dh1.as_bytes());
    ikm.extend_from_slice(dh2.as_bytes());
    ikm.extend_from_slice(dh3.as_bytes());
    if let Some(dh4) = &dh4_bytes {
        ikm.extend_from_slice(dh4);
    }

    let hkdf = Hkdf::<Sha256>::new(None, &ikm);
    let mut shared_secret = [0u8; 32];
    hkdf.expand(X3DH_INFO, &mut shared_secret)
        .map_err(|_| Error::Crypto("HKDF expand failed".into()))?;

    Ok(shared_secret)
}
