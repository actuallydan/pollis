import React, { useState } from "react";
import { useAppStore } from "../stores/appStore";
import { invoke } from "@tauri-apps/api/core";
import { deriveSlug, updateURL } from "../utils/urlRouting";

export const CreateGroup: React.FC = () => {
  const { currentUser, addGroup, setSelectedGroupId } = useAppStore();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    const finalSlug = (slugEdited ? slug : deriveSlug(name)).trim();
    if (!finalSlug) {
      setError("Slug must contain at least one letter or number");
      return;
    }
    if (!currentUser) {
      setError("User not found");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const group = await invoke<{ id: string; name: string; description?: string; owner_id: string; created_at: string }>(
        'create_group',
        { name: name.trim(), description: description.trim() || null, ownerId: currentUser.id },
      );
      const groupData: any = {
        id: group.id,
        slug: finalSlug,
        name: group.name,
        description: group.description || '',
        created_by: group.owner_id,
        created_at: new Date(group.created_at).getTime(),
        updated_at: new Date(group.created_at).getTime(),
      };
      addGroup(groupData);
      setSelectedGroupId(groupData.id);
      updateURL(`/g/${groupData.slug}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div data-testid="create-group-no-user" className="flex items-center justify-center flex-1" style={{ background: 'var(--c-bg)' }}>
        <p className="text-xs font-mono" style={{ color: 'var(--c-text-muted)' }}>Please sign in</p>
      </div>
    );
  }

  return (
    <div
      data-testid="create-group-page"
      className="flex-1 flex flex-col overflow-auto"
      style={{ background: 'var(--c-bg)' }}
    >
      {/* Form */}
      <div data-testid="create-group-content" className="flex-1 flex justify-center overflow-auto px-6 py-8">
        <form
          data-testid="create-group-form"
          onSubmit={handleSubmit}
          className="w-full max-w-md flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-group-name" className="section-label px-0">Group Name</label>
            <input
              id="create-group-name"
              data-testid="create-group-name-input"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugEdited) { setSlug(deriveSlug(e.target.value)); }
              }}
              placeholder="Engineering"
              required
              disabled={isLoading}
              className="pollis-input"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-group-slug" className="section-label px-0">Slug</label>
            <input
              id="create-group-slug"
              data-testid="create-group-slug-input"
              type="text"
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugEdited(true); }}
              placeholder="engineering"
              required
              disabled={isLoading}
              className="pollis-input font-mono"
            />
            <p className="text-2xs font-mono" style={{ color: 'var(--c-text-muted)' }}>
              Auto-generated from name. Letters, numbers, hyphens.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-group-description" className="section-label px-0">Description</label>
            <textarea
              id="create-group-description"
              data-testid="create-group-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
              disabled={isLoading}
              rows={3}
              className="pollis-textarea"
            />
          </div>

          {error && (
            <p data-testid="create-group-error" className="text-xs font-mono" style={{ color: '#ff6b6b' }}>
              {error}
            </p>
          )}

          <button
            data-testid="create-group-submit-button"
            type="submit"
            disabled={isLoading}
            className="btn-primary py-2"
          >
            {isLoading ? "Creating…" : "Create Group"}
          </button>
        </form>
      </div>
    </div>
  );
};
