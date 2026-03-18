import React, { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { useCreateGroup } from "../../hooks/queries";
import { deriveSlug, updateURL } from "../../utils/urlRouting";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const currentUser = useAppStore((state) => state.currentUser);
  const setSelectedGroupId = useAppStore((state) => state.setSelectedGroupId);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createGroupMutation = useCreateGroup();

  if (!isOpen) {
    return null;
  }

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
    setError(null);
    try {
      const group = await createGroupMutation.mutateAsync({
        slug: finalSlug,
        name: name.trim(),
        description: description.trim() || "",
      });
      setSelectedGroupId(group?.id ?? '');
      updateURL(`/g/${finalSlug}`);
      onClose();
      setName("");
      setSlug("");
      setSlugEdited(false);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    }
  };

  return (
    <div data-testid="create-group-modal">
      <button
        data-testid="close-create-group-modal-button"
        onClick={onClose}
        aria-label="Close"
      >
        <X aria-hidden="true" />
      </button>

      <h2>Create Group</h2>
      <p>Create a new group to organize your channels.</p>

      <form data-testid="create-group-form" onSubmit={handleSubmit}>
        <label htmlFor="group-name">Group Name</label>
        <input
          id="group-name"
          data-testid="group-name-input"
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
          disabled={createGroupMutation.isPending}
        />
        <p>Enter the display name for the group</p>

        <label htmlFor="group-slug">Group Slug</label>
        <input
          id="group-slug"
          data-testid="group-slug-input"
          type="text"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value.toLowerCase());
            setSlugEdited(true);
          }}
          placeholder="my-group"
          required
          disabled={createGroupMutation.isPending}
        />
        <p>Lowercase, letters/numbers/hyphens. Defaults from name.</p>

        <label htmlFor="group-description">Description (optional)</label>
        <textarea
          id="group-description"
          data-testid="group-description-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Group description..."
          disabled={createGroupMutation.isPending}
        />

        {(error || createGroupMutation.error) && (
          <p data-testid="create-group-error">
            {error ||
              (createGroupMutation.error instanceof Error
                ? createGroupMutation.error.message
                : "Failed to create group")}
          </p>
        )}

        <div>
          <button
            data-testid="cancel-create-group-button"
            type="button"
            onClick={onClose}
            disabled={createGroupMutation.isPending}
          >
            Cancel
          </button>
          <button
            data-testid="submit-create-group-button"
            type="submit"
            disabled={createGroupMutation.isPending}
          >
            {createGroupMutation.isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
};
