/// Double Ratchet Algorithm
/// https://signal.org/docs/specifications/doubleratchet/

use x25519_dalek::{StaticSecret, PublicKey as X25519PublicKey};
use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit};
use aes_gcm::aead::Aead;
use hkdf::Hkdf;
use hmac::Hmac;
use hmac::Mac as HmacMac;
use sha2::Sha256;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use crate::error::{Error, Result};

const MESSAGE_KEY_SEED: &[u8] = b"Pollis MessageKeys v1";
const CHAIN_KEY_SEED: &[u8] = b"Pollis ChainKey v1";
const ROOT_KEY_INFO: &[u8] = b"Pollis RootKey v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RatchetState {
    pub root_key: Vec<u8>,
    pub sending_chain_key: Vec<u8>,
    pub receiving_chain_key: Vec<u8>,
    pub sending_ratchet_key_public: Vec<u8>,
    pub sending_ratchet_key_secret: Vec<u8>,
    pub remote_ratchet_key: Vec<u8>,
    pub send_count: u32,
    pub recv_count: u32,
    pub prev_send_count: u32,
    /// Skipped message keys: (ratchet_public_key, n) -> message_key
    pub skipped_keys: Vec<(Vec<u8>, u32, Vec<u8>)>,
}

pub struct EncryptedMessage {
    pub ciphertext: Vec<u8>,
    pub header: MessageHeader,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageHeader {
    pub ratchet_public_key: Vec<u8>,
    pub prev_chain_len: u32,
    pub message_n: u32,
}

impl RatchetState {
    pub fn init_sender(shared_secret: &[u8; 32], receiver_ratchet_key: &[u8; 32]) -> Result<Self> {
        let send_ratchet = StaticSecret::random_from_rng(OsRng);
        let send_ratchet_pub = X25519PublicKey::from(&send_ratchet);
        let receiver_pub = X25519PublicKey::from(*receiver_ratchet_key);

        let dh = send_ratchet.diffie_hellman(&receiver_pub);
        let (root_key, chain_key) = kdf_rk(shared_secret, dh.as_bytes())?;

        Ok(Self {
            root_key,
            sending_chain_key: chain_key,
            receiving_chain_key: vec![0u8; 32],
            sending_ratchet_key_public: send_ratchet_pub.as_bytes().to_vec(),
            sending_ratchet_key_secret: send_ratchet.as_bytes().to_vec(),
            remote_ratchet_key: receiver_ratchet_key.to_vec(),
            send_count: 0,
            recv_count: 0,
            prev_send_count: 0,
            skipped_keys: vec![],
        })
    }

    pub fn init_receiver(shared_secret: &[u8; 32], own_ratchet_key_secret: &StaticSecret) -> Result<Self> {
        let own_pub = X25519PublicKey::from(own_ratchet_key_secret);
        Ok(Self {
            root_key: shared_secret.to_vec(),
            sending_chain_key: vec![0u8; 32],
            receiving_chain_key: vec![0u8; 32],
            sending_ratchet_key_public: own_pub.as_bytes().to_vec(),
            sending_ratchet_key_secret: own_ratchet_key_secret.as_bytes().to_vec(),
            remote_ratchet_key: vec![0u8; 32],
            send_count: 0,
            recv_count: 0,
            prev_send_count: 0,
            skipped_keys: vec![],
        })
    }

    pub fn encrypt(&mut self, plaintext: &[u8]) -> Result<EncryptedMessage> {
        let (new_chain_key, message_key) = kdf_ck(&self.sending_chain_key)?;
        self.sending_chain_key = new_chain_key;

        let header = MessageHeader {
            ratchet_public_key: self.sending_ratchet_key_public.clone(),
            prev_chain_len: self.prev_send_count,
            message_n: self.send_count,
        };

        let ciphertext = aes_gcm_encrypt(&message_key, &header_bytes(&header), plaintext)?;
        self.send_count += 1;

        Ok(EncryptedMessage { ciphertext, header })
    }

    pub fn decrypt(
        &mut self,
        msg: &EncryptedMessage,
    ) -> Result<Vec<u8>> {
        // Check skipped keys first
        let skip_key = (
            msg.header.ratchet_public_key.clone(),
            msg.header.message_n,
        );
        if let Some(pos) = self.skipped_keys.iter().position(|(r, n, _)| {
            r == &skip_key.0 && *n == skip_key.1
        }) {
            let mk = self.skipped_keys.remove(pos).2;
            return aes_gcm_decrypt(&mk, &header_bytes(&msg.header), &msg.ciphertext);
        }

        // Ratchet step if new ratchet key
        if msg.header.ratchet_public_key != self.remote_ratchet_key {
            self.skip_message_keys(msg.header.prev_chain_len)?;
            // Reconstruct the own secret from stored bytes
            let own_secret_bytes: [u8; 32] = self.sending_ratchet_key_secret.clone()
                .try_into()
                .map_err(|_| crate::error::Error::Crypto("invalid ratchet secret length".into()))?;
            let own_secret = StaticSecret::from(own_secret_bytes);
            self.ratchet_step(&msg.header.ratchet_public_key, &own_secret)?;
        }

        self.skip_message_keys(msg.header.message_n)?;

        let (new_chain_key, message_key) = kdf_ck(&self.receiving_chain_key)?;
        self.receiving_chain_key = new_chain_key;
        self.recv_count += 1;

        aes_gcm_decrypt(&message_key, &header_bytes(&msg.header), &msg.ciphertext)
    }

    fn ratchet_step(&mut self, remote_pub_bytes: &[u8], own_secret: &StaticSecret) -> Result<()> {
        if remote_pub_bytes.len() != 32 {
            return Err(Error::Crypto("invalid ratchet key length".into()));
        }

        let remote_pub_arr: [u8; 32] = remote_pub_bytes.try_into()
            .map_err(|_| Error::Crypto("ratchet key conversion failed".into()))?;
        let remote_pub = X25519PublicKey::from(remote_pub_arr);

        let dh = own_secret.diffie_hellman(&remote_pub);
        let (root_key, recv_chain_key) = kdf_rk(&self.root_key, dh.as_bytes())?;

        let new_send_ratchet = StaticSecret::random_from_rng(OsRng);
        let new_send_pub = X25519PublicKey::from(&new_send_ratchet);
        let dh2 = new_send_ratchet.diffie_hellman(&remote_pub);
        let (new_root_key, send_chain_key) = kdf_rk(&root_key, dh2.as_bytes())?;

        self.prev_send_count = self.send_count;
        self.send_count = 0;
        self.recv_count = 0;
        self.root_key = new_root_key;
        self.receiving_chain_key = recv_chain_key;
        self.sending_chain_key = send_chain_key;
        self.remote_ratchet_key = remote_pub_bytes.to_vec();
        self.sending_ratchet_key_public = new_send_pub.as_bytes().to_vec();
        self.sending_ratchet_key_secret = new_send_ratchet.as_bytes().to_vec();

        Ok(())
    }

    fn skip_message_keys(&mut self, until: u32) -> Result<()> {
        if self.recv_count > until {
            return Ok(());
        }
        // Cap to avoid runaway skipping
        if until - self.recv_count > 1000 {
            return Err(Error::Signal("too many skipped messages".into()));
        }

        while self.recv_count < until {
            let (new_chain_key, message_key) = kdf_ck(&self.receiving_chain_key)?;
            self.receiving_chain_key = new_chain_key;
            self.skipped_keys.push((
                self.remote_ratchet_key.clone(),
                self.recv_count,
                message_key,
            ));
            self.recv_count += 1;
        }
        Ok(())
    }
}

fn kdf_rk(root_key: &[u8], dh_output: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
    let hkdf = Hkdf::<Sha256>::new(Some(root_key), dh_output);
    let mut out = [0u8; 64];
    hkdf.expand(ROOT_KEY_INFO, &mut out)
        .map_err(|_| Error::Crypto("HKDF kdf_rk failed".into()))?;
    Ok((out[..32].to_vec(), out[32..].to_vec()))
}

fn kdf_ck(chain_key: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
    let mut mac_ck = <Hmac<Sha256> as HmacMac>::new_from_slice(chain_key)
        .map_err(|_| Error::Crypto("HMAC init failed".into()))?;
    HmacMac::update(&mut mac_ck, CHAIN_KEY_SEED);
    let new_ck = HmacMac::finalize(mac_ck).into_bytes().to_vec();

    let mut mac_mk = <Hmac<Sha256> as HmacMac>::new_from_slice(chain_key)
        .map_err(|_| Error::Crypto("HMAC init failed".into()))?;
    HmacMac::update(&mut mac_mk, MESSAGE_KEY_SEED);
    let mk = HmacMac::finalize(mac_mk).into_bytes().to_vec();

    Ok((new_ck, mk))
}

fn header_bytes(header: &MessageHeader) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&header.ratchet_public_key);
    out.extend_from_slice(&header.prev_chain_len.to_le_bytes());
    out.extend_from_slice(&header.message_n.to_le_bytes());
    out
}

fn aes_gcm_encrypt(key: &[u8], aad: &[u8], plaintext: &[u8]) -> Result<Vec<u8>> {
    let key: [u8; 32] = key[..32].try_into()
        .map_err(|_| Error::Crypto("invalid key size for AES-256-GCM".into()))?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));

    let nonce_bytes: [u8; 12] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ct = cipher.encrypt(nonce, aes_gcm::aead::Payload { msg: plaintext, aad })
        .map_err(|_| Error::Crypto("AES-GCM encrypt failed".into()))?;

    // Prepend nonce to ciphertext
    let mut result = nonce_bytes.to_vec();
    result.extend(ct);
    Ok(result)
}

fn aes_gcm_decrypt(key: &[u8], aad: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>> {
    if ciphertext.len() < 12 {
        return Err(Error::Crypto("ciphertext too short".into()));
    }

    let key: [u8; 32] = key[..32].try_into()
        .map_err(|_| Error::Crypto("invalid key size for AES-256-GCM".into()))?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));

    let nonce = Nonce::from_slice(&ciphertext[..12]);
    let ct = &ciphertext[12..];

    cipher.decrypt(nonce, aes_gcm::aead::Payload { msg: ct, aad })
        .map_err(|_| Error::Crypto("AES-GCM decrypt failed".into()))
}
