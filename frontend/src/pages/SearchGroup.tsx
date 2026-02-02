import React, { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { Button, TextInput, Header, Paragraph } from "monopollis";
import { useJoinGroup } from "../hooks/queries";
import { updateURL } from "../utils/urlRouting";

export const SearchGroup: React.FC = () => {
  const currentUser = useAppStore((state) => state.currentUser);
  const [slug, setSlug] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundGroup, setFoundGroup] = useState<any>(null);

  // Use React Query mutation for joining group
  const joinGroupMutation = useJoinGroup();

  const handleBack = () => {
    window.history.back();
  };

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
      const { GetGroupBySlug } = await import("../../wailsjs/go/main/App");
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

      // Navigate to the group
      updateURL(`/g/${foundGroup.slug}`);
      window.dispatchEvent(new PopStateEvent("popstate"));

      // Reset form
      setSlug("");
      setFoundGroup(null);
    } catch (err) {
      // Error is handled by the mutation
      console.error("Failed to join group:", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-black overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-orange-300/70 hover:text-orange-300 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <Header size="xl" className="mb-2">
            Search Group
          </Header>
          <Paragraph size="base" className="mb-8 text-orange-300/70">
            Search for a group by its slug to join.
          </Paragraph>

          <div className="space-y-6">
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
              <div className="p-6 bg-orange-300/10 border border-orange-300/30 rounded">
                <Header size="lg" className="mb-2">
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
              <div className="p-4 bg-red-900/20 border border-red-300/30 rounded">
                <Paragraph size="sm" className="text-red-300">
                  {searchError ||
                    (joinGroupMutation.error instanceof Error
                      ? joinGroupMutation.error.message
                      : "Failed to join group")}
                </Paragraph>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
