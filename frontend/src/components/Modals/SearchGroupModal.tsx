import React, { useState } from "react";
import { X, Search } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { Card, Button, TextInput, Header, Paragraph } from "monopollis";
import { useJoinGroup } from "../../hooks/queries";

interface SearchGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchGroupModal: React.FC<SearchGroupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const currentUser = useAppStore((state) => state.currentUser);
  const [slug, setSlug] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundGroup, setFoundGroup] = useState<any>(null);

  // Use React Query mutation for joining group
  const joinGroupMutation = useJoinGroup();

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!slug.trim()) {
      setSearchError("Please enter a group slug");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setFoundGroup(null);

    try {
      // Dynamically import Wails function
      const { GetGroupBySlug } = await import("../../../wailsjs/go/main/App");
      const group = await GetGroupBySlug(slug.trim());
      setFoundGroup(group);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Group not found");
    } finally {
      setIsSearching(false);
    }
  };

  const handleJoin = async () => {
    if (!foundGroup || !currentUser) {
      return;
    }

    try {
      await joinGroupMutation.mutateAsync(foundGroup.slug);

      onClose();

      // Reset form
      setSlug("");
      setFoundGroup(null);
    } catch (err) {
      // Error is handled by the mutation
      console.error("Failed to join group:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl relative" variant="bordered">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <Header size="lg" className="mb-2 pr-8">
          Search Group
        </Header>
        <Paragraph size="sm" className="mb-6 text-orange-300/70">
          Search for a group by its slug to join.
        </Paragraph>

        <div className="space-y-4">
          <div className="flex gap-2">
            <TextInput
              id="slug"
              label="Group Slug"
              value={slug}
              onChange={setSlug}
              placeholder="my-group"
              disabled={isSearching}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              isLoading={isSearching}
              disabled={!slug.trim() || isSearching}
              icon={<Search className="w-4 h-4" />}
              className="mt-6"
            >
              Search
            </Button>
          </div>

          {foundGroup && (
            <div className="p-4 bg-orange-300/10 border border-orange-300/30 rounded">
              <Header size="base" className="mb-2">
                {foundGroup.name}
              </Header>
              <Paragraph size="sm" className="text-orange-300/70 mb-2">
                Slug: {foundGroup.slug}
              </Paragraph>
              {foundGroup.description && (
                <Paragraph size="sm" className="text-orange-300/70 mb-4">
                  {foundGroup.description}
                </Paragraph>
              )}
              <Button
                onClick={handleJoin}
                isLoading={joinGroupMutation.isPending}
                className="w-full"
              >
                Join Group
              </Button>
            </div>
          )}

          {(searchError || joinGroupMutation.error) && (
            <div className="p-3 bg-red-900/20 border border-red-300/30 rounded">
              <Paragraph size="sm" className="text-red-300">
                {searchError ||
                  (joinGroupMutation.error instanceof Error
                    ? joinGroupMutation.error.message
                    : "Failed to join group")}
              </Paragraph>
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSearching}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
};
