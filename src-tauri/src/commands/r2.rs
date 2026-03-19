use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;

use crate::error::{Error, Result};
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResult {
    pub key: String,
    pub url: String,
}

#[tauri::command]
pub async fn upload_file(
    key: String,
    data: Vec<u8>,
    content_type: String,
    state: State<'_, Arc<AppState>>,
) -> Result<UploadResult> {
    let url = format!("{}/{}", state.config.r2_endpoint.trim_end_matches('/'), key);

    let auth_headers = sigv4_headers(
        "PUT",
        &url,
        &content_type,
        &data,
        &state.config.r2_access_key_id,
        &state.config.r2_secret_access_key,
        &state.config.r2_region,
    )?;

    let client = reqwest::Client::new();
    let mut req = client
        .put(&url)
        .header("Content-Type", &content_type)
        .body(data);

    for (k, v) in &auth_headers {
        req = req.header(k.as_str(), v.as_str());
    }

    let response = req.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(Error::Other(anyhow::anyhow!(
            "R2 upload failed: {} — {}", status, body
        )));
    }

    Ok(UploadResult { key, url })
}

#[tauri::command]
pub async fn download_file(
    key: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<u8>> {
    let url = format!("{}/{}", state.config.r2_endpoint.trim_end_matches('/'), key);

    let auth_headers = sigv4_headers(
        "GET",
        &url,
        "",
        &[],
        &state.config.r2_access_key_id,
        &state.config.r2_secret_access_key,
        &state.config.r2_region,
    )?;

    let client = reqwest::Client::new();
    let mut req = client.get(&url);

    for (k, v) in &auth_headers {
        req = req.header(k.as_str(), v.as_str());
    }

    let response = req.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(Error::Other(anyhow::anyhow!(
            "R2 download failed: {} — {}", status, body
        )));
    }

    Ok(response.bytes().await?.to_vec())
}

/// Compute AWS SigV4 headers for a request.
fn sigv4_headers(
    method: &str,
    url: &str,
    content_type: &str,
    body: &[u8],
    access_key: &str,
    secret_key: &str,
    region: &str,
) -> Result<Vec<(String, String)>> {
    use chrono::Utc;

    let (host, path) = parse_host_path(url);

    let now = Utc::now();
    let datetime = now.format("%Y%m%dT%H%M%SZ").to_string();
    let date = &datetime[..8];

    let payload_hash = sha256_hex(body);

    // Headers must be in sorted order for canonical form
    let canonical_headers = if content_type.is_empty() {
        format!("host:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{datetime}\n")
    } else {
        format!("content-type:{content_type}\nhost:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{datetime}\n")
    };

    let signed_headers = if content_type.is_empty() {
        "host;x-amz-content-sha256;x-amz-date"
    } else {
        "content-type;host;x-amz-content-sha256;x-amz-date"
    };

    let canonical_request = format!(
        "{method}\n{path}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    );

    let credential_scope = format!("{date}/{region}/s3/aws4_request");
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{datetime}\n{credential_scope}\n{}",
        sha256_hex(canonical_request.as_bytes())
    );

    let signing_key = derive_signing_key(secret_key, date, region, "s3");
    let signature = hex::encode(hmac_sha256(&signing_key, string_to_sign.as_bytes()));

    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
    );

    // Content-Type is set directly on the request by the caller — do NOT
    // include it here or it will be applied twice, corrupting the signature.
    let headers = vec![
        ("Authorization".to_string(), authorization),
        ("x-amz-date".to_string(), datetime),
        ("x-amz-content-sha256".to_string(), payload_hash),
    ];

    Ok(headers)
}

fn parse_host_path(url: &str) -> (&str, &str) {
    let without_scheme = url
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    match without_scheme.find('/') {
        Some(i) => (&without_scheme[..i], &without_scheme[i..]),
        None => (without_scheme, "/"),
    }
}

fn sha256_hex(data: &[u8]) -> String {
    use sha2::{Sha256, Digest};
    hex::encode(Sha256::digest(data))
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("hmac accepts any key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn derive_signing_key(secret: &str, date: &str, region: &str, service: &str) -> Vec<u8> {
    let k_secret = format!("AWS4{secret}");
    let k_date = hmac_sha256(k_secret.as_bytes(), date.as_bytes());
    let k_region = hmac_sha256(&k_date, region.as_bytes());
    let k_service = hmac_sha256(&k_region, service.as_bytes());
    hmac_sha256(&k_service, b"aws4_request")
}
