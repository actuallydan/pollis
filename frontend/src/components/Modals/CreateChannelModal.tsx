import React, { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { invoke } from "@tauri-apps/api/core";
import { deriveSlug, updateURL } from "../../utils/urlRouting";

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { selectedGroupId, currentUser, addChannel, channels, groups, setSelectedChannelId } = useAppStore();
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  if (!selectedGroupId) {
    return (
      <div data-testid="create-channel-modal">
        <button
          data-testid="close-create-channel-modal-button"
          onClick={onClose}
          aria-label="Close"
        >
          <X aria-hidden="true" />
        </button>
        <p>Please select a group first.</p>
      </div>
    );
  }

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
      const group = groups.find((g) => g.id === selectedGroupId);
      if (group) {
        updateURL(`/g/${group.slug}/${finalSlug}`);
      }
      onClose();
      setSlug("");
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div data-testid="create-channel-modal">
      <button
        data-testid="close-create-channel-modal-button"
        onClick={onClose}
        aria-label="Close"
      >
        <X aria-hidden="true" />
      </button>

      <h2>Create Channel</h2>
      <p>Create a new channel in the selected group.</p>

      <form data-testid="create-channel-form" onSubmit={handleSubmit}>
        <label htmlFor="channel-name">Name</label>
        <input
          id="channel-name"
          data-testid="channel-name-input"
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

        <label htmlFor="channel-slug">Slug</label>
        <input
          id="channel-slug"
          data-testid="channel-slug-input"
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
        <p>Lowercase, letters/numbers/hyphens. Defaults from name.</p>

        <label htmlFor="channel-description">Description (optional)</label>
        <textarea
          id="channel-description"
          data-testid="channel-description-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Channel description..."
          disabled={isLoading}
        />

        {error && (
          <p data-testid="create-channel-error">{error}</p>
        )}

        <div>
          <button
            data-testid="cancel-create-channel-button"
            type="button"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            data-testid="submit-create-channel-button"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
};
