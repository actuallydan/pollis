use crate::error::{Error, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub turso_url: String,
    pub turso_token: String,
    pub r2_endpoint: String,
    pub r2_access_key_id: String,
    pub r2_secret_access_key: String,
    pub r2_region: String,
    pub r2_public_url: String,
    pub livekit_url: String,
    pub livekit_api_key: String,
    pub livekit_api_secret: String,
    pub resend_api_key: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            turso_url: require_env("TURSO_URL")?,
            turso_token: require_env("TURSO_TOKEN")?,
            r2_endpoint: require_env("R2_S3_ENDPOINT")?,
            r2_access_key_id: require_env("R2_ACCESS_KEY_ID")?,
            r2_secret_access_key: require_env("R2_SECRET_KEY")?,
            // Cloudflare R2 uses "auto" as its S3-compatible region
            r2_region: std::env::var("R2_REGION").unwrap_or_else(|_| "auto".to_string()),
            r2_public_url: require_env("R2_PUBLIC_URL")?,
            livekit_url: std::env::var("LIVEKIT_URL").unwrap_or_default(),
            livekit_api_key: std::env::var("LIVEKIT_API_KEY").unwrap_or_default(),
            livekit_api_secret: std::env::var("LIVEKIT_API_SECRET").unwrap_or_default(),
            resend_api_key: require_env("RESEND_API_KEY")?,
        })
    }
}

fn require_env(key: &str) -> Result<String> {
    std::env::var(key).map_err(|_| Error::Config(format!("missing env var: {key}")))
}
