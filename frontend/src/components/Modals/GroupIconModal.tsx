import React, { useState, useRef } from "react";
import { X, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { uploadGroupIcon } from "../../services/r2-upload";
import { Button } from "../Button";
import { Paragraph } from "../Paragraph";
import { Header } from "../Header";
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

  if (!isOpen || !group) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be less than 5MB");
      return;
    }

    setSelectedFile(file);
    setUploadError(null);

    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !group) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await uploadGroupIcon(group.id, selectedFile);

      setUploadedUrl(response.public_url || response.object_key);

      // Notify parent component
      if (onIconUpdated) {
        onIconUpdated(response.public_url || response.object_key);
      }

      // TODO: Update group with the new icon URL
      // This would require backend API to update the group

      // Close modal after a short delay to show success
      setTimeout(() => {
        onClose();
        // Reset state
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-orange-300/20 rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-orange-300/20">
          <Header size="lg">Group Icon</Header>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="text-orange-300/70 hover:text-orange-300 disabled:opacity-50 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Group name */}
          <div>
            <Paragraph size="sm" className="mb-2 text-orange-300/70">
              Group: {group.name}
            </Paragraph>
          </div>

          {/* Current icon */}
          {group.icon_url && (
            <div>
              <Paragraph size="sm" className="mb-2 text-orange-300/70">
                Current Icon
              </Paragraph>
              <div className="w-24 h-24 rounded-full overflow-hidden border border-orange-300/20">
                <img
                  src={group.icon_url}
                  alt={`${group.name} icon`}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div>
              <Paragraph size="sm" className="mb-2 text-orange-300/70">
                Preview
              </Paragraph>
              <div className="w-24 h-24 rounded-full overflow-hidden border border-orange-300/20">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Upload success */}
          {uploadedUrl && (
            <div className="p-3 bg-green-900/20 border border-green-500/30 rounded">
              <Paragraph size="sm" className="text-green-400">
                Icon uploaded successfully!
              </Paragraph>
            </div>
          )}

          {/* Error */}
          {uploadError && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded">
              <Paragraph size="sm" className="text-red-400">
                {uploadError}
              </Paragraph>
            </div>
          )}

          {/* File input */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Select group icon"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant="secondary"
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {selectedFile ? "Change Image" : "Select Image"}
            </Button>
          </div>

          {/* Upload button */}
          {selectedFile && (
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Icon
                </>
              )}
            </Button>
          )}

          {/* Info */}
          <Paragraph size="sm" className="text-orange-300/50">
            Supported formats: PNG, JPG, GIF. Max size: 5MB.
          </Paragraph>
        </div>
      </div>
    </div>
  );
};
