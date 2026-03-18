import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Upload, User } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { uploadAvatar } from "../services/r2-upload";
import { updateURL } from "../utils/urlRouting";
import { resizeImage } from "../utils/imageProcessing";
import { useUserProfile, useUpdateProfile, useUpdateAvatar, useUserAvatar } from "../hooks/queries";

export const Settings: React.FC = () => {
  const { currentUser } = useAppStore();

  const { data: userData, isLoading } = useUserProfile();
  const { data: avatarDownloadUrl } = useUserAvatar();
  const updateProfileMutation = useUpdateProfile();
  const updateAvatarMutation = useUpdateAvatar();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    if (userData) {
      setUsername(userData.username || "");
      setEmail(userData.email || "");
      setPhone(userData.phone || "");
    }
  }, [userData]);

  useEffect(() => {
    setCurrentAvatarUrl(avatarDownloadUrl || null);
  }, [avatarDownloadUrl]);

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

  const handleAvatarUpload = useCallback(async () => {
    if (!selectedFile || !currentUser) {
      return;
    }
    setUploadError(null);
    try {
      const oldAvatarKey = userData?.avatar_url;
      const optimizedFile = await resizeImage(selectedFile);
      const response = await uploadAvatar(currentUser.id, "", optimizedFile);
      await updateAvatarMutation.mutateAsync(response.object_key);
      // Old avatar cleanup not implemented (no delete_file command)
      setSelectedFile(null);
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setPreview(null);
      setFileInputKey((prev) => prev + 1);
      setSaveSuccess(true);
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload avatar"
      );
    }
  }, [selectedFile, currentUser, userData?.avatar_url, preview, updateAvatarMutation]);

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const handleSave = async () => {
    if (!currentUser) {
      return;
    }
    try {
      await updateProfileMutation.mutateAsync({
        username: username.trim(),
        phone: phone.trim() || undefined,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const handleBack = () => {
    updateURL("/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (!currentUser) {
    return (
      <div data-testid="settings-no-user">
        <p>Please sign in to access settings</p>
      </div>
    );
  }

  return (
    <div data-testid="settings-page">
      <div data-testid="settings-header">
        <button
          data-testid="settings-back-button"
          onClick={handleBack}
          aria-label="Back"
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <h1>Settings</h1>
      </div>

      <div data-testid="settings-content">
        <div>
          <h2>Account Information</h2>

          {isLoading ? (
            <span data-testid="settings-loading">Loading...</span>
          ) : (
            <div>
              <label htmlFor="settings-username">Username</label>
              <input
                id="settings-username"
                data-testid="settings-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
              />

              <label htmlFor="settings-email">Email</label>
              <input
                id="settings-email"
                data-testid="settings-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />

              <label htmlFor="settings-phone">Phone</label>
              <input
                id="settings-phone"
                data-testid="settings-phone-input"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
              />

            </div>
          )}

          {updateProfileMutation.error && (
            <p data-testid="settings-save-error">
              {updateProfileMutation.error instanceof Error
                ? updateProfileMutation.error.message
                : "Failed to save settings"}
            </p>
          )}

          {saveSuccess && (
            <p data-testid="settings-save-success">Settings saved successfully!</p>
          )}

          <button
            data-testid="settings-save-button"
            onClick={handleSave}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div>
          <h2>Profile</h2>

          <div>
            <p>Avatar</p>
            <div data-testid="avatar-preview-container">
              {preview ? (
                <img
                  data-testid="avatar-new-preview"
                  src={preview}
                  alt="Avatar preview"
                />
              ) : currentAvatarUrl ? (
                <img
                  data-testid="avatar-current"
                  src={currentAvatarUrl}
                  alt="Current avatar"
                  onError={() => setCurrentAvatarUrl(null)}
                />
              ) : (
                <User data-testid="avatar-placeholder" aria-hidden="true" />
              )}
            </div>

            <label htmlFor="settings-avatar-input">Select Avatar Image</label>
            <input
              key={fileInputKey}
              id="settings-avatar-input"
              data-testid="settings-avatar-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={updateAvatarMutation.isPending}
              aria-label="Select avatar image"
            />
            <p>Supported formats: PNG, JPG, GIF. Max size: 5MB.</p>

            {uploadError && (
              <p data-testid="avatar-upload-error">{uploadError}</p>
            )}

            {saveSuccess && !selectedFile && (
              <p data-testid="avatar-upload-success">Avatar uploaded successfully!</p>
            )}

            {selectedFile && (
              <button
                data-testid="upload-avatar-button"
                onClick={handleAvatarUpload}
                disabled={updateAvatarMutation.isPending}
              >
                <Upload aria-hidden="true" />
                {updateAvatarMutation.isPending ? "Uploading..." : "Upload Avatar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
