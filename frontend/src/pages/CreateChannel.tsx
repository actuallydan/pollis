import React, { useState } from "react";
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
      const existingSlug = (ch as any).slug?.toLowerCase() ?? deriveSlug(ch.name).toLowerCase();
      return existingSlug === channelSlugLower;
    });
    if (duplicateExists) {
      setError(`A channel named "${finalSlug}" already exists`);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div data-testid="create-channel-no-user" className="flex items-center justify-center flex-1" style={{ background: 'var(--c-bg)' }}>
        <p className="text-xs font-mono" style={{ color: 'var(--c-text-muted)' }}>Please sign in</p>
      </div>
    );
  }

  if (!selectedGroupId || !currentGroup) {
    return (
      <div data-testid="create-channel-no-group" className="flex flex-col items-center justify-center flex-1 gap-3" style={{ background: 'var(--c-bg)' }}>
        <p className="text-xs font-mono" style={{ color: 'var(--c-text-muted)' }}>Select a group first</p>
        <button
          data-testid="create-channel-go-home-button"
          onClick={() => { updateURL("/"); window.dispatchEvent(new PopStateEvent("popstate")); }}
          className="btn-ghost"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="create-channel-page"
      className="flex-1 flex flex-col overflow-auto"
      style={{ background: 'var(--c-bg)' }}
    >
      <div data-testid="create-channel-content" className="flex-1 flex justify-center overflow-auto px-6 py-8">
        <form
          data-testid="create-channel-form"
          onSubmit={handleSubmit}
          className="w-full max-w-md flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-channel-name" className="section-label px-0">Channel Name</label>
            <input
              id="create-channel-name"
              data-testid="create-channel-name-input"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugEdited) { setSlug(deriveSlug(e.target.value)); }
              }}
              placeholder="general"
              required
              disabled={isLoading}
              className="pollis-input"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-channel-slug" className="section-label px-0">Slug</label>
            <input
              id="create-channel-slug"
              data-testid="create-channel-slug-input"
              type="text"
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugEdited(true); }}
              placeholder="general"
              required
              disabled={isLoading}
              className="pollis-input font-mono"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-channel-description" className="section-label px-0">Description</label>
            <textarea
              id="create-channel-description"
              data-testid="create-channel-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
              disabled={isLoading}
              rows={2}
              className="pollis-textarea"
            />
          </div>

          {error && (
            <p data-testid="create-channel-error" className="text-xs font-mono" style={{ color: '#ff6b6b' }}>
              {error}
            </p>
          )}

          <button
            data-testid="create-channel-submit-button"
            type="submit"
            disabled={isLoading}
            className="btn-primary py-2"
          >
            {isLoading ? "Creating…" : "Create Channel"}
          </button>
        </form>
      </div>
    </div>
  );
};
