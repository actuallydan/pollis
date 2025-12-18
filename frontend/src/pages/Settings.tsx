import React, { useState, useEffect } from "react";
import { ArrowLeft, Upload, Loader2, User } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Paragraph } from "../components/Paragraph";
import { TextInput } from "../components/TextInput";
import { FilePicker, type FileWithPreview } from "../components/FilePicker";
import { uploadAvatar, getFileDownloadUrl } from "../services/r2-upload";
import { updateURL } from "../utils/urlRouting";
import * as api from "../services/api";

export const Settings: React.FC = () => {
  const { currentUser, setCurrentUser } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filePickerKey, setFilePickerKey] = useState(0); // Key to reset FilePicker

  // Clean up preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // Load user data from service DB
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const userData = await api.getServiceUserData();
        setUsername(userData.username || "");
        setEmail(userData.email || "");
        setPhone(userData.phone || "");

        // Load avatar from service (Turso DB)
        if (userData.avatar_url) {
          try {
            const downloadUrl = await getFileDownloadUrl(userData.avatar_url);
            setCurrentAvatarUrl(downloadUrl);
          } catch (error) {
            console.error("Failed to get avatar download URL:", error);
            setCurrentAvatarUrl(null);
          }
        } else {
          setCurrentAvatarUrl(null);
        }
      } catch (error) {
        console.error("Failed to load user data:", error);
        // Initialize empty on error
        setUsername("");
        setEmail("");
        setPhone("");
        setCurrentAvatarUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [currentUser]);

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

  const handleAvatarUpload = async () => {
    if (!selectedFile || !currentUser) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await uploadAvatar(
        currentUser.id,
        "", // No alias/group ID for user avatar
        selectedFile
      );

      // Get presigned download URL for the uploaded avatar
      const downloadUrl = await getFileDownloadUrl(response.object_key);

      // Update avatar URL in Turso DB via service
      await api.updateServiceUserAvatar(response.object_key);

      // Update current avatar URL to show the new avatar
      setCurrentAvatarUrl(downloadUrl);

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
      console.error("Failed to upload avatar:", error);
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload avatar"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await api.updateServiceUserData(
        username.trim(),
        email.trim() || null,
        phone.trim() || null
      );

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveError(
        error instanceof Error ? error.message : "Failed to save settings"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    updateURL("/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Paragraph>Please sign in to access settings</Paragraph>
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
          <Header size="lg">Settings</Header>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0 w-full">
        <div className="w-full">
          <div className="w-full max-w-[500px] space-y-6">
            {/* Account Information */}
            <div>
              <Header size="base" className="mb-4">
                Account Information
              </Header>

              <div className="space-y-4">
                {isLoading ? (
                  <div className="text-orange-300/70">Loading...</div>
                ) : (
                  <>
                    <TextInput
                      id="username"
                      label="Username"
                      value={username}
                      onChange={setUsername}
                      placeholder="username"
                      type="text"
                      description="Your username (required)"
                      required
                    />

                    <TextInput
                      id="email"
                      label="Email"
                      value={email}
                      onChange={setEmail}
                      placeholder="your@email.com"
                      type="email"
                      description="Your email address (optional)"
                    />

                    <TextInput
                      id="phone"
                      label="Phone"
                      value={phone}
                      onChange={setPhone}
                      placeholder="+1234567890"
                      type="text"
                      description="Your phone number (optional)"
                    />
                  </>
                )}

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
              </div>
            </div>

            {/* Profile Section */}
            <div>
              <Header size="base" className="mb-4">
                Profile
              </Header>

              {/* Avatar */}
              <div className="space-y-4">
                <div>
                  <Paragraph size="sm" className="mb-2 text-orange-300/70">
                    Avatar
                  </Paragraph>
                  {/* Always show avatar preview */}
                  <div className="mb-4">
                    <div className="w-32 h-32 rounded-full overflow-hidden border border-orange-300/20 mx-auto bg-orange-300/20 flex items-center justify-center">
                      {preview ? (
                        <img
                          src={preview}
                          alt="Avatar preview"
                          className="w-full h-full object-cover"
                        />
                      ) : currentAvatarUrl ? (
                        <img
                          src={currentAvatarUrl}
                          alt="Current avatar"
                          className="w-full h-full object-cover"
                          onError={() => setCurrentAvatarUrl(null)} // Fallback to icon if image fails to load
                        />
                      ) : (
                        <User className="w-16 h-16 text-orange-300/50" />
                      )}
                    </div>
                  </div>
                  <FilePicker
                    key={filePickerKey}
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
                  {selectedFile && (
                    <Button
                      onClick={handleAvatarUpload}
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
                          Upload Avatar
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
