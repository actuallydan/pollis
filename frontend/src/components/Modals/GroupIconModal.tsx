import React, { useState, useRef } from "react";
import { X, Upload } from "lucide-react";
import { uploadGroupIcon } from "../../services/r2-upload";
import type { Group } from "../../types";

interface GroupIconModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group | null;
  onIconUpdated?: (iconUrl: string) => void;
}

export const GroupIconModal: React.FC<GroupIconModalProps> = ({
  isOpen,
  onClose,
  group,
  onIconUpdated,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !group) {
    return null;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be less than 5MB");
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !group) {
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const response = await uploadGroupIcon(group.id, selectedFile);
      setUploadedUrl(response.public_url || response.object_key);
      if (onIconUpdated) {
        onIconUpdated(response.public_url || response.object_key);
      }
      setTimeout(() => {
        onClose();
        setSelectedFile(null);
        setPreview(null);
        setUploadedUrl(null);
      }, 1000);
    } catch (error) {
      console.error("Failed to upload group icon:", error);
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload icon"
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
    <div data-testid="group-icon-modal">
      <div>
        <h2>Group Icon</h2>
        <button
          data-testid="close-group-icon-modal-button"
          onClick={handleClose}
          disabled={isUploading}
          aria-label="Close"
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <div>
        <p>Group: {group.name}</p>

        {group.icon_url && !preview && (
          <div data-testid="current-group-icon">
            <p>Current Icon</p>
            <img src={group.icon_url} alt={`${group.name} icon`} />
          </div>
        )}

        {preview && (
          <div data-testid="group-icon-preview">
            <p>Preview</p>
            <img src={preview} alt="Preview" />
          </div>
        )}

        {uploadedUrl && (
          <p data-testid="group-icon-upload-success">Icon uploaded successfully!</p>
        )}

        {uploadError && (
          <p data-testid="group-icon-upload-error">{uploadError}</p>
        )}

        <input
          ref={fileInputRef}
          data-testid="group-icon-file-input"
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          aria-label="Select group icon"
        />
        <button
          data-testid="select-group-icon-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload aria-hidden="true" />
          {selectedFile ? "Change Image" : "Select Image"}
        </button>

        {selectedFile && (
          <button
            data-testid="upload-group-icon-button"
            onClick={handleUpload}
            disabled={isUploading}
          >
            <Upload aria-hidden="true" />
            {isUploading ? "Uploading..." : "Upload Icon"}
          </button>
        )}

        <p>Supported formats: PNG, JPG, GIF. Max size: 5MB.</p>
      </div>
    </div>
  );
};
