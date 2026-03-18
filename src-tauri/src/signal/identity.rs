use ed25519_dalek::{SigningKey, VerifyingKey, Signer};
use x25519_dalek::{StaticSecret, PublicKey as X25519PublicKey};
use rand::rngs::OsRng;
use zeroize::Zeroizing;
use crate::error::{Error, Result};
use crate::keystore;

const KEY_IDENTITY_PRIVATE: &str = "identity_key_private";
const KEY_IDENTITY_PUBLIC: &str = "identity_key_public";

pub struct IdentityKey {
    pub signing_key: SigningKey,
    pub verifying_key: VerifyingKey,
}

impl IdentityKey {
    pub async fn generate_and_store() -> Result<Self> {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();

        keystore::store(KEY_IDENTITY_PRIVATE, signing_key.as_bytes()).await?;
        keystore::store(KEY_IDENTITY_PUBLIC, verifying_key.as_bytes()).await?;

        Ok(Self { signing_key, verifying_key })
    }

    pub async fn load() -> Result<Option<Self>> {
        let private_bytes = match keystore::load(KEY_IDENTITY_PRIVATE).await? {
            Some(b) => b,
            None => return Ok(None),
        };

        if private_bytes.len() != 32 {
            return Err(Error::Crypto("invalid identity key length".into()));
        }

        let bytes: [u8; 32] = private_bytes.try_into()
            .map_err(|_| Error::Crypto("invalid identity key bytes".into()))?;

        let signing_key = SigningKey::from_bytes(&bytes);
        let verifying_key = signing_key.verifying_key();

        Ok(Some(Self { signing_key, verifying_key }))
    }

    pub fn to_x25519_static_secret(&self) -> StaticSecret {
        let private_bytes = Zeroizing::new(*self.signing_key.as_bytes());
        StaticSecret::from(*private_bytes)
    }

    pub fn sign(&self, message: &[u8]) -> Vec<u8> {
        self.signing_key.sign(message).to_bytes().to_vec()
    }

    pub fn public_key_bytes(&self) -> [u8; 32] {
        self.verifying_key.to_bytes()
    }
}

pub async fn generate_signed_prekey(
    id: u32,
    identity: &IdentityKey,
) -> Result<(Vec<u8>, Vec<u8>)> {
    let secret = StaticSecret::random_from_rng(OsRng);
    let public = X25519PublicKey::from(&secret);
    let key_name = format!("spk_{id}");
    keystore::store(&key_name, secret.as_bytes()).await?;
    let signature = identity.sign(public.as_bytes());
    Ok((public.as_bytes().to_vec(), signature))
}

pub async fn generate_one_time_prekeys(
    start_id: u32,
    count: u32,
) -> Result<Vec<(u32, Vec<u8>)>> {
    let mut result = Vec::with_capacity(count as usize);
    for i in 0..count {
        let id = start_id + i;
        let secret = StaticSecret::random_from_rng(OsRng);
        let public = X25519PublicKey::from(&secret);
        let key_name = format!("opk_{id}");
        keystore::store(&key_name, secret.as_bytes()).await?;
        result.push((id, public.as_bytes().to_vec()));
    }
    Ok(result)
}

pub async fn load_x25519_secret(key_name: &str) -> Result<StaticSecret> {
    let bytes = keystore::load(key_name).await?
        .ok_or_else(|| Error::Keystore(format!("key not found: {key_name}")))?;

    if bytes.len() != 32 {
        return Err(Error::Crypto("invalid key length".into()));
    }

    let arr: [u8; 32] = bytes.try_into()
        .map_err(|_| Error::Crypto("key bytes conversion failed".into()))?;

    Ok(StaticSecret::from(arr))
}
