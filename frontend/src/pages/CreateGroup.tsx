import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { Button, Header, Paragraph, TextInput, Textarea } from "monopollis";
import { CreateGroup as CreateGroupAPI } from "../../wailsjs/go/main/App";
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
      const group = await CreateGroupAPI(
        finalSlug,
        name.trim(),
        description.trim() || "",
        currentUser.id
      );

      // Convert to our Group type
      const groupData: any = {
        id: group.id,
        slug: group.slug,
        name: group.name,
        description: group.description,
        created_by: group.created_by,
        created_at: group.created_at,
        updated_at: group.updated_at,
      };

      addGroup(groupData);
      setSelectedGroupId(groupData.id);
      updateURL(`/g/${groupData.slug}`);
      window.dispatchEvent(new PopStateEvent("popstate"));

      // Reset form
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
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Paragraph>Please sign in to create a group</Paragraph>
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
          <Header size="lg">Create Group</Header>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0 w-full">
        <div className="w-full">
          <div className="w-full max-w-[500px] space-y-6">
            <div>
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
                    // Only auto-update slug if user hasn't manually edited it
                    if (!slugEdited) {
                      setSlug(deriveSlug(val));
                    }
                  }}
                  placeholder="My Group"
                  required
                  disabled={isLoading}
                  description="The display name for the group"
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
                  disabled={isLoading}
                  description="Lowercase, letters/numbers/hyphens. Auto-generates from name."
                />

                <Textarea
                  id="description"
                  label="Description"
                  value={description}
                  onChange={setDescription}
                  placeholder="Group description..."
                  disabled={isLoading}
                  description="Optional description for the group"
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
                  {isLoading ? "Creating..." : "Create Group"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
