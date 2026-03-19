import React, { useState } from "react";
import { Search } from "lucide-react";
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
    <div
      data-testid="search-group-page"
      className="flex-1 flex flex-col overflow-auto"
      style={{ background: 'var(--c-bg)' }}
    >
      <div className="flex-1 flex justify-center overflow-auto px-6 py-8">
        <div className="w-full max-w-md flex flex-col gap-6">

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="search-group-slug" className="section-label px-0">Group Slug</label>
              <div className="flex gap-2">
                <input
                  id="search-group-slug"
                  data-testid="search-group-slug-input"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { handleSearch(); } }}
                  placeholder="my-group"
                  disabled={isSearching}
                  className="pollis-input font-mono flex-1"
                />
                <button
                  data-testid="search-group-button"
                  onClick={handleSearch}
                  disabled={!slug.trim() || isSearching}
                  className="btn-primary flex items-center gap-1.5"
                >
                  <Search size={17} aria-hidden="true" />
                  {isSearching ? "Searching…" : "Search"}
                </button>
              </div>
            </div>
          </div>

          {foundGroup && (
            <div
              data-testid="search-group-result"
              className="flex flex-col gap-3 p-4 rounded-panel"
              style={{ border: '1px solid var(--c-border)', background: 'var(--c-surface)' }}
            >
              <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-mono font-medium" style={{ color: 'var(--c-accent)' }}>
                  {foundGroup.name}
                </h2>
                <p className="text-xs font-mono" style={{ color: 'var(--c-text-muted)' }}>
                  /g/{foundGroup.slug}
                </p>
                {foundGroup.description && (
                  <p className="text-xs font-mono mt-1" style={{ color: 'var(--c-text-dim)' }}>
                    {foundGroup.description}
                  </p>
                )}
              </div>
              <button
                data-testid="join-group-button"
                onClick={handleJoin}
                disabled={joinGroupMutation.isPending}
                className="btn-primary self-start"
              >
                {joinGroupMutation.isPending ? "Joining…" : "Join Group"}
              </button>
            </div>
          )}

          {(searchError || joinGroupMutation.error) && (
            <p data-testid="search-group-error" className="text-xs font-mono" style={{ color: '#ff6b6b' }}>
              {searchError ||
                (joinGroupMutation.error instanceof Error
                  ? joinGroupMutation.error.message
                  : "Failed to join group")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
