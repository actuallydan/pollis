import React, { useState, useEffect } from "react";
import { X, Upload } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { uploadAvatar } from "../../services/r2-upload";

interface AvatarSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  aliasId?: string;
  groupId?: string;
}

export const AvatarSettingsModal: React.FC<AvatarSettingsModalProps> = ({
  isOpen,
  onClose,
  aliasId,
  groupId,
}) => {
  const { currentUser } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  if (!isOpen) {
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setPreview(null);
      setUploadError(null);
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    if (file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentUser) {
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const response = await uploadAvatar(
        currentUser.id,
        aliasId || groupId || "",
        selectedFile
      );
      setUploadedUrl(response.public_url || response.object_key);
      setTimeout(() => {
        onClose();
        setSelectedFile(null);
        setPreview(null);
        setUploadedUrl(null);
      }, 1000);
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload avatar"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      onClose();
      setSelectedFile(null);
      setPreview(null);
      setUploadedUrl(null);
      setUploadError(null);
    }
  };

  return (
    <div data-testid="avatar-settings-modal">
      <div>
        <h2>Avatar Settings</h2>
        <button
          data-testid="close-avatar-modal-button"
          onClick={handleClose}
          disabled={isUploading}
          aria-label="Close"
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <div>
        {preview && (
          <div data-testid="avatar-preview">
            <p>Preview</p>
            <img src={preview} alt="Preview" />
          </div>
        )}

        {uploadedUrl && (
          <p data-testid="avatar-upload-success">Avatar uploaded successfully!</p>
        )}

        {uploadError && (
          <p data-testid="avatar-upload-error">{uploadError}</p>
        )}

        <label htmlFor="avatar-file-input">Select Avatar Image</label>
        <input
          id="avatar-file-input"
          data-testid="avatar-file-input"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={isUploading}
          aria-label="Select avatar image"
        />
        <p>Supported formats: PNG, JPG, GIF. Max size: 5MB.</p>

        {selectedFile && (
          <button
            data-testid="upload-avatar-button"
            onClick={handleUpload}
            disabled={isUploading}
          >
            <Upload aria-hidden="true" />
            {isUploading ? "Uploading..." : "Upload Avatar"}
          </button>
        )}
      </div>
    </div>
  );
};
