import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
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

  const handleBack = () => {
    updateURL("/");
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
      setName("");
      setSlug("");
      setSlugEdited(false);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div data-testid="create-group-no-user">
        <p>Please sign in to create a group</p>
      </div>
    );
  }

  return (
    <div data-testid="create-group-page">
      <div data-testid="create-group-header">
        <button
          data-testid="create-group-back-button"
          onClick={handleBack}
          aria-label="Back"
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <h1>Create Group</h1>
      </div>

      <div data-testid="create-group-content">
        <p>Create a new group to organize your channels.</p>

        <form data-testid="create-group-form" onSubmit={handleSubmit}>
          <label htmlFor="create-group-name">Group Name</label>
          <input
            id="create-group-name"
            data-testid="create-group-name-input"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) {
                setSlug(deriveSlug(e.target.value));
              }
            }}
            placeholder="My Group"
            required
            disabled={isLoading}
          />
          <p>The display name for the group</p>

          <label htmlFor="create-group-slug">Group Slug</label>
          <input
            id="create-group-slug"
            data-testid="create-group-slug-input"
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase());
              setSlugEdited(true);
            }}
            placeholder="my-group"
            required
            disabled={isLoading}
          />
          <p>Lowercase, letters/numbers/hyphens. Auto-generates from name.</p>

          <label htmlFor="create-group-description">Description</label>
          <textarea
            id="create-group-description"
            data-testid="create-group-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Group description..."
            disabled={isLoading}
          />
          <p>Optional description for the group</p>

          {error && (
            <p data-testid="create-group-error">{error}</p>
          )}

          <button
            data-testid="create-group-submit-button"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Create Group"}
          </button>
        </form>
      </div>
    </div>
  );
};
