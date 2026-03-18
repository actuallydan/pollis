import React, { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { useJoinGroup } from "../hooks/queries";
import { updateURL } from "../utils/urlRouting";

export const SearchGroup: React.FC = () => {
  const currentUser = useAppStore((state) => state.currentUser);
  const [slug, setSlug] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundGroup, setFoundGroup] = useState<any>(null);

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
      const { invoke } = await import("@tauri-apps/api/core");
      const group = await invoke<{ id: string; name: string; description?: string }>('search_group_by_slug', { slug: slug.trim() });
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
      updateURL(`/g/${foundGroup.slug}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
      setSlug("");
      setFoundGroup(null);
    } catch (err) {
      console.error("Failed to join group:", err);
    }
  };

  return (
    <div data-testid="search-group-page">
      <button
        data-testid="search-group-back-button"
        onClick={handleBack}
        aria-label="Back"
      >
        <ArrowLeft aria-hidden="true" />
        Back
      </button>

      <h1>Search Group</h1>
      <p>Search for a group by its slug to join.</p>

      <div>
        <label htmlFor="search-group-slug">Group Slug</label>
        <input
          id="search-group-slug"
          data-testid="search-group-slug-input"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="my-group"
          disabled={isSearching}
        />
        <button
          data-testid="search-group-button"
          onClick={handleSearch}
          disabled={!slug.trim() || isSearching}
        >
          <Search aria-hidden="true" />
          {isSearching ? "Searching..." : "Search"}
        </button>
      </div>

      {foundGroup && (
        <div data-testid="search-group-result">
          <h2>{foundGroup.name}</h2>
          <p>Slug: {foundGroup.slug}</p>
          {foundGroup.description && <p>{foundGroup.description}</p>}
          <button
            data-testid="join-group-button"
            onClick={handleJoin}
            disabled={joinGroupMutation.isPending}
          >
            {joinGroupMutation.isPending ? "Joining..." : "Join Group"}
          </button>
        </div>
      )}

      {(searchError || joinGroupMutation.error) && (
        <p data-testid="search-group-error">
          {searchError ||
            (joinGroupMutation.error instanceof Error
              ? joinGroupMutation.error.message
              : "Failed to join group")}
        </p>
      )}
    </div>
  );
};
