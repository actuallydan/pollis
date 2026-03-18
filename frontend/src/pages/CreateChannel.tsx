import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { invoke } from "@tauri-apps/api/core";
import { deriveSlug, updateURL } from "../utils/urlRouting";

export const CreateChannel: React.FC = () => {
  const { selectedGroupId, currentUser, addChannel, channels, groups, setSelectedChannelId } = useAppStore();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentGroup = groups.find((g) => g.id === selectedGroupId);

  const handleBack = () => {
    if (currentGroup) {
      updateURL(`/g/${currentGroup.slug}`);
    } else {
      updateURL("/");
    }
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    const finalSlug = (slugEdited ? slug : deriveSlug(name)).trim();
    if (!finalSlug) {
      setError("Slug is required");
      return;
    }
    const groupChannels = selectedGroupId ? channels[selectedGroupId] || [] : [];
    const channelSlugLower = finalSlug.toLowerCase();
    const duplicateExists = groupChannels.some((ch) => {
      const existingSlug =
        (ch as any).slug?.toLowerCase() ?? deriveSlug(ch.name).toLowerCase();
      return existingSlug === channelSlugLower;
    });
    if (duplicateExists) {
      setError(`A channel with slug "${finalSlug}" already exists in this group`);
      return;
    }
    if (!currentUser) {
      setError("User not found");
      return;
    }
    if (!selectedGroupId) {
      setError("Please select a group first");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const channel = await invoke<{ id: string; group_id: string; name: string; description?: string }>(
        'create_channel',
        { groupId: selectedGroupId, name: name.trim(), description: description.trim() || null },
      );
      const channelData: any = {
        id: channel.id,
        group_id: channel.group_id,
        slug: finalSlug,
        name: channel.name,
        description: channel.description || '',
        channel_type: 'text',
        created_by: currentUser.id,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      addChannel(channelData);
      setSelectedChannelId(channelData.id);
      if (currentGroup) {
        updateURL(`/g/${currentGroup.slug}/${finalSlug}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      setName("");
      setSlug("");
      setSlugEdited(false);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div data-testid="create-channel-no-user">
        <p>Please sign in to create a channel</p>
      </div>
    );
  }

  if (!selectedGroupId || !currentGroup) {
    return (
      <div data-testid="create-channel-no-group">
        <p>Please select a group first</p>
        <button
          data-testid="create-channel-go-home-button"
          onClick={() => {
            updateURL("/");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div data-testid="create-channel-page">
      <div data-testid="create-channel-header">
        <button
          data-testid="create-channel-back-button"
          onClick={handleBack}
          aria-label="Back"
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <h1>Create Channel</h1>
      </div>

      <div data-testid="create-channel-content">
        <p>Create a new channel in {currentGroup.name}.</p>

        <form data-testid="create-channel-form" onSubmit={handleSubmit}>
          <label htmlFor="create-channel-name">Channel Name</label>
          <input
            id="create-channel-name"
            data-testid="create-channel-name-input"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) {
                setSlug(deriveSlug(e.target.value));
              }
            }}
            placeholder="General"
            required
            disabled={isLoading}
          />
          <p>The display name for the channel</p>

          <label htmlFor="create-channel-slug">Channel Slug</label>
          <input
            id="create-channel-slug"
            data-testid="create-channel-slug-input"
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase());
              setSlugEdited(true);
            }}
            placeholder="general"
            required
            disabled={isLoading}
          />
          <p>Lowercase, letters/numbers/hyphens. Auto-generates from name.</p>

          <label htmlFor="create-channel-description">Description</label>
          <textarea
            id="create-channel-description"
            data-testid="create-channel-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Channel description..."
            disabled={isLoading}
          />
          <p>Optional description for the channel</p>

          {error && (
            <p data-testid="create-channel-error">{error}</p>
          )}

          <button
            data-testid="create-channel-submit-button"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Create Channel"}
          </button>
        </form>
      </div>
    </div>
  );
};
