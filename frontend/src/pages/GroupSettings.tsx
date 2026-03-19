import React, { useState, useEffect } from "react";
import { Upload } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { uploadGroupIcon, getFileDownloadUrl } from "../services/r2-upload";
import { deriveSlug, parseURL } from "../utils/urlRouting";
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
    return () => { if (preview) { URL.revokeObjectURL(preview); } };
  }, [preview]);

  useEffect(() => {
    if (!currentGroup) { setIsLoading(false); return; }
    setGroupName(currentGroup.name);
    setSlugPreview(deriveSlug(currentGroup.name));
    setCurrentIconUrl((currentGroup as any).icon_url || null);
    setIsLoading(false);
  }, [currentGroup]);

  useEffect(() => {
    if (groupName) { setSlugPreview(deriveSlug(groupName)); }
  }, [groupName]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      if (preview) { URL.revokeObjectURL(preview); }
      setPreview(null);
      setUploadError(null);
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
    if (preview) { URL.revokeObjectURL(preview); }
    if (file.type.startsWith("image/")) { setPreview(URL.createObjectURL(file)); }
  };

  const handleIconUpload = async () => {
    if (!selectedFile || !currentGroup) { return; }
    setIsUploading(true);
    setUploadError(null);
    try {
      const response = await uploadGroupIcon(currentGroup.id, selectedFile);
      const downloadUrl = await getFileDownloadUrl(response.object_key);
      await updateGroupIconMutation.mutateAsync({ groupId: currentGroup.id, iconUrl: downloadUrl });
      setCurrentIconUrl(downloadUrl);
      setSelectedFile(null);
      if (preview) { URL.revokeObjectURL(preview); }
      setPreview(null);
      setFileInputKey((prev) => prev + 1);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Failed to upload icon");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!currentGroup) { return; }
    setIsSaving(true);
    setSaveError(null);
    try {
      await api.updateGroup(currentGroup.id, groupName.trim(), "");
      const updatedGroups = groups.map((g) =>
        g.id === currentGroup.id ? { ...g, name: groupName.trim() } : g
      );
      setGroups(updatedGroups);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentGroup) {
    return (
      <div
        data-testid="group-settings-not-found"
        className="flex items-center justify-center flex-1"
        style={{ background: 'var(--c-bg)' }}
      >
        <p className="text-xs font-mono" style={{ color: 'var(--c-text-muted)' }}>Group not found</p>
      </div>
    );
  }

  return (
    <div
      data-testid="group-settings-page"
      className="flex-1 flex flex-col overflow-auto"
      style={{ background: 'var(--c-bg)' }}
    >
      <div data-testid="group-settings-content" className="flex-1 flex justify-center overflow-auto px-6 py-8">
        <div className="w-full max-w-md flex flex-col gap-8">

          {/* Group info */}
          <section className="flex flex-col gap-4">
            <h2 className="section-label px-0 border-b pb-1" style={{ borderColor: 'var(--c-border)' }}>
              Group Info
            </h2>

            {isLoading ? (
              <span data-testid="group-settings-loading" className="text-xs font-mono" style={{ color: 'var(--c-text-muted)' }}>
                Loading…
              </span>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="group-settings-name" className="section-label px-0">Group Name</label>
                  <input
                    id="group-settings-name"
                    data-testid="group-settings-name-input"
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="My Group"
                    required
                    className="pollis-input"
                  />
                </div>

                <div
                  data-testid="group-settings-slug-preview"
                  className="flex items-center gap-2"
                >
                  <span className="section-label px-0">URL</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--c-text-dim)' }}>
                    /g/{slugPreview}
                  </span>
                </div>
              </div>
            )}

            {saveError && (
              <p data-testid="group-settings-save-error" className="text-xs font-mono" style={{ color: '#ff6b6b' }}>
                {saveError}
              </p>
            )}
            {saveSuccess && (
              <p data-testid="group-settings-save-success" className="text-xs font-mono" style={{ color: 'var(--c-accent-dim)' }}>
                Saved.
              </p>
            )}

            <button
              data-testid="group-settings-save-button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary self-start"
            >
              {isSaving ? "Saving…" : "Save Changes"}
            </button>
          </section>

          {/* Group icon */}
          <section className="flex flex-col gap-4">
            <h2 className="section-label px-0 border-b pb-1" style={{ borderColor: 'var(--c-border)' }}>
              Icon
            </h2>

            <div className="flex items-center gap-4">
              <div
                data-testid="group-icon-preview-container"
                className="w-14 h-14 rounded-panel overflow-hidden flex items-center justify-center flex-shrink-0 font-mono font-bold text-lg"
                style={{ border: '1px solid var(--c-border)', background: 'var(--c-surface-high)', color: 'var(--c-accent-dim)' }}
              >
                {preview ? (
                  <img data-testid="group-icon-new-preview" src={preview} alt="Preview" className="w-full h-full object-cover" />
                ) : currentIconUrl ? (
                  <img
                    data-testid="group-icon-current"
                    src={currentIconUrl}
                    alt="Icon"
                    className="w-full h-full object-cover"
                    onError={() => setCurrentIconUrl(null)}
                  />
                ) : (
                  <span data-testid="group-icon-placeholder">
                    {currentGroup.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="group-icon-input"
                  className="btn-ghost cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Upload size={17} aria-hidden="true" />
                  Choose icon
                </label>
                <input
                  key={fileInputKey}
                  id="group-icon-input"
                  data-testid="group-icon-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  aria-label="Select group icon"
                  className="sr-only"
                />
                <p className="text-2xs font-mono" style={{ color: 'var(--c-text-muted)' }}>PNG, JPG, GIF</p>
              </div>
            </div>

            {uploadError && (
              <p data-testid="group-icon-upload-error" className="text-xs font-mono" style={{ color: '#ff6b6b' }}>
                {uploadError}
              </p>
            )}

            {selectedFile && (
              <button
                data-testid="upload-group-icon-button"
                onClick={handleIconUpload}
                disabled={isUploading}
                className="btn-primary self-start flex items-center gap-1.5"
              >
                <Upload size={17} aria-hidden="true" />
                {isUploading ? "Uploading…" : "Upload Icon"}
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
