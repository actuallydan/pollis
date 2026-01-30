import React from "react";
import { Hash, Plus, Settings } from "lucide-react";
import { Header, Paragraph } from "monopollis";
import { updateURL, deriveSlug } from "../../utils/urlRouting";
import { Channel } from "../../types";

interface Group {
  id: string;
  name: string;
  slug: string;
  icon_url?: string;
}

type ChannelPartial = Pick<Channel, "id" | "name">

interface GroupsListProps {
  groups: Group[];
  channels: Record<string, ChannelPartial[]>;
  selectedGroupId: string | null;
  selectedChannelId: string | null;
  isCollapsed: boolean;
  onSelectGroup: (groupId: string) => void;
  onSelectChannel: (channelId: string) => void;
  onCreateChannel?: () => void;
}

export const GroupsList: React.FC<GroupsListProps> = ({
  groups,
  channels,
  selectedGroupId,
  selectedChannelId,
  isCollapsed,
  onSelectGroup,
  onSelectChannel,
  onCreateChannel,
}) => {
  const groupChannels = selectedGroupId ? channels[selectedGroupId] || [] : [];

  return (
    <div className="flex-1 overflow-y-auto">
      {groups.length === 0 ? (
        !isCollapsed && (
          <div className="p-4 text-center">
            <Paragraph size="sm" className="text-orange-300/50">
              No groups yet. Create one to get started.
            </Paragraph>
          </div>
        )
      ) : (
        <div className={isCollapsed ? "py-2 space-y-1" : "py-2"}>
          {groups.map((group) => (
            <div key={group.id} className={isCollapsed ? "" : "mb-2"}>
              <button
                onClick={() => {
                  onSelectGroup(group.id);
                  updateURL(`/g/${group.slug}`);
                }}
                className={`group ${
                  isCollapsed
                    ? "w-9 h-9 flex items-center justify-center mx-auto rounded-md hover:bg-orange-300/10 transition-colors"
                    : "w-full px-4 py-2 text-left hover:bg-orange-300/10 transition-colors"
                } ${
                  selectedGroupId === group.id
                    ? isCollapsed
                      ? "bg-orange-300/20"
                      : "bg-orange-300/20 border-l-2 border-orange-300"
                    : ""
                }`}
                title={isCollapsed ? group.name : undefined}
              >
                {isCollapsed ? (
                  <div className="w-6 h-6 rounded bg-orange-300/20 flex items-center justify-center overflow-hidden">
                    {group.icon_url ? (
                      <img
                        src={group.icon_url}
                        alt={group.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-orange-300 font-bold text-xs">
                        {group.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {group.icon_url ? (
                      <img
                        src={group.icon_url}
                        alt={group.name}
                        className="w-6 h-6 rounded flex-shrink-0 object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded bg-orange-300/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-orange-300 font-bold text-xs">
                          {group.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <Header
                      size="sm"
                      className="text-orange-300 flex-1 min-w-0 truncate"
                    >
                      {group.name}
                    </Header>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateURL(`/g/${group.slug}/settings`);
                        window.dispatchEvent(new PopStateEvent("popstate"));
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-all"
                      aria-label={`Settings for ${group.name}`}
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </button>

              {/* Channels for this group */}
              {selectedGroupId === group.id && !isCollapsed && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {onCreateChannel && (
                    <button
                      onClick={onCreateChannel}
                      className="w-full px-4 py-1.5 text-left flex items-center gap-2 hover:bg-orange-300/10 transition-colors rounded text-orange-300/70 text-sm"
                      aria-label="Create channel"
                    >
                      <Plus className="w-4 h-4 flex-shrink-0" />
                      <span className="font-mono">Create Channel</span>
                    </button>
                  )}

                  {groupChannels.length === 0 ? (
                    <div className="px-4 py-2">
                      <Paragraph size="sm" className="text-orange-300/50">
                        No channels. Create one?
                      </Paragraph>
                    </div>
                  ) : (
                    groupChannels.map((channel) => {
                      const channelSlug = deriveSlug(channel.name);
                      return (
                        <button
                          key={channel.id}
                          onClick={() => {
                            onSelectChannel(channel.id);
                            updateURL(`/g/${group.slug}/${channelSlug}`);
                          }}
                          className={`w-full px-4 py-1.5 text-left flex items-center gap-2 hover:bg-orange-300/10 transition-colors rounded ${
                            selectedChannelId === channel.id
                              ? "bg-orange-300/20 text-orange-300"
                              : "text-orange-300/80"
                          }`}
                          aria-label={`Channel ${channel.name}`}
                        >
                          <Hash className="w-4 h-4 flex-shrink-0" />
                          <span className="font-mono text-sm truncate">
                            {channel.name}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
