import React, { useState, useEffect } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { uploadGroupIcon, getFileDownloadUrl } from "../services/r2-upload";
import { updateURL, deriveSlug, parseURL } from "../utils/urlRouting";
import { useUpdateGroupIcon } from "../hooks/queries";
import * as api from "../services/api";

export const GroupSettings: React.FC = () => {
  const { groups, setGroups, selectedGroupId, setSelectedGroupId } = useAppStore();
  const updateGroupIconMutation = useUpdateGroupIcon();
  const [groupName, setGroupName] = useState("");
  const [slugPreview, setSlugPreview] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentIconUrl, setCurrentIconUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fileInputKey, setFileInputKey] = useState(0);

  const urlData = parseURL();
  const currentGroup = urlData.type === "group-settings" && urlData.groupSlug
    ? groups.find((g) => g.slug === urlData.groupSlug)
    : groups.find((g) => g.id === selectedGroupId);

  useEffect(() => {
    if (currentGroup && currentGroup.id !== selectedGroupId) {
      setSelectedGroupId(currentGroup.id);
    }
  }, [currentGroup, selectedGroupId, setSelectedGroupId]);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    if (!currentGroup) {
      setIsLoading(false);
      return;
    }
    setGroupName(currentGroup.name);
    setSlugPreview(deriveSlug(currentGroup.name));
    setCurrentIconUrl(currentGroup.icon_url || null);
    setIsLoading(false);
  }, [currentGroup]);

  useEffect(() => {
    if (groupName) {
      setSlugPreview(deriveSlug(groupName));
    }
  }, [groupName]);

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

  const handleIconUpload = async () => {
    if (!selectedFile || !currentGroup) {
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const response = await uploadGroupIcon(currentGroup.id, selectedFile);
      const downloadUrl = await getFileDownloadUrl(response.object_key);
      await updateGroupIconMutation.mutateAsync({
        groupId: currentGroup.id,
        iconUrl: downloadUrl,
      });
      setCurrentIconUrl(downloadUrl);
      setSelectedFile(null);
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setPreview(null);
      setFileInputKey((prev) => prev + 1);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to upload group icon:", error);
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload icon"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!currentGroup) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await api.updateGroup(
        currentGroup.id,
        groupName.trim(),
        ""
      );
      const updatedGroups = groups.map((g) =>
        g.id === currentGroup.id ? { ...g, name: groupName.trim() } : g
      );
      setGroups(updatedGroups);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save group settings:", error);
      setSaveError(
        error instanceof Error ? error.message : "Failed to save settings"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (currentGroup) {
      updateURL(`/g/${currentGroup.slug}`);
    } else {
      updateURL("/");
    }
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (!currentGroup) {
    return (
      <div data-testid="group-settings-not-found">
        <p>Group not found</p>
      </div>
    );
  }

  return (
    <div data-testid="group-settings-page">
      <div data-testid="group-settings-header">
        <button
          data-testid="group-settings-back-button"
          onClick={handleBack}
          aria-label="Back"
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <h1>Group Settings</h1>
      </div>

      <div data-testid="group-settings-content">
        <div>
          <h2>Group Information</h2>

          {isLoading ? (
            <span data-testid="group-settings-loading">Loading...</span>
          ) : (
            <div>
              <label htmlFor="group-settings-name">Group Name</label>
              <input
                id="group-settings-name"
                data-testid="group-settings-name-input"
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="My Group"
                required
              />

              <div data-testid="group-settings-slug-preview">
                <p>URL Slug</p>
                <p>/g/{slugPreview}</p>
                <p>This is automatically generated from the group name</p>
              </div>

              {saveError && (
                <p data-testid="group-settings-save-error">{saveError}</p>
              )}

              {saveSuccess && (
                <p data-testid="group-settings-save-success">Settings saved successfully!</p>
              )}

              <button
                data-testid="group-settings-save-button"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        <div>
          <h2>Group Icon</h2>

          <div>
            <p>Icon</p>
            <div data-testid="group-icon-preview-container">
              {preview ? (
                <img
                  data-testid="group-icon-new-preview"
                  src={preview}
                  alt="Icon preview"
                />
              ) : currentIconUrl ? (
                <img
                  data-testid="group-icon-current"
                  src={currentIconUrl}
                  alt="Current icon"
                  onError={() => setCurrentIconUrl(null)}
                />
              ) : (
                <span data-testid="group-icon-placeholder">
                  {currentGroup.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <label htmlFor="group-icon-input">Select Group Icon</label>
            <input
              key={fileInputKey}
              id="group-icon-input"
              data-testid="group-icon-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploading}
              aria-label="Select group icon"
            />
            <p>Supported formats: PNG, JPG, GIF. Max size: 5MB.</p>

            {uploadError && (
              <p data-testid="group-icon-upload-error">{uploadError}</p>
            )}

            {selectedFile && (
              <button
                data-testid="upload-group-icon-button"
                onClick={handleIconUpload}
                disabled={isUploading}
              >
                <Upload aria-hidden="true" />
                {isUploading ? "Uploading..." : "Upload Icon"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
