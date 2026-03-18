import React from "react";
import { Hash, Plus, Settings } from "lucide-react";
import { updateURL, deriveSlug } from "../../utils/urlRouting";
import { Channel } from "../../types";
import { Link } from "@tanstack/react-router";

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
    <div data-testid="groups-list">
      {groups.length === 0 ? (
        !isCollapsed && (
          <div>
            <p>No groups yet. Create one to get started.</p>
          </div>
        )
      ) : (
        <div>
          {groups.map((group) => (
            <div key={group.id}>
              <button
                data-testid={`group-item-${group.id}`}
                onClick={() => {
                  onSelectGroup(group.id);
                  updateURL(`/g/${group.slug}`);
                }}
                title={isCollapsed ? group.name : undefined}
                aria-label={`Group ${group.name}`}
              >
                {isCollapsed ? (
                  <div>
                    {group.icon_url ? (
                      <img src={group.icon_url} alt={group.name} />
                    ) : (
                      <span>{group.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                ) : (
                  <div>
                    {group.icon_url ? (
                      <img src={group.icon_url} alt={group.name} />
                    ) : (
                      <div>
                        <span>{group.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <h3>{group.name}</h3>
                    <Link
                      to="/g/$groupSlug/settings"
                      params={{ groupSlug: group.slug }}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`group-settings-link-${group.id}`}
                      aria-label={`Settings for ${group.name}`}
                    >
                      <Settings aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </button>

              {selectedGroupId === group.id && !isCollapsed && (
                <div>
                  {onCreateChannel && (
                    <button
                      data-testid="create-channel-button"
                      onClick={onCreateChannel}
                      aria-label="Create channel"
                    >
                      <Plus aria-hidden="true" />
                      <span>Create Channel</span>
                    </button>
                  )}

                  {groupChannels.length === 0 ? (
                    <div>
                      <p>No channels. Create one?</p>
                    </div>
                  ) : (
                    groupChannels.map((channel) => {
                      const channelSlug = deriveSlug(channel.name);
                      return (
                        <button
                          key={channel.id}
                          data-testid={`channel-item-${channel.id}`}
                          onClick={() => {
                            onSelectChannel(channel.id);
                            updateURL(`/g/${group.slug}/${channelSlug}`);
                          }}
                          aria-label={`Channel ${channel.name}`}
                        >
                          <Hash aria-hidden="true" />
                          <span>{channel.name}</span>
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
