import { checkIsDesktop } from "../hooks/useWailsReady";
import type { PresignedUploadResponse } from "../types";

/**
 * Upload a file to R2 using a presigned URL
 * The Content-Type must match exactly what's in the presigned URL signature
 */
export async function uploadToR2(
  presignedUrl: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  // Use XHR for better progress tracking and CORS handling
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed: network error"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted"));
    });

    xhr.open("PUT", presignedUrl);
    // Set Content-Type to match what's in the presigned URL signature
    // The presigned URL was generated with this Content-Type, so it must match
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

/**
 * Upload avatar image
 */
export async function uploadAvatar(
  userId: string,
  aliasId: string,
  file: File
): Promise<PresignedUploadResponse> {
  if (!checkIsDesktop()) {
    throw new Error("R2 uploads only available in desktop app");
  }

  const { GetPresignedAvatarUploadURL } = await import(
    "../../wailsjs/go/main/App"
  );

  const response = await GetPresignedAvatarUploadURL(
    userId,
    aliasId || "",
    file.name,
    file.type || "image/png"
  );

  // Upload file to R2
  await uploadToR2(response.upload_url, file);

  return {
    upload_url: response.upload_url,
    object_key: response.object_key,
    public_url: response.public_url,
  };
}

/**
 * Upload file attachment for chat
 */
export async function uploadFileAttachment(
  channelId: string | null,
  conversationId: string | null,
  messageId: string | null,
  file: File,
  onProgress?: (progress: number) => void
): Promise<PresignedUploadResponse> {
  if (!checkIsDesktop()) {
    throw new Error("R2 uploads only available in desktop app");
  }

  const { GetPresignedFileUploadURL } = await import(
    "../../wailsjs/go/main/App"
  );

  const response = await GetPresignedFileUploadURL(
    channelId || "",
    conversationId || "",
    messageId || "",
    file.name,
    file.type || "application/octet-stream"
  );

  // Upload file to R2
  await uploadToR2(response.upload_url, file, onProgress);

  return {
    upload_url: response.upload_url,
    object_key: response.object_key,
    public_url: response.public_url,
  };
}

/**
 * Get download URL for a file
 */
export async function getFileDownloadUrl(objectKey: string): Promise<string> {
  if (!checkIsDesktop()) {
    throw new Error("R2 downloads only available in desktop app");
  }

  const { GetPresignedFileDownloadURL } = await import(
    "../../wailsjs/go/main/App"
  );
  return await GetPresignedFileDownloadURL(objectKey);
}

/**
 * Upload group icon
 */
export async function uploadGroupIcon(
  groupId: string,
  file: File
): Promise<PresignedUploadResponse> {
  if (!checkIsDesktop()) {
    throw new Error("R2 uploads only available in desktop app");
  }

  // Use avatar upload endpoint with group ID as alias ID
  // This creates a unique path for group icons
  const { GetPresignedAvatarUploadURL } = await import(
    "../../wailsjs/go/main/App"
  );

  // For group icons, we'll use a special format: "group-{groupId}"
  // The backend should handle this appropriately
  const response = await GetPresignedAvatarUploadURL(
    groupId, // Using group ID as user ID for group icons
    `group-${groupId}`, // Using group ID as alias ID
    file.name,
    file.type || "image/png"
  );

  // Upload file to R2
  await uploadToR2(response.upload_url, file);

  return {
    upload_url: response.upload_url,
    object_key: response.object_key,
    public_url: response.public_url,
  };
}

