import React, { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { Card, Button, TextInput, Textarea, Header, Paragraph } from "monopollis";
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

  // Use React Query mutation for creating group
  const createGroupMutation = useCreateGroup();

  if (!isOpen) return null;

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

      setSelectedGroupId(group.id);
      updateURL(`/g/${group.slug}`);
      onClose();

      // Reset form
      setName("");
      setSlug("");
      setSlugEdited(false);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md relative" variant="bordered">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <Header size="lg" className="mb-2 pr-8">
          Create Group
        </Header>
        <Paragraph size="sm" className="mb-6 text-orange-300/70">
          Create a new group to organize your channels.
        </Paragraph>

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            id="name"
            label="Group Name"
            value={name}
            onChange={(val) => {
              setName(val);
              if (!slugEdited) {
                setSlug(deriveSlug(val));
              }
            }}
            placeholder="My Group"
            required
            disabled={createGroupMutation.isPending}
            description="Enter the display name for the group"
          />

          <TextInput
            id="slug"
            label="Group Slug"
            value={slug}
            onChange={(val) => {
              setSlug(val.toLowerCase());
              setSlugEdited(true);
            }}
            placeholder="my-group"
            required
            disabled={createGroupMutation.isPending}
            description="Lowercase, letters/numbers/hyphens. Defaults from name."
          />

          <Textarea
            id="description"
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            placeholder="Group description..."
            disabled={createGroupMutation.isPending}
          />

          {(error || createGroupMutation.error) && (
            <div className="p-3 bg-red-900/20 border border-red-300/30 rounded">
              <Paragraph size="sm" className="text-red-300">
                {error ||
                  (createGroupMutation.error instanceof Error
                    ? createGroupMutation.error.message
                    : "Failed to create group")}
              </Paragraph>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={createGroupMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createGroupMutation.isPending}
              loadingText="Creating..."
              className="flex-1"
            >
              Create
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
