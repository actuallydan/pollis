import React, { useState, useRef, useEffect } from "react";
import { X, Upload, User, Loader2 } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { uploadAvatar } from "../../services/r2-upload";
import { Button, Paragraph, Header, FilePicker, type FileWithPreview } from "monopollis";

interface AvatarSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  aliasId?: string; // If provided, this is for a specific alias (e.g., group-specific)
  groupId?: string; // If provided, this alias is for a specific group
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

  // Clean up preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  if (!isOpen) return null;

  const handleFilesChange = (files: FileWithPreview[]) => {
    if (files.length === 0) {
      setSelectedFile(null);
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setPreview(null);
      setUploadError(null);
      return;
    }

    const file = files[0];
    setSelectedFile(file);
    setUploadError(null);

    // Clean up previous preview
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    // Use preview from FilePicker if available, otherwise create one
    if (file.preview) {
      setPreview(file.preview);
    } else if (file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentUser) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await uploadAvatar(
        currentUser.id,
        aliasId || groupId || "", // Use alias ID or group ID
        selectedFile
      );

      setUploadedUrl(response.public_url || response.object_key);

      // TODO: Update profile/alias with the new avatar URL
      // This would require backend API to update the profile/alias

      // Close modal after a short delay to show success
      setTimeout(() => {
        onClose();
        // Reset state
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

  const currentAvatarUrl = null; // TODO: Fetch avatar URL from service when needed

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-orange-300/20 rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-orange-300/20">
          <Header size="lg">Avatar Settings</Header>
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
          {/* Current avatar */}
          {currentAvatarUrl && !preview && (
            <div>
              <Paragraph size="sm" className="mb-2 text-orange-300/70">
                Current Avatar
              </Paragraph>
              <div className="w-24 h-24 rounded-full overflow-hidden border border-orange-300/20">
                <img
                  src={currentAvatarUrl}
                  alt="Current avatar"
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
              <div className="w-32 h-32 rounded-full overflow-hidden border border-orange-300/20 mx-auto">
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
                Avatar uploaded successfully!
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

          {/* File picker */}
          <FilePicker
            label="Select Avatar Image"
              accept="image/*"
            multiple={false}
            maxFiles={1}
            maxSize={5 * 1024 * 1024} // 5MB
            preview={true}
            onFilesChange={handleFilesChange}
            showSubmitButton={false}
            description="Supported formats: PNG, JPG, GIF. Max size: 5MB."
            error={uploadError || undefined}
            disabled={isUploading}
          />

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
                  Upload Avatar
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
