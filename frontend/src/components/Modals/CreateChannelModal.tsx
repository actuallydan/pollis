import React, { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { Card, Button, TextInput, Textarea, Header, Paragraph } from "monopollis";
import { CreateChannel } from "../../../wailsjs/go/main/App";
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

  if (!isOpen) return null;

  if (!selectedGroupId) {
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
          <Paragraph size="sm" className="text-orange-300/70">
            Please select a group first.
          </Paragraph>
        </Card>
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

    // Check for duplicate channel slug in the group
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
      const channel = await CreateChannel(
        selectedGroupId,
        finalSlug,
        name.trim(),
        description.trim() || "",
        currentUser.id
      );

      // Convert to our Channel type
      const channelData: any = {
        id: channel.id,
        group_id: channel.group_id,
        slug: channel.slug,
        name: channel.name,
        description: channel.description,
        channel_type: channel.channel_type,
        created_by: channel.created_by,
        created_at: channel.created_at,
        updated_at: channel.updated_at,
      };

      addChannel(channelData);
      setSelectedChannelId(channelData.id);
      
      // Find the group to get its slug for the URL
      const group = groups.find((g) => g.id === selectedGroupId);
      if (group) {
        updateURL(`/g/${group.slug}/${finalSlug}`);
      }
      
      onClose();

      // Reset form
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
          Create Channel
        </Header>
        <Paragraph size="sm" className="mb-6 text-orange-300/70">
          Create a new channel in the selected group.
        </Paragraph>

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            id="name"
            label="Name"
            value={name}
            onChange={(val) => {
              setName(val);
              if (!slugEdited) {
                setSlug(deriveSlug(val));
              }
            }}
            placeholder="General"
            required
            disabled={isLoading}
          />

          <TextInput
            id="slug"
            label="Slug"
            value={slug}
            onChange={(val) => {
              setSlug(val.toLowerCase());
              setSlugEdited(true);
            }}
            placeholder="general"
            required
            disabled={isLoading}
            description="Lowercase, letters/numbers/hyphens. Defaults from name."
          />

          <Textarea
            id="description"
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            placeholder="Channel description..."
            disabled={isLoading}
          />

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-300/30 rounded">
              <Paragraph size="sm" className="text-red-300">
                {error}
              </Paragraph>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
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
