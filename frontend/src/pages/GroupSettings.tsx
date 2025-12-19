import React, { useState, useEffect } from "react";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Paragraph } from "../components/Paragraph";
import { TextInput } from "../components/TextInput";
import { FilePicker, type FileWithPreview } from "../components/FilePicker";
import { uploadGroupIcon, getFileDownloadUrl } from "../services/r2-upload";
import { updateURL, deriveSlug } from "../utils/urlRouting";
import * as api from "../services/api";

export const GroupSettings: React.FC = () => {
  const { groups, setGroups, selectedGroupId } = useAppStore();
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
  const [filePickerKey, setFilePickerKey] = useState(0);

  const currentGroup = groups.find((g) => g.id === selectedGroupId);

  // Clean up preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // Load group data
  useEffect(() => {
    if (!currentGroup) {
      setIsLoading(false);
      return;
    }

    setGroupName(currentGroup.name);
    setSlugPreview(deriveSlug(currentGroup.name));
    // TODO: Fetch current icon URL from service
    setCurrentIconUrl(currentGroup.icon_url || null);
    setIsLoading(false);
  }, [currentGroup]);

  // Update slug preview when group name changes
  useEffect(() => {
    if (groupName) {
      setSlugPreview(deriveSlug(groupName));
    }
  }, [groupName]);

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

  const handleIconUpload = async () => {
    if (!selectedFile || !currentGroup) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await uploadGroupIcon(currentGroup.id, selectedFile);

      // Get presigned download URL for the uploaded icon
      const downloadUrl = await getFileDownloadUrl(response.object_key);

      // TODO: Update group with new icon URL in service
      // For now, update locally
      const updatedGroups = groups.map((g) =>
        g.id === currentGroup.id ? { ...g, icon_url: downloadUrl } : g
      );
      setGroups(updatedGroups);

      // Update current icon URL
      setCurrentIconUrl(downloadUrl);

      // Reset file picker and preview
      setSelectedFile(null);
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setPreview(null);
      setFilePickerKey((prev) => prev + 1); // Reset FilePicker component
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
    if (!currentGroup) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const updatedGroup = await api.updateGroup(
        currentGroup.id,
        groupName.trim(),
        "" // Description not editable yet
      );

      // Update group in store
      const updatedGroups = groups.map((g) =>
        g.id === currentGroup.id ? updatedGroup : g
      );
      setGroups(updatedGroups);

      // Update URL if slug changed
      if (updatedGroup.slug !== currentGroup.slug) {
        updateURL(`/g/${updatedGroup.slug}/settings`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }

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
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Paragraph>Group not found</Paragraph>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black overflow-hidden min-w-0 w-full">
      {/* Header */}
      <div className="border-b border-orange-300/20 p-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Header size="lg">Group Settings</Header>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0 w-full">
        <div className="w-full">
          <div className="w-full max-w-[500px] space-y-6">
            {/* Group Information */}
            <div>
              <Header size="base" className="mb-4">
                Group Information
              </Header>

              <div className="space-y-4">
                {isLoading ? (
                  <div className="text-orange-300/70">Loading...</div>
                ) : (
                  <>
                    <TextInput
                      id="group-name"
                      label="Group Name"
                      value={groupName}
                      onChange={setGroupName}
                      placeholder="My Group"
                      type="text"
                      description="The display name for your group"
                      required
                    />

                    <div>
                      <Paragraph size="sm" className="mb-2 text-orange-300/70">
                        URL Slug
                      </Paragraph>
                      <div className="p-3 bg-black/50 border border-orange-300/20 rounded text-orange-300/50 font-mono text-sm">
                        /g/{slugPreview}
                      </div>
                      <Paragraph size="sm" className="mt-1 text-orange-300/50">
                        This is automatically generated from the group name
                      </Paragraph>
                    </div>

                    {saveError && (
                      <div className="p-3 bg-red-900/20 border border-red-500/30 rounded">
                        <Paragraph size="sm" className="text-red-400">
                          {saveError}
                        </Paragraph>
                      </div>
                    )}

                    {saveSuccess && (
                      <div className="p-3 bg-green-900/20 border border-green-500/30 rounded">
                        <Paragraph size="sm" className="text-green-400">
                          Settings saved successfully!
                        </Paragraph>
                      </div>
                    )}

                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="w-full"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Group Icon */}
            <div>
              <Header size="base" className="mb-4">
                Group Icon
              </Header>

              <div className="space-y-4">
                <div>
                  <Paragraph size="sm" className="mb-2 text-orange-300/70">
                    Icon
                  </Paragraph>
                  {/* Always show icon preview */}
                  <div className="mb-4">
                    <div className="w-32 h-32 rounded-lg overflow-hidden border border-orange-300/20 mx-auto bg-orange-300/20 flex items-center justify-center">
                      {preview ? (
                        <img
                          src={preview}
                          alt="Icon preview"
                          className="w-full h-full object-cover"
                        />
                      ) : currentIconUrl ? (
                        <img
                          src={currentIconUrl}
                          alt="Current icon"
                          className="w-full h-full object-cover"
                          onError={() => setCurrentIconUrl(null)}
                        />
                      ) : (
                        <span className="text-6xl font-bold text-orange-300/50">
                          {currentGroup.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <FilePicker
                    key={filePickerKey}
                    label="Select Group Icon"
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
                  {selectedFile && (
                    <Button
                      onClick={handleIconUpload}
                      disabled={isUploading}
                      className="w-full mt-4"
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
