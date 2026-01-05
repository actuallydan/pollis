import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { Button, Header, Paragraph, TextInput, Textarea } from "monopollis";
import { CreateChannel as CreateChannelAPI } from "../../wailsjs/go/main/App";
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

    if (!selectedGroupId) {
      setError("Please select a group first");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const channel = await CreateChannelAPI(
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

      // Navigate to the new channel
      if (currentGroup) {
        updateURL(`/g/${currentGroup.slug}/${finalSlug}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }

      // Reset form
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
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Paragraph>Please sign in to create a channel</Paragraph>
      </div>
    );
  }

  if (!selectedGroupId || !currentGroup) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <Paragraph className="mb-4">Please select a group first</Paragraph>
          <Button onClick={() => {
            updateURL("/");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}>
            Go Home
          </Button>
        </div>
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
          <Header size="lg">Create Channel</Header>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0 w-full">
        <div className="w-full">
          <div className="w-full max-w-[500px] space-y-6">
            <div>
              <Paragraph size="sm" className="mb-6 text-orange-300/70">
                Create a new channel in {currentGroup.name}.
              </Paragraph>

              <form onSubmit={handleSubmit} className="space-y-4">
                <TextInput
                  id="name"
                  label="Channel Name"
                  value={name}
                  onChange={(val) => {
                    setName(val);
                    // Only auto-update slug if user hasn't manually edited it
                    if (!slugEdited) {
                      setSlug(deriveSlug(val));
                    }
                  }}
                  placeholder="General"
                  required
                  disabled={isLoading}
                  description="The display name for the channel"
                />

                <TextInput
                  id="slug"
                  label="Channel Slug"
                  value={slug}
                  onChange={(val) => {
                    setSlug(val.toLowerCase());
                    setSlugEdited(true);
                  }}
                  placeholder="general"
                  required
                  disabled={isLoading}
                  description="Lowercase, letters/numbers/hyphens. Auto-generates from name."
                />

                <Textarea
                  id="description"
                  label="Description"
                  value={description}
                  onChange={setDescription}
                  placeholder="Channel description..."
                  disabled={isLoading}
                  description="Optional description for the channel"
                />

                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-500/30 rounded">
                    <Paragraph size="sm" className="text-red-400">
                      {error}
                    </Paragraph>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? "Creating..." : "Create Channel"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
