use keyring::Entry;
use crate::error::{Error, Result};

const SERVICE: &str = "pollis";

pub async fn store(key: &str, value: &[u8]) -> Result<()> {
    let key = key.to_string();
    let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, value);
    tokio::task::spawn_blocking(move || {
        let entry = Entry::new(SERVICE, &key)
            .map_err(|e| Error::Keystore(e.to_string()))?;
        entry.set_password(&encoded)
            .map_err(|e| Error::Keystore(e.to_string()))
    })
    .await
    .map_err(|e| Error::Keystore(format!("spawn_blocking: {e}")))?
}

pub async fn load(key: &str) -> Result<Option<Vec<u8>>> {
    let key = key.to_string();
    tokio::task::spawn_blocking(move || {
        let entry = Entry::new(SERVICE, &key)
            .map_err(|e| Error::Keystore(e.to_string()))?;
        match entry.get_password() {
            Ok(encoded) => {
                let bytes = base64::Engine::decode(
                    &base64::engine::general_purpose::STANDARD,
                    encoded,
                )
                .map_err(|e| Error::Keystore(format!("base64 decode: {e}")))?;
                Ok(Some(bytes))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(Error::Keystore(e.to_string())),
        }
    })
    .await
    .map_err(|e| Error::Keystore(format!("spawn_blocking: {e}")))?
}

pub async fn delete(key: &str) -> Result<()> {
    let key = key.to_string();
    tokio::task::spawn_blocking(move || {
        let entry = Entry::new(SERVICE, &key)
            .map_err(|e| Error::Keystore(e.to_string()))?;
        entry.delete_credential()
            .map_err(|e| Error::Keystore(e.to_string()))
    })
    .await
    .map_err(|e| Error::Keystore(format!("spawn_blocking: {e}")))?
}
