import React from "react";
import { Hash, Plus } from "lucide-react";
import { deriveSlug } from "../../utils/urlRouting";
import { useRouter } from "@tanstack/react-router";
import type { Channel } from "../../types";
import { TreeView } from "./TreeView";
import type { TreeNode } from "./TreeView";

interface Group {
  id: string;
  name: string;
  slug: string;
  icon_url?: string;
}

type ChannelPartial = Pick<Channel, "id" | "name">;

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
  const router = useRouter();

  const treeData: TreeNode[] = groups.map((group) => {
    const groupChannels = channels[group.id] || [];

    const channelNodes: TreeNode[] = groupChannels.map((channel) => ({
      id: channel.id,
      label: channel.name,
      testId: `channel-item-${channel.id}`,
      hideAction: true,
      data: { type: "channel", channel, group },
    }));

    const newChannelNode: TreeNode = {
      id: `${group.id}__new-channel`,
      label: "New Channel",
      testId: "create-channel-button",
      hideAction: true,
      data: { type: "new-channel", group },
    };

    return {
      id: group.id,
      label: group.name,
      testId: `group-item-${group.id}`,
      data: { type: "group", group },
      children: [newChannelNode, ...channelNodes],
    };
  });

  const handleNodeClick = (node: TreeNode) => {
    if (node.data?.type === "group") {
      const group = node.data.group as Group;
      onSelectGroup(group.id);
      router.navigate({ to: "/g/$groupSlug", params: { groupSlug: group.slug } });
    } else if (node.data?.type === "channel") {
      const { channel, group } = node.data as { channel: ChannelPartial; group: Group };
      onSelectChannel(channel.id);
      router.navigate({
        to: "/g/$groupSlug/$channelSlug",
        params: { groupSlug: group.slug, channelSlug: deriveSlug(channel.name) },
      });
    } else if (node.data?.type === "new-channel") {
      const group = node.data.group as Group;
      onSelectGroup(group.id);
      onCreateChannel?.();
    }
  };

  const handleNodeAction = (node: TreeNode) => {
    if (node.data?.type === "group") {
      const group = node.data.group as Group;
      router.navigate({ to: "/g/$groupSlug/settings", params: { groupSlug: group.slug } });
    }
  };

  // Collapsed: show group initials stacked on the right edge
  if (isCollapsed) {
    return (
      <div data-testid="groups-list" className="flex-1 overflow-y-auto min-h-0 py-1">
        {groups.map((group) => {
          const isSelected = selectedGroupId === group.id;
          return (
            <button
              key={group.id}
              data-testid={`group-item-${group.id}`}
              onClick={() => {
                onSelectGroup(group.id);
                router.navigate({ to: "/g/$groupSlug", params: { groupSlug: group.slug } });
              }}
              title={group.name}
              aria-label={`Group ${group.name}`}
              className="sidebar-item w-full justify-end"
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-2xs font-mono font-bold flex-shrink-0"
                style={{
                  background: isSelected ? "var(--c-active)" : "var(--c-hover)",
                  color: isSelected ? "var(--c-accent)" : "var(--c-text-dim)",
                  border: isSelected
                    ? "1px solid var(--c-border-active)"
                    : "1px solid var(--c-border)",
                }}
              >
                {group.name.charAt(0).toUpperCase()}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  const selectedId = selectedChannelId || selectedGroupId;

  return (
    <div data-testid="groups-list" className="flex-1 overflow-y-auto min-h-0 py-1 px-1">
      {groups.length === 0 ? (
        <p className="px-3 py-2 text-xs" style={{ color: "var(--c-text-muted)" }}>
          No groups yet.
        </p>
      ) : (
        <TreeView
          data={treeData}
          selectedId={selectedId}
          onNodeClick={handleNodeClick}
          onNodeAction={handleNodeAction}
          getNodeIcon={(node) => {
            if (node.data?.type === "channel") {
              return Hash as any;
            }
            if (node.data?.type === "new-channel") {
              return Plus as any;
            }
            return undefined;
          }}
          defaultExpandedIds={selectedGroupId ? [selectedGroupId] : []}
        />
      )}
    </div>
  );
};
