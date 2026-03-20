use keyring::Entry;
use crate::error::{Error, Result};

const SERVICE: &str = "pollis";

/// When POLLIS_DATA_DIR is set (second dev instance), namespace keyring entries
/// so multiple instances don't stomp each other's session/identity keys.
/// Production builds without POLLIS_DATA_DIR are unaffected.
fn namespaced(key: &str) -> String {
    match std::env::var("POLLIS_DATA_DIR") {
        Ok(dir) => {
            let label = std::path::Path::new(&dir)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("dev2");
            format!("{label}:{key}")
        }
        Err(_) => key.to_string(),
    }
}

pub async fn store(key: &str, value: &[u8]) -> Result<()> {
    let key = namespaced(key);
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
    let key = namespaced(key);
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
    let key = namespaced(key);
    tokio::task::spawn_blocking(move || {
        let entry = Entry::new(SERVICE, &key)
            .map_err(|e| Error::Keystore(e.to_string()))?;
        entry.delete_credential()
            .map_err(|e| Error::Keystore(e.to_string()))
    })
    .await
    .map_err(|e| Error::Keystore(format!("spawn_blocking: {e}")))?
}
